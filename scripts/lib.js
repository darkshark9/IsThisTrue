const crypto = require("crypto");
const fs = require("fs");

function loadPrivateKey(pemPath) {
  const pem = fs.readFileSync(pemPath, "utf8");
  return crypto.createPrivateKey(pem);
}

function getPublicKeyDer(privateKey) {
  return crypto.createPublicKey(privateKey).export({ type: "spki", format: "der" });
}

function getPublicKeyBase64(publicKeyDer) {
  return publicKeyDer.toString("base64");
}

// Chrome's extension ID is the first 16 bytes of SHA-256(public_key_DER), hex-encoded,
// with each hex char remapped 0-9,a-f -> a-p.
function getExtensionId(publicKeyDer) {
  const hash = crypto.createHash("sha256").update(publicKeyDer).digest("hex");
  const first32 = hash.slice(0, 32);
  return first32.replace(/./g, (c) => String.fromCharCode(parseInt(c, 16) + "a".charCodeAt(0)));
}

module.exports = { loadPrivateKey, getPublicKeyDer, getPublicKeyBase64, getExtensionId };
