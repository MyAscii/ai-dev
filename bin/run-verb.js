const { runVerb } = require("../src/cli");

// Shared launcher for the verb-first bins (init / setup / sync / status).
// Each bin calls run(command); the rest of argv (e.g. "ai-dev", "--force") is parsed here.
function run(command) {
  runVerb(command, process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = { run };
