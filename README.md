# Page-Theme-Changer 

# Page Theme Changer

**Version:** 1.0.1  
A Chrome extension to change page background/theme per-site, toggle a dark mode, and save per-site preferences.

---

## Features
- Pick or enter a background color and apply it to the current page.
- Predefined color swatches (select then press **Apply**).
- Toggle a persistent dark mode (backs up/restores theme).
- Save color/dark preference per-site (auto-apply on reload).
- Graceful injection: popup injects `content.js` when needed.

---
## Installation (developer / local testing)
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this extension folder (`page-theme-changer/`).
4. The extension icon should appear in the toolbar. Click it to open the popup.

> Test on normal web pages (e.g. `https://example.com`). Chrome prevents content script injection on protected pages (`chrome://`, Chrome Web Store, some PDF viewers).

---

## Usage
1. Open the extension popup.
2. Choose a color using the picker or click a swatch to *select* (selection will **not** auto-apply).
3. Click **Apply** to apply the selected color to the current page.
4. Toggle **Toggle Dark Mode** to switch dark theme on/off (it will back up any current theme).
5. Check **Save for this site (auto-apply)** to store the setting in-extension storage (applies automatically when you reopen/reload the site).

---

## Developer notes
- `popup.js` handles UI, saving to `chrome.storage.local`, and messaging the page.
- `content.js` applies styles on the page and listens to messages. It is **idempotent** (won't re-run twice on the same page).
- `background.js` listens to tab updates and auto-applies saved settings by injecting styles via `chrome.scripting`.
- Storage used: `chrome.storage.local` (keeps everything inside the extension, no syncing).

---

## Manifest & Permissions
Please check `manifest.json` includes:
```json
"permissions": ["storage", "scripting", "activeTab", "tabs"],
"host_permissions": ["<all_urls>"],
"background": { "service_worker": "background.js" },
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }
]
