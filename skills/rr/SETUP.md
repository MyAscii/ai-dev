# /rr setup

One-time wiring so the `/rr` debate skill can reach Codex (Sol) from Claude Code.

## Requirements

- Node.js 18+
- Claude Code 2.x (`claude` CLI or desktop app)
- Codex CLI, logged in with your ChatGPT subscription (`codex login`)

## 1. Install the skill

From the ai-dev repo:

```bash
sync ai-dev        # refreshes ~/.ai-dev/skills/rr from the repo
init ai-dev        # in any project: installs it into .claude/skills/ etc.
```

To make `/rr` available in every project without per-repo installs, link it into
Claude's user scope once (PowerShell, no admin needed):

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.claude\skills" | Out-Null
New-Item -ItemType Junction -Path "$env:USERPROFILE\.claude\skills\rr" -Target "$env:USERPROFILE\.ai-dev\skills\rr"
```

The junction tracks the central store, so `sync ai-dev` keeps the user-scope
copy current automatically.

## 2. Register the codex-sol MCP server

Run the doctor first; it prints the exact command for this machine:

```bash
node ~/.ai-dev/skills/rr/scripts/doctor.mjs
```

The command it prints looks like this:

```bash
claude mcp add --scope user --transport stdio codex-sol -- node "C:\Users\<you>\.ai-dev\skills\rr\scripts\codex-mcp.mjs" mcp-server -c tools.web_search=true
```

Notes:

- `codex-mcp.mjs` resolves the newest installed Codex CLI at spawn time. The
  Windows Codex app installs `codex.exe` under a version-hashed folder that
  changes on updates, so registering a static exe path would break.
- `-c tools.web_search=true` gives Sol live web search for research passes.
- The model and reasoning effort come from `~/.codex/config.toml`
  (currently `model = "gpt-5.6-sol"`). Override per machine there, or set
  `RR_CODEX_BIN` to point at a specific codex executable.

Restart Claude Code afterwards, then check `/mcp` shows `codex-sol` connected.

## 3. Verify

```bash
node ~/.ai-dev/skills/rr/scripts/doctor.mjs          # free checks + MCP handshake
node ~/.ai-dev/skills/rr/scripts/doctor.mjs --live   # adds one small paid Sol call
```

All checks PASS means `/rr` is ready:

```text
/rr Should we cache the parser output between runs? sol-passes=6
```

## Troubleshooting

- `codex CLI: FAIL`: install the Codex CLI or set `RR_CODEX_BIN`.
- `codex login: FAIL`: run `codex login` in a terminal.
- `claude MCP registration: FAIL`: run the printed `claude mcp add` command.
  If `claude` is not on PATH, use its full path
  (Windows default: `%USERPROFILE%\.local\bin\claude.exe`).
- `/mcp` does not list `codex-sol`: restart Claude Code; user-scope servers
  load at session start.

## Uninstall

```bash
claude mcp remove --scope user codex-sol
```

Then delete the junction: `Remove-Item "$env:USERPROFILE\.claude\skills\rr"`.
