// Runs `node --check` over every extension script, mirroring the CI workflow.
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const files = [
  "background.js",
  "content.js",
  "popup.js",
  "glance.js",
  ...listJs("shared"),
  ...listJs("email")
];

function listJs(directory) {
  return fs.readdirSync(path.join(root, directory))
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => path.join(directory, name));
}

let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { cwd: root, stdio: "inherit" });

  if (result.status !== 0) {
    failed = true;
    console.error(`Syntax check failed: ${file}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Syntax check passed for ${files.length} files.`);
