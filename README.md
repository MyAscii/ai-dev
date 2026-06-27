# ai-dev

`ai-dev` is a small Node.js CLI for installing and syncing local AI skills into project-local folders for Claude Code, Codex, Cursor, and Trae. It is a simpler, lighter implementation of the `rulesync` idea, focused on skills plus shared root instruction files.

It keeps one canonical skills directory on your machine and mirrors those skills, along with your preferred `AGENTS.md` / `CLAUDE.md`, into each repository.

## Requirements

- Node.js `18+`

## Install

```bash
git clone https://github.com/MyAscii/ai-dev.git
cd ai-dev
npm link
```

This registers four global commands: `setup`, `init`, `sync`, and `status`. Each is
verb-first and takes `ai-dev` as its argument (for example `init ai-dev`). The `ai-dev`
token is required, so the generic verb names do nothing on their own.

> Note: the verb names are generic. In shells that ship their own `sync` (for example
> Git Bash, where `/usr/bin/sync` wins on `PATH`), call it explicitly or use PowerShell,
> where `sync ai-dev` resolves to this CLI.

## Quick Start

1. Create the central skills directory and template files:

```bash
setup ai-dev
```

2. Add skills under your home directory:

```text
~/.ai-dev/skills/
  my-skill/
    SKILL.md
```

3. In any repository, install all skills and root files:

```bash
init ai-dev
```

4. After updating skills or templates centrally, refresh the current repository:

```bash
sync ai-dev
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

### `setup ai-dev`

Creates the default local configuration, central skill source, and template root files:

```text
~/.ai-dev/config.json
~/.ai-dev/skills/
~/.ai-dev/templates/
  AGENTS.md
  CLAUDE.md
```

Edit the files under `~/.ai-dev/templates/` once; they are copied into the root of
every repository on `init`/`sync`. See [Root Instruction Files](#root-instruction-files).

### `init ai-dev`

Installs all skills from the configured source into the current repository.

Created targets:

```text
.claude/skills/
.codex/skills/
.cursor/skills/
.trae/skills/
.ai-dev/state.json
AGENTS.md   # from ~/.ai-dev/templates/, only if missing
CLAUDE.md   # from ~/.ai-dev/templates/, only if missing
```

`ai-dev` also adds matching entries to the repository `.gitignore` so installed skills stay local and do not get committed or pushed. The distributed root files (`AGENTS.md`, `CLAUDE.md`) are gitignored too (as `/AGENTS.md`, `/CLAUDE.md`), so they stay local to each repo and are not committed.

### `sync ai-dev`

Synchronizes the current repository with the central skill source.

Default behavior:

- creates missing skills
- updates unchanged managed skills when the source changed
- leaves unchanged skills alone
- skips locally modified managed skills

Force overwrite locally modified managed skills:

```bash
sync ai-dev --force
```

### `status ai-dev`

Prints the configured source, managed tools, and tracked skills for the current repository.

## Safe Sync

`ai-dev` writes a repository-local state file at `.ai-dev/state.json`.

The state file records:

- configured source directory
- managed tool targets
- installed skill metadata
- content hashes for managed files

This allows `sync` to update only skills that are still under tool management and avoid overwriting local edits by default.

## Root Instruction Files

Alongside skills, `ai-dev` distributes your preferred root instruction files so every
new repository starts with the conventions you like.

- Source: `~/.ai-dev/templates/` (seeded with `AGENTS.md` and `CLAUDE.md` on `setup`).
- On `init`/`sync`, every file in that folder is copied to the repository root.
- Copies are **create-if-missing**: an existing file in the repo is never overwritten,
  so per-repo edits are safe (even with `--force`, which only affects skills).
- The distributed files are gitignored (`/AGENTS.md`, `/CLAUDE.md`) so they stay local
  to each repo, the same way installed skills do.

`AGENTS.md` is the single source of truth. Codex, Cursor, and Trae read it natively;
Claude Code reads it through the `@AGENTS.md` import on the first line of `CLAUDE.md`.
Edit the templates once centrally and every repo inherits them.

## Tool Targets

- Claude Code: `.claude/skills`
- Codex: `.codex/skills`
- Cursor: `.cursor/skills`
- Trae: `.trae/skills`
