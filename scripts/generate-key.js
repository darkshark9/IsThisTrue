#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getPublicKeyDer, getPublicKeyBase64, getExtensionId } = require("./lib");

const keyPath = path.resolve(__dirname, "..", "extension-key.pem");

if (fs.existsSync(keyPath)) {
  console.error("Refusing to overwrite existing extension-key.pem.");
  console.error("This key defines the extension's permanent ID — regenerating breaks all existing installs.");
  console.error("If you really mean it, delete the file and re-run.");
  process.exit(1);
}

const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

fs.writeFileSync(keyPath, privateKey, { mode: 0o600 });

const pub = getPublicKeyDer(crypto.createPrivateKey(privateKey));
const id = getExtensionId(pub);
const b64 = getPublicKeyBase64(pub);

console.log("Wrote:        " + keyPath);
console.log("Extension ID: " + id);
console.log("");
console.log("manifest.json \"key\" value (paste into manifest.json):");
console.log(b64);
console.log("");
console.log("Next steps:");
console.log("  1. BACK UP extension-key.pem to a password manager. If lost, you can never publish updates.");
console.log("  2. Add the base64 above to manifest.json as the \"key\" field (locks the ID for unpacked installs too).");
console.log("  3. Add the full PEM file contents as a GitHub repo secret named EXTENSION_KEY_PEM.");
