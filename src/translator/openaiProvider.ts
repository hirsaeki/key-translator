import { TranslationProvider, TranslatorConfig } from "../types";

export class OpenAIProvider implements TranslationProvider {
  private config: TranslatorConfig;

  constructor(config: TranslatorConfig) {
    this.config = config;
  }

  async translateBatch(texts: string[]): Promise<Map<string, string>> {
    if (!this.config.openai?.apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    if (texts.length === 0) {
      return new Map();
    }

    const from = this.config.sourceLanguage;
    const to = this.config.targetLanguage;
    const isBatch = texts.length > 1;

    let requestBody: any;
    const systemPrompt = this.config.promptSettings.systemPrompt
      .replace(/{{from}}/g, from)
      .replace(/{{to}}/g, to);

    if (isBatch) {
      const jsonInput = texts.map((text, index) => ({
        id: String(index),
        text,
      }));
      const textBlock = JSON.stringify(jsonInput);
      const userPrompt = this.config.promptSettings.userPromptMulti
        .replace(/{{from}}/g, from)
        .replace(/{{to}}/g, to)
        .replace(/{{text}}/g, textBlock);

      requestBody = {
        model: this.config.openai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: {
          type: "json_object",
        },
      };
    } else {
      const userPrompt = this.config.promptSettings.userPromptSingle
        .replace(/{{to}}/g, to)
        .replace(/{{text}}/g, texts[0]);

      requestBody = {
        model: this.config.openai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      };
    }

    const response = await fetch(this.config.openai.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.openai.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error("OpenAI API Error:", response.status, response.statusText);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[];
    };
    const content = data.choices[0].message.content.trim();

    const results = new Map<string, string>();

    if (isBatch) {
      try {
        const parsed = JSON.parse(content) as {
          translations: { id: string; text: string }[];
        };
        for (const item of parsed.translations) {
          if (item.id !== undefined && item.text !== undefined) {
            const originalText = texts[parseInt(item.id, 10)];
            results.set(originalText, item.text);
          }
        }
      } catch (error) {
        console.error("Failed to parse JSON response from OpenAI:", error);
        // Fallback: return original texts
        for (const text of texts) {
          results.set(text, text);
        }
      }
    } else {
      results.set(texts[0], content);
    }

    return results;
  }
}
