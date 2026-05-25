import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function exists(path) {
  return existsSync(join(root, path));
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function isGitRepo() {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function gitTrackedFiles() {
  try {
    return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean)
      .map((path) => path.replaceAll("\\", "/"));
  } catch {
    return [];
  }
}

function hasRequiredIgnore(pattern) {
  return read(".gitignore")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .includes(pattern);
}

function matchesSensitiveTrackedPath(path) {
  return (
    path === ".env" ||
    path.startsWith(".env.") ||
    path.startsWith(".next/") ||
    path.startsWith(".vercel/") ||
    path.startsWith("node_modules/") ||
    path.startsWith("supabase/.temp/") ||
    path.startsWith("backups/") ||
    path.endsWith(".pem") ||
    path.endsWith(".dump") ||
    path.endsWith(".bak") ||
    path.endsWith(".backup") ||
    path.endsWith(".tsbuildinfo") ||
    path.endsWith(".log")
  );
}

function collectFiles(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    if ([".git", ".next", "node_modules", ".vercel"].includes(entry)) continue;

    const absolute = join(directory, entry);
    const relativePath = relative(root, absolute).replaceAll("\\", "/");
    const stat = statSync(absolute);

    if (stat.isDirectory()) {
      if (["backups", "supabase/.temp"].includes(relativePath)) continue;
      collectFiles(absolute, files);
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

function scanForObviousSecrets() {
  const allowed = new Set(["README.md"]);
  const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".sql", ".ps1", ".md"]);
  const obviousSecretPatterns = [
    /postgresql:\/\/[^\s"']+:[^\s"']+@/i,
    /\b(sb_secret|sb_service_role|service_role)_[A-Za-z0-9_-]{16,}\b/,
    /\bsbp_[A-Za-z0-9_-]{20,}\b/,
    /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/
  ];

  for (const file of collectFiles(root)) {
    if (allowed.has(file)) continue;
    if (!sourceExtensions.has(file.slice(file.lastIndexOf(".")))) continue;

    const content = read(file);
    if (obviousSecretPatterns.some((pattern) => pattern.test(content))) {
      fail(`${file} contains a value that looks like a hardcoded secret.`);
    }
  }
}

if (!exists(".gitignore")) fail(".gitignore is missing.");

for (const pattern of [
  ".env*",
  ".next/",
  "node_modules/",
  ".vercel/",
  "supabase/.temp/",
  "backups/",
  "*.tsbuildinfo",
  "*.log"
]) {
  if (exists(".gitignore") && !hasRequiredIgnore(pattern)) fail(`.gitignore is missing ${pattern}.`);
}

if (exists(".env")) fail("Root .env exists. Use .env.local locally and keep it out of Git.");

for (const path of [".env.local", "supabase/.temp", "backups", "node_modules", ".next", "tsconfig.tsbuildinfo"]) {
  if (!exists(path)) continue;
  if (strict) fail(`${path} exists. Remove it before sharing a zip/tarball.`);
  else warn(`${path} exists locally. It must stay ignored and must not be uploaded manually.`);
}

const packageJson = JSON.parse(read("package.json"));
if (!packageJson.license) fail("package.json is missing a license field.");
if (!exists("LICENSE")) fail("LICENSE file is missing.");
if (!exists("CONTRIBUTING.md")) fail("CONTRIBUTING.md is missing.");

if (isGitRepo()) {
  const trackedSensitiveFiles = gitTrackedFiles().filter(matchesSensitiveTrackedPath);
  if (trackedSensitiveFiles.length > 0) {
    fail(`Sensitive/generated files are tracked by Git: ${trackedSensitiveFiles.join(", ")}`);
  }
} else {
  warn("Git repository not initialized; tracked-file safety check was skipped.");
}

scanForObviousSecrets();

if (warnings.length > 0) {
  console.log("Publish check warnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (failures.length > 0) {
  console.error("Publish check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Publish check passed${strict ? " in strict mode" : ""}.`);
