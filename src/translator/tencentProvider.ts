import * as crypto from "crypto";
import { TranslationProvider, TranslatorConfig } from "../types";

function sha256(
  message: string,
  secret: string | Buffer,
  encoding?: crypto.BinaryToTextEncoding,
): string | Buffer {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(message);
  return encoding ? digest.digest(encoding) : digest.digest();
}

function getHash(
  message: string,
  encoding: crypto.BinaryToTextEncoding = "hex",
) {
  const hash = crypto.createHash("sha256");
  return hash.update(message).digest(encoding);
}

function getDate(timestamp: number) {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = ("0" + (date.getUTCMonth() + 1)).slice(-2);
  const day = ("0" + date.getUTCDate()).slice(-2);
  return `${year}-${month}-${day}`;
}

function getLanguageCode(language: string, isSource: boolean): string {
  const lowerLang = language.toLowerCase();
  const mapping: { [key: string]: string } = {
    english: "en",
    chinese: "zh",
    "simplified chinese": "zh",
    "traditional chinese": "zh-TW",
    japanese: "ja",
    korean: "ko",
    french: "fr",
    spanish: "es",
    italian: "it",
    german: "de",
    turkish: "tr",
    russian: "ru",
    portuguese: "pt",
    vietnamese: "vi",
    indonesian: "id",
    thai: "th",
    malay: "ms",
    arabic: "ar",
    hindi: "hi",
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
    `Unsupported target language for Tencent Translator: ${language}`,
  );
}

interface TencentError {
  Code: string;
  Message: string;
}

interface TencentResponse {
  Response: {
    TargetTextList?: string[];
    Error?: TencentError;
  };
}

export class TencentProvider implements TranslationProvider {
  private config: TranslatorConfig;

  constructor(config: TranslatorConfig) {
    this.config = config;
  }

  async translateBatch(texts: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    if (!this.config.tencent?.secretId || !this.config.tencent?.secretKey) {
      throw new Error("Tencent Secret ID or Secret Key not configured");
    }

    const host = "tmt.tencentcloudapi.com";
    const service = "tmt";
    const region = "ap-guangzhou";
    const action = "TextTranslateBatch";
    const version = "2018-03-21";
    const timestamp = Math.floor(new Date().getTime() / 1000);
    const date = getDate(timestamp);

    const sourceLangCode = getLanguageCode(this.config.sourceLanguage, true);
    const targetLangCode = getLanguageCode(this.config.targetLanguage, false);

    const payload = JSON.stringify({
      Source: sourceLangCode,
      Target: targetLangCode,
      ProjectId: 0,
      SourceTextList: texts,
    });

    const signedHeaders = "content-type;host";
    const hashedRequestPayload = getHash(payload);
    const httpRequestMethod = "POST";
    const canonicalUri = "/";
    const canonicalQueryString = "";
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`;

    const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;

    const algorithm = "TC3-HMAC-SHA256";
    const hashedCanonicalRequest = getHash(canonicalRequest);
    const credentialScope = `${date}/${service}/tc3_request`;
    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

    const kDate = sha256(date, "TC3" + this.config.tencent.secretKey);
    const kService = sha256(service, kDate);
    const kSigning = sha256("tc3_request", kService);
    const signature = sha256(stringToSign, kSigning, "hex");

    const authorization = `${algorithm} Credential=${this.config.tencent.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers = {
      Authorization: authorization,
      "Content-Type": "application/json; charset=utf-8",
      Host: host,
      "X-TC-Action": action,
      "X-TC-Timestamp": String(timestamp),
      "X-TC-Version": version,
      "X-TC-Region": region,
    };

    try {
      const response = await fetch(`https://${host}`, {
        method: httpRequestMethod,
        headers,
        body: payload,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Tencent Translate API error: ${response.statusText}. Body: ${errorBody}`,
        );
      }

      const data = (await response.json()) as TencentResponse;

      if (data.Response.Error) {
        throw new Error(
          `Tencent Translate API error: ${data.Response.Error.Message}`,
        );
      }

      const translations = data.Response.TargetTextList as string[];
      for (let i = 0; i < texts.length && i < translations.length; i++) {
        results.set(texts[i], translations[i]);
      }
    } catch (error) {
      console.error("Tencent Translate error:", error);
      throw error;
    }

    return results;
  }
}
