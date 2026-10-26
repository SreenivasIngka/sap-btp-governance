
const fs = require("node:fs");
const path = require("node:path");

const root = process.env.APPLICATION_DIR || process.cwd();
let failures = 0;
let warnings = 0;

function report(id, title, passed, severity, remediation) {
  if (passed) {
    console.log(`PASS ${id}: ${title}`);
    return;
  }

  const message = `${id}: ${title}. Fix: ${remediation}`;

  if (severity === "Block") {
    console.error(`::error::${message}`);
    failures++;
  } else {
    console.warn(`::warning::${message}`);
    warnings++;
  }
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function read(file) {
  const fullPath = path.join(root, file);
  return exists(file) ? fs.readFileSync(fullPath, "utf8") : "";
}

function hasAnyFile(paths) {
  return paths.some(exists);
}

// REPO-001: Repository naming convention
const repoName = (process.env.GITHUB_REPOSITORY || "")
  .split("/")
  .pop() || "";

const pattern = process.env.COE_REPOSITORY_NAME_REGEX;

let validName = false;
try {
  if (pattern) validName = new RegExp(pattern).test(repoName);
} catch {
  console.error("::error::Invalid COE_REPOSITORY_NAME_REGEX");
  failures++;
}

report(
  "REPO-001",
  "Repository follows CoE naming standard",
  Boolean(pattern) && validName,
  "Block",
  "Configure COE_REPOSITORY_NAME_REGEX and rename the repository if needed."
);

// REPO-002: Gitflow branch naming
const allowedBranch = name =>
  name === "main" ||
  name === "dev" ||
  /^feature\/.+/.test(name) ||
  /^release\/.+/.test(name);

const head = process.env.PR_HEAD_BRANCH || "";
const base = process.env.PR_BASE_BRANCH || "";

report(
  "REPO-002",
  "PR source and target branches follow Gitflow",
  Boolean(head && base && allowedBranch(head) && allowedBranch(base)),
  "Block",
  "Use main, dev, feature/<name>, or release/<name> branches."
);

// REPO-003 through REPO-006 are enforced by GitHub rulesets.
// A file-only script cannot reliably verify actual GitHub settings.

// REPO-007: CODEOWNERS
report(
  "REPO-007",
  "CODEOWNERS file is present",
  hasAnyFile([
    ".github/CODEOWNERS",
    "CODEOWNERS",
    "docs/CODEOWNERS"
  ]),
  "Warn",
  "Add a CODEOWNERS file with the appropriate owners."
);

// REPO-008: Required .gitignore patterns
const ignoreLines = read(".gitignore")
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith("#"));

const requiredPatterns = [
  "node_modules/",
  "gen/",
  "mta_archives/",
  "default-env.json",
  ".env",
  "*.sqlite"
];

const missingPatterns = requiredPatterns.filter(
  required => !ignoreLines.some(line => line === required)
);

report(
  "REPO-008",
  "Required .gitignore exclusions are present",
  exists(".gitignore") && missingPatterns.length === 0,
  "Warn",
  `Add missing patterns to .gitignore: ${
    missingPatterns.join(", ") || ".gitignore"
  }`
);

// REPO-009: README content
const readme = read("README.md");

const requiredHeadings = [
  /^#{1,6}\s+.*purpose/im,
  /^#{1,6}\s+.*local.*(run|setup)/im,
  /^#{1,6}\s+.*deploy/im
];

report(
  "REPO-009",
  "README contains purpose, local run, and deploy sections",
  exists("README.md") &&
    requiredHeadings.every(regex => regex.test(readme)),
  "Warn",
  "Add README headings for Purpose, Local Run/Setup, and Deploy."
);

// REPO-010: Pull request template
report(
  "REPO-010",
  "Pull request template is present",
  hasAnyFile([
    ".github/pull_request_template.md",
    "pull_request_template.md",
    "docs/pull_request_template.md"
  ]),
  "Warn",
  "Add a supported GitHub pull request template."
);

console.log(
  `Repository checks completed: ${failures} blocking failure(s), ` +
  `${warnings} warning(s).`
);

if (failures > 0) process.exitCode = 1;
