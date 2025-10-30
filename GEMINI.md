# GEMINI.md

This file provides guidance to Gemini when working with code in this repository.

## Project Overview

This is a VS Code extension that translates values for specific keys in YAML or JSON files. It provides a read-only preview without modifying the original file and supports multiple translation providers.

## Development Commands

### Setup and Dependencies

```bash
# Install dependencies (uses pnpm)
pnpm install

# Compile TypeScript
pnpm run compile

# Watch mode (auto-recompile on changes)
pnpm run watch

# Run tests
pnpm test
```

### Testing and Debugging

```bash
# Run all tests
pnpm test

# Test in VS Code Extension Development Host
# Press F5 in VS Code with this project open
```

### Building and Packaging

```bash
# Package extension (uses local dev dependency)
npx @vscode/vsce package

# Install locally for testing
code --install-extension key-translator-*.vsix
```

## Architecture Overview

The extension follows a modular architecture with clear separation of concerns:

### Core Components

- **`src/extension.ts`** - Main extension entry point, handles commands and orchestration
- **`src/parser/`** - YAML/JSON parsing with format preservation
  - `yamlParser.ts` - YAML CST-based parsing that maintains exact formatting
  - `jsonParser.ts` - JSON parsing with quote handling
  - `factory.ts` - Parser factory based on language ID
- **`src/translator/`** - Translation provider implementations
  - `macosShortcutsProvider.ts` - macOS Shortcuts integration (free, local)
  - `openaiProvider.ts` - OpenAI API integration
  - `googleProvider.ts` - Google Translate API integration
  - `tencentProvider.ts` - Tencent Translate TMT integration
- **`src/preview/`** - Virtual document preview system
  - `previewProvider.ts` - Read-only preview with custom scheme
- **`src/cache/`** - Two-level caching system
  - `cacheManager.ts` - Phrase-level and file-level caching

### Key Data Flow

1. Parse YAML/JSON using CST-aware parsers that preserve formatting
2. Identify translatable nodes based on key matching rules
3. Check phrase cache and file fingerprint cache
4. Translate uncached content in batches with concurrency control
5. Apply translations while preserving original structure
6. Display in virtual preview document with custom URI scheme

### Translation Providers

- **macOS Shortcuts**: Uses system Shortcuts app, requires macOS 12+
- **OpenAI**: Compatible with OpenAI API and LLMs (configurable endpoint)
- **Google**: Google Cloud Translation API
- **Tencent**: Tencent Cloud TMT API
- **Mock**: Test provider that prefixes with `[中文]`

## Key Features

### Format Preservation

- Maintains original indentation, comments, quote styles
- Supports block scalars (`|` and `>`)
- Preserves YAML anchors and aliases
- Handles nested structures and arrays

### Smart Content Handling

- Automatically skips Jinja templates (`{{ var }}`, `{% if %}`)
- Skips code expressions (`${variable}`)
- Configurable key matching (exact, contains, regex)

### Caching Strategy

- **Phrase cache**: Cross-file translation caching
- **File fingerprint**: Fast reuse of entire file translations using SHA-1
- LRU eviction with configurable size limits
- Global or workspace-scoped caching

## Configuration

The extension uses VS Code settings under `keyTranslator.*` prefix:

- **Provider selection**: `provider` (macos_shortcuts, openai, google, tencent, mock)
- **Language settings**: `sourceLanguage`, `targetLanguage` (top-level settings)
- **Translation targets**: `keysToTranslate`, `keyMatchMode`, `translateComments`
- **Cache settings**: `cache.enabled`, `cache.scope`, `cache.maxEntries`
- **Provider options**: API keys (under `openai`, `google`, `tencent`), models, batch sizes, timeouts
- **Prompt customization**: System and user prompts with placeholders

## Testing

Tests are located in `src/test/suite/` and cover:

- Parser functionality with complex YAML structures
- Cache operations and eviction
- Translation provider integration
- Replacement logic and edge cases

## Important Implementation Details

### YAML Parsing

Uses the `yaml` library with CST (Concrete Syntax Tree) to maintain exact formatting. This is critical for preserving comments, indentation, and structure when applying translations.

### Virtual Documents

Uses custom URI scheme `key-translator-preview:` to show translated content without modifying original files.

### Concurrency and Performance

- Batch translation with configurable limits
- Concurrent request handling with rate limiting
- Retry logic with exponential backoff
- Progress reporting with cancellation support

### Security and Privacy

- No telemetry or analytics
- Local cache storage only
- API keys stored in VS Code settings (encrypted)
- macOS Shortcuts provider works completely offline

## Troubleshooting

### `command 'keyTranslator.translateFile' not found` Error

If you encounter the `command 'keyTranslator.translateFile' not found` error after installing the packaged `.vsix` file, it is likely due to an issue with how dependencies are bundled during the build process.

**Symptoms:**

- A VS Code notification shows the error: `command 'keyTranslator.translateFile' not found`.
- The extension host logs show an error like `Cannot find module './impl/format'`.

**Cause:**
This error occurs because `esbuild`, the bundler used in this project, incorrectly bundles the `jsonc-parser` dependency. It preserves an AMD-style `define` or `require` call that points to a non-existent file (`impl/format`), causing the extension to fail during activation. Because activation fails, the commands are never registered.

**Solution:**
The fix is to force `esbuild` to use the ESM-compatible version of `jsonc-parser`. This is done by adding the `--main-fields=module,main` flag to the `esbuild` command in `package.json`.

The `esbuild-base` script in `package.json` should look like this:

```json
"esbuild-base": "esbuild ./src/extension.ts --bundle --outfile=extension/out/extension.js --external:vscode --format=cjs --platform=node --main-fields=module,main"
```

This ensures that all dependencies are correctly bundled into the final `extension.js` file, and the extension activates properly.
