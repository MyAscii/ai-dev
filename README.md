# ai-dev-skills-kit

`ai-dev-skills-kit` is a small Node.js CLI for installing and syncing local AI skills into project-local folders for Claude Code, Codex, Cursor, and Trae. It is a simpler, lighter implementation of the `rulesync` idea, focused only on skills.

It keeps one canonical skills directory on your machine and mirrors those skills into each repository.

## Requirements

- Node.js `18+`

## Install

```bash
npm install -g .
```

## Quick Start

1. Create the central skills directory:

```bash
ai-dev setup
```

2. Add skills under your home directory:

```text
~/.ai-dev/skills/
  my-skill/
    SKILL.md
```

3. In any repository, install all skills:

```bash
ai-dev init
```

4. After updating skills centrally, refresh the current repository:

```bash
ai-dev sync
```

## Skill Format

Each skill must be a directory containing `SKILL.md`.

```text
~/.ai-dev/skills/
  debugging/
    SKILL.md
  tdd/
    SKILL.md
    tests.md
```

Additional files inside a skill directory are copied as-is.

## Commands

### `ai-dev setup`

Creates the default local configuration and central skill source:

```text
~/.ai-dev/config.json
~/.ai-dev/skills/
```

### `ai-dev init`

Installs all skills from the configured source into the current repository.

Created targets:

```text
.claude/skills/
.codex/skills/
.cursor/skills/
.trae/skills/
.ai-dev/state.json
```

The CLI also adds matching entries to the repository `.gitignore` so installed skills stay local and do not get committed or pushed.

### `ai-dev sync`

Synchronizes the current repository with the central skill source.

Default behavior:

- creates missing skills
- updates unchanged managed skills when the source changed
- leaves unchanged skills alone
- skips locally modified managed skills

Force overwrite locally modified managed skills:

```bash
ai-dev sync --force
```

### `ai-dev status`

Prints the configured source, managed tools, and tracked skills for the current repository.

## Safe Sync

The CLI writes a repository-local state file at `.ai-dev/state.json`.

The state file records:

- configured source directory
- managed tool targets
- installed skill metadata
- content hashes for managed files

This allows `sync` to update only skills that are still under tool management and avoid overwriting local edits by default.

## Tool Targets

- Claude Code: `.claude/skills`
- Codex: `.codex/skills`
- Cursor: `.cursor/skills`
- Trae: `.trae/skills`
