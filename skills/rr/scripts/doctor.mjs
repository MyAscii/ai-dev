#!/usr/bin/env node
// Environment check for the /rr debate skill.
// Free checks by default; --live adds one small paid Sol call.
// Exit code 0 means /rr is ready to run.
//
// Usage: node doctor.mjs [--live]

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const launcher = join(here, "codex-mcp.mjs");
const live = process.argv.includes("--live");
let failures = 0;

function report(ok, label, detail, fix) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${detail}`);
  if (!ok) {
    failures += 1;
    if (fix) {
      console.log(`     fix: ${fix}`);
    }
  }
}

function preferredLauncherPath() {
  const central = join(homedir(), ".ai-dev", "skills", "rr", "scripts", "codex-mcp.mjs");
  return existsSync(central) ? central : launcher;
}

function registrationCommand() {
  return (
    'claude mcp add --scope user --transport stdio codex-sol -- ' +
    `node "${preferredLauncherPath()}" mcp-server -c tools.web_search=true`
  );
}

function runLauncher(args, timeoutMs = 60000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [launcher, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (data) => (out += data));
    child.stderr.on("data", (data) => (out += data));
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: -1, out: `${out}\n(timed out after ${timeoutMs}ms)` });
    }, timeoutMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: -1, out: error.message });
    });
  });
}

function handshake(timeoutMs = 45000) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [launcher, "mcp-server"], {
      stdio: ["pipe", "pipe", "ignore"],
    });
    let buf = "";
    let id = 0;
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch {}
      resolve(value);
    };
    const timer = setTimeout(() => finish({ ok: false, detail: "handshake timed out" }), timeoutMs);
    const send = (method, params, notify) => {
      const msg = { jsonrpc: "2.0", method, params };
      if (!notify) msg.id = ++id;
      child.stdin.write(`${JSON.stringify(msg)}\n`);
    };
    child.stdout.on("data", (data) => {
      buf += data.toString();
      let newline;
      while ((newline = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, newline).trim();
        buf = buf.slice(newline + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue;
        }
        if (msg.id === 1) {
          send("notifications/initialized", {}, true);
          send("tools/list", {});
        } else if (msg.id === 2) {
          clearTimeout(timer);
          const names = (msg.result?.tools || []).map((tool) => tool.name);
          const ok = names.includes("codex") && names.includes("codex-reply");
          finish({ ok, detail: `tools: ${names.join(", ") || "(none)"}` });
        }
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      finish({ ok: false, detail: error.message });
    });
    send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "rr-doctor", version: "0.1.0" },
    });
  });
}

function checkClaudeRegistration() {
  const configPath = join(homedir(), ".claude.json");
  if (!existsSync(configPath)) {
    return { ok: false, detail: "~/.claude.json not found" };
  }
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    return { ok: false, detail: `could not parse ~/.claude.json: ${error.message}` };
  }
  const servers = config.mcpServers || {};
  for (const [name, entry] of Object.entries(servers)) {
    const flat = JSON.stringify(entry).toLowerCase();
    if (flat.includes("mcp-server") && flat.includes("codex")) {
      return { ok: true, detail: `user-scope server "${name}" is registered` };
    }
  }
  return { ok: false, detail: "no codex MCP server in user scope" };
}

const version = await runLauncher(["--version"]);
report(
  version.code === 0,
  "codex CLI",
  version.code === 0 ? version.out.trim().split("\n")[0] : version.out.trim(),
  "install the Codex CLI (or the Codex desktop app), or set RR_CODEX_BIN to the codex executable"
);

if (version.code === 0) {
  const login = await runLauncher(["login", "status"]);
  report(
    login.code === 0,
    "codex login",
    login.out.trim().split("\n")[0] || "(no output)",
    "run: codex login"
  );

  const configPath = join(homedir(), ".codex", "config.toml");
  if (existsSync(configPath)) {
    const model = readFileSync(configPath, "utf8").match(/^\s*model\s*=\s*"([^"]+)"/m);
    report(true, "codex model", model ? model[1] : "(default for this codex version)");
  } else {
    report(true, "codex model", "(no config.toml, codex default applies)");
  }

  const registration = checkClaudeRegistration();
  report(registration.ok, "claude MCP registration", registration.detail, registrationCommand());

  const shake = await handshake();
  report(
    shake.ok,
    "MCP handshake",
    shake.detail,
    "the codex mcp-server did not expose codex/codex-reply; update the Codex CLI"
  );

  if (live) {
    console.log("running live Sol ping (one small paid call)...");
    const ping = await runLauncher(
      ["exec", "--sandbox", "read-only", "--skip-git-repo-check", "Reply with exactly: RR-OK"],
      180000
    );
    report(
      ping.code === 0 && ping.out.includes("RR-OK"),
      "live Sol call",
      ping.code === 0 && ping.out.includes("RR-OK")
        ? "model replied RR-OK"
        : ping.out.trim().slice(-300),
      "check codex login status, network access, and the model set in ~/.codex/config.toml"
    );
  }
}

console.log(failures === 0 ? "rr doctor: all checks passed" : `rr doctor: ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
