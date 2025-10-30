import * as assert from "assert";
import * as vscode from "vscode";
import { CacheManager } from "../../cache/cacheManager";

suite("Cache Manager Test Suite", () => {
  let context: vscode.ExtensionContext;
  let cacheManager: CacheManager;
  let smallCacheManager: CacheManager;
  let cache: Map<string, any>;
  let smallCache: Map<string, any>;

  setup(() => {
    cache = new Map();
    smallCache = new Map();
    // Mock extension context
    context = {
      globalState: {
        get: (key: string) => cache.get(key),
        update: async (key: string, value: any) => {
          cache.set(key, value);
        },
        keys: () => Array.from(cache.keys()),
      },
      workspaceState: {
        get: (key: string) => cache.get(key),
        update: async (key: string, value: any) => {
          cache.set(key, value);
        },
        keys: () => Array.from(cache.keys()),
      },
    } as any;

    const smallCacheContext = {
      globalState: {
        get: (key: string) => smallCache.get(key),
        update: async (key: string, value: any) => {
          smallCache.set(key, value);
        },
        keys: () => Array.from(smallCache.keys()),
      },
      workspaceState: {
        get: (key: string) => smallCache.get(key),
        update: async (key: string, value: any) => {
          smallCache.set(key, value);
        },
        keys: () => Array.from(smallCache.keys()),
      },
    } as any;

    cacheManager = new CacheManager(context, 100, "global");
    smallCacheManager = new CacheManager(smallCacheContext, 3, "global");
  });

  test("Get from empty cache returns null", () => {
    const result = cacheManager.getFromPhraseCache("test");
    assert.strictEqual(result, null);
  });

  test("Set and get from cache", async () => {
    await cacheManager.setPhraseCache("Hello", "你好");
    const result = cacheManager.getFromPhraseCache("Hello");
    assert.strictEqual(result, "你好");
  });

  test("Normalized cache key", async () => {
    await cacheManager.setPhraseCache("  Hello   World  ", "你好世界");
    const result = cacheManager.getFromPhraseCache("Hello World");
    assert.strictEqual(result, "你好世界");
  });

  test("LRU eviction", async () => {
    await smallCacheManager.setPhraseCache("A", "甲");
    await smallCacheManager.setPhraseCache("B", "乙");
    await smallCacheManager.setPhraseCache("C", "丙");

    // This should evict 'A'
    await smallCacheManager.setPhraseCache("D", "丁");

    assert.strictEqual(smallCacheManager.getFromPhraseCache("A"), null);
    assert.strictEqual(smallCacheManager.getFromPhraseCache("D"), "丁");
  });

  test("File fingerprint computation", () => {
    const text1 = "version: 2\nmodels:\n  - name: test";
    const text2 = "version: 2\nmodels:\n  - name: test";
    const text3 = "version: 2\nmodels:\n  - name: test2";

    const fp1 = cacheManager.computeFileFingerprint(text1);
    const fp2 = cacheManager.computeFileFingerprint(text2);
    const fp3 = cacheManager.computeFileFingerprint(text3);

    assert.strictEqual(fp1, fp2);
    assert.notStrictEqual(fp1, fp3);
  });

  test("Cache stats", async () => {
    await cacheManager.setPhraseCache("A", "甲");
    await cacheManager.setPhraseCache("B", "乙");

    const stats = cacheManager.getCacheStats();
    assert.strictEqual(stats.size, 2);
    assert.strictEqual(stats.maxSize, 100);
  });

  test("Clear cache", async () => {
    await cacheManager.setPhraseCache("A", "甲");
    await cacheManager.setPhraseCache("B", "乙");

    await cacheManager.clearCache();

    const stats = cacheManager.getCacheStats();
    assert.strictEqual(stats.size, 0);
  });
});
