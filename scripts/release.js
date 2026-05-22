#!/usr/bin/env node
// Bumps manifest.json + electron-app/package.json to a new version,
// commits, tags vX.Y.Z, and pushes commit + tag. CI then:
//   - rebuilds the Chrome extension CRX and republishes update.xml (on push to main)
//   - builds the Windows .exe and macOS .dmg, attaches them to a GitHub Release (on the tag)
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/release.js <version>");
  console.error("Example: node scripts/release.js 1.0.6");
  process.exit(1);
}

const tag = `v${version}`;

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: "utf8", ...opts });
}

const status = sh("git status --porcelain").trim();
if (status) {
  console.error("Working tree is dirty. Commit or stash changes first:");
  console.error(status);
  process.exit(1);
}

const branch = sh("git rev-parse --abbrev-ref HEAD").trim();
if (branch !== "main") {
  console.error(`Refusing to release from branch "${branch}". Switch to main first.`);
  process.exit(1);
}

try {
  sh(`git rev-parse --verify ${tag}`, { stdio: "pipe" });
  console.error(`Tag ${tag} already exists locally.`);
  process.exit(1);
} catch {}

try {
  const remoteTag = sh(`git ls-remote --tags origin refs/tags/${tag}`).trim();
  if (remoteTag) {
    console.error(`Tag ${tag} already exists on origin.`);
    process.exit(1);
  }
} catch {}

function bump(relPath) {
  const full = path.join(ROOT, relPath);
  const content = fs.readFileSync(full, "utf8");
  const json = JSON.parse(content);
  const old = json.version;
  if (old === version) {
    console.log(`  ${relPath}: already ${version} (no change)`);
    return false;
  }
  json.version = version;
  const indent = (content.match(/^([ \t]+)"/m) || [, "  "])[1];
  const trailingNewline = content.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(full, JSON.stringify(json, null, indent) + trailingNewline);
  console.log(`  ${relPath}: ${old} -> ${version}`);
  return true;
}

console.log(`Releasing ${tag}`);
console.log("Bumping versions:");
const bumpedManifest = bump("manifest.json");
const bumpedInstaller = bump("electron-app/package.json");

if (!bumpedManifest && !bumpedInstaller) {
  console.error(`Both files already at ${version}. Nothing to release.`);
  process.exit(1);
}

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

run("git add manifest.json electron-app/package.json");
run(`git commit -m "Release ${tag}"`);
run(`git tag ${tag}`);
run("git push origin main");
run(`git push origin ${tag}`);

console.log("");
console.log(`Released ${tag}`);
console.log(`  CI runs:           https://github.com/darkshark9/IsThisTrue/actions`);
console.log(`  GitHub Release:    https://github.com/darkshark9/IsThisTrue/releases/tag/${tag}`);
console.log(`  Extension update:  https://darkshark9.github.io/IsThisTrue/update.xml`);
console.log("");
console.log("The .exe/.dmg will be attached to the Release in ~5-10 minutes once CI finishes.");
console.log("Chrome polls update.xml every few hours and will install the new CRX automatically.");
