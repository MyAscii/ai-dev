const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

const {
  syncProject,
  summarizeResults,
  installRootFiles,
  summarizeRootResults,
  runVerb,
} = require("../src/cli");

function makeTempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
}

function runBin(name, args, cwd) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [path.join(__dirname, "..", "bin", `${name}.js`), ...args],
      { cwd, encoding: "utf8" }
    );
    return { code: 0, output: stdout };
  } catch (error) {
    return { code: error.status, output: `${error.stdout || ""}${error.stderr || ""}` };
  }
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

test("syncProject adds gitignore rules for installed skill folders", () => {
  const sourceDir = makeTempDir("ai-dev-source");
  const projectDir = makeTempDir("ai-dev-project");

  writeFile(path.join(sourceDir, "debugging", "SKILL.md"), "first version");
  syncProject({ projectDir, sourceDir, force: false });

  const gitignore = fs.readFileSync(path.join(projectDir, ".gitignore"), "utf8");

  assert.match(gitignore, /# ai-dev-skills-kit/);
  assert.match(gitignore, /\.ai-dev\//);
  assert.match(gitignore, /\.claude\/skills\//);
  assert.match(gitignore, /\.codex\/skills\//);
  assert.match(gitignore, /\.cursor\/skills\//);
  assert.match(gitignore, /\.trae\/skills\//);
});

test("syncProject preserves existing gitignore content and does not duplicate rules", () => {
  const sourceDir = makeTempDir("ai-dev-source");
  const projectDir = makeTempDir("ai-dev-project");

  writeFile(path.join(sourceDir, "debugging", "SKILL.md"), "first version");
  writeFile(
    path.join(projectDir, ".gitignore"),
    ["node_modules/", ".claude/skills/", ""].join("\n")
  );

  syncProject({ projectDir, sourceDir, force: false });
  syncProject({ projectDir, sourceDir, force: false });

  const gitignore = fs.readFileSync(path.join(projectDir, ".gitignore"), "utf8");

  assert.match(gitignore, /^node_modules\/$/m);
  assert.equal((gitignore.match(/# ai-dev-skills-kit/g) || []).length, 1);
  assert.equal((gitignore.match(/^\.claude\/skills\/$/gm) || []).length, 1);
});

test("installRootFiles copies template files into the repo root", () => {
  const templatesDir = makeTempDir("ai-dev-templates");
  const projectDir = makeTempDir("ai-dev-project");

  writeFile(path.join(templatesDir, "AGENTS.md"), "shared instructions");
  writeFile(path.join(templatesDir, "CLAUDE.md"), "@AGENTS.md\n");

  const results = installRootFiles({ projectDir, templatesDir });

  assert.equal(results.length, 2);
  assert.equal(
    fs.readFileSync(path.join(projectDir, "AGENTS.md"), "utf8"),
    "shared instructions"
  );
  assert.equal(
    fs.readFileSync(path.join(projectDir, "CLAUDE.md"), "utf8"),
    "@AGENTS.md\n"
  );
  assert.ok(results.every((result) => result.status === "created"));
});

test("installRootFiles never overwrites an existing root file", () => {
  const templatesDir = makeTempDir("ai-dev-templates");
  const projectDir = makeTempDir("ai-dev-project");

  writeFile(path.join(templatesDir, "AGENTS.md"), "template version");
  writeFile(path.join(projectDir, "AGENTS.md"), "repo-specific edit");

  const results = installRootFiles({ projectDir, templatesDir });

  assert.equal(results[0].status, "kept");
  assert.equal(
    fs.readFileSync(path.join(projectDir, "AGENTS.md"), "utf8"),
    "repo-specific edit"
  );
});

test("installRootFiles returns nothing when there is no templates folder", () => {
  const projectDir = makeTempDir("ai-dev-project");
  const templatesDir = path.join(projectDir, "does-not-exist");

  assert.deepEqual(installRootFiles({ projectDir, templatesDir }), []);
});

test("installRootFiles gitignores the files it distributes", () => {
  const templatesDir = makeTempDir("ai-dev-templates");
  const projectDir = makeTempDir("ai-dev-project");

  writeFile(path.join(templatesDir, "AGENTS.md"), "shared instructions");
  writeFile(path.join(templatesDir, "CLAUDE.md"), "@AGENTS.md\n");

  installRootFiles({ projectDir, templatesDir });

  const gitignore = fs.readFileSync(path.join(projectDir, ".gitignore"), "utf8");
  assert.match(gitignore, /# ai-dev-skills-kit/);
  assert.match(gitignore, /^\/AGENTS\.md$/m);
  assert.match(gitignore, /^\/CLAUDE\.md$/m);
});

test("init keeps a single gitignore header across skills and root files", () => {
  const sourceDir = makeTempDir("ai-dev-source");
  const templatesDir = makeTempDir("ai-dev-templates");
  const projectDir = makeTempDir("ai-dev-project");

  writeFile(path.join(sourceDir, "debugging", "SKILL.md"), "first version");
  writeFile(path.join(templatesDir, "AGENTS.md"), "shared instructions");

  syncProject({ projectDir, sourceDir, force: false });
  installRootFiles({ projectDir, templatesDir });

  const gitignore = fs.readFileSync(path.join(projectDir, ".gitignore"), "utf8");
  assert.equal((gitignore.match(/# ai-dev-skills-kit/g) || []).length, 1);
  assert.match(gitignore, /\.claude\/skills\//);
  assert.match(gitignore, /^\/AGENTS\.md$/m);
});

test("summarizeRootResults reports created and kept counts", () => {
  const output = summarizeRootResults([
    { file: "AGENTS.md", status: "created" },
    { file: "CLAUDE.md", status: "kept" },
  ]);

  assert.match(output, /created: 1, kept: 1/);
  assert.match(output, /- created AGENTS\.md/);
});

test("runVerb requires the ai-dev namespace token", async () => {
  await assert.rejects(() => runVerb("init", []), /Usage: init ai-dev/);
  await assert.rejects(() => runVerb("sync", ["nope"]), /Usage: sync ai-dev \[--force\]/);
});

test("runVerb rejects an unknown verb", async () => {
  await assert.rejects(() => runVerb("bogus", ["ai-dev"]), /Unknown command: bogus/);
});

test("verb bin without the ai-dev token prints usage and exits 1", () => {
  const result = runBin("init", [], os.tmpdir());
  assert.equal(result.code, 1);
  assert.match(result.output, /Usage: init ai-dev/);
});

test("status ai-dev runs end to end via the bin", () => {
  const projectDir = makeTempDir("ai-dev-project");
  const result = runBin("status", ["ai-dev"], projectDir);
  assert.equal(result.code, 0);
  assert.match(result.output, /No ai-dev state found/);
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
