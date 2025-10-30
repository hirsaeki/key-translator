# Key Translator

A VS Code extension that translates content in YAML, JSON, or JSONC files, displaying a read-only preview without modifying the original file.

## Features

- 🌍 **Translate files**: Translates specified keys in YAML, JSON, or JSONC files
- 👀 **Read-only preview**: Shows translation in a side-by-side view without modifying the original
- 💾 **Smart caching**: Two-level cache system for fast repeated translations
- 🔄 **Multiple providers**: Supports macOS Shortcuts, OpenAI, Google Translate, and Tencent Translate
- 📝 **Format preservation**: Maintains original formatting, comments, and YAML structure
- 🎯 **Selective translation**: Skip Jinja templates and code blocks automatically

## Installation

1. Install the extension from VS Code Marketplace (or install `.vsix` manually)
2. Choose your translation provider in settings

## Quick Start

1.  **Install the extension.**
2.  **Configure the provider:**
    - For **macOS (Default)**: Ensure the [Shortcuts app](https://support.apple.com/guide/shortcuts-mac/welcome/mac) is set up with a translation shortcut. You can use the [pre-made one](https://www.icloud.com/shortcuts/028921c9c833428ab08d3556fd9aef22).
    - For **OpenAI/Google/Tencent**: Set your API key in the VS Code settings.
3.  **Set languages:** Configure your `keyTranslator.sourceLanguage` and `keyTranslator.targetLanguage`.
4.  **Define keys:** Specify which keys to translate in `keyTranslator.keysToTranslate` (e.g., `["name", "description"]`).
5.  **Run translation:** Open a YAML/JSON file and click the **🌍 Translate File** button in the editor toolbar.

## Setup

### Option 1: macOS Shortcuts (Default - Free)

This provider runs translations locally on your machine and is completely free.

**Easy Install:** You can get a pre-configured shortcut from this link: [https://www.icloud.com/shortcuts/028921c9c833428ab08d3556fd9aef22](https://www.icloud.com/shortcuts/028921c9c833428ab08d3556fd9aef22). After adding it, you may need to edit the "Translate Text" action to select your desired target language. The default name is `KeyTranslate`.

If you prefer to create the shortcut manually, follow these steps:

1.  Open the **Shortcuts** app on your Mac (macOS 12+ is required).
2.  Create a new Shortcut. You can name it anything, for example `KeyTranslate`.
3.  Add the following actions in this specific order:
    1.  **Get Dictionary from Input**: Set this to get the dictionary from `Shortcut Input`. This action parses the data sent by the extension.
    2.  **Get Value for Key**: Set this to get the value for the key `text` from the `Dictionary` provided by the previous step.
    3.  **Translate Text**: Set this to translate the `Value` from the previous step. Choose the language you want to translate _to_ (e.g., "Chinese, Simplified").
4.  Save the shortcut with a consistent name (e.g., `KeyTranslate`). The final output of the shortcut should automatically be the result of the "Translate Text" action.
5.  In your VS Code settings, configure the provider and your new shortcut's name:
    ```json
    {
      "keyTranslator.provider": "macos_shortcuts",
      "keyTranslator.macos.shortcutsName": "KeyTranslate"
    }
    ```

### Option 2: OpenAI

1. Get an API key from an OpenAI-compatible provider
2. In VS Code settings:

```json
{
  "keyTranslator.provider": "openai",
  "keyTranslator.openai.apiKey": "sk-…",
  "keyTranslator.openai.model": "gpt-3.5-turbo",

  // Optional: for custom OpenAI-compatible endpoints
  "keyTranslator.openai.apiUrl": "http://localhost:8080/v1/chat/completions"
}
```

### Option 3: Google Translate

1. Get an API key from Google Cloud Console
2. In VS Code settings:

```json
{
  "keyTranslator.provider": "google",
  "keyTranslator.google.apiKey": "YOUR_API_KEY"
}
```

### Option 4: Tencent Translate

1. Get a Secret ID and Secret Key from the [Tencent Cloud CAM console](https://console.cloud.tencent.com/cam/capi)
2. In VS Code settings:

```json
{
  "keyTranslator.provider": "tencent",
  "keyTranslator.tencent.secretId": "YOUR_SECRET_ID",
  "keyTranslator.tencent.secretKey": "YOUR_SECRET_KEY"
}
```

## Usage

1. Open any YAML (`.yml`), JSON (`.json`), or JSONC (`.jsonc`) file
2. Click the **🌍 Translate File** button in the editor toolbar
3. View the translated preview in the side panel
4. Use additional buttons to:
   - **Copy** translation to clipboard
   - **Open Diff** view to compare original and translated
   - **Refresh** translation

## Example: Translation Preview

Here's an example of the extension in action, showing how it handles a YAML file with embedded Jinja templates. The extension intelligently skips the template expressions (highlighted in the preview) while translating the surrounding text content.

![Translation Preview](https://github.com/yingyingqiqi/key-translator/raw/master/image/translation_preview.png)

## Configuration

### Basic Settings

```json
{
  // Translation provider
  "keyTranslator.provider": "macos_shortcuts",

  // Keys to translate (case-sensitive)
  "keyTranslator.keysToTranslate": ["description", "name"],

  // Key matching mode: "exact" | "contains" | "regex"
  "keyTranslator.keyMatchMode": "exact",

  // Source and target languages (full name or language code)
  "keyTranslator.sourceLanguage": "English",
  "keyTranslator.targetLanguage": "Chinese",

  // Translate comments (# ...)
  "keyTranslator.translateComments": false,

  // Patterns to skip translation
  "keyTranslator.skipPatterns": ["{{", "{%", "}}", "%}", "${"]
}
```

### Cache Settings

```json
{
  // Enable caching
  "keyTranslator.cache.enabled": true,

  // Cache scope: "global" (all workspaces) | "workspace" (current workspace only)
  "keyTranslator.cache.scope": "global",

  // Maximum cache entries (LRU eviction)
  "keyTranslator.cache.maxEntries": 10000
}
```

### Provider Options

```json
{
  // Maximum texts per batch request
  "keyTranslator.providerOptions.maxBatchSize": 50,

  // Maximum concurrent requests
  "keyTranslator.providerOptions.concurrency": 3,

  // Retry attempts for failed requests
  "keyTranslator.providerOptions.retries": 3,

  // Request timeout (milliseconds)
  "keyTranslator.providerOptions.timeoutMs": 20000
}
```

### Advanced: Prompt Customization

For LLM-based providers like OpenAI, you can customize the translation prompts.

- `{{from}}` and `{{to}}` are replaced with the source/target languages.
- `{{text}}` is replaced with the content to be translated.

```json
{
  "keyTranslator.promptSettings.systemPrompt": "You are a professional {{to}} native translator...",
  "keyTranslator.promptSettings.userPromptSingle": "Translate to {{to}}:\n\n{{text}}",
  "keyTranslator.promptSettings.userPromptMulti": "Translate the `text` fields... Input: {{text}}"
}
```

> **Note**: These are example customizations. The extension provides sensible defaults, so you only need to customize these if you want to change the default behavior.

## How It Works

1. **Parse YAML**: Uses the `yaml` library to parse YAML with CST (Concrete Syntax Tree)
2. **Match keys**: Finds all values for specified keys (respects nesting, arrays, etc.)
3. **Check cache**: Looks up translations in local cache (phrase-level and file-level)
4. **Translate**: Sends uncached texts to translation provider in batches
5. **Apply replacements**: Replaces original text while preserving formatting
6. **Show preview**: Displays translated content in a virtual document

## Features in Detail

### Format Preservation

The extension preserves:

- ✅ Original indentation
- ✅ Comments (including inline comments)
- ✅ Quote styles (single, double, or none)
- ✅ Block scalars (`|` and `>`)
- ✅ YAML anchors and aliases
- ✅ All other YAML structures

### Smart Skipping

Automatically skips translating content that contains certain patterns. By default, it skips:

- Jinja templates: `{{ var }}`, `{% if %}`
- Code expressions: `${variable}`
- Empty or null values

You can customize the patterns to skip in the settings with `keyTranslator.skipPatterns`.

Skipped items are logged in the Output panel.

### Two-Level Cache

1. **Phrase cache**: Normalizes and caches individual translations across all files
2. **File fingerprint**: Tracks file changes using SHA-1 hash to reuse entire translation

## Commands

- `Key Translator: Translate File` - Translate current file
- `Key Translator: Copy Translation to Clipboard` - Copy preview content
- `Key Translator: Open Diff with Original` - Show side-by-side diff
- `Key Translator: Refresh Translation` - Re-translate (bypasses cache)

## Known Limitations

1. **Template handling**: Complex Jinja/template mixing is skipped by default
2. **Custom YAML tags**: Non-standard YAML tags may not be fully supported
3. **Very large files**: Files with 1000+ translatable nodes may be slow
4. **macOS only**: Shortcuts provider only works on macOS 12+

## Troubleshooting

### "Shortcuts CLI not available"

- Ensure you're on macOS 12 (Monterey) or later
- Open Shortcuts.app at least once to initialize
- Try running `shortcuts list` in Terminal

### "Translation failed"

- Check Output panel (View → Output → Key Translator) for details
- Verify API keys are correct (for OpenAI/Google)
- Check internet connection
- Try reducing `maxBatchSize` if hitting rate limits

### "Nothing translated"

- Verify your YAML file contains keys matching `keysToTranslate`
- Check if content contains template markers (will be skipped)
- Try changing `keyMatchMode` to "contains"

### `command 'keyTranslator.translateFile' not found`

If you see this error after installing a packaged `.vsix` file, it's likely due to a bundling issue with the `jsonc-parser` dependency.

**Solution for Developers:**
This is resolved by ensuring `esbuild` uses the correct module version. The build script in `package.json` has been updated with the `--main-fields=module,main` flag to fix this. If you are building the extension from source, ensure this flag is present in the `esbuild-base` script.

## Privacy & Data

- ✅ No telemetry or analytics
- ✅ All cache stored locally in VS Code storage
- ✅ API keys stored in VS Code settings (encrypted by VS Code)
- ⚠️ Text sent to external APIs (OpenAI/Google/Tencent) per provider
- ✅ macOS Shortcuts runs locally (no external API)

## Contributing

Found a bug or have a feature request? Please open an issue on GitHub!

<details>
<summary>Developer Guide</summary>

### Build Instructions

#### Prerequisites

- Node.js 16+ and pnpm
- VS Code 1.80+

#### Setup

```bash
# Clone this repository and navigate into it

# Install dependencies
pnpm install
```

<br>

#### Local Development & Pre-commit Hooks

This project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks, ensuring code quality and security before it gets committed. All checks are run automatically when you use `git commit`.

**On `git commit`:**

- **Linting & Formatting**: `eslint` (including `eslint-plugin-security` for code patterns) and `prettier` are run on staged files via `lint-staged`.
- **Secret Scanning**: `secretlint` scans for any accidentally committed API keys, passwords, or other secrets.
- **TypeScript Compilation**: The entire project is checked for type errors with `tsc`.
- **Tests**: The full test suite is run with `pnpm test`.
- **Dependency Audit**: `pnpm audit` checks for known vulnerabilities in project dependencies.

If any of these checks fail, the commit will be aborted.

<br>

#### Development

```bash
# Compile TypeScript in watch mode
pnpm run watch

# Run tests
pnpm test
```

#### Testing in VS Code

1. Press `F5` to open the Extension Development Host window.
2. In the new window, open a YAML, JSON, or JSONC file.
3. Run the translation command to test the extension.

#### Package & Publish

**Note on `pnpm`, `esbuild`, and `vsce`:**

When packaging the extension, dependencies are bundled using `esbuild`. A critical detail is that some dependencies, like `jsonc-parser`, require a specific module format to be bundled correctly.

**Solution:**

To resolve this, we use two main strategies:

1.  The `esbuild` command in `package.json` includes the `--main-fields=module,main` flag. This tells `esbuild` to prefer the ESM version of dependencies, which avoids bundling issues.
2.  We use the `--no-dependencies` flag with `vsce`, as all dependencies are already included in the `esbuild` bundle.

```bash
# Package the extension into a .vsix file
pnpm run package

# Publish to the marketplace (requires PAT)
pnpm run publish
```

</details>

## License

Apache License 2.0 - see [LICENSE.txt](LICENSE.txt) file

## Changelog

See [CHANGELOG.md](CHANGELOG.md)
