export interface NodeInfo {
  keyPath: string[];
  key: string;
  startOffset: number;
  endOffset: number;
  originalText: string;
  value: string;
  isBlockScalar: boolean;
  quoteType: "single" | "double" | "none";
  blockType?: "literal" | "folded";
  indentLevel?: number;
  skipReason?: string;
  isComment?: boolean;
  replaceInsideQuotes?: boolean;
}

export interface Replacement {
  startOffset: number;
  endOffset: number;
  replacementText: string;
  meta?: NodeInfo;
}

export interface TranslatorConfig {
  provider: string;
  sourceLanguage: string;
  targetLanguage: string;
  keysToTranslate: string[];
  keyMatchMode: "exact" | "contains" | "regex";
  translateComments: boolean;
  skipPatterns: string[];
  cache: {
    enabled: boolean;
    scope: "global" | "workspace";
    maxEntries: number;
  };
  providerOptions: {
    maxBatchSize: number;
    concurrency: number;
    retries: number;
    timeoutMs: number;
  };
  macos?: {
    shortcutsName: string;
  };
  openai?: {
    apiKey: string;
    model: string;
    baseUrl: string;
  };
  google: {
    apiKey: string;
  };
  tencent?: {
    secretId: string;
    secretKey: string;
  };
  promptSettings: {
    systemPrompt: string;
    userPromptSingle: string;
    userPromptMulti: string;
  };
}

export interface TranslationRequestOptions {
  signal?: AbortSignal;
}

export interface TranslationProvider {
  translateBatch(
    texts: string[],
    options?: TranslationRequestOptions,
  ): Promise<Map<string, string>>;
}
