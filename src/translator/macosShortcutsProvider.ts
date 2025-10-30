import { exec } from "child_process";
import { promisify } from "util";
import { TranslationProvider, TranslatorConfig } from "../types";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

const execAsync = promisify(exec);

function getLanguageCode(language: string, isSource: boolean): string {
  const lowerLang = language.toLowerCase();
  const mapping: { [key: string]: string } = {
    english: "en_US",
    chinese: "zh_CN",
    "simplified chinese": "zh_CN",
    "traditional chinese": "zh_TW",
    japanese: "ja_JP",
    korean: "ko_KR",
    french: "fr_FR",
    spanish: "es_ES",
    italian: "it_IT",
    german: "de_DE",
    turkish: "tr_TR",
    russian: "ru_RU",
    portuguese: "pt_BR",
    vietnamese: "vi_VN",
    indonesian: "id_ID",
    thai: "th_TH",
    malay: "ms_MY",
    arabic: "ar_AE",
    hindi: "hi_IN",
  };

  const code = mapping[lowerLang];
  if (code) {
    return code;
  }

  if (lowerLang.length === 2 || lowerLang.includes("-")) {
    return lowerLang;
  }

  if (isSource) {
    return "auto";
  }

  throw new Error(
    `Unsupported target language for macOS Shortcuts: ${language}`,
  );
}

export class MacOSShortcutsProvider implements TranslationProvider {
  private config: TranslatorConfig;

  constructor(config: TranslatorConfig) {
    this.config = config;
  }

  async translateBatch(texts: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    if (texts.length === 0) {
      return results;
    }

    await this.checkShortcutsAvailable();

    const tempDir = os.tmpdir();
    const uniqueId = crypto.randomBytes(16).toString("hex");
    const inputPath = path.join(tempDir, `shortcuts-input-${uniqueId}.json`);
    const outputPath = path.join(tempDir, `shortcuts-output-${uniqueId}.txt`);

    try {
      const separator = "_@|@_";
      if (texts.some((t) => t.includes(separator))) {
        throw new Error(
          `Input text cannot contain the translation separator string "${separator}". Please remove it from your source file.`,
        );
      }

      const inputPayload = {
        text: texts.join(separator),
        detectFrom: getLanguageCode(this.config.sourceLanguage, true),
        detectTo: getLanguageCode(this.config.targetLanguage, false),
      };

      await fs.writeFile(inputPath, JSON.stringify(inputPayload, null, 2));

      const shortcutName = this.config.macos?.shortcutsName || "Key.Translate";
      await execAsync(
        `shortcuts run "${shortcutName}" -i "${inputPath}" -o "${outputPath}"`,
        { maxBuffer: 10 * 1024 * 1024 },
      );

      const outputContent = await fs.readFile(outputPath, "utf-8");
      const translations = outputContent.split(separator);

      // Handle cases where a trailing separator might be added by the translation service or shell.
      if (
        translations.length > texts.length &&
        translations[translations.length - 1].trim() === ""
      ) {
        translations.pop();
      }

      if (Array.isArray(translations) && translations.length === texts.length) {
        for (let i = 0; i < texts.length; i++) {
          results.set(texts[i], translations[i]);
        }
      } else {
        throw new Error(
          `Received malformed translation data from Shortcuts. Expected ${texts.length} segments, but got ${translations.length}.`,
        );
      }
    } catch (error) {
      console.error("macOS Shortcuts translation error:", error);
      throw new Error(`Shortcuts translation failed: ${error}`);
    } finally {
      // Clean up temporary files
      await fs
        .unlink(inputPath)
        .catch((err) =>
          console.error(`Failed to delete temp file: ${inputPath}`, err),
        );
      await fs
        .unlink(outputPath)
        .catch((err) =>
          console.error(`Failed to delete temp file: ${outputPath}`, err),
        );
    }
    return results;
  }

  private async checkShortcutsAvailable(): Promise<void> {
    try {
      await execAsync("which shortcuts");
    } catch {
      throw new Error(
        "Shortcuts CLI not available. Please ensure you are on macOS 12+ and Shortcuts.app is installed.",
      );
    }
  }
}
