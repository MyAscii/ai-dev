# ai-dev-skills-kit

A tiny global CLI for syncing your reusable AI coding skills into new repositories.

This version is intentionally skills-only:

- no global instruction markdown files
- no project context markdown files
- no rulesync integration
- one central local skills folder
- project-local installs for Claude Code, Codex, Cursor, and Trae

## What It Does

Install and sync your own skills from a single local source folder into the current repo.

Supported project-local targets:

- `.claude/skills/`
- `.codex/skills/`
- `.cursor/skills/`
- `.trae/skills/`

The command is designed for this workflow:

1. Keep all of your canonical skills in one local folder.
2. Open any new repo.
3. Run `ai-dev init`.
4. Get project-local copies for all four tools.
5. Later add or update skills centrally, then run `ai-dev sync`.

## Canonical Skill Format

The source of truth is one canonical skill format:

```text
~/.ai-dev/skills/
  debugging/
    SKILL.md
  code-review/
    SKILL.md
  writing-tests/
    SKILL.md
```

Each skill must be a folder containing `SKILL.md`.

Optional extra files are fine too:

```text
my-skill/
  SKILL.md
  references/
  scripts/
  assets/
```

## Install

From this repo:

```bash
npm install -g .
```

Then run:

```bash
ai-dev setup
```

That creates your central source folder if it does not already exist.

## Commands

### `ai-dev setup`

Creates the default central local source:

```text
~/.ai-dev/skills/
~/.ai-dev/config.json
```

### `ai-dev init`

Installs all central skills into the current repo for:

- Claude Code
- Codex
- Cursor
- Trae

This writes:

```text
.claude/skills/
.codex/skills/
.cursor/skills/
.trae/skills/
.ai-dev/state.json
```

### `ai-dev sync`

Refreshes the current repo from the central source folder:

- adds new skills
- updates previously managed unchanged skills
- skips locally edited skills by default

Use `--force` if you want to overwrite locally changed managed skills:

```bash
ai-dev sync --force
```

### `ai-dev status`

Shows the current repo state file information and installed skill names.

## Safe Sync Model

This tool uses a tiny repo-local state file:

```text
.ai-dev/state.json
```

It records:

- the source folder used
- the target tools
- the installed skills
- hashes of managed file contents

That lets `sync` do safe updates instead of blindly overwriting local repo changes.

Default behavior:

- missing skill -> create it
- unchanged managed skill -> leave it alone
- changed central skill + unchanged repo copy -> update it
- changed repo copy -> skip it

## Empty Skills Folder

This repo includes an empty `skills/` directory as the local canonical structure reference.

You said you want to import your skills later, so this repo does not ship with sample skills.

## Example Usage

Set up your machine once:

```bash
ai-dev setup
```

Add your own skills under:

```text
~/.ai-dev/skills/
```

Then in a new repo:

```bash
ai-dev init
```

Later, after adding new skills centrally:

```bash
ai-dev sync
```

## Notes On Tool Support

- Claude Code: installs to `.claude/skills`
- Codex: installs to `.codex/skills`
- Cursor: installs to `.cursor/skills`
- Trae: installs to `.trae/skills`

This tool assumes a shared `SKILL.md`-style skill directory as the canonical source and mirrors that structure into each tool's project-local skill folder.
