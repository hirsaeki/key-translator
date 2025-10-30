import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  let extension: vscode.Extension<any> | undefined;

  suiteSetup(async function () {
    this.timeout(5000);
    extension = vscode.extensions.getExtension("yingqi.key-translator");
    if (extension) {
      await extension.activate();
    }
  });

  test("Extension should be present", () => {
    assert.ok(extension);
  });

  test("Extension should be activated", () => {
    assert.ok(extension?.isActive);
  });

  test("Commands should be registered", async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes("keyTranslator.translateFile"));
    assert.ok(commands.includes("keyTranslator.copyPreview"));
    assert.ok(commands.includes("keyTranslator.openDiff"));
    assert.ok(commands.includes("keyTranslator.refresh"));
  });
});
