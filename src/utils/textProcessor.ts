import * as crypto from "crypto";

export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function computeHash(text: string): string {
  return crypto.createHash("sha1").update(text, "utf8").digest("hex");
}

export function hasTemplateMarkers(
  text: string,
  skipPatterns: string[],
): boolean {
  if (!skipPatterns || skipPatterns.length === 0) {
    return false;
  }
  return skipPatterns.some((marker) => text.includes(marker));
}

export function escapeYamlString(
  text: string,
  quoteType: "single" | "double" | "none",
): string {
  if (quoteType === "none") {
    return text;
  } else if (quoteType === "single") {
    return text.replace(/'/g, "''");
  } else {
    return text
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n");
  }
}

export function indentLines(text: string, indentLevel: number): string {
  const indent = " ".repeat(indentLevel);
  return text
    .split("\n")
    .map((line) => indent + line)
    .join("\n");
}
