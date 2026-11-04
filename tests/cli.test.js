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
  seedSkillsFromPackage,
  seedTemplatesFromPackage,
  pullPackageRepo,
  TOOL_DIRS,
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

test("syncProject installs one canonical skill and links every tool folder", () => {
  const sourceDir = makeTempDir("ai-dev-source");
  const projectDir = makeTempDir("ai-dev-project");

  writeFile(path.join(sourceDir, "debugging", "SKILL.md"), "---\nname: debugging\n---\n");

  const results = syncProject({ projectDir, sourceDir, force: false });

  assert.equal(results.length, 1);
  const canonical = path.join(projectDir, ".agents", "skills");
  assert.ok(fs.lstatSync(canonical).isDirectory());
  for (const dir of Object.values(TOOL_DIRS)) {
    const target = path.join(projectDir, dir);
    assert.ok(fs.lstatSync(target).isSymbolicLink());
    assert.equal(fs.realpathSync(target), fs.realpathSync(canonical));
  }
  assert.equal(
    fs.existsSync(path.join(projectDir, ".claude", "skills", "debugging", "SKILL.md")),
    true
  );
  assert.equal(
    fs.existsSync(path.join(projectDir, ".codex")),
    false
  );
  assert.equal(
    fs.existsSync(path.join(projectDir, ".cursor")),
    false
  );
  assert.equal(
    fs.existsSync(path.join(projectDir, ".trae")),
    false
  );
});

test("repeat sync reuses links and repairs a local edit when forced", () => {
  const sourceDir = makeTempDir("ai-dev-source");
  const projectDir = makeTempDir("ai-dev-project");
  writeFile(path.join(sourceDir, "demo", "SKILL.md"), "central");
  syncProject({ projectDir, sourceDir, force: true });
  assert.ok(syncProject({ projectDir, sourceDir, force: true }).every((r) => r.status === "unchanged"));
  writeFile(path.join(projectDir, ".claude", "skills", "demo", "SKILL.md"), "edited");
  assert.ok(syncProject({ projectDir, sourceDir, force: false }).every((r) => r.status === "skipped"));
  syncProject({ projectDir, sourceDir, force: true });
  for (const dir of Object.values(TOOL_DIRS)) {
    assert.equal(fs.readFileSync(path.join(projectDir, dir, "demo", "SKILL.md"), "utf8"), "central");
    assert.equal(fs.existsSync(path.join(projectDir, `${dir}.ai-dev-backup`)), false);
  }
});

test("retired aliases are unlinked while shared skills and unrelated config survive", () => {
  const projectDir = makeTempDir("ai-dev-project");
  const sourceDir = makeTempDir("ai-dev-source");
  writeFile(path.join(sourceDir, "demo", "SKILL.md"), "central");
  syncProject({ projectDir, sourceDir, force: true });
  for (const tool of ["codex", "cursor", "trae"]) {
    writeFile(path.join(projectDir, `.${tool}`, "config.txt"), "keep");
    fs.symlinkSync(path.join(projectDir, ".agents", "skills"), path.join(projectDir, `.${tool}`, "skills"), process.platform === "win32" ? "junction" : "dir");
  }
  syncProject({ projectDir, sourceDir, force: true });
  for (const tool of ["codex", "cursor", "trae"]) {
    assert.equal(fs.existsSync(path.join(projectDir, `.${tool}`, "skills")), false);
    assert.equal(fs.readFileSync(path.join(projectDir, `.${tool}`, "config.txt"), "utf8"), "keep");
  }
  assert.equal(fs.readFileSync(path.join(projectDir, ".agents", "skills", "demo", "SKILL.md"), "utf8"), "central");
  const state = JSON.parse(fs.readFileSync(path.join(projectDir, ".ai-dev", "state.json"), "utf8"));
  assert.deepEqual(state.tools, ["claudecode"]);
  assert.deepEqual(state.toolDirs, { claudecode: ".claude/skills" });
});

test("retired real directories and foreign links are preserved", () => {
  const projectDir = makeTempDir("ai-dev-project");
  const sourceDir = makeTempDir("ai-dev-source");
  const foreign = makeTempDir("ai-dev-foreign");
  writeFile(path.join(projectDir, ".codex", "skills", "local.txt"), "local");
  fs.mkdirSync(path.join(projectDir, ".cursor"));
  fs.symlinkSync(foreign, path.join(projectDir, ".cursor", "skills"), process.platform === "win32" ? "junction" : "dir");
  syncProject({ projectDir, sourceDir, force: true });
  assert.equal(fs.readFileSync(path.join(projectDir, ".codex", "skills", "local.txt"), "utf8"), "local");
  assert.equal(fs.realpathSync(path.join(projectDir, ".cursor", "skills")), fs.realpathSync(foreign));
});

test("migration archives existing tool skills without losing local-only skills or edits", () => {
  const sourceDir = makeTempDir("ai-dev-source");
  const projectDir = makeTempDir("ai-dev-project");
  writeFile(path.join(sourceDir, "demo", "SKILL.md"), "central");
  for (const dir of Object.values(TOOL_DIRS)) {
    writeFile(path.join(projectDir, dir, "local", "SKILL.md"), "local edit");
    writeFile(path.join(projectDir, `${dir}.ai-dev-backup`, "keep.txt"), "old backup");
  }
  syncProject({ projectDir, sourceDir, force: true });
  for (const dir of Object.values(TOOL_DIRS)) {
    assert.equal(fs.readFileSync(path.join(projectDir, `${dir}.ai-dev-backup-1`, "local", "SKILL.md"), "utf8"), "local edit");
    assert.equal(fs.readFileSync(path.join(projectDir, `${dir}.ai-dev-backup`, "keep.txt"), "utf8"), "old backup");
    assert.ok(fs.lstatSync(path.join(projectDir, dir)).isSymbolicLink());
  }
});

test("empty central store still creates the shared directory and links", () => {
  const projectDir = makeTempDir("ai-dev-project");
  assert.deepEqual(syncProject({ projectDir, sourceDir: makeTempDir("ai-dev-source"), force: true }), []);
  for (const dir of Object.values(TOOL_DIRS)) assert.ok(fs.lstatSync(path.join(projectDir, dir)).isSymbolicLink());
});

test("foreign and dangling tool links are rejected without touching their targets", () => {
  for (const dangling of [false, true]) {
    const projectDir = makeTempDir("ai-dev-project");
    const sourceDir = makeTempDir("ai-dev-source");
    const foreign = path.join(makeTempDir("ai-dev-foreign"), "skills");
    if (!dangling) writeFile(path.join(foreign, "keep.txt"), "keep");
    fs.mkdirSync(path.join(projectDir, ".claude"));
    fs.symlinkSync(foreign, path.join(projectDir, ".claude", "skills"), process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => syncProject({ projectDir, sourceDir, force: true }), /points elsewhere/);
    assert.equal(fs.existsSync(path.join(projectDir, ".agents")), false);
    if (!dangling) assert.equal(fs.readFileSync(path.join(foreign, "keep.txt"), "utf8"), "keep");
  }
});

test("invalid source fails before creating tool folders", () => {
  const projectDir = makeTempDir("ai-dev-project");
  const sourceDir = makeTempDir("ai-dev-source");
  writeFile(path.join(sourceDir, "broken", "notes.md"), "missing skill");
  assert.throws(() => syncProject({ projectDir, sourceDir, force: true }), /Missing SKILL.md/);
  assert.equal(fs.existsSync(path.join(projectDir, ".agents")), false);
});

test("linked parent folders and canonical skill directories are rejected", () => {
  for (const relative of [".agents", ".claude", path.join(".agents", "skills", "demo")]) {
    const projectDir = makeTempDir("ai-dev-project");
    const sourceDir = makeTempDir("ai-dev-source");
    const foreign = makeTempDir("ai-dev-foreign");
    writeFile(path.join(sourceDir, "demo", "SKILL.md"), "central");
    const target = path.join(projectDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(foreign, target, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => syncProject({ projectDir, sourceDir, force: true }), /Expected a real/);
    assert.deepEqual(fs.readdirSync(foreign), []);
  }
});

test("canonical directory cannot also be the source", () => {
  const projectDir = makeTempDir("ai-dev-project");
  const sourceDir = path.join(projectDir, ".agents", "skills");
  writeFile(path.join(sourceDir, "demo", "SKILL.md"), "keep");
  assert.throws(() => syncProject({ projectDir, sourceDir, force: true }), /Source skills must be separate/);
  assert.equal(fs.readFileSync(path.join(sourceDir, "demo", "SKILL.md"), "utf8"), "keep");
});

test("link creation failure restores the original tool directory", () => {
  const projectDir = makeTempDir("ai-dev-project");
  const sourceDir = makeTempDir("ai-dev-source");
  const original = path.join(projectDir, ".claude", "skills", "keep.txt");
  writeFile(original, "keep");
  const symlinkSync = fs.symlinkSync;
  fs.symlinkSync = () => { throw new Error("link creation denied"); };
  try {
    assert.throws(() => syncProject({ projectDir, sourceDir, force: true }), /Could not link.*link creation denied/);
  } finally {
    fs.symlinkSync = symlinkSync;
  }
  assert.equal(fs.readFileSync(original, "utf8"), "keep");
  assert.equal(fs.existsSync(path.join(projectDir, ".ai-dev", "state.json")), false);
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

  assert.match(gitignore, /# ai-dev/);
  assert.match(gitignore, /\.ai-dev\//);
  assert.match(gitignore, /\.agents\/skills\//);
  for (const tool of ["claude"]) {
    assert.ok(gitignore.includes(`/.${tool}/skills\n`));
  }
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
  assert.equal((gitignore.match(/# ai-dev/g) || []).length, 1);
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
  assert.match(gitignore, /# ai-dev/);
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
  assert.equal((gitignore.match(/# ai-dev/g) || []).length, 1);
  assert.match(gitignore, /\/\.claude\/skills$/m);
  assert.match(gitignore, /^\/AGENTS\.md$/m);
});

test("summarizeRootResults reports created, updated, and kept counts", () => {
  const output = summarizeRootResults([
    { file: "AGENTS.md", status: "updated" },
    { file: "CLAUDE.md", status: "kept" },
  ]);

  assert.match(output, /created: 0, updated: 1, kept: 1/);
  assert.match(output, /- updated AGENTS\.md/);
});

test("installRootFiles with overwrite replaces an existing root file", () => {
  const templatesDir = makeTempDir("ai-dev-templates");
  const projectDir = makeTempDir("ai-dev-project");

  writeFile(path.join(templatesDir, "AGENTS.md"), "newest from central");
  writeFile(path.join(projectDir, "AGENTS.md"), "stale blank scaffold");

  const results = installRootFiles({ projectDir, templatesDir, overwrite: true });

  assert.equal(results[0].status, "updated");
  assert.equal(
    fs.readFileSync(path.join(projectDir, "AGENTS.md"), "utf8"),
    "newest from central"
  );
});

test("seedSkillsFromPackage with overwrite refreshes an existing skill", () => {
  const packageRoot = makeTempDir("ai-dev-pkg");
  const sourceDir = makeTempDir("ai-dev-source");

  writeFile(path.join(packageRoot, "skills", "tdd", "SKILL.md"), "v2 from repo");
  writeFile(path.join(sourceDir, "tdd", "SKILL.md"), "v1 in central");

  seedSkillsFromPackage(sourceDir, packageRoot, { overwrite: true });

  assert.equal(
    fs.readFileSync(path.join(sourceDir, "tdd", "SKILL.md"), "utf8"),
    "v2 from repo"
  );
});

test("pullPackageRepo reports failure on a non-git directory", () => {
  const notARepo = makeTempDir("ai-dev-notgit");
  const result = pullPackageRepo(notARepo);
  assert.equal(result.ok, false);
});

test("seedTemplatesFromPackage copies the repo's real AGENTS.md/CLAUDE.md", () => {
  const packageRoot = makeTempDir("ai-dev-pkg");
  const templatesDir = makeTempDir("ai-dev-templates");

  writeFile(path.join(packageRoot, "AGENTS.md"), "real custom instructions");
  writeFile(path.join(packageRoot, "CLAUDE.md"), "@AGENTS.md\n");

  seedTemplatesFromPackage(templatesDir, packageRoot);

  assert.equal(
    fs.readFileSync(path.join(templatesDir, "AGENTS.md"), "utf8"),
    "real custom instructions"
  );
  assert.equal(
    fs.readFileSync(path.join(templatesDir, "CLAUDE.md"), "utf8"),
    "@AGENTS.md\n"
  );
});

test("seedTemplatesFromPackage overwrites a stale scaffold", () => {
  const packageRoot = makeTempDir("ai-dev-pkg");
  const templatesDir = makeTempDir("ai-dev-templates");

  writeFile(path.join(packageRoot, "AGENTS.md"), "real custom instructions");
  writeFile(path.join(packageRoot, "CLAUDE.md"), "@AGENTS.md\n");
  writeFile(path.join(templatesDir, "AGENTS.md"), "# AGENTS.md\n\n<!-- empty scaffold -->\n");

  seedTemplatesFromPackage(templatesDir, packageRoot);

  assert.equal(
    fs.readFileSync(path.join(templatesDir, "AGENTS.md"), "utf8"),
    "real custom instructions"
  );
});

test("seedTemplatesFromPackage falls back to scaffold when the repo lacks the file", () => {
  const packageRoot = makeTempDir("ai-dev-pkg");
  const templatesDir = makeTempDir("ai-dev-templates");

  seedTemplatesFromPackage(templatesDir, packageRoot);

  const agents = fs.readFileSync(path.join(templatesDir, "AGENTS.md"), "utf8");
  assert.match(agents, /# AGENTS.md/);
});

test("seedSkillsFromPackage seeds bundled skills but keeps existing ones", () => {
  const packageRoot = makeTempDir("ai-dev-pkg");
  const sourceDir = makeTempDir("ai-dev-source");

  writeFile(path.join(packageRoot, "skills", "tdd", "SKILL.md"), "bundled tdd");
  writeFile(path.join(packageRoot, "skills", "debugging", "SKILL.md"), "bundled debugging");
  writeFile(path.join(sourceDir, "tdd", "SKILL.md"), "my local tdd");

  seedSkillsFromPackage(sourceDir, packageRoot);

  assert.equal(
    fs.readFileSync(path.join(sourceDir, "tdd", "SKILL.md"), "utf8"),
    "my local tdd"
  );
  assert.equal(
    fs.readFileSync(path.join(sourceDir, "debugging", "SKILL.md"), "utf8"),
    "bundled debugging"
  );
});

test("runVerb requires the ai-dev namespace token", async () => {
  await assert.rejects(() => runVerb("init", []), /Usage: init ai-dev/);
  await assert.rejects(() => runVerb("sync", ["nope"]), /Usage: sync ai-dev/);
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
    { toolName: "claudecode", skillName: "debugging", status: "skipped" },
  ]);

  assert.match(output, /created: 1/);
  assert.match(output, /skipped: 1/);
  assert.match(output, /claudecode: debugging/);
});
