# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Logseq plugin that syncs notes between Logseq and Memos (a self-hosted memo hub). The project is currently archived as the author no longer uses Memos, but the codebase remains functional.

## Development Commands

```bash
# Install dependencies (enforces pnpm)
pnpm install

# Start development server with hot reload
pnpm dev

# Build the plugin for production
pnpm build

# Run tests
pnpm test

# Tests run automatically on pre-commit via Husky
```

## Architecture

### Plugin Structure
- **Entry Point**: `src/main.tsx` - Registers commands, sets up event handlers, and initializes the plugin
- **Core Logic**: `src/memos.ts` - Handles sync operations between Logseq and Memos
- **API Clients**: `src/memos/impls/` - Supports both Memos API v0 and v1 with abstracted interfaces
- **Settings**: `src/settings.ts` - Defines plugin configuration schema using Logseq's settings system

### Key Patterns
1. **API Version Abstraction**: The plugin uses a factory pattern to create the appropriate API client based on the Memos server version
2. **Sync Modes**: 
   - Journal: Syncs to daily journal pages
   - Custom Page: Syncs to a user-defined page
   - Journal Grouped: Groups memos by date in journal
3. **Event-Driven**: Uses Logseq's event system for settings changes and user commands

### Important Files
- `src/memos/client.ts`: Abstract base class for Memos API clients
- `src/memos/type.ts`: TypeScript definitions for Memos data structures
- `src/utils.ts` & `src/memos/utils.ts`: Utility functions for content generation and formatting

## Testing

Tests are located in `src/memos/__tests__/` and focus on content generation logic. The test suite runs automatically before commits.

## Build Process

The plugin uses Vite with a specialized Logseq plugin (`vite-plugin-logseq`) that:
- Bundles the plugin code
- Generates proper module exports for Logseq
- Creates the distribution package

## Release Process

Uses semantic-release with GitHub Actions for automated versioning and releases. The release creates a zip file containing:
- `dist/` folder with built assets
- `readme.md`
- `logo.svg`
- `LICENSE`
- `package.json`

## Important Considerations

1. **Memos API Compatibility**: The plugin supports both v0 and v1 of the Memos API. When making changes, ensure compatibility with both versions.
2. **Logseq API**: Uses `@logseq/libs` v0.0.10. Check Logseq documentation for API usage.
3. **Date Handling**: Uses date-fns for date manipulation. All dates should be handled consistently.
4. **Error Handling**: The plugin includes user-friendly error messages. Maintain clear error reporting for sync failures.
5. **Settings Validation**: Settings changes trigger immediate validation and re-initialization of the Memos client.