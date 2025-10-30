import * as yaml from "yaml";
import { NodeInfo } from "../types";
import { hasTemplateMarkers } from "../utils/textProcessor";
import { Parser } from "./types";

export class YamlParser implements Parser {
  collectTranslatableNodes(
    text: string,
    keysToTranslate: string[],
    keyMatchMode: "exact" | "contains" | "regex",
    translateComments: boolean,
    skipPatterns: string[],
  ): NodeInfo[] {
    const nodes: NodeInfo[] = [];

    try {
      const doc = yaml.parseDocument(text, { keepSourceTokens: true });

      // Traverse the document
      this.traverseNode(
        doc.contents,
        [],
        text,
        keysToTranslate,
        keyMatchMode,
        nodes,
        skipPatterns,
      );

      // Handle comments if enabled
      if (translateComments) {
        this.collectCommentNodes(doc, text, nodes, skipPatterns);
      }
    } catch (error) {
      console.error("YAML parsing error:", error);
    }

    return nodes;
  }

  private traverseNode(
    node: any,
    keyPath: string[],
    sourceText: string,
    keysToTranslate: string[],
    keyMatchMode: "exact" | "contains" | "regex",
    results: NodeInfo[],
    skipPatterns: string[],
  ): void {
    if (!node) {
      return;
    }

    if (yaml.isMap(node)) {
      for (const pair of node.items) {
        const key = yaml.isScalar(pair.key) ? String(pair.key.value) : "";
        const newKeyPath = [...keyPath, key];

        if (
          this.shouldTranslateKey(key, keysToTranslate, keyMatchMode) &&
          yaml.isScalar(pair.value)
        ) {
          const nodeInfo = this.extractScalarInfo(
            pair.value,
            newKeyPath,
            key,
            sourceText,
            skipPatterns,
          );
          if (nodeInfo) {
            results.push(nodeInfo);
          }
        }

        this.traverseNode(
          pair.value,
          newKeyPath,
          sourceText,
          keysToTranslate,
          keyMatchMode,
          results,
          skipPatterns,
        );
      }
    } else if (yaml.isSeq(node)) {
      for (let i = 0; i < node.items.length; i++) {
        this.traverseNode(
          node.items[i],
          [...keyPath, `[${i}]`],
          sourceText,
          keysToTranslate,
          keyMatchMode,
          results,
          skipPatterns,
        );
      }
    }
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
      // regex mode
      return keysToTranslate.some((pattern) => {
        try {
          return new RegExp(pattern).test(key);
        } catch {
          return false;
        }
      });
    }
  }

  private extractScalarInfo(
    node: yaml.Scalar,
    keyPath: string[],
    key: string,
    sourceText: string,
    skipPatterns: string[],
  ): NodeInfo | null {
    if (!node.range) {
      return null;
    }

    const [start, end] = node.range;
    const originalText = sourceText.substring(start, end);
    const value = String(node.value || "");

    // Skip if contains template markers
    if (hasTemplateMarkers(value, skipPatterns)) {
      return {
        keyPath,
        key,
        startOffset: start,
        endOffset: end,
        originalText,
        value,
        isBlockScalar: false,
        quoteType: "none",
        skipReason: "Contains template markers",
      };
    }

    // Skip if empty or not string-like
    if (!value || typeof value !== "string") {
      return null;
    }

    // Determine scalar type
    const isBlockScalar =
      originalText.includes("\n") &&
      (originalText.trimStart().startsWith("|") ||
        originalText.trimStart().startsWith(">"));
    const blockType = originalText.trimStart().startsWith("|")
      ? "literal"
      : originalText.trimStart().startsWith(">")
        ? "folded"
        : undefined;

    // Determine quote type
    let quoteType: "single" | "double" | "none" = "none";
    const trimmed = originalText.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      quoteType = "double";
    } else if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      quoteType = "single";
    }

    return {
      keyPath,
      key,
      startOffset: start,
      endOffset: end,
      originalText,
      value,
      isBlockScalar,
      quoteType,
      blockType,
      indentLevel: this.getIndentLevel(sourceText, start),
    };
  }

  private getIndentLevel(text: string, offset: number): number {
    let pos = offset;
    while (pos > 0 && text[pos - 1] !== "\n") {
      pos--;
    }
    let indent = 0;
    while (pos < text.length && text[pos] === " ") {
      indent++;
      pos++;
    }
    return indent;
  }

  private collectCommentNodes(
    doc: yaml.Document,
    sourceText: string,
    results: NodeInfo[],
    skipPatterns: string[],
  ): void {
    // Simple comment extraction - find lines starting with #
    const lines = sourceText.split("\n");
    let offset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("#")) {
        const commentText = trimmed.substring(1).trim();
        if (commentText && !hasTemplateMarkers(commentText, skipPatterns)) {
          const start = offset + line.indexOf("#");
          const end = offset + line.length;

          results.push({
            keyPath: [`comment-${i}`],
            key: "comment",
            startOffset: start,
            endOffset: end,
            originalText: line.substring(line.indexOf("#")),
            value: commentText,
            isBlockScalar: false,
            quoteType: "none",
            isComment: true,
          });
        }
      }

      offset += line.length + 1; // +1 for \n
    }
  }
}
