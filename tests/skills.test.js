const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const skillsDir = path.join(__dirname, "..", "skills");

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return null;
  }
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([A-Za-z][A-Za-z-]*):\s*(.*)$/);
    if (pair) {
      fields[pair[1]] = pair[2].trim();
    }
  }
  return fields;
}

function listSkillDirs() {
  return fs
    .readdirSync(skillsDir)
    .filter((name) => fs.statSync(path.join(skillsDir, name)).isDirectory());
}

test("every skill has SKILL.md with a matching name and a description", () => {
  for (const name of listSkillDirs()) {
    const file = path.join(skillsDir, name, "SKILL.md");
    assert.equal(fs.existsSync(file), true, `${name}: SKILL.md missing`);
    const frontmatter = parseFrontmatter(fs.readFileSync(file, "utf8"));
    assert.ok(frontmatter, `${name}: frontmatter missing`);
    assert.equal(frontmatter.name, name, `${name}: frontmatter name must match directory`);
    assert.ok(frontmatter.description, `${name}: description missing`);
    assert.ok(
      frontmatter.description.length <= 1024,
      `${name}: description over 1024 chars`
    );
  }
});

test("rr skill keeps its protocol contract", () => {
  const body = fs.readFileSync(path.join(skillsDir, "rr", "SKILL.md"), "utf8");
  const frontmatter = parseFrontmatter(body);
  assert.equal(frontmatter["disable-model-invocation"], "true");

  const requiredMarkers = [
    "$ARGUMENTS",
    "sol-passes",
    "codex-reply",
    "threadId",
    "read-only",
    "FABLE INITIAL POSITION",
    "SOL INITIAL POSITION",
    "PASS A",
    "PASS B",
    "PASS C",
    "DECISION TABLE",
    "WINNER",
    "doctor.mjs",
  ];
  for (const marker of requiredMarkers) {
    assert.ok(body.includes(marker), `rr/SKILL.md must mention "${marker}"`);
  }
});

test("rr bundled scripts exist and parse", () => {
  const scripts = [
    ["scripts", "codex-mcp.mjs"],
    ["scripts", "doctor.mjs"],
    ["evals", "check-transcript.mjs"],
  ];
  for (const parts of scripts) {
    const file = path.join(skillsDir, "rr", ...parts);
    assert.equal(fs.existsSync(file), true, `${parts.join("/")} missing`);
    execFileSync(process.execPath, ["--check", file]);
  }
});
