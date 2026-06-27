const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const VERSION = "0.1.0";
const STATE_RELATIVE_PATH = path.join(".ai-dev", "state.json");
const TOOL_DIRS = {
  claudecode: path.join(".claude", "skills"),
  codex: path.join(".codex", "skills"),
  trae: path.join(".trae", "skills"),
  cursor: path.join(".cursor", "skills"),
};
const REPO_GITIGNORE_ENTRIES = [
  ".ai-dev/",
  ...Object.values(TOOL_DIRS).map((toolDir) => `${toolDir.split(path.sep).join("/")}/`),
];

const DEFAULT_AGENTS_MD = `# AGENTS.md

Shared instructions for AI coding agents working in this repository.
Read natively by Codex, Cursor, and Trae. Claude Code reads it via the
\`@AGENTS.md\` import in \`CLAUDE.md\`.

## Project overview

<!-- What this project is, in a sentence or two. -->

## Setup & commands

<!-- e.g.
- Install: \`...\`
- Build: \`...\`
- Test: \`...\`
- Lint: \`...\`
-->

## Conventions

<!-- Coding style, naming, structure, anything an agent should follow. -->

## Things to be careful with

<!-- Dirs/files that need extra care, gotchas, do-not-touch areas. -->
`;

const DEFAULT_CLAUDE_MD = `@AGENTS.md

## Claude Code

<!-- Claude Code-specific instructions go here (these are NOT shared with other tools).
     Examples:
     - Use plan mode for changes under \`src/...\`.
     - Always run \`npm test\` before committing.
-->
`;

const DEFAULT_TEMPLATE_FILES = {
  "AGENTS.md": DEFAULT_AGENTS_MD,
  "CLAUDE.md": DEFAULT_CLAUDE_MD,
};

function getHomeDir() {
  return os.homedir();
}

function getDefaultSourceDir() {
  return path.join(getHomeDir(), ".ai-dev", "skills");
}

function getDefaultTemplatesDir() {
  return path.join(getHomeDir(), ".ai-dev", "templates");
}

function getDefaultConfigPath() {
  return path.join(getHomeDir(), ".ai-dev", "config.json");
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function ensureRepoGitignore(projectDir, entries = REPO_GITIGNORE_ENTRIES) {
  const gitignorePath = path.join(projectDir, ".gitignore");
  const existing = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";
  const normalized = existing.replace(/\r\n/g, "\n");
  const lines = normalized === "" ? [] : normalized.split("\n");
  const existingEntries = new Set(lines);
  const missingEntries = entries.filter((entry) => !existingEntries.has(entry));

  if (missingEntries.length === 0) {
    return;
  }

  const nextLines = [...lines];
  while (nextLines.length > 0 && nextLines[nextLines.length - 1] === "") {
    nextLines.pop();
  }

  if (nextLines.length > 0) {
    nextLines.push("");
  }

  if (!existingEntries.has("# ai-dev-skills-kit")) {
    nextLines.push("# ai-dev-skills-kit");
  }
  nextLines.push(...missingEntries);
  fs.writeFileSync(gitignorePath, `${nextLines.join("\n")}\n`, "utf8");
}

function listSkillDirs(sourceDir) {
  if (!fs.existsSync(sourceDir)) {
    return [];
  }

  return fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function walkFiles(rootDir) {
  const files = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return files.sort();
}

function readSkillSnapshot(skillDir) {
  const skillFile = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillFile)) {
    throw new Error(`Missing SKILL.md in ${skillDir}`);
  }

  const files = {};
  for (const fullPath of walkFiles(skillDir)) {
    const relativePath = path.relative(skillDir, fullPath).split(path.sep).join("/");
    files[relativePath] = fs.readFileSync(fullPath, "utf8");
  }

  return {
    hash: sha256(JSON.stringify(files)),
    files,
  };
}

function resolveConfig() {
  const configPath = getDefaultConfigPath();
  const config = readJsonIfExists(configPath, {});
  const sourceDir = config.sourceDir || getDefaultSourceDir();
  const templatesDir = config.templatesDir || getDefaultTemplatesDir();
  return { configPath, sourceDir, templatesDir };
}

function getStatePath(projectDir) {
  return path.join(projectDir, STATE_RELATIVE_PATH);
}

function readState(projectDir) {
  return readJsonIfExists(getStatePath(projectDir), {
    kit: "ai-dev-skills-kit",
    version: VERSION,
    sourceDir: null,
    tools: Object.keys(TOOL_DIRS),
    installedAt: null,
    skills: {},
  });
}

function writeState(projectDir, state) {
  writeJson(getStatePath(projectDir), state);
}

function copySkillFiles(destinationDir, snapshot) {
  ensureDir(destinationDir);
  for (const [relativePath, content] of Object.entries(snapshot.files)) {
    const destinationPath = path.join(destinationDir, ...relativePath.split("/"));
    ensureDir(path.dirname(destinationPath));
    fs.writeFileSync(destinationPath, content, "utf8");
  }
}

function removeDirIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function isManagedUnchanged(destinationDir, previousFiles) {
  if (!previousFiles) {
    return false;
  }

  for (const [relativePath, previousContent] of Object.entries(previousFiles)) {
    const fullPath = path.join(destinationDir, ...relativePath.split("/"));
    if (!fs.existsSync(fullPath)) {
      return false;
    }
    const currentContent = fs.readFileSync(fullPath, "utf8");
    if (currentContent !== previousContent) {
      return false;
    }
  }

  return true;
}

function installSkillForTool({
  projectDir,
  toolName,
  skillName,
  snapshot,
  state,
  force,
}) {
  const toolRoot = path.join(projectDir, TOOL_DIRS[toolName]);
  const destinationDir = path.join(toolRoot, skillName);
  const previousToolState = state.skills?.[skillName]?.tools?.[toolName];

  if (!fs.existsSync(destinationDir)) {
    copySkillFiles(destinationDir, snapshot);
    return { status: "created", hash: snapshot.hash, files: snapshot.files };
  }

  if (previousToolState && previousToolState.hash === snapshot.hash) {
    return { status: "unchanged", hash: snapshot.hash, files: snapshot.files };
  }

  const safeToUpdate = isManagedUnchanged(destinationDir, previousToolState?.files);
  if (!safeToUpdate && !force) {
    return {
      status: "skipped",
      hash: previousToolState?.hash || null,
      files: previousToolState?.files || null,
    };
  }

  removeDirIfExists(destinationDir);
  copySkillFiles(destinationDir, snapshot);
  return { status: safeToUpdate ? "updated" : "overwritten", hash: snapshot.hash, files: snapshot.files };
}

function syncProject({ projectDir, sourceDir, force }) {
  const skillNames = listSkillDirs(sourceDir);
  const state = readState(projectDir);
  const tools = Object.keys(TOOL_DIRS);
  const results = [];
  const nextState = {
    kit: "ai-dev-skills-kit",
    version: VERSION,
    sourceDir,
    tools,
    installedAt: new Date().toISOString(),
    skills: {},
  };

  ensureRepoGitignore(projectDir);

  for (const skillName of skillNames) {
    const snapshot = readSkillSnapshot(path.join(sourceDir, skillName));
    nextState.skills[skillName] = { sourceHash: snapshot.hash, tools: {} };

    for (const toolName of tools) {
      const result = installSkillForTool({
        projectDir,
        toolName,
        skillName,
        snapshot,
        state,
        force,
      });

      nextState.skills[skillName].tools[toolName] = {
        hash: result.hash,
        files: result.files,
      };

      results.push({ toolName, skillName, status: result.status });
    }
  }

  writeState(projectDir, nextState);
  return results;
}

function summarizeResults(results) {
  const counts = {
    created: 0,
    updated: 0,
    overwritten: 0,
    unchanged: 0,
    skipped: 0,
  };

  for (const result of results) {
    counts[result.status] += 1;
  }

  const lines = [
    `created: ${counts.created}`,
    `updated: ${counts.updated}`,
    `overwritten: ${counts.overwritten}`,
    `unchanged: ${counts.unchanged}`,
    `skipped: ${counts.skipped}`,
  ];

  const skipped = results.filter((result) => result.status === "skipped");
  if (skipped.length > 0) {
    lines.push("");
    lines.push("Skipped local changes:");
    for (const result of skipped) {
      lines.push(`- ${result.toolName}: ${result.skillName}`);
    }
  }

  return lines.join("\n");
}

function installRootFiles({ projectDir, templatesDir }) {
  if (!fs.existsSync(templatesDir)) {
    return [];
  }

  const results = [];
  for (const fullPath of walkFiles(templatesDir)) {
    const relativePath = path.relative(templatesDir, fullPath).split(path.sep).join("/");
    const destinationPath = path.join(projectDir, ...relativePath.split("/"));

    if (fs.existsSync(destinationPath)) {
      results.push({ file: relativePath, status: "kept" });
      continue;
    }

    ensureDir(path.dirname(destinationPath));
    fs.copyFileSync(fullPath, destinationPath);
    results.push({ file: relativePath, status: "created" });
  }

  if (results.length > 0) {
    ensureRepoGitignore(
      projectDir,
      results.map((result) => `/${result.file}`)
    );
  }

  return results;
}

function summarizeRootResults(results) {
  const created = results.filter((result) => result.status === "created");
  const kept = results.filter((result) => result.status === "kept");
  const lines = [`Root files — created: ${created.length}, kept: ${kept.length}`];
  for (const result of created) {
    lines.push(`- created ${result.file}`);
  }
  return lines.join("\n");
}

function seedDefaultTemplates(templatesDir) {
  ensureDir(templatesDir);
  for (const [name, content] of Object.entries(DEFAULT_TEMPLATE_FILES)) {
    const filePath = path.join(templatesDir, name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, "utf8");
    }
  }
}

function runSetup() {
  const configPath = getDefaultConfigPath();
  const sourceDir = getDefaultSourceDir();
  const templatesDir = getDefaultTemplatesDir();
  ensureDir(sourceDir);
  seedDefaultTemplates(templatesDir);

  if (!fs.existsSync(configPath)) {
    writeJson(configPath, { sourceDir });
  }

  console.log(`Central skills folder: ${sourceDir}`);
  console.log("Add your skill folders there. Each skill must contain `SKILL.md`.");
  console.log(`Central templates folder: ${templatesDir}`);
  console.log("Edit AGENTS.md / CLAUDE.md there; they are copied into each repo on init/sync.");
}

function runInitOrSync({ force }) {
  const projectDir = process.cwd();
  const { sourceDir, templatesDir } = resolveConfig();

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Central skills folder not found: ${sourceDir}\nRun \`ai-dev setup\` first.`);
  }

  const results = syncProject({ projectDir, sourceDir, force });
  console.log(`Source: ${sourceDir}`);
  console.log(summarizeResults(results));

  const rootResults = installRootFiles({ projectDir, templatesDir });
  if (rootResults.length > 0) {
    console.log("");
    console.log(`Templates: ${templatesDir}`);
    console.log(summarizeRootResults(rootResults));
  }
}

function runStatus() {
  const projectDir = process.cwd();
  const statePath = getStatePath(projectDir);
  if (!fs.existsSync(statePath)) {
    console.log("No ai-dev state found in this repo.");
    return;
  }

  const state = readState(projectDir);
  const skillNames = Object.keys(state.skills || {}).sort();
  console.log(`State file: ${statePath}`);
  console.log(`Source: ${state.sourceDir || "unknown"}`);
  console.log(`Tools: ${(state.tools || []).join(", ")}`);
  console.log(`Skills: ${skillNames.length}`);
  for (const skillName of skillNames) {
    console.log(`- ${skillName}`);
  }
}

function parseArgs(argv) {
  const [command = "init", ...rest] = argv;
  const force = rest.includes("--force");
  return { command, force };
}

async function main(argv) {
  const { command, force } = parseArgs(argv);

  switch (command) {
    case "setup":
      runSetup();
      break;
    case "init":
      runInitOrSync({ force: false });
      break;
    case "sync":
      runInitOrSync({ force });
      break;
    case "status":
      runStatus();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

module.exports = {
  TOOL_DIRS,
  STATE_RELATIVE_PATH,
  DEFAULT_TEMPLATE_FILES,
  getDefaultSourceDir,
  getDefaultConfigPath,
  getDefaultTemplatesDir,
  listSkillDirs,
  readSkillSnapshot,
  syncProject,
  installRootFiles,
  summarizeResults,
  summarizeRootResults,
  seedDefaultTemplates,
  main,
};
