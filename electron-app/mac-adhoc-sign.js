"use strict";

const path = require("path");
const { execSync } = require("child_process");

/**
 * Ad-hoc sign the Mac .app after pack (when not using CSC_LINK).
 * This avoids the "damaged" message; users only need to right-click > Open once.
 */
exports.default = async function (context) {
  if (process.platform !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );
  const entitlementsPath = path.join(__dirname, "entitlements.mac.plist");

  try {
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
