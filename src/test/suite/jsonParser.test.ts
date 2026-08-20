import * as assert from "assert";
import { JsonParser } from "../../parser/jsonParser";

suite("JSON Parser Test Suite", () => {
  const parser = new JsonParser();

  test("Translates direct string array items under a selected key", () => {
    const json = JSON.stringify({
      included: ["First item", "Second item"],
      untouched: ["Do not translate"],
    });

    const nodes = parser.collectTranslatableNodes(
      json,
      ["included"],
      "exact",
      false,
      [],
    );

    assert.deepStrictEqual(
      nodes.map((node) => node.value),
      ["First item", "Second item"],
    );
    assert.ok(nodes.every((node) => node.key === "included"));
  });

  test("Does not inherit a selected array key into nested objects", () => {
    const json = JSON.stringify({
      included: [{ statement: "Nested object value" }, "Direct item"],
    });

    const nodes = parser.collectTranslatableNodes(
      json,
      ["included"],
      "exact",
      false,
      [],
    );

    assert.deepStrictEqual(nodes.map((node) => node.value), ["Direct item"]);
  });

  test("Keeps skip-pattern handling for string array items", () => {
    const json = JSON.stringify({
      included: ["Translate me", "Keep {{ variable }}"],
    });

    const nodes = parser.collectTranslatableNodes(
      json,
      ["included"],
      "exact",
      false,
      ["{{", "}}"],
    );

    assert.strictEqual(nodes.length, 2);
    assert.strictEqual(nodes[0].skipReason, undefined);
    assert.strictEqual(nodes[1].skipReason, "Contains template markers");
  });
});
