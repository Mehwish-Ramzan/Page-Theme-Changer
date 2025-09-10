// popup.js with all fixes implemented
const colorInput = document.getElementById("color");
const customColor = document.getElementById("customColor");
const applyBtn = document.getElementById("applyBtn");
const darkBtn = document.getElementById("darkBtn");
const resetBtn = document.getElementById("resetBtn");
const saveSite = document.getElementById("saveSite");
const statusEl = document.getElementById("status");
const siteHint = document.getElementById("siteHint");

// Keep track of current color and dark mode state
let currentColor = colorInput.value;
let isDarkMode = false;

// Helper: safe get active tab info (handles edge cases)
async function getActiveTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = new URL(tab.url);
    return { tabId: tab.id, host: url.hostname, url: tab.url };
  } catch (e) {
    // Could be chrome:// or new tab where URL isn't available
    return { tabId: null, host: "unknown", url: "" };
  }
}

function setStatus(msg, ms = 2000) {
  statusEl.textContent = msg;
  if (ms > 0) {
    setTimeout(() => {
      if (statusEl.textContent === msg) {
        statusEl.textContent = "";
      }
    }, ms);
  }
}

// wrapper to send message and detect if there's no receiver
function trySendMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        resolve({ ok: false, error: lastError.message });
      } else {
        resolve({ ok: true, response });
      }
    });
  });
}

// attempt to inject content.js into the page
async function tryInjectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// Init UI with saved site settings
(async function init() {
  const { host, url } = await getActiveTabInfo();

  // Check if this is a chrome:// URL or similar where we can't run content scripts
  if (
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  ) {
    siteHint.textContent = "Cannot modify browser pages";
    applyBtn.disabled = true;
    darkBtn.disabled = true;
    resetBtn.disabled = true;
    return;
  }

  siteHint.textContent = `Site: ${host}`;

  if (host === "unknown") return;

  chrome.storage.local.get(["sites"], (res) => {
    const sites = res.sites || {};
    const siteCfg = sites[host];
    if (siteCfg) {
      if (siteCfg.color) {
        colorInput.value = siteCfg.color;
        customColor.value = siteCfg.color;
        currentColor = siteCfg.color;
      }
      if (siteCfg.darkEnabled) {
        saveSite.checked = true;
        isDarkMode = siteCfg.darkEnabled;
      }
    }
  });
})();

// Sync both color inputs
colorInput.addEventListener("input", () => {
  customColor.value = colorInput.value;
  currentColor = colorInput.value;
});

customColor.addEventListener("input", () => {
  colorInput.value = customColor.value;
  currentColor = customColor.value;
});

// Swatches click - only update color inputs, don't apply
document.querySelectorAll(".sw").forEach((btn) => {
  btn.addEventListener("click", () => {
    const color = btn.dataset.color;
    colorInput.value = color;
    customColor.value = color;
    currentColor = color;
    setStatus("Color selected - click Apply to use", 1500);
  });
});

// APPLY handler with fallback injection
applyBtn.addEventListener("click", async () => {
  const { tabId, host } = await getActiveTabInfo();

  if (!tabId || host === "unknown") {
    setStatus("Can't apply on this page");
    return;
  }

  const color = currentColor || colorInput.value || "#ffffff";
  let res = await trySendMessage(tabId, { type: "applyColor", color });

  if (res.ok) {
    setStatus("Applied ✓");

    if (saveSite.checked && host && host !== "unknown") {
      chrome.storage.local.get(["sites"], (r) => {
        const sites = r.sites || {};
        sites[host] = {
          ...(sites[host] || {}),
          color,
          save: true,
          // Preserve dark mode setting if it exists
          darkEnabled: sites[host]?.darkEnabled || false,
        };
        chrome.storage.local.set({ sites }, () =>
          setStatus("Saved for site ✓")
        );
      });
    }
    return;
  }

  // Try injecting content script then resend message
  setStatus("Injecting script...");
  const inj = await tryInjectContentScript(tabId);

  if (!inj.ok) {
    setStatus("Cannot modify this page");
    return;
  }

  // Small delay to ensure content script is ready
  await new Promise((resolve) => setTimeout(resolve, 100));

  const resend = await trySendMessage(tabId, { type: "applyColor", color });

  if (resend.ok) {
    setStatus("Applied ✓");
    if (saveSite.checked && host && host !== "unknown") {
      chrome.storage.local.get(["sites"], (r) => {
        const sites = r.sites || {};
        sites[host] = {
          ...(sites[host] || {}),
          color,
          save: true,
          darkEnabled: sites[host]?.darkEnabled || false,
        };
        chrome.storage.local.set({ sites }, () =>
          setStatus("Saved for site ✓")
        );
      });
    }
  } else {
    setStatus("Failed to apply");
  }
});

// TOGGLE DARK handler with fallback injection
darkBtn.addEventListener("click", async () => {
  const { tabId, host } = await getActiveTabInfo();

  if (!tabId || host === "unknown") {
    setStatus("Can't toggle on this page");
    return;
  }

  isDarkMode = !isDarkMode;

  let res = await trySendMessage(tabId, {
    type: "toggleDark",
    darkMode: isDarkMode,
  });

  if (res.ok) {
    setStatus(isDarkMode ? "Dark mode enabled ✓" : "Dark mode disabled ✓");
  } else {
    const inj = await tryInjectContentScript(tabId);

    if (!inj.ok) {
      setStatus("Cannot modify this page");
      isDarkMode = !isDarkMode; // Revert change
      return;
    }

    // Small delay to ensure content script is ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    const resend = await trySendMessage(tabId, {
      type: "toggleDark",
      darkMode: isDarkMode,
    });

    setStatus(
      resend.ok
        ? isDarkMode
          ? "Dark mode enabled ✓"
          : "Dark mode disabled ✓"
        : "Failed to toggle"
    );
  }

  // update saved preference (if any)
  if (host && host !== "unknown") {
    chrome.storage.local.get(["sites"], (r) => {
      const sites = r.sites || {};
      const prev = sites[host] || {};
      sites[host] = {
        ...prev,
        darkEnabled: isDarkMode,
        save: saveSite.checked,
      };
      chrome.storage.local.set({ sites });
    });
  }
});

// RESET handler with fallback injection
resetBtn.addEventListener("click", async () => {
  const { tabId, host } = await getActiveTabInfo();

  if (!tabId || host === "unknown") {
    setStatus("Can't reset on this page");
    return;
  }

  let res = await trySendMessage(tabId, { type: "reset" });

  if (res.ok) {
    setStatus("Reset ✓");
    isDarkMode = false;

    if (host && host !== "unknown") {
      chrome.storage.local.get(["sites"], (r) => {
        const sites = r.sites || {};
        delete sites[host];
        chrome.storage.local.set({ sites }, () => {
          colorInput.value = "#ffefd5";
          customColor.value = "#ffefd5";
          currentColor = "#ffefd5";
          saveSite.checked = false;
        });
      });
    }
    return;
  }

  const inj = await tryInjectContentScript(tabId);

  if (!inj.ok) {
    setStatus("Cannot modify this page");
    return;
  }

  // Small delay to ensure content script is ready
  await new Promise((resolve) => setTimeout(resolve, 100));

  const resend = await trySendMessage(tabId, { type: "reset" });

  if (resend.ok) {
    setStatus("Reset ✓");
    isDarkMode = false;

    if (host && host !== "unknown") {
      chrome.storage.local.get(["sites"], (r) => {
        const sites = r.sites || {};
        delete sites[host];
        chrome.storage.local.set({ sites }, () => {
          colorInput.value = "#ffefd5";
          customColor.value = "#ffefd5";
          currentColor = "#ffefd5";
          saveSite.checked = false;
        });
      });
    }
  } else {
    setStatus("Failed to reset");
  }
});
