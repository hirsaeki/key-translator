import { TranslationProvider, TranslatorConfig } from "../types";

export class GoogleProvider implements TranslationProvider {
  private config: TranslatorConfig;

  constructor(config: TranslatorConfig) {
    this.config = config;
  }

  async translateBatch(texts: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    if (!this.config.google?.apiKey) {
      throw new Error("Google API key not configured");
    }

    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${this.config.google.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: texts,
            source: this.config.sourceLanguage,
            target: this.config.targetLanguage,
            format: "text",
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Google Translate API error: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        data: { translations: { translatedText: string }[] };
      };
      const translations = data.data.translations;

      for (let i = 0; i < texts.length && i < translations.length; i++) {
        results.set(texts[i], translations[i].translatedText);
      }
    } catch (error) {
      console.error("Google Translate error:", error);
      throw error;
    }

    return results;
  }
}
