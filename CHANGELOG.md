# Changelog

All notable changes to the "key-translator" extension will be documented in this file.

## [1.0.0] - 2025-10-28

### Initial Release

- **Translate YAML, JSON, and JSONC files**: Translates values for specific keys in YAML, JSON, or JSONC files.
- **Read-only Preview**: Displays the translated content in a side-by-side preview, without modifying the original file.
- **Multiple Translation Providers**: Supports various translation services:
  - **macOS Shortcuts**: Free, local translation on macOS.
  - **OpenAI**: Supports GPT-3.5, GPT-4, and other compatible models.
  - **Google Translate**: Integrates with the Google Cloud Translation API.
  - **Tencent Translate**: Uses the Tencent Machine Translation (TMT) service.
  - **Mock Provider**: A test provider for development and debugging.
- **Smart Caching**: A two-level caching system for improved performance:
  - **Phrase-level cache**: Caches individual translations across files.
  - **File-level fingerprint cache**: Quickly reuses translations for unchanged files.
- **Format Preservation**: Maintains the original file's formatting, including:
  - Indentation and spacing.
  - Comments.
  - Quote styles (single, double, or none).
  - Block scalars (`|` and `>`).
- **Selective Translation**:
  - Automatically skips Jinja templates (`{{ ... }}`) and code expressions (`${...}`).
  - Configurable key matching (exact, contains, or regex).
- **User Interface Features**:
  - **Translate File**: A command to trigger the translation.
  - **Copy to Clipboard**: Copies the translated content.
  - **Diff View**: Compares the original and translated content.
  - **Refresh Translation**: Forces a new translation, bypassing the cache.
- **Performance**:
  - Batch translation with configurable concurrency.
  - Retry logic with exponential backoff for failed requests.
- **Logging**: Detailed logging in the Output panel for debugging.
