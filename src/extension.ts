import * as vscode from "vscode";
import { getParser } from "./parser/factory";
import { escapeJsonString } from "./utils/stringEscaping";
import {
  TranslationPreviewProvider,
  applyReplacementsToSource,
} from "./preview/previewProvider";
import { CacheManager } from "./cache/cacheManager";
import { translateBatch } from "./translator/index";
import { MacOSShortcutsProvider } from "./translator/macosShortcutsProvider";
import { OpenAIProvider } from "./translator/openaiProvider";
import { GoogleProvider } from "./translator/googleProvider";
import { TencentProvider } from "./translator/tencentProvider";
import {
  TranslatorConfig,
  NodeInfo,
  Replacement,
  TranslationProvider,
} from "./types";

let previewProvider: TranslationPreviewProvider;
let cacheManager: CacheManager;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel("Key Translator");

  // Initialize cache manager
  const config = getConfig();
  cacheManager = new CacheManager(
    context,
    config.cache.maxEntries,
    config.cache.scope,
  );

  // Register preview provider
  previewProvider = new TranslationPreviewProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      "key-translator-preview",
      previewProvider,
    ),
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "keyTranslator.translateFile",
      translateFile,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("keyTranslator.copyPreview", copyPreview),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("keyTranslator.openDiff", openDiff),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "keyTranslator.refresh",
      refreshTranslation,
    ),
  );

  outputChannel.appendLine("Key Translator activated");
}

async function translateFile(uri?: vscode.Uri) {
  let document: vscode.TextDocument | undefined;
  if (uri) {
    document = await vscode.workspace.openTextDocument(uri);
  } else {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      document = editor.document;
    } else {
      vscode.window.showErrorMessage("No active editor");
      return;
    }
  }

  if (
    document.languageId !== "yaml" &&
    document.languageId !== "json" &&
    document.languageId !== "jsonc"
  ) {
    vscode.window.showErrorMessage("Not a YAML/JSON file");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Translating File...",
      cancellable: false,
    },
    async (progress) => {
      const translatedText = await doTranslate(document, progress, {
        useCache: true,
      });
      if (translatedText) {
        await showPreview(document!.uri, translatedText);
      }
    },
  );
}

async function doTranslate(
  document: vscode.TextDocument,
  progress: vscode.Progress<{ message?: string }>,
  options: { useCache: boolean },
): Promise<string | undefined> {
  try {
    progress.report({ message: "Parsing File..." });

    const config = getConfig();
    const text = document.getText();

    if (options.useCache) {
      const currentFingerprint = cacheManager.computeFileFingerprint(text);
      const cachedFingerprint = cacheManager.getFileFingerprint(document.uri);
      if (config.cache.enabled && cachedFingerprint === currentFingerprint) {
        const previewUri = getPreviewUri(document.uri);
        const cached = previewProvider.getPreviewContent(previewUri);
        if (cached) {
          outputChannel.appendLine(
            "Using cached translation from preview provider",
          );
          return cached;
        }
      }
    }

    const parser = getParser(document.languageId);
    if (!parser) {
      vscode.window.showErrorMessage(
        `Unsupported language: ${document.languageId}`,
      );
      return;
    }

    const nodes = parser.collectTranslatableNodes(
      text,
      config.keysToTranslate,
      config.keyMatchMode,
      config.translateComments,
      config.skipPatterns,
    );

    outputChannel.appendLine(`Found ${nodes.length} translatable nodes`);

    const validNodes = nodes.filter((n) => !n.skipReason);
    const skippedNodes = nodes.filter((n) => n.skipReason);

    if (skippedNodes.length > 0) {
      outputChannel.appendLine(`Skipped ${skippedNodes.length} nodes:`);
      skippedNodes.forEach((n) => {
        outputChannel.appendLine(`  - ${n.keyPath.join(".")}: ${n.skipReason}`);
      });
    }

    if (validNodes.length === 0) {
      vscode.window.showInformationMessage("No translatable content found");
      return;
    }

    progress.report({ message: "Translating..." });

    const textsToTranslate = [...new Set(validNodes.map((n) => n.value))];
    const translations = new Map<string, string>();
    const uncachedTexts: string[] = [];

    for (const text of textsToTranslate) {
      if (config.cache.enabled && options.useCache) {
        const cached = cacheManager.getFromPhraseCache(text);
        if (cached) {
          translations.set(text, cached);
          continue;
        }
      }
      uncachedTexts.push(text);
    }

    outputChannel.appendLine(
      `Cache hits: ${translations.size}, misses: ${uncachedTexts.length}`,
    );

    if (uncachedTexts.length > 0) {
      const provider = getTranslationProvider(config);
      const newTranslations = await translateBatch(
        uncachedTexts,
        provider,
        config.providerOptions,
      );
      for (const [original, translated] of newTranslations) {
        translations.set(original, translated);
        if (config.cache.enabled) {
          await cacheManager.setPhraseCache(original, translated);
        }
      }
    }

    progress.report({ message: "Generating preview..." });

    const replacements: Replacement[] = validNodes.map((node) => {
      let translated = translations.get(node.value) || node.originalText;

      const langId = document.languageId;
      if (
        (langId === "json" || langId === "jsonc") &&
        node.quoteType === "double"
      ) {
        translated = escapeJsonString(translated);
      }

      return {
        startOffset: node.startOffset,
        endOffset: node.endOffset,
        replacementText: translated,
        meta: node,
      };
    });

    const translatedText = applyReplacementsToSource(text, replacements);

    if (config.cache.enabled) {
      const newFingerprint = cacheManager.computeFileFingerprint(text);
      await cacheManager.setFileFingerprint(document.uri, newFingerprint);
    }

    outputChannel.appendLine("Translation completed successfully");
    const stats = cacheManager.getCacheStats();
    outputChannel.appendLine(`Cache: ${stats.size}/${stats.maxSize} entries`);

    return translatedText;
  } catch (error) {
    outputChannel.appendLine(`Error: ${error}`);
    vscode.window.showErrorMessage(`Translation failed: ${error}`);
    return;
  }
}

async function showPreview(originalUri: vscode.Uri, translatedText: string) {
  const previewUri = getPreviewUri(originalUri);
  previewProvider.setPreviewContent(previewUri, translatedText);

  await vscode.commands.executeCommand("vscode.open", previewUri, {
    viewColumn: vscode.ViewColumn.Beside,
    preview: true,
    preserveFocus: true,
  });
}

function getPreviewUri(originalUri: vscode.Uri): vscode.Uri {
  return originalUri.with({
    scheme: "key-translator-preview",
    path: originalUri.path + ".translated",
  });
}

async function copyPreview() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== "key-translator-preview") {
    vscode.window.showErrorMessage("No preview active");
    return;
  }

  const content = editor.document.getText();
  await vscode.env.clipboard.writeText(content);
  vscode.window.showInformationMessage("Translation copied to clipboard");
}

async function openDiff() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== "key-translator-preview") {
    vscode.window.showErrorMessage("No preview active");
    return;
  }

  const previewUri = editor.document.uri;
  const originalUri = previewUri.with({
    scheme: "file",
    path: previewUri.path.replace(".translated", ""),
  });

  await vscode.commands.executeCommand(
    "vscode.diff",
    originalUri,
    previewUri,
    `Original ↔ Translated`,
  );
}

async function refreshTranslation() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let originalUri: vscode.Uri;
  if (editor.document.uri.scheme === "key-translator-preview") {
    originalUri = editor.document.uri.with({
      scheme: "file",
      path: editor.document.uri.path.replace(".translated", ""),
    });
  } else {
    originalUri = editor.document.uri;
  }

  const doc = await vscode.workspace.openTextDocument(originalUri);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Refreshing Translation...",
      cancellable: false,
    },
    async (progress) => {
      const translatedText = await doTranslate(doc, progress, {
        useCache: false,
      });
      if (translatedText) {
        const previewUri = getPreviewUri(doc.uri);
        previewProvider.setPreviewContent(previewUri, translatedText);
        outputChannel.appendLine("Translation refreshed");
      }
    },
  );
}

function getConfig(): TranslatorConfig {
  const config = vscode.workspace.getConfiguration("keyTranslator");

  return {
    provider: config.get("provider", "macos_shortcuts"),
    sourceLanguage: config.get("sourceLanguage", "English"),
    targetLanguage: config.get("targetLanguage", "Chinese"),
    keysToTranslate: config.get("keysToTranslate", ["description", "name"]),
    keyMatchMode: config.get("keyMatchMode", "exact") as any,
    translateComments: config.get("translateComments", false),
    skipPatterns: config.get("skipPatterns", ["{{", "{%", "}}", "%}", "${"]),
    cache: {
      enabled: config.get("cache.enabled", true),
      scope: config.get("cache.scope", "global") as any,
      maxEntries: config.get("cache.maxEntries", 10000),
    },
    providerOptions: {
      maxBatchSize: config.get("providerOptions.maxBatchSize", 50),
      concurrency: config.get("providerOptions.concurrency", 3),
      retries: config.get("providerOptions.retries", 5),
      timeoutMs: config.get("providerOptions.timeoutMs", 60000),
    },
    macos: {
      shortcutsName: config.get("macos.shortcutsName", "Translate to Chinese"),
    },
    openai: {
      apiKey: config.get("openai.apiKey", ""),
      model: config.get("openai.model", "gpt-3.5-turbo"),
      baseUrl: config.get("openai.apiUrl", ""),
    },
    google: {
      apiKey: config.get("google.apiKey", ""),
    },
    tencent: {
      secretId: config.get("tencent.secretId", ""),
      secretKey: config.get("tencent.secretKey", ""),
    },
    promptSettings: {
      systemPrompt: config.get(
        "promptSettings.systemPrompt",
        "You are a professional {{to}} native translator who needs to fluently translate text from {{from}} into {{to}}.\n\n## Translation Rules\n1. Output only the translated content, without explanations or additional content.\n2. The returned translation must maintain exactly the same number of paragraphs and format as the original text.\n3. For content that should not be translated (such as proper nouns, code, etc.), keep the original text.\n\n## OUTPUT FORMAT:\n- **Single paragraph input** → Output translation directly.\n- **Multi-paragraph input** → The input is a YAML array of objects, each with an 'id' and a 'text'. Your output must be a YAML array with the same number of objects, where the 'text' field contains the translation.",
      ),
      userPromptSingle: config.get(
        "promptSettings.userPromptSingle",
        "Translate to {{to}} (output translation only):\n\n{{text}}",
      ),
      userPromptMulti: config.get(
        "promptSettings.userPromptMulti",
        "Translate to {{to}}:\n\n{{text}}",
      ),
    },
  };
}

function getTranslationProvider(config: TranslatorConfig): TranslationProvider {
  switch (config.provider) {
    case "macos_shortcuts":
      return new MacOSShortcutsProvider(config);
    case "openai":
      return new OpenAIProvider(config);
    case "google":
      return new GoogleProvider(config);
    case "tencent":
      return new TencentProvider(config);
    case "mock":
      return {
        translateBatch: async (texts: string[]) => {
          const results = new Map<string, string>();
          texts.forEach((t) => results.set(t, `[中文] ${t}`));
          return results;
        },
      };
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function deactivate() {
  outputChannel.dispose();
}
