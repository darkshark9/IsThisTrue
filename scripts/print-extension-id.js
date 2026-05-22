#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getPublicKeyDer, getPublicKeyBase64, getExtensionId } = require("./lib");

const keyPath = process.env.EXTENSION_KEY_PATH || path.resolve(__dirname, "..", "extension-key.pem");
if (!fs.existsSync(keyPath)) {
  console.error(`Missing key at ${keyPath}. Run \`npm run generate:key\` first.`);
  process.exit(1);
}
const pem = fs.readFileSync(keyPath, "utf8");
const pub = getPublicKeyDer(crypto.createPrivateKey(pem));
console.log("Extension ID: " + getExtensionId(pub));
console.log("Public key base64 (manifest.json \"key\" field):");
console.log(getPublicKeyBase64(pub));
