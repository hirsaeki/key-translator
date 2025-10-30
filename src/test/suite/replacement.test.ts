import * as assert from "assert";
import { applyReplacementsToSource } from "../../preview/previewProvider";
import { Replacement } from "../../types";

suite("Replacement Test Suite", () => {
  test("Simple inline replacement", () => {
    const original = 'description: "Hello world"';
    const replacements: Replacement[] = [
      {
        startOffset: 13,
        endOffset: 26,
        replacementText: '"你好世界"',
        meta: {
          keyPath: ["description"],
          key: "description",
          startOffset: 13,
          endOffset: 26,
          originalText: '"Hello world"',
          value: "Hello world",
          isBlockScalar: false,
          quoteType: "double",
        },
      },
    ];

    const result = applyReplacementsToSource(original, replacements);
    assert.ok(result.includes("你好世界"));
  });

  test("Multiple replacements", () => {
    const original = `name: "test"
description: "Hello world"`;

    const replacements: Replacement[] = [
      {
        startOffset: 6,
        endOffset: 12,
        replacementText: '"测试"',
        meta: {
          keyPath: ["name"],
          key: "name",
          startOffset: 6,
          endOffset: 12,
          originalText: '"test"',
          value: "test",
          isBlockScalar: false,
          quoteType: "double",
        },
      },
      {
        startOffset: 26,
        endOffset: 39,
        replacementText: '"你好世界"',
        meta: {
          keyPath: ["description"],
          key: "description",
          startOffset: 26,
          endOffset: 39,
          originalText: '"Hello world"',
          value: "Hello world",
          isBlockScalar: false,
          quoteType: "double",
        },
      },
    ];

    const result = applyReplacementsToSource(original, replacements);
    assert.ok(result.includes("测试"));
    assert.ok(result.includes("你好世界"));
  });

  test("Block scalar replacement preserves format", () => {
    const original = `description: |
  Line one
  Line two`;

    const replacements: Replacement[] = [
      {
        startOffset: 0,
        endOffset: original.length,
        replacementText: "第一行\n第二行",
        meta: {
          keyPath: ["description"],
          key: "description",
          startOffset: 0,
          endOffset: original.length,
          originalText: original,
          value: "Line one\nLine two",
          isBlockScalar: true,
          quoteType: "none",
          blockType: "literal",
          indentLevel: 0,
        },
      },
    ];

    const result = applyReplacementsToSource(original, replacements);
    assert.ok(result.includes("|"));
    assert.ok(result.includes("第一行"));
  });

  test("Quote preservation", () => {
    const original = `description: 'single quoted'`;

    const replacements: Replacement[] = [
      {
        startOffset: 13,
        endOffset: 28,
        replacementText: "'单引号'",
        meta: {
          keyPath: ["description"],
          key: "description",
          startOffset: 13,
          endOffset: 28,
          originalText: "'single quoted'",
          value: "single quoted",
          isBlockScalar: false,
          quoteType: "single",
        },
      },
    ];

    const result = applyReplacementsToSource(original, replacements);
    assert.ok(result.includes("'单引号'"));
  });
});
