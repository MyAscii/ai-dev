// Real-filesystem evaluation. No inference or external services required.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { TOOL_DIRS, seedSkillsFromPackage, seedTemplatesFromPackage } = require("../src/cli");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-dev-layout-eval-"));
const home = path.join(root, "home");
const project = path.join(root, "project with spaces");
const source = path.join(home, ".ai-dev", "skills");
fs.mkdirSync(project, { recursive: true });
seedSkillsFromPackage(source);
seedTemplatesFromPackage(path.join(home, ".ai-dev", "templates"));
const env = { ...process.env, HOME: home, USERPROFILE: home };
const run = (verb) => execFileSync(process.execPath, [path.join(__dirname, "..", "bin", `${verb}.js`), "ai-dev"], { cwd: project, env, encoding: "utf8" });
const checks = [];
function check(name, fn) {
  fn();
  checks.push(name);
  console.log(`PASS ${name}`);
}

check("fresh CLI init installs bundled scripts and one shared tree", () => {
  assert.match(run("init"), /Tool skills folders link/);
  for (const dir of Object.values(TOOL_DIRS)) {
    const target = path.join(project, dir);
    assert.ok(fs.lstatSync(target).isSymbolicLink());
    assert.equal(fs.realpathSync(target), fs.realpathSync(path.join(project, ".agents", "skills")));
    assert.equal(fs.readFileSync(path.join(target, "rr", "scripts", "doctor.mjs"), "utf8"), fs.readFileSync(path.join(source, "rr", "scripts", "doctor.mjs"), "utf8"));
  }
});
check("repeat CLI init is idempotent", () => assert.match(run("init"), /created: 0/));
check("only agents and Claude skills paths are created; retired aliases are removed", () => {
  for (const tool of ["codex", "cursor", "trae"]) {
    const parent = path.join(project, `.${tool}`);
    assert.equal(fs.existsSync(parent), false);
    fs.mkdirSync(parent);
    fs.symlinkSync(path.join(project, ".agents", "skills"), path.join(parent, "skills"), process.platform === "win32" ? "junction" : "dir");
  }
  run("init");
  for (const tool of ["codex", "cursor", "trae"]) assert.equal(fs.existsSync(path.join(project, `.${tool}`, "skills")), false);
  assert.ok(fs.existsSync(path.join(project, ".agents", "skills", "tdd", "SKILL.md")));
});
check("central update reaches all tools", () => {
  fs.appendFileSync(path.join(source, "tdd", "SKILL.md"), "\nEvaluation update\n");
  run("init");
  for (const dir of Object.values(TOOL_DIRS)) assert.match(fs.readFileSync(path.join(project, dir, "tdd", "SKILL.md"), "utf8"), /Evaluation update/);
});
check("Git ignores both canonical files and tool links", () => {
  execFileSync("git", ["init", "--quiet"], { cwd: project });
  for (const target of [".agents/skills/tdd/SKILL.md", ...Object.values(TOOL_DIRS)]) {
    execFileSync("git", ["check-ignore", "--quiet", target], { cwd: project });
  }
});
check("CLI status identifies canonical skills directory", () => assert.match(run("status"), /Project skills: .agents\/skills/));
check("legacy directories migrate with local content preserved", () => {
  const legacy = path.join(root, "legacy");
  fs.mkdirSync(legacy);
  for (const dir of Object.values(TOOL_DIRS)) {
    fs.mkdirSync(path.join(legacy, dir), { recursive: true });
    fs.writeFileSync(path.join(legacy, dir, "local.txt"), "local");
  }
  const output = execFileSync(process.execPath, [path.join(__dirname, "..", "bin", "init.js"), "ai-dev"], { cwd: legacy, env, encoding: "utf8" });
  assert.match(output, /Archived previous skills/);
  for (const dir of Object.values(TOOL_DIRS)) assert.equal(fs.readFileSync(path.join(legacy, `${dir}.ai-dev-backup`, "local.txt"), "utf8"), "local");
});
console.log(JSON.stringify({ passed: checks.length, total: 7, threshold: 1, artifacts: root }));
