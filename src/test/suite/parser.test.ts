import * as assert from "assert";
import { YamlParser } from "../../parser/yamlParser";
import { NodeInfo } from "../../types";

suite("YAML Parser Test Suite", () => {
  const parser = new YamlParser();

  test("Simple single-line scalar", () => {
    const yaml = `
models:
  - name: my_model
    description: "This is a sample model."
`;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description", "name"],
      "exact",
      false,
      [],
    );

    assert.strictEqual(nodes.length, 2);
    const descNode = nodes.find((n: NodeInfo) => n.key === "description");
    assert.ok(descNode);
    assert.strictEqual(descNode?.isBlockScalar, false);
    assert.strictEqual(descNode?.quoteType, "double");
  });

  test("Block scalar with literal indicator", () => {
    const yaml = `
models:
  - name: another
    description: |
      Line one.
      Line two with "quotes".
`;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description"],
      "exact",
      false,
      [],
    );

    assert.strictEqual(nodes.length, 1);
    const descNode = nodes[0];
    assert.strictEqual(descNode.isBlockScalar, true);
    assert.strictEqual(descNode.blockType, "literal");
  });

  test("Block scalar with folded indicator", () => {
    const yaml = `
description: >
  This is a folded
  block scalar text.
`;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description"],
      "exact",
      false,
      [],
    );

    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].isBlockScalar, true);
    assert.strictEqual(nodes[0].blockType, "folded");
  });

  test("Skip Jinja templates", () => {
    const yaml = `
models:
  - name: jinja_model
    description: "This model uses {{ var('env') }} in description"
`;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description"],
      "exact",
      false,
      ["{{", "{%", "}}", "%}", "${"],
    );

    assert.strictEqual(nodes.length, 1);
    assert.ok(nodes[0].skipReason);
    assert.ok(nodes[0].skipReason?.includes("template"));
  });

  test("Different quote types", () => {
    const yaml = `
model1:
  description: "double quoted"
model2:
  description: 'single quoted'
model3:
  description: no quotes
`;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description"],
      "exact",
      false,
      [],
    );

    assert.strictEqual(nodes.length, 3);
    assert.strictEqual(nodes[0].quoteType, "double");
    assert.strictEqual(nodes[1].quoteType, "single");
    assert.strictEqual(nodes[2].quoteType, "none");
  });

  test("Key match mode: contains", () => {
    const yaml = `
model_description: "test"
table_description: "test2"
other_field: "test3"
`;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description"],
      "contains",
      false,
      [],
    );

    assert.strictEqual(nodes.length, 2);
    assert.ok(nodes.every((n: NodeInfo) => n.key.includes("description")));
  });

  test("Nested objects", () => {
    const yaml = `
version: 2
models:
  - name: customers
    description: "Customer table"
    columns:
      - name: customer_id
        description: "Primary key"
      - name: email
        description: "Email address"
`;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description"],
      "exact",
      false,
      [],
    );

    assert.strictEqual(nodes.length, 3);
  });

  test("Array of objects", () => {
    const yaml = `
sources:
  - name: raw
    description: "Raw data source"
    tables:
      - name: orders
        description: "Orders table"
      - name: payments
        description: "Payments table"
`;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description"],
      "exact",
      false,
      [],
    );

    assert.strictEqual(nodes.length, 3);
  });

  test("Comments - not translated by default", () => {
    const yaml = `
# This is a comment
models:
  - name: test
    description: "Test model"  # inline comment
`;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description"],
      "exact",
      false,
      [],
    );

    // Only description should be found, not comments
    assert.strictEqual(nodes.length, 1);
    assert.strictEqual(nodes[0].key, "description");
  });

  test("Comments - translated when enabled", () => {
    const yaml = `
# This is a comment
models:
  - name: test
    description: "Test model"
`;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description"],
      "exact",
      true,
      [],
    );

    // Should find both description and comment
    assert.ok(nodes.length > 1);
    assert.ok(nodes.some((n: NodeInfo) => n.key === "comment"));
  });

  test("Empty values", () => {
    const yaml = `
models:
  - name: test
    description: ""
    notes:
`;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description", "notes"],
      "exact",
      false,
      [],
    );

    // Should not include empty values
    assert.strictEqual(nodes.length, 0);
  });

  test("Configurable skip patterns", () => {
    const yaml = `
    description: "This should be skipped because of <<pattern>>"
    `;
    const nodes = parser.collectTranslatableNodes(
      yaml,
      ["description"],
      "exact",
      false,
      ["<<", ">>"],
    );
    assert.strictEqual(nodes.length, 1);
    assert.ok(nodes[0].skipReason);
    assert.ok(nodes[0].skipReason?.includes("template"));
  });
});
