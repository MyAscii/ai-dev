const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { syncProject, summarizeResults } = require("../src/cli");

function makeTempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

test("syncProject installs a canonical skill into all tool folders", () => {
  const sourceDir = makeTempDir("ai-dev-source");
  const projectDir = makeTempDir("ai-dev-project");

  writeFile(path.join(sourceDir, "debugging", "SKILL.md"), "---\nname: debugging\n---\n");

  const results = syncProject({ projectDir, sourceDir, force: false });

  assert.equal(results.length, 4);
  assert.equal(
    fs.existsSync(path.join(projectDir, ".claude", "skills", "debugging", "SKILL.md")),
    true
  );
  assert.equal(
    fs.existsSync(path.join(projectDir, ".codex", "skills", "debugging", "SKILL.md")),
    true
  );
  assert.equal(
    fs.existsSync(path.join(projectDir, ".cursor", "skills", "debugging", "SKILL.md")),
    true
  );
  assert.equal(
    fs.existsSync(path.join(projectDir, ".trae", "skills", "debugging", "SKILL.md")),
    true
  );
});

test("syncProject skips locally edited managed skills during safe sync", () => {
  const sourceDir = makeTempDir("ai-dev-source");
  const projectDir = makeTempDir("ai-dev-project");

  writeFile(path.join(sourceDir, "debugging", "SKILL.md"), "first version");
  syncProject({ projectDir, sourceDir, force: false });

  writeFile(path.join(projectDir, ".claude", "skills", "debugging", "SKILL.md"), "repo edit");
  writeFile(path.join(sourceDir, "debugging", "SKILL.md"), "second version");

  const results = syncProject({ projectDir, sourceDir, force: false });
  const skipped = results.filter((result) => result.toolName === "claudecode")[0];

  assert.equal(skipped.status, "skipped");
  assert.equal(
    fs.readFileSync(path.join(projectDir, ".claude", "skills", "debugging", "SKILL.md"), "utf8"),
    "repo edit"
  );
});

test("summarizeResults reports skipped local changes", () => {
  const output = summarizeResults([
    { toolName: "claudecode", skillName: "debugging", status: "created" },
    { toolName: "cursor", skillName: "debugging", status: "skipped" },
  ]);

  assert.match(output, /created: 1/);
  assert.match(output, /skipped: 1/);
  assert.match(output, /cursor: debugging/);
});
