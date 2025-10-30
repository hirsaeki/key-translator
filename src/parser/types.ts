import { NodeInfo } from "../types";

/**
 * An interface for parsers that can extract translatable
 * nodes from a source text of a specific language (e.g., YAML, JSON).
 */
export interface Parser {
  /**
   * Analyzes the source text and returns an array of nodes
   * that are candidates for translation.
   * @param text The source code of the document.
   * @param keysToTranslate The list of keys whose values should be translated.
   * @param keyMatchMode The mode for matching keys.
   * @param translateComments Whether to extract comments for translation.
   * @returns An array of NodeInfo objects.
   */
  collectTranslatableNodes(
    text: string,
    keysToTranslate: string[],
    keyMatchMode: "exact" | "contains" | "regex",
    translateComments: boolean,
    skipPatterns: string[],
  ): NodeInfo[];
}
