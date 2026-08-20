import { TranslationProvider, TranslatorConfig } from "../types";

export async function translateBatch(
  texts: string[],
  provider: TranslationProvider,
  options: TranslatorConfig["providerOptions"],
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const uniqueTexts = [...new Set(texts)];

  // Split into batches
  const batches: string[][] = [];
  for (let i = 0; i < uniqueTexts.length; i += options.maxBatchSize) {
    batches.push(uniqueTexts.slice(i, i + options.maxBatchSize));
  }

  // Process batches with concurrency control
  const queue = [...batches];
  const active: Promise<void>[] = [];

  while (queue.length > 0 || active.length > 0) {
    while (active.length < options.concurrency && queue.length > 0) {
      const batch = queue.shift()!;
      const promise = processBatchWithRetry(batch, provider, options, results);
      active.push(promise);
      void promise.then(
        () => removeActivePromise(active, promise),
        () => removeActivePromise(active, promise),
      );
    }

    if (active.length > 0) {
      await Promise.race(active);
    }
  }

  return results;
}

function removeActivePromise(active: Promise<void>[], promise: Promise<void>) {
  const index = active.indexOf(promise);
  if (index > -1) {
    active.splice(index, 1);
  }
}

async function processBatchWithRetry(
  batch: string[],
  provider: TranslationProvider,
  options: TranslatorConfig["providerOptions"],
  results: Map<string, string>,
): Promise<void> {
  let lastError: Error | null = null;
  const attempts = Math.max(1, options.retries);

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const batchResults = await Promise.race([
        provider.translateBatch(batch),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Translation timeout")),
            options.timeoutMs,
          ),
        ),
      ]);

      // Merge results
      for (const [key, value] of batchResults) {
        results.set(key, value);
      }

      return;
    } catch (error) {
      lastError = error as Error;
      if (attempt < attempts - 1) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("Batch translation failed");
}
