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

function getHomeDir() {
  return os.homedir();
}

function getDefaultSourceDir() {
  return path.join(getHomeDir(), ".ai-dev", "skills");
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
  return { configPath, sourceDir };
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

function runSetup() {
  const configPath = getDefaultConfigPath();
  const sourceDir = getDefaultSourceDir();
  ensureDir(sourceDir);

  if (!fs.existsSync(configPath)) {
    writeJson(configPath, { sourceDir });
  }

  console.log(`Central skills folder: ${sourceDir}`);
  console.log("Add your skill folders there. Each skill must contain `SKILL.md`.");
}

function runInitOrSync({ force }) {
  const projectDir = process.cwd();
  const { sourceDir } = resolveConfig();

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Central skills folder not found: ${sourceDir}\nRun \`ai-dev setup\` first.`);
  }

  const results = syncProject({ projectDir, sourceDir, force });
  console.log(`Source: ${sourceDir}`);
  console.log(summarizeResults(results));
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
  getDefaultSourceDir,
  getDefaultConfigPath,
  listSkillDirs,
  readSkillSnapshot,
  syncProject,
  summarizeResults,
  main,
};
