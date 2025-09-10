// background.js - uses chrome.storage.local to match popup storage

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    try {
      let url = new URL(tab.url);
      let domain = url.hostname;

      // Load saved color for this site from local (popup uses local)
      chrome.storage.local.get(["sites"], (res) => {
        const sites = res.sites || {};
        const color = sites[domain]?.color;
        const dark = sites[domain]?.darkEnabled;
        if (color) {
          chrome.scripting
            .executeScript({
              target: { tabId: tabId },
              func: (c) => {
                let el = document.getElementById("mwr-theme-style");
                if (!el) {
                  el = document.createElement("style");
                  el.id = "mwr-theme-style";
                  document.documentElement.appendChild(el);
                }
                el.textContent = `html, body { background: ${c} !important; }`;
              },
              args: [color],
            })
            .catch(() => {
              /* ignore injection failures on protected pages */
            });
        }
        if (dark) {
          chrome.scripting
            .executeScript({
              target: { tabId: tabId },
              func: () => {
                let el = document.getElementById("mwr-dark-style");
                if (!el) {
                  el = document.createElement("style");
                  el.id = "mwr-dark-style";
                  document.documentElement.appendChild(el);
                }
                el.textContent = `html, body { background: #121212 !important; } body { color: #eaeaea !important; }`;
              },
            })
            .catch(() => {});
        }
      });
    } catch (e) {
      // ignore invalid URLs (chrome:// etc)
    }
  }
});
