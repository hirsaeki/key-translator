import * as assert from "assert";
import { parseBatchTranslationResponse } from "../../translator/openaiProvider";

suite("OpenAI Provider Test Suite", () => {
  test("Parses translations wrapper", () => {
    const result = parseBatchTranslationResponse(
      JSON.stringify({
        translations: [
          { id: "0", text: "一つ目" },
          { id: "1", text: "二つ目" },
        ],
      }),
      ["First", "Second"],
    );

    assert.strictEqual(result.get("First"), "一つ目");
    assert.strictEqual(result.get("Second"), "二つ目");
  });

  test("Accepts a fenced top-level translation array", () => {
    const result = parseBatchTranslationResponse(
      '```json\n[{"id":"0","text":"翻訳"}]\n```',
      ["Translation"],
    );

    assert.strictEqual(result.get("Translation"), "翻訳");
  });

  test("Rejects malformed batch output instead of returning source text", () => {
    assert.throws(
      () => parseBatchTranslationResponse("not json", ["Original"]),
      SyntaxError,
    );
  });

  test("Rejects missing translation ids", () => {
    assert.throws(
      () =>
        parseBatchTranslationResponse(
          JSON.stringify({ translations: [{ id: "0", text: "一つ目" }] }),
          ["First", "Second"],
        ),
      /missing translation ids: 1/,
    );
  });
});
