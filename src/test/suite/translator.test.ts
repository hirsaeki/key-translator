import * as assert from "assert";
import { getTranslationOrSource, translateBatch } from "../../translator";
import { TranslationProvider } from "../../types";

suite("Translator Test Suite", () => {
  test("Uses the semantic source value when a translation is missing", () => {
    const source = 'quoted "value" \\ path\nnext';
    assert.strictEqual(getTranslationOrSource(new Map(), source), source);
  });

  test("Preserves an explicit empty translation", () => {
    const translations = new Map([["Original", ""]]);
    assert.strictEqual(getTranslationOrSource(translations, "Original"), "");
  });

  test("Propagates a provider failure after retries are exhausted", async () => {
    const provider: TranslationProvider = {
      translateBatch: async () => {
        throw new Error("invalid batch response");
      },
    };

    await assert.rejects(
      () =>
        translateBatch(["Original"], provider, {
          maxBatchSize: 50,
          concurrency: 1,
          retries: 1,
          timeoutMs: 1000,
        }),
      /invalid batch response/,
    );
  });

  test("Aborts the active provider request on timeout", async () => {
    let aborted = false;
    const provider: TranslationProvider = {
      translateBatch: async (_texts, options) =>
        new Promise<Map<string, string>>((_, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => {
              aborted = true;
              reject(new Error("request aborted"));
            },
            { once: true },
          );
        }),
    };

    await assert.rejects(
      () =>
        translateBatch(["Original"], provider, {
          maxBatchSize: 10,
          concurrency: 1,
          retries: 1,
          timeoutMs: 10,
        }),
      /Translation timeout/,
    );

    assert.strictEqual(aborted, true);
  });
});
