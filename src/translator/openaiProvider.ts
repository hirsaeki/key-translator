import { TranslationProvider, TranslatorConfig } from "../types";

type BatchTranslation = {
  id: string | number;
  text: string;
};

function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

export function parseBatchTranslationResponse(
  content: string,
  texts: string[],
): Map<string, string> {
  const parsed = JSON.parse(stripCodeFence(content)) as unknown;
  let translations: unknown;

  if (Array.isArray(parsed)) {
    translations = parsed;
  } else if (parsed && typeof parsed === "object") {
    translations = (parsed as { translations?: unknown }).translations;
  }

  if (!Array.isArray(translations)) {
    throw new Error(
      "OpenAI batch response must be an array or an object with a translations array",
    );
  }

  const byId = new Map<number, string>();

  for (const rawItem of translations) {
    if (!rawItem || typeof rawItem !== "object") {
      throw new Error("OpenAI batch response contains a non-object item");
    }

    const item = rawItem as Partial<BatchTranslation>;
    const id =
      typeof item.id === "number"
        ? item.id
        : typeof item.id === "string" && /^\d+$/.test(item.id)
          ? Number(item.id)
          : Number.NaN;

    if (!Number.isInteger(id) || id < 0 || id >= texts.length) {
      throw new Error(`OpenAI batch response contains invalid id: ${item.id}`);
    }
    if (byId.has(id)) {
      throw new Error(`OpenAI batch response contains duplicate id: ${id}`);
    }
    if (typeof item.text !== "string") {
      throw new Error(`OpenAI batch response is missing text for id: ${id}`);
    }

    byId.set(id, item.text);
  }

  if (byId.size !== texts.length) {
    const missingIds = texts
      .map((_, index) => index)
      .filter((index) => !byId.has(index));
    throw new Error(
      `OpenAI batch response is missing translation ids: ${missingIds.join(", ")}`,
    );
  }

  const results = new Map<string, string>();
  for (let index = 0; index < texts.length; index++) {
    results.set(texts[index], byId.get(index)!);
  }
  return results;
}

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
        .replace(/{{from}}/g, from)
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
      choices?: { message?: { content?: unknown } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI API response did not contain message content");
    }

    if (isBatch) {
      return parseBatchTranslationResponse(content, texts);
    }

    return new Map([[texts[0], stripCodeFence(content)]]);
  }
}
