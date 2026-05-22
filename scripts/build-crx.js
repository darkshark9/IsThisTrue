#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const crx3 = require("crx3");
const { getPublicKeyDer, getExtensionId } = require("./lib");

const ROOT = path.resolve(__dirname, "..");
const KEY_PATH = process.env.EXTENSION_KEY_PATH || path.join(ROOT, "extension-key.pem");
const MANIFEST_PATH = path.join(ROOT, "manifest.json");
const DOCS = path.join(ROOT, "docs");
const EXT_DIR = path.join(DOCS, "extension");
const PAGES_BASE = "https://darkshark9.github.io/IsThisTrue";

// Explicit allowlist — keeps node_modules, dist/, electron-app/, docs/, and marketing
// PNGs (Marquee/Smallpromo/IconLarge) out of the CRX.
const INCLUDE = [
  "manifest.json",
  "background.js",
  "content.js",
  "content.css",
  "popup.html",
  "popup.css",
  "popup.js",
  "icons/icon16.png",
  "icons/icon48.png",
  "icons/icon128.png",
];

async function main() {
  if (!fs.existsSync(KEY_PATH)) {
    console.error(`Missing signing key at ${KEY_PATH}. Run \`npm run generate:key\` first or set EXTENSION_KEY_PATH.`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const version = manifest.version;
  if (!version) {
    console.error("manifest.json has no \"version\" field.");
    process.exit(1);
  }

  const pem = fs.readFileSync(KEY_PATH, "utf8");
  const pub = getPublicKeyDer(crypto.createPrivateKey(pem));
  const extensionId = getExtensionId(pub);

  const stage = fs.mkdtempSync(path.join(os.tmpdir(), "itt-crx-"));
  try {
    for (const name of INCLUDE) {
      const src = path.join(ROOT, name);
      if (!fs.existsSync(src)) {
        console.warn(`  ! Skipping missing entry: ${name}`);
        continue;
      }
      fs.cpSync(src, path.join(stage, name), { recursive: true });
    }

    fs.mkdirSync(EXT_DIR, { recursive: true });
    const crxName = `is-this-true-${version}.crx`;
    const crxPath = path.join(EXT_DIR, crxName);

    await crx3([path.join(stage, "manifest.json")], {
      keyPath: KEY_PATH,
      crxPath,
    });

    const updateXml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${extensionId}'>
    <updatecheck codebase='${PAGES_BASE}/extension/${crxName}' version='${version}' />
  </app>
</gupdate>
`;
    fs.writeFileSync(path.join(DOCS, "update.xml"), updateXml);

    const size = fs.statSync(crxPath).size;
    console.log(`Built ${crxPath} (${(size / 1024).toFixed(1)} KB)`);
    console.log(`Wrote ${path.join(DOCS, "update.xml")}`);
    console.log(`Extension ID: ${extensionId}`);
    console.log(`Version:      ${version}`);
  } finally {
    fs.rmSync(stage, { recursive: true, force: true });
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
