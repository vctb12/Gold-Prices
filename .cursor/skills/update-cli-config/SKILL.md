---
name: update-cli-config
description: View and modify Cursor CLI configuration settings in ~/.cursor/cli-config.json. Use when the user wants to change CLI settings, configure permissions, switch approval mode, enable vim mode, toggle display options, configure sandbox, or manage any CLI preferences.
metadata:
  surfaces:
    - cli
---

# Cursor CLI Configuration

This skill explains how to view and modify Cursor CLI settings stored in `~/.cursor/cli-config.json`.

## Config File Location

The config file is `~/.cursor/cli-config.json`.

Projects can layer overrides via `.cursor/cli.json` files. The CLI walks from the git root to the current working directory and merges each `.cursor/cli.json` it finds (deeper files take precedence). Project overrides only affect the current session; they are not written back to the home config.

## How to Modify

Read `~/.cursor/cli-config.json`, apply changes, and write it back. The file is standard JSON. Changes take effect after restarting the CLI.

## Available Settings

### `permissions` (required)
Tool permission rules. Each entry is a string pattern.
- `allow`: string[] — patterns for allowed tool calls (e.g. `"Shell(**)"`, `"Mcp(server-name, tool-name)"`)
- `deny`: string[] — patterns for denied tool calls

### `editor`
- `vimMode`: boolean — enable vim keybindings in the CLI input
- `defaultBehavior`: `"ide"` | `"agent"` — default behavior mode

### `display` (optional)
- `showLineNumbers`: boolean (default: false)
- `showThinkingBlocks`: boolean (default: false)
- `showStatusIndicators`: boolean (default: false)

### `channel` (optional)
Release channel: `"prod"` | `"staging"` | `"lab"` | `"static"`

### `maxMode` (optional)
boolean (default: false)

### `approvalMode` (optional)
- `"allowlist"` (default)
- `"unrestricted"`

### `sandbox` (optional)
- `mode`: `"disabled"` | `"enabled"`
- `networkAccess`: `"user_config_only"` | `"user_config_with_defaults"` | `"allow_all"`
- `networkAllowlist`: string[]

### `network` (optional)
- `useHttp1ForAgent`: boolean (default: false)

### `bedrock` (optional)
AWS Bedrock integration settings.

### `attribution` (optional)
- `attributeCommitsToAgent`: boolean (default: true)
- `attributePRsToAgent`: boolean (default: true)

### `webFetchDomainAllowlist` (optional)
string[]

## Fields You Should NOT Modify

- `version`, `model`, `selectedModel`, `modelParameters`, `hasChangedDefaultModel`
- `privacyCache`, `authInfo`, `showSandboxIntro`, `conversationClassificationScoredConversations`
