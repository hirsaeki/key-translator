import { Parser } from "./types";
import { YamlParser } from "./yamlParser";

import { JsonParser } from "./jsonParser";

/**
 * Returns a parser instance appropriate for the given language ID.
 */
export function getParser(languageId: string): Parser | undefined {
  switch (languageId) {
    case "yaml":
      return new YamlParser();
    case "json":
    case "jsonc":
      return new JsonParser();
    default:
      return undefined;
  }
}
