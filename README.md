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

The central store (`~/.ai-dev/`) sits between the git repo and your projects:

```text
GitHub repo --(sync ai-dev)--> ~/.ai-dev/ --(init ai-dev)--> a project
```

1. First time on a machine, from the ai-dev clone:

```bash
setup ai-dev
```

2. Whenever the repo changes, refresh the central store. Runnable from anywhere:

```bash
sync ai-dev
```

`sync` pulls the latest from GitHub into the clone, then refreshes `~/.ai-dev/`.

3. In any project, install whatever is in the central store:

```bash
init ai-dev
```

`init` copies the central skills and `AGENTS.md` / `CLAUDE.md` into the project,
overwriting so the project always matches central.

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

First-time setup on a machine. Seeds the central store from the cloned repo (no git pull):

```text
~/.ai-dev/config.json
~/.ai-dev/skills/      # seeded from the repo's skills/ (existing ones are kept)
~/.ai-dev/templates/
  AGENTS.md            # copied from the repo's AGENTS.md
  CLAUDE.md            # copied from the repo's CLAUDE.md
```

The skills and `AGENTS.md` / `CLAUDE.md` committed in the repo are the source of truth.
Use `sync ai-dev` afterwards to pull updates and refresh the central store.

### `sync ai-dev`

Refreshes the central store from the git repo. Runnable from any directory.

1. `git pull --ff-only` in the ai-dev clone (gets the latest from GitHub).
2. Re-seeds `~/.ai-dev/skills` and `~/.ai-dev/templates` from the clone, overwriting so
   the central store always matches the repo.

If the pull fails (offline, detached, etc.), it warns and reseeds from the current clone.

### `init ai-dev`

Installs whatever is in the central store into the current project, overwriting so the
project matches central.

Created targets:

```text
.claude/skills/
.codex/skills/
.cursor/skills/
.trae/skills/
.ai-dev/state.json
AGENTS.md   # copied from ~/.ai-dev/templates/ (overwritten to match central)
CLAUDE.md   # copied from ~/.ai-dev/templates/ (overwritten to match central)
```

`ai-dev` also adds matching entries to the repository `.gitignore` so installed skills stay local and do not get committed or pushed. The distributed root files (`AGENTS.md`, `CLAUDE.md`) are gitignored too (as `/AGENTS.md`, `/CLAUDE.md`), so they stay local to each repo and are not committed.

### `status ai-dev`

Prints the configured source, managed tools, and tracked skills for the current repository.

## Project State

`init` writes a repository-local state file at `.ai-dev/state.json` recording the source
directory, managed tool targets, and installed skill metadata with content hashes.

## Root Instruction Files

Alongside skills, `ai-dev` distributes your preferred root instruction files so every
new repository starts with the conventions you like.

- Source: `~/.ai-dev/templates/` (seeded from the repo on `setup`, refreshed on `sync`).
- On `init`, every file in that folder is copied to the project root, overwriting so the
  project matches central. Edit your instructions in the repo, not per-project.
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
