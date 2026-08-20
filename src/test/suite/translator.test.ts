import * as assert from "assert";
import { translateBatch } from "../../translator";
import { TranslationProvider } from "../../types";

suite("Translator Test Suite", () => {
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
});
