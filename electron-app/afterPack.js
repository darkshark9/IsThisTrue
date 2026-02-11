// ============================================================
// afterPack hook - Manual ad-hoc codesigning for macOS
// Runs after electron-builder assembles the .app but BEFORE
// the DMG is created, so the DMG contains a signed app.
//
// This bypasses electron-builder's unreliable built-in signing.
// ============================================================

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

exports.default = async function (context) {
  // Only sign on macOS builds
  if (process.platform !== "darwin") return;

  const appOutDir = context.appOutDir;
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) {
    console.log(`  afterPack: App not found at ${appPath}, skipping signing`);
    return;
  }

  console.log(`  afterPack: Ad-hoc signing ${appPath}`);

  try {
    // Ad-hoc sign the entire .app bundle (--deep signs nested frameworks/helpers)
    execSync(`codesign --force --deep -s - "${appPath}"`, {
      stdio: "inherit",
    });

    // Verify the signature
    const result = execSync(`codesign -dvv "${appPath}" 2>&1`, {
      encoding: "utf8",
    });
    console.log(`  afterPack: Signature verification:\n${result}`);

    if (result.includes("Signature=adhoc")) {
      console.log("  afterPack: Ad-hoc signature confirmed.");
    } else {
      console.warn("  afterPack: WARNING - Signature may not be ad-hoc!");
    }
  } catch (err) {
    console.error(`  afterPack: codesign failed: ${err.message}`);
    throw err;
  }
};
