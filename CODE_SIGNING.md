# Code Signing and "Unsafe" Warnings

Your Electron app can show as "unsafe" or "unknown publisher" on Windows (SmartScreen) and Mac (Gatekeeper) when it is not signed with a trusted certificate. Here are your options without paying for standard commercial code signing.

---

## Free option: SignPath Foundation (Windows)

**SignPath Foundation** (https://signpath.org) offers **free code signing for open source projects**.

- They sign your builds with their certificate and vouch that the binary came from your repo.
- Removes "Unknown publisher" / SmartScreen-style warnings for signed builds.
- Typical requirements: OSI-approved open source license (e.g. MIT), no commercial dual-licensing, actively maintained project, no malware, you only sign your own code.
- Integrates with CI (e.g. GitHub Actions) so builds are signed automatically.

**What to do:** Apply at https://signpath.org. If you accept it, add a `LICENSE` file (e.g. MIT) to the repo root if you have not already.

**Note:** SignPath focuses on Windows. For Mac, see below.

---

## Low-cost option: Certum Open Source (Windows)

**Certum** offers an **Open Source Code Signing** certificate (from about **$29**).

- You get your own certificate; publisher name can show as "Open Source Developer."
- Trusted by Windows; helps with SmartScreen and reputation over time.
- Issued to individuals (not organizations); requires identity verification and proof of involvement in an open source project.

Details: https://certum.store/open-source-code-signing-code.html

---

## Mac: no free way to remove Gatekeeper warnings

On macOS, to avoid "app is from an unidentified developer" and to support notarization:

- You need an **Apple Developer Program** membership (**$99/year**).
- That gives you a Developer ID certificate and the ability to notarize the app.
- There is no free Apple-approved path for distributing signed, notarized apps outside the App Store.

Without that, users can still run the app: **right-click the app → Open → Open** (first time only). You can document this in your README or install notes.

---

## What you can do for free right now

1. **Document how to run despite the warning**
   - **Windows:** "Windows protected your PC" → click **More info** → **Run anyway**. Optionally: right-click the `.exe` → **Properties** → check **Unblock** (if present) → OK, then run.
   - **Mac:** Right-click the app → **Open** → **Open** in the dialog (only needed the first time).

2. **Apply to SignPath** if the project is (or can be) open source under an OSI-approved license. That gives you free signing for Windows builds.

3. **Optional:** Add a short "Installation" or "If Windows/Mac blocks the app" section in your README that points to the steps above and/or to this file.

---

## Summary

| Platform | Free option | Low-cost option |
|----------|-------------|-----------------|
| **Windows** | SignPath Foundation (for qualifying open source projects) | Certum Open Source (~$29) |
| **Mac**     | None (user can Right-click → Open) | Apple Developer Program ($99/year) for signing + notarization |

There is no fully free way to get a certificate that both Windows and Mac trust like a paid vendor. SignPath is the main free route for Windows if your project is open source.

---

## Deep dive: how Windows and macOS verify signing

Below is a technical overview of *when* and *how* each OS checks signatures and reputation.

---

### Windows: two separate layers

Windows uses (1) **Authenticode** to verify the signature and identity, and (2) **SmartScreen** to apply reputation. They run at different times and use different data.

#### 1. Authenticode (signature and integrity)

**What it is:** A code-signing format based on **PKCS#7 SignedData** and X.509 certificates. It ties a hash of the file to a publisher identity.

**Where the signature lives:** In **PE (Portable Executable)** files, the signature is in the **Attribute Certificate Table**. The PE Optional Header has a Data Directory entry that points to this table. Each entry in the table has:

- Length, revision, certificate type (WIN_CERT_TYPE_PKCS_SIGNEDDATA for Authenticode).
- The **bCertificate** blob: a **PKCS#7 SignedData** structure in DER encoding. That blob contains:
  - A **hash of the PE** (e.g. SHA-1 or SHA-256), computed over almost the whole file *except* the checksum, the certificate table RVA/size, and the attribute certificate table itself (so embedding the signature doesn’t change the hash).
  - A **signature** over that hash, produced with the publisher’s **private key**.
  - The **X.509 certificate chain**: end-entity (your code signing cert) and any intermediates, all the way to a **root CA**.

**When it’s checked:** When the loader maps the executable (e.g. `CreateProcess` or loading a DLL). The kernel/code integrity stack:

1. Locates the Attribute Certificate Table and the PKCS#7 blob.
2. **Recomputes the PE hash** (same rules as when signing) and compares it to the hash in the SignedData. If they differ, the file was modified after signing → invalid.
3. **Verifies the signature** with the public key in the end-entity certificate.
4. **Builds and validates the certificate chain**: end-entity → intermediate(s) → **root**. The root must be in the **Windows Trusted Root Certification Authorities** store (or the kernel’s equivalent). If any cert is expired, revoked, or the chain doesn’t lead to a trusted root, verification fails.
5. Optionally checks **timestamp**: if the signature was timestamped by a trusted TSA, the signature can still be considered valid after the signing cert expires.

If any step fails, Windows can block load or show “unknown publisher” / integrity errors. If everything passes, the binary is considered signed by a known chain; the **publisher name** comes from the end-entity cert’s subject (e.g. CN, O).

**Trust store:** Only roots in **Microsoft’s Trusted Root Program** (and the local machine’s Trusted Root store) count. That’s why self-signed certs don’t satisfy Authenticode: their root isn’t in that store.

#### 2. SmartScreen (reputation)

**What it is:** A **reputation** system for files that come from the internet. It is **separate** from Authenticode. A file can be correctly Authenticode-signed and still get a SmartScreen warning if it has no reputation.

**When it triggers:** When a file is **downloaded** by a browser or other app that sets the **Mark of the Web** (MotW) — an alternate data stream or zone identifier indicating “from internet.” When the user (or installer) **runs** that file, the shell/loader consults SmartScreen.

**What it checks:**

- **By hash:** The exact file’s hash (e.g. SHA-256) is sent to Microsoft. If that hash has been seen often enough without reports of malware, it can get “good” reputation and avoid a block.
- **By certificate:** If the file is Authenticode-signed, SmartScreen also tracks reputation by **signing certificate**. Reputation attaches to the cert, so new builds signed with the same cert can inherit it. Unsigned files only get hash-based reputation, and each new build has a new hash, so reputation doesn’t carry over.

So: **Authenticode** = “Is this file signed and unmodified, and is the signer’s cert chain trusted?” **SmartScreen** = “Have we seen this file (or this signer) enough to treat it as safe?” Both can influence the “Windows protected your PC” / “Unknown publisher” experience.

---

### macOS: code signing + Gatekeeper + notarization

macOS ties together **code signing** (integrity + identity), **Gatekeeper** (policy at launch), and **notarization** (Apple’s extra check that the build isn’t known malware).

#### 1. Code signing (what’s in the binary)

**What gets signed:** For an app bundle (e.g. `MyApp.app`), signing works over a **code directory**: a structure that lists hashes of the executable and other resources (per file or per page). A **cdhash** (code directory hash) is a hash of that structure and uniquely identifies the exact signed layout of the app.

**What’s embedded:**

- The **code directory** (hashes, optional requirements).
- A **signature** over that (using the developer’s **Developer ID** or Apple cert).
- **Designated requirement** (DR): a predicate that says “this code is valid if signed by cert X” (or “signed by Apple”, etc.). The OS will evaluate this against the actual signing cert chain.
- The **certificate chain** (end-entity up to Apple’s root).

**Integrity:** Any change to the bundle (or to the signed parts) changes the code directory and thus the cdhash, so the signature no longer matches. The system treats the app as modified and can refuse to run it or strip the signature.

**Chain trust:** The signing certificate must chain to a root in **Apple’s trust store** (e.g. Apple Root CA). Developer ID certs chain to Apple; ad-hoc or self-signed don’t satisfy the normal “signed by an identified developer” policy.

#### 2. Gatekeeper (when and how it’s checked)

**Who does the check:** The **syspolicyd** daemon. It’s the central service that answers “is this binary allowed to run?” under the current security policy.

**When it runs:** At **launch time**, before the main executable is allowed to run. Something (e.g. `launchd` or the kernel) asks syspolicyd via **XPC** (`com.apple.security.syspolicy`): “Can we run this binary?” Syspolicyd then:

- Looks at the binary (or app bundle) and its **quarantine** attribute.
- **Quarantine** (`com.apple.quarantine`) is the key trigger: it’s set when the file was **downloaded** (e.g. by Safari, Mail, or a browser). If the attribute is present, Gatekeeper applies its full policy; if not (e.g. built locally, or copied from a USB stick without quarantine), the check may be looser or skipped for “local” files.
- Verifies the **code signature**: cdhash, signature, certificate chain, designated requirement. If the app isn’t signed by a trusted Developer ID (or Apple), Gatekeeper can block and show “app is from an unidentified developer.”
- If the system is configured to require **notarization** (default for downloaded apps in recent macOS), it also checks that this build was notarized (see below).

So Gatekeeper is a **pre-execution policy**: it doesn’t run the app first and then check; it decides allow/deny based on signature + quarantine + notarization, then the OS either runs the binary or shows the warning (with the option to override via “Open” in the dialog or “Allow” in System Settings).

#### 3. Notarization (Apple’s extra check)

**What it is:** You upload your built app (or disk image) to **Apple’s notary service**. Apple runs automated and manual checks (e.g. malware, policy) and, if it passes, issues a **notarization ticket** tied to your app.

**What’s in the ticket:** The ticket is bound to the **cdhash(es)** of what you submitted (and related metadata). So it says, in effect: “Apple has checked the build that has this cdhash and didn’t find known bad behavior.”

**How the Mac uses it:**

- **Stapled:** You can **staple** the ticket onto the app (or .dmg) with `xcrun stapler staple`. The ticket is then stored inside the bundle. When Gatekeeper runs, it can validate the ticket **offline** by checking that the current app’s cdhash matches the stapled ticket and that the ticket is signed by Apple.
- **Not stapled:** If there’s no staple, Gatekeeper can try to fetch the ticket **from Apple’s servers** (e.g. via CloudKit) using the app’s cdhash. That requires **internet** at first launch; if the Mac is offline, the notarization check can fail even though the app is signed.

So: **Code signing** = integrity + identity (cert chain). **Gatekeeper** = policy at launch (quarantine + signature + notarization). **Notarization** = Apple’s attestation that this specific build (cdhash) was scanned and approved. All three interact to produce the “safe” vs “unidentified developer” / “cannot be opened” experience.
