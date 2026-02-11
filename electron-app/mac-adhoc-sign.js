"use strict";

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

/**
 * Ad-hoc sign the Mac .app after pack (when not using CSC_LINK).
 * This avoids the "damaged" message; users only need to right-click > Open once.
 * Never throws so the build does not fail if signing fails.
 */
exports.default = async function (context) {
  if (process.platform !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );
  const projectDir = context.packager.info._appDir || __dirname;
  const entitlementsPath = path.join(projectDir, "entitlements.mac.plist");

  try {
    if (!fs.existsSync(appPath)) {
      console.warn("mac-adhoc-sign: .app not found at", appPath);
      return;
    }
    if (!fs.existsSync(entitlementsPath)) {
      console.warn("mac-adhoc-sign: entitlements not found at", entitlementsPath);
      return;
    }
    execSync(
      [
        "codesign",
        "--force",
        "--deep",
        "--sign",
        "-",
        "--entitlements",
        entitlementsPath,
        appPath
      ],
      { stdio: "inherit" }
    );
  } catch (e) {
    console.warn("Ad-hoc sign failed (app may still work; user may need to right-click > Open):", e.message);
  }
};
