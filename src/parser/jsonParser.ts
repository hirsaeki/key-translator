import * as jsonc from "jsonc-parser";
import { NodeInfo } from "../types";
import { hasTemplateMarkers } from "../utils/textProcessor";
import { Parser } from "./types";

export class JsonParser implements Parser {
  collectTranslatableNodes(
    text: string,
    keysToTranslate: string[],
    keyMatchMode: "exact" | "contains" | "regex",
    translateComments: boolean,
    skipPatterns: string[],
  ): NodeInfo[] {
    const nodes: NodeInfo[] = [];
    const root = jsonc.parseTree(text);

    if (!root) {
      return [];
    }

    const visited = new Set<jsonc.Node>();

    jsonc.visit(text, {
      onObjectProperty: (
        property,
        offset,
        length,
        startLine,
        startCharacter,
        path,
      ) => {
        const keyNode = jsonc.findNodeAtOffset(root, offset);
        if (!keyNode || visited.has(keyNode)) {
          return;
        }
        visited.add(keyNode);

        const key = jsonc.getNodeValue(keyNode);
        const valueNode = keyNode.parent?.children?.[1];

        if (
          valueNode &&
          this.shouldTranslateKey(key, keysToTranslate, keyMatchMode) &&
          valueNode.type === "string"
        ) {
          const value = jsonc.getNodeValue(valueNode);
          if (
            value &&
            typeof value === "string" &&
            !hasTemplateMarkers(value, skipPatterns)
          ) {
            nodes.push({
              keyPath: path().map((p) => String(p)),
              key: key,
              startOffset: valueNode.offset + 1, // Inside quotes
              endOffset: valueNode.offset + valueNode.length - 1, // Inside quotes
              originalText: text.substring(
                valueNode.offset + 1,
                valueNode.offset + valueNode.length - 1,
              ),
              value: value,
              isBlockScalar: false,
              quoteType: "double", // JSON strings are always double-quoted
            });
          } else if (hasTemplateMarkers(value, skipPatterns)) {
            nodes.push({
              keyPath: path().map((p) => String(p)),
              key: key,
              startOffset: valueNode.offset + 1,
              endOffset: valueNode.offset + valueNode.length - 1,
              originalText: text.substring(
                valueNode.offset + 1,
                valueNode.offset + valueNode.length - 1,
              ),
              value: value,
              isBlockScalar: false,
              quoteType: "double",
              skipReason: "Contains template markers",
            });
          }
        }
      },
    });

    if (translateComments) {
      const commentNodes = this.collectCommentNodes(text, skipPatterns);
      nodes.push(...commentNodes);
    }

    return nodes;
  }

  private collectCommentNodes(
    text: string,
    skipPatterns: string[],
  ): NodeInfo[] {
    const nodes: NodeInfo[] = [];
    const scanner = jsonc.createScanner(text, false);
    let token = scanner.scan();
    let i = 0;
    while (token !== jsonc.SyntaxKind.EOF) {
      if (token === jsonc.SyntaxKind.LineCommentTrivia) {
        const start = scanner.getTokenOffset() + 2; // After //
        const end = start + scanner.getTokenLength() - 2;
        const commentText = text.substring(start, end).trim();
        if (commentText && !hasTemplateMarkers(commentText, skipPatterns)) {
          nodes.push({
            keyPath: [`line-comment-${i++}`],
            key: "comment",
            startOffset: start,
            endOffset: end,
            originalText: text.substring(start, end),
            value: commentText,
            isBlockScalar: false,
            quoteType: "none",
          });
        }
      } else if (token === jsonc.SyntaxKind.BlockCommentTrivia) {
        const start = scanner.getTokenOffset() + 2; // After /*
        const end = scanner.getTokenOffset() + scanner.getTokenLength() - 2; // Before */
        const commentText = text.substring(start, end).trim();
        if (commentText && !hasTemplateMarkers(commentText, skipPatterns)) {
          nodes.push({
            keyPath: [`block-comment-${i++}`],
            key: "comment",
            startOffset: start,
            endOffset: end,
            originalText: text.substring(start, end),
            value: commentText,
            isBlockScalar: false,
            quoteType: "none",
          });
        }
      }
      token = scanner.scan();
    }
    return nodes;
  }

  private shouldTranslateKey(
    key: string,
    keysToTranslate: string[],
    mode: "exact" | "contains" | "regex",
  ): boolean {
    if (mode === "exact") {
      return keysToTranslate.includes(key);
    } else if (mode === "contains") {
      return keysToTranslate.some((k) => key.includes(k));
    } else {
      return keysToTranslate.some((pattern) => {
        try {
          return new RegExp(pattern).test(key);
        } catch {
          return false;
        }
      });
    }
  }
}
