#!/usr/bin/env node
// Locates the newest installed Codex CLI and runs it with the given args.
// Needed on Windows: the Codex desktop app installs codex.exe under a
// version-hashed directory that changes on every app update, so no static
// path stays valid across updates. Override with RR_CODEX_BIN when needed.
//
// Usage: node codex-mcp.mjs <codex args...>
// Example (MCP server): node codex-mcp.mjs mcp-server -c tools.web_search=true

import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function findCodex(env = process.env) {
  const override = env.RR_CODEX_BIN;
  if (override && existsSync(override)) {
    return override;
  }

  const localAppData = env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  const binRoot = join(localAppData, "OpenAI", "Codex", "bin");
  if (existsSync(binRoot)) {
    const candidates = readdirSync(binRoot)
      .map((dir) => join(binRoot, dir, "codex.exe"))
      .filter((exe) => existsSync(exe))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    if (candidates.length > 0) {
      return candidates[0];
    }
  }

  return "codex"; // PATH fallback for npm or brew installs
}

const codex = findCodex();
const child = spawn(codex, process.argv.slice(2), { stdio: "inherit" });

child.on("error", (error) => {
  console.error(`rr: failed to start codex at "${codex}": ${error.message}`);
  console.error("rr: install the Codex CLI or set RR_CODEX_BIN to the codex executable.");
  process.exit(127);
});

child.on("exit", (code, signal) => {
  process.exit(signal ? 1 : code === null ? 1 : code);
});
