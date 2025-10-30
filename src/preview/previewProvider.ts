import * as vscode from "vscode";
import { Replacement } from "../types";

export class TranslationPreviewProvider
  implements vscode.TextDocumentContentProvider
{
  private previewContent: Map<string, string> = new Map();
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  readonly onDidChange = this._onDidChange.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.previewContent.get(uri.toString()) || "";
  }

  setPreviewContent(uri: vscode.Uri, content: string): void {
    this.previewContent.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }

  getPreviewContent(uri: vscode.Uri): string | undefined {
    return this.previewContent.get(uri.toString());
  }

  clearPreview(uri: vscode.Uri): void {
    this.previewContent.delete(uri.toString());
  }
}

export function applyReplacementsToSource(
  originalText: string,
  replacements: Replacement[],
): string {
  // Sort replacements by startOffset in descending order
  const sorted = [...replacements].sort(
    (a, b) => b.startOffset - a.startOffset,
  );

  let result = originalText;

  for (const replacement of sorted) {
    const { startOffset, endOffset, replacementText, meta } = replacement;

    if (!meta) {
      // Simple replacement
      result =
        result.substring(0, startOffset) +
        replacementText +
        result.substring(endOffset);
      continue;
    }

    // Extract the original value part (without key and colon)
    const before = result.substring(0, startOffset);
    const after = result.substring(endOffset);
    const original = result.substring(startOffset, endOffset);

    let newValue: string;

    if (meta.isComment) {
      const indent = " ".repeat(getIndentLevel(originalText, startOffset));
      newValue = `${indent}# ${replacementText}`;
    } else if (meta.isBlockScalar) {
      // Handle block scalar
      newValue = formatBlockScalar(replacementText, meta, original);
    } else {
      // Handle inline scalar with quotes
      newValue = formatInlineScalar(replacementText, meta.quoteType);
    }

    result = before + newValue + after;
  }

  return result;
}

function getIndentLevel(text: string, offset: number): number {
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

function formatBlockScalar(text: string, meta: any, original: string): string {
  const indicator = meta.blockType === "literal" ? "|" : ">";
  const lines = text.split("\n");
  const indentLevel = meta.indentLevel || 0;
  const contentIndent = indentLevel + 2; // block content typically indented 2 more

  // Find the block indicator line
  const indicatorMatch = original.match(/^(\s*)[|>]/);
  if (!indicatorMatch) {
    // Fallback: simple replacement
    return original.replace(
      /[|>][\s\S]*$/,
      `${indicator}\n` +
        lines.map((l) => " ".repeat(contentIndent) + l).join("\n"),
    );
  }

  const prefix = indicatorMatch[1];
  const indentedLines = lines
    .map((line) => " ".repeat(contentIndent) + line)
    .join("\n");

  return `${prefix}${indicator}\n${indentedLines}`;
}

function formatInlineScalar(
  text: string,
  quoteType: "single" | "double" | "none",
): string {
  if (quoteType === "none") {
    // Check if text needs quoting
    if (text.includes(":") || text.includes("#") || text.includes("\n")) {
      quoteType = "double";
    } else {
      return text;
    }
  }

  if (quoteType === "single") {
    const escaped = text.replace(/'/g, "''");
    return `'${escaped}'`;
  } else {
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
}
