; ============================================================
; Is This True? - NSIS install hook
; Registers the companion Chrome extension via Chrome's
; ExtensionInstallForcelist policy so it auto-installs and
; auto-updates from GitHub Pages.
; ============================================================

!define ITT_EXTENSION_ID "kpjclcnjdlghkbhajcpdiabpbceedhdk"
!define ITT_UPDATE_URL   "https://darkshark9.github.io/IsThisTrue/update.xml"
; Slot number inside ExtensionInstallForcelist. Each app picks an integer.
; Using a high number to reduce the chance of colliding with another app's entry.
!define ITT_FORCELIST_SLOT "942"

!macro customInstall
  ; Writing under HKCU keeps this a per-user install (no UAC) and applies
  ; to whichever Windows user ran the installer. Chrome reads both HKCU
  ; and HKLM for ExtensionInstallForcelist; HKCU is sufficient for personal use.
  WriteRegStr HKCU "SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" "${ITT_FORCELIST_SLOT}" "${ITT_EXTENSION_ID};${ITT_UPDATE_URL}"
  ; Also write the Chromium key so Edge/Brave/etc. pick it up too.
  WriteRegStr HKCU "SOFTWARE\Policies\Chromium\ExtensionInstallForcelist" "${ITT_FORCELIST_SLOT}" "${ITT_EXTENSION_ID};${ITT_UPDATE_URL}"
  DetailPrint "Registered Chrome extension ${ITT_EXTENSION_ID} (restart Chrome to activate)."
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" "${ITT_FORCELIST_SLOT}"
  DeleteRegValue HKCU "SOFTWARE\Policies\Chromium\ExtensionInstallForcelist" "${ITT_FORCELIST_SLOT}"
!macroend
