// content.js - cleaned, single listener, toggle implemented

// Utility: hex -> rgb
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const bigint = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16
  );
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

// Per WCAG-ish relative luminance
function luminance({ r, g, b }) {
  const srgb = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function pickTextColor(bgHex) {
  try {
    const rgb = hexToRgb(bgHex);
    return luminance(rgb) > 0.55 ? "#111111" : "#ffffff";
  } catch {
    return "#111111";
  }
}

function ensureStyleEl(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.documentElement.appendChild(el);
  }
  return el;
}

function applyColor(bgHex) {
  const text = pickTextColor(bgHex);
  const style = ensureStyleEl("mwr-theme-style");
  style.textContent = `
    html, body { background: ${bgHex} !important; }
    body, body :where(p,span,li,div,section,h1,h2,h3,h4,h5,h6,article,nav,footer,header,main) {
      color: ${text} !important;
    }
    a { color: ${text} !important; text-decoration-color: ${text} !important; }
  `;
}

let darkActive = false;
function toggleDark(enable) {
  // Allow explicit setting or toggling
  darkActive = enable !== undefined ? enable : !darkActive;
  const style = ensureStyleEl("mwr-dark-style");

  if (darkActive) {
    style.textContent = `
      html, body { background: #000000 !important; }
      body, body :where(p,span,li,div,section,h1,h2,h3,h4,h5,h6) { 
        color: #eaeaea !important; 
      }
      a { color: #9ecbff !important; }
      input, textarea, select {
        background-color: #222 !important;
        color: #eee !important;
        border-color: #444 !important;
      }
    `;
  } else {
    style.textContent = "";
  }
}

function resetAll() {
  const s1 = document.getElementById("mwr-theme-style");
  const s2 = document.getElementById("mwr-dark-style");
  if (s1) s1.textContent = "";
  if (s2) s2.textContent = "";
  darkActive = false;
}

// Auto-apply if site is saved (uses chrome.storage.local to match popup)
(function autoApply() {
  try {
    const host = location.hostname;
    chrome.storage.local.get(["sites"], (res) => {
      const sites = res.sites || {};
      const cfg = sites[host];
      if (!cfg) return;
      if (cfg.color) applyColor(cfg.color);
      if (cfg.darkEnabled) {
        darkActive = true;
        toggleDark(true);
      }
    });
  } catch (e) {
    // ignore cross-origin quirks
  }
})();

// Single, consolidated listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg.type === "applyColor" && msg.color) {
      applyColor(msg.color);
      sendResponse({ ok: true });
      return; // no need for return true
    }
    if (msg.type === "toggleDark") {
      toggleDark(msg.darkMode);
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "reset") {
      resetAll();
      sendResponse({ ok: true });
      return;
    }
  } catch (err) {
    console.error("content.js handler error:", err);
    sendResponse({ ok: false, error: err.message });
  }
});
