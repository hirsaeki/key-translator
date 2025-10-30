import * as vscode from "vscode";
import { computeHash, normalizeText } from "../utils/textProcessor";

interface CacheEntry {
  key: string;
  value: string;
  timestamp: number;
}

export class CacheManager {
  private phraseCache: Map<string, CacheEntry> = new Map();
  private fileFingerprintCache: Map<string, string> = new Map();
  private maxEntries: number;
  private context: vscode.ExtensionContext;
  private scope: "global" | "workspace";

  constructor(
    context: vscode.ExtensionContext,
    maxEntries: number,
    scope: "global" | "workspace",
  ) {
    this.context = context;
    this.maxEntries = maxEntries;
    this.scope = scope;
    this.loadFromStorage();
  }

  async loadFromStorage(): Promise<void> {
    const storage =
      this.scope === "global"
        ? this.context.globalState
        : this.context.workspaceState;

    const phraseCacheData = storage.get<any>("phraseCache");
    if (phraseCacheData) {
      this.phraseCache = new Map(
        Object.entries(phraseCacheData).map(([k, v]: [string, any]) => [
          k,
          v as CacheEntry,
        ]),
      );
    }

    const fingerprintData = storage.get<any>("fileFingerprintCache");
    if (fingerprintData) {
      this.fileFingerprintCache = new Map(Object.entries(fingerprintData));
    }
  }

  async saveToStorage(): Promise<void> {
    const storage =
      this.scope === "global"
        ? this.context.globalState
        : this.context.workspaceState;

    const phraseCacheObj = Object.fromEntries(this.phraseCache);
    await storage.update("phraseCache", phraseCacheObj);

    const fingerprintObj = Object.fromEntries(this.fileFingerprintCache);
    await storage.update("fileFingerprintCache", fingerprintObj);
  }

  getFromPhraseCache(text: string): string | null {
    const normalized = normalizeText(text);
    const entry = this.phraseCache.get(normalized);

    if (entry) {
      // Update timestamp for LRU
      entry.timestamp = Date.now();
      return entry.value;
    }

    return null;
  }

  async setPhraseCache(text: string, translation: string): Promise<void> {
    const normalized = normalizeText(text);

    // LRU eviction
    if (this.phraseCache.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.phraseCache.set(normalized, {
      key: normalized,
      value: translation,
      timestamp: Date.now(),
    });

    await this.saveToStorage();
  }

  computeFileFingerprint(text: string): string {
    return computeHash(text);
  }

  getFileFingerprint(uri: vscode.Uri): string | null {
    return this.fileFingerprintCache.get(uri.toString()) || null;
  }

  async setFileFingerprint(
    uri: vscode.Uri,
    fingerprint: string,
  ): Promise<void> {
    this.fileFingerprintCache.set(uri.toString(), fingerprint);
    await this.saveToStorage();
  }

  async clearCache(): Promise<void> {
    this.phraseCache.clear();
    this.fileFingerprintCache.clear();
    await this.saveToStorage();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.phraseCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.phraseCache.delete(oldestKey);
    }
  }

  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.phraseCache.size,
      maxSize: this.maxEntries,
    };
  }
}
