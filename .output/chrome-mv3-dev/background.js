var background = function() {
  "use strict";
  var _a, _b;
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const browser$1 = ((_b = (_a = globalThis.browser) == null ? void 0 : _a.runtime) == null ? void 0 : _b.id) ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  async function filterTabs(tabs) {
    const IS_ALLOW_PINNED = await getIsAllowPinnedTab();
    const IS_DUPLICATE_TAB_ALLOWED = await getIsAllowDuplicateTab();
    let filteredTabs = tabs.filter((tab) => {
      const url = tab.url || "";
      return url !== "" && !url.startsWith("chrome://") && !url.startsWith("chrome-extension://") && !url.startsWith("about:");
    });
    filteredTabs = filteredTabs.filter((tab) => {
      if (!tab.pinned) {
        return true;
      }
      if (tab.pinned === IS_ALLOW_PINNED) {
        return true;
      } else {
        return false;
      }
    });
    if (!IS_DUPLICATE_TAB_ALLOWED) {
      const seen = /* @__PURE__ */ new Set();
      filteredTabs = filteredTabs.filter((tab) => {
        if (seen.has(tab.url)) {
          return false;
        } else {
          seen.add(tab.url);
          return true;
        }
      });
    }
    return filteredTabs;
  }
  async function getOpenedTabs() {
    let tabs = await browser.tabs.query({});
    return await filterTabs(tabs);
  }
  async function openDashboard() {
    let tabs = await browser.tabs.query({ url: browser.runtime.getURL("dashboard.html") });
    if (tabs.length === 0) {
      browser.tabs.create({ url: browser.runtime.getURL("dashboard.html"), index: 0, pinned: true });
    } else {
      browser.tabs.update(tabs[0].id, { active: true });
    }
  }
  async function ensureDashboardFirst() {
    const tabs = await browser.tabs.query({ url: browser.runtime.getURL("dashboard.html") });
    if (tabs.length === 0) {
      await browser.tabs.create({ url: browser.runtime.getURL("dashboard.html"), index: 0, pinned: true });
    } else {
      const dashboardTab = tabs[0];
      if (dashboardTab.index !== 0) {
        await browser.tabs.move(dashboardTab.id, { index: 0 });
      }
    }
  }
  const defaultWorkspaces = {
    ALL: "All"
  };
  const DB_NAME = "TarchiveDB";
  const BUCKET_STORE_NAME = "buckets";
  const SETTINGS_STORE_NAME = "settings";
  const SESSION_STORE_NAME = "session";
  const DB_VERSION = 1;
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(BUCKET_STORE_NAME)) {
          db.createObjectStore(BUCKET_STORE_NAME, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
          db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
          db.createObjectStore(SESSION_STORE_NAME, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function addTabsToBucket(tabs) {
    if (tabs.length === 0) return;
    let filteredTabs = tabs.filter((tab) => {
      if (tab.checked !== false) return tab;
    });
    if (filteredTabs.length === 0) return;
    const id = crypto.randomUUID();
    const bucket = {
      id,
      name: id.slice(0, 8),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      tabs: filteredTabs,
      tag: [defaultWorkspaces.ALL],
      isLocked: false
    };
    const db = await openDB();
    const tx = db.transaction(BUCKET_STORE_NAME, "readwrite");
    tx.objectStore(BUCKET_STORE_NAME).add(bucket);
  }
  async function getSetting(key) {
    const db = await openDB();
    const tx = db.transaction(SETTINGS_STORE_NAME, "readonly");
    const store = tx.objectStore(SETTINGS_STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        var _a2;
        resolve(((_a2 = request.result) == null ? void 0 : _a2.value) ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  }
  async function getIsAllowDuplicateTab() {
    return await getSetting("IS_ALLOW_DUPLICATE_TAB");
  }
  async function getIsAllowPinnedTab() {
    return await getSetting("IS_ALLOW_PINNED_TAB");
  }
  async function saveLastSession(tabs) {
    tabs = await filterTabs(tabs);
    const db = await openDB();
    const tx = db.transaction(SESSION_STORE_NAME, "readwrite");
    const store = tx.objectStore(SESSION_STORE_NAME);
    await store.clear();
    store.put({ key: "lastSession", tabs });
  }
  const definition = defineBackground(() => {
    let startupPhase = true;
    browser.runtime.onStartup.addListener(async () => {
      const { currSession } = await browser.storage.local.get("currSession");
      await saveLastSession(currSession);
      startupPhase = false;
      ensureDashboardFirst();
    });
    browser.runtime.onInstalled.addListener(({ reason }) => {
      if (reason === "install") {
        ensureDashboardFirst();
      }
    });
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) {
        let session = await getOpenedTabs();
        if (startupPhase) return;
        await browser.storage.local.set({ currSession: session });
      }
    });
    browser.commands.onCommand.addListener(async (command) => {
      if (command === "addTabs") {
        let tabs = await getOpenedTabs();
        let filteredTabs = tabs.filter((tab) => {
          if (tab.title !== "about:blank") return tab;
        });
        if (filteredTabs.length === 0) return;
        await addTabsToBucket(filteredTabs);
        const channel = new BroadcastChannel("tarchive_channel");
        channel.postMessage({ type: "workspaces_updated" });
      }
      if (command === "viewBuckets") {
        await openDashboard();
      }
    });
  });
  function initPlugins() {
  }
  var _MatchPattern = class {
    constructor(matchPattern) {
      if (matchPattern === "<all_urls>") {
        this.isAllUrls = true;
        this.protocolMatches = [..._MatchPattern.PROTOCOLS];
        this.hostnameMatch = "*";
        this.pathnameMatch = "*";
      } else {
        const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
        if (groups == null)
          throw new InvalidMatchPattern(matchPattern, "Incorrect format");
        const [_, protocol, hostname, pathname] = groups;
        validateProtocol(matchPattern, protocol);
        validateHostname(matchPattern, hostname);
        this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
        this.hostnameMatch = hostname;
        this.pathnameMatch = pathname;
      }
    }
    includes(url) {
      if (this.isAllUrls)
        return true;
      const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
      return !!this.protocolMatches.find((protocol) => {
        if (protocol === "http")
          return this.isHttpMatch(u);
        if (protocol === "https")
          return this.isHttpsMatch(u);
        if (protocol === "file")
          return this.isFileMatch(u);
        if (protocol === "ftp")
          return this.isFtpMatch(u);
        if (protocol === "urn")
          return this.isUrnMatch(u);
      });
    }
    isHttpMatch(url) {
      return url.protocol === "http:" && this.isHostPathMatch(url);
    }
    isHttpsMatch(url) {
      return url.protocol === "https:" && this.isHostPathMatch(url);
    }
    isHostPathMatch(url) {
      if (!this.hostnameMatch || !this.pathnameMatch)
        return false;
      const hostnameMatchRegexs = [
        this.convertPatternToRegex(this.hostnameMatch),
        this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))
      ];
      const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
      return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
    }
    isFileMatch(url) {
      throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
    }
    isFtpMatch(url) {
      throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
    }
    isUrnMatch(url) {
      throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
    }
    convertPatternToRegex(pattern) {
      const escaped = this.escapeForRegex(pattern);
      const starsReplaced = escaped.replace(/\\\*/g, ".*");
      return RegExp(`^${starsReplaced}$`);
    }
    escapeForRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  };
  var MatchPattern = _MatchPattern;
  MatchPattern.PROTOCOLS = ["http", "https", "file", "ftp", "urn"];
  var InvalidMatchPattern = class extends Error {
    constructor(matchPattern, reason) {
      super(`Invalid match pattern "${matchPattern}": ${reason}`);
    }
  };
  function validateProtocol(matchPattern, protocol) {
    if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*")
      throw new InvalidMatchPattern(
        matchPattern,
        `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`
      );
  }
  function validateHostname(matchPattern, hostname) {
    if (hostname.includes(":"))
      throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
    if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*."))
      throw new InvalidMatchPattern(
        matchPattern,
        `If using a wildcard (*), it must go at the start of the hostname`
      );
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  let ws;
  function getDevServerWebSocket() {
    if (ws == null) {
      const serverUrl = `${"ws:"}//${"localhost"}:${3e3}`;
      logger.debug("Connecting to dev server @", serverUrl);
      ws = new WebSocket(serverUrl, "vite-hmr");
      ws.addWxtEventListener = ws.addEventListener.bind(ws);
      ws.sendCustom = (event, payload) => ws == null ? void 0 : ws.send(JSON.stringify({ type: "custom", event, payload }));
      ws.addEventListener("open", () => {
        logger.debug("Connected to dev server");
      });
      ws.addEventListener("close", () => {
        logger.debug("Disconnected from dev server");
      });
      ws.addEventListener("error", (event) => {
        logger.error("Failed to connect to dev server", event);
      });
      ws.addEventListener("message", (e) => {
        try {
          const message = JSON.parse(e.data);
          if (message.type === "custom") {
            ws == null ? void 0 : ws.dispatchEvent(
              new CustomEvent(message.event, { detail: message.data })
            );
          }
        } catch (err) {
          logger.error("Failed to handle message", err);
        }
      });
    }
    return ws;
  }
  function keepServiceWorkerAlive() {
    setInterval(async () => {
      await browser.runtime.getPlatformInfo();
    }, 5e3);
  }
  function reloadContentScript(payload) {
    const manifest = browser.runtime.getManifest();
    if (manifest.manifest_version == 2) {
      void reloadContentScriptMv2();
    } else {
      void reloadContentScriptMv3(payload);
    }
  }
  async function reloadContentScriptMv3({
    registration,
    contentScript
  }) {
    if (registration === "runtime") {
      await reloadRuntimeContentScriptMv3(contentScript);
    } else {
      await reloadManifestContentScriptMv3(contentScript);
    }
  }
  async function reloadManifestContentScriptMv3(contentScript) {
    const id = `wxt:${contentScript.js[0]}`;
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const existing = registered.find((cs) => cs.id === id);
    if (existing) {
      logger.debug("Updating content script", existing);
      await browser.scripting.updateContentScripts([{ ...contentScript, id }]);
    } else {
      logger.debug("Registering new content script...");
      await browser.scripting.registerContentScripts([{ ...contentScript, id }]);
    }
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadRuntimeContentScriptMv3(contentScript) {
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const matches = registered.filter((cs) => {
      var _a2, _b2;
      const hasJs = (_a2 = contentScript.js) == null ? void 0 : _a2.find((js) => {
        var _a3;
        return (_a3 = cs.js) == null ? void 0 : _a3.includes(js);
      });
      const hasCss = (_b2 = contentScript.css) == null ? void 0 : _b2.find((css) => {
        var _a3;
        return (_a3 = cs.css) == null ? void 0 : _a3.includes(css);
      });
      return hasJs || hasCss;
    });
    if (matches.length === 0) {
      logger.log(
        "Content script is not registered yet, nothing to reload",
        contentScript
      );
      return;
    }
    await browser.scripting.updateContentScripts(matches);
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadTabsForContentScript(contentScript) {
    const allTabs = await browser.tabs.query({});
    const matchPatterns = contentScript.matches.map(
      (match) => new MatchPattern(match)
    );
    const matchingTabs = allTabs.filter((tab) => {
      const url = tab.url;
      if (!url) return false;
      return !!matchPatterns.find((pattern) => pattern.includes(url));
    });
    await Promise.all(
      matchingTabs.map(async (tab) => {
        try {
          await browser.tabs.reload(tab.id);
        } catch (err) {
          logger.warn("Failed to reload tab:", err);
        }
      })
    );
  }
  async function reloadContentScriptMv2(_payload) {
    throw Error("TODO: reloadContentScriptMv2");
  }
  {
    try {
      const ws2 = getDevServerWebSocket();
      ws2.addWxtEventListener("wxt:reload-extension", () => {
        browser.runtime.reload();
      });
      ws2.addWxtEventListener("wxt:reload-content-script", (event) => {
        reloadContentScript(event.detail);
      });
      if (true) {
        ws2.addEventListener(
          "open",
          () => ws2.sendCustom("wxt:background-initialized")
        );
        keepServiceWorkerAlive();
      }
    } catch (err) {
      logger.error("Failed to setup web socket connection with dev server", err);
    }
    browser.commands.onCommand.addListener((command) => {
      if (command === "wxt:reload-extension") {
        browser.runtime.reload();
      }
    });
  }
  let result;
  try {
    initPlugins();
    result = definition.main();
    if (result instanceof Promise) {
      console.warn(
        "The background's main() function return a promise, but it must be synchronous"
      );
    }
  } catch (err) {
    logger.error("The background crashed on startup!");
    throw err;
  }
  const result$1 = result;
  return result$1;
}();
background;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zZXJ2aWNlcy9pbmRleC5qcyIsIi4uLy4uL3V0aWxzL2NvbnN0YW50cy9pbmRleC5qcyIsIi4uLy4uL2RiL2luZGV4LmpzIiwiLi4vLi4vZW50cnlwb2ludHMvYmFja2dyb3VuZC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVCYWNrZ3JvdW5kKGFyZykge1xuICBpZiAoYXJnID09IG51bGwgfHwgdHlwZW9mIGFyZyA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyBtYWluOiBhcmcgfTtcbiAgcmV0dXJuIGFyZztcbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XHJcbmltcG9ydCB7IGdldElzQWxsb3dEdXBsaWNhdGVUYWIsIGdldElzQWxsb3dQaW5uZWRUYWIgfSBmcm9tICcuLi9kYic7XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmlsdGVyVGFicyh0YWJzKSB7XHJcbiAgICBjb25zdCBJU19BTExPV19QSU5ORUQgPSBhd2FpdCBnZXRJc0FsbG93UGlubmVkVGFiKCk7XHJcbiAgICBjb25zdCBJU19EVVBMSUNBVEVfVEFCX0FMTE9XRUQgPSBhd2FpdCBnZXRJc0FsbG93RHVwbGljYXRlVGFiKCk7XHJcblxyXG4gICAgbGV0IGZpbHRlcmVkVGFicyA9IHRhYnMuZmlsdGVyKHRhYiA9PiB7XHJcbiAgICAgICAgY29uc3QgdXJsID0gdGFiLnVybCB8fCBcIlwiO1xyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIHVybCAhPT0gXCJcIiAmJlxyXG4gICAgICAgICAgICAhdXJsLnN0YXJ0c1dpdGgoXCJjaHJvbWU6Ly9cIikgJiZcclxuICAgICAgICAgICAgIXVybC5zdGFydHNXaXRoKFwiY2hyb21lLWV4dGVuc2lvbjovL1wiKSAmJlxyXG4gICAgICAgICAgICAhdXJsLnN0YXJ0c1dpdGgoXCJhYm91dDpcIilcclxuICAgICAgICApO1xyXG4gICAgfSk7XHJcblxyXG4gICAgZmlsdGVyZWRUYWJzID0gZmlsdGVyZWRUYWJzLmZpbHRlcih0YWIgPT4ge1xyXG4gICAgICAgIGlmICghdGFiLnBpbm5lZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0YWIucGlubmVkID09PSBJU19BTExPV19QSU5ORUQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGlmICghSVNfRFVQTElDQVRFX1RBQl9BTExPV0VEKSB7XHJcbiAgICAgICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQoKTtcclxuICAgICAgICBmaWx0ZXJlZFRhYnMgPSBmaWx0ZXJlZFRhYnMuZmlsdGVyKCh0YWIpID0+IHtcclxuICAgICAgICAgICAgaWYgKHNlZW4uaGFzKHRhYi51cmwpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzZWVuLmFkZCh0YWIudXJsKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSlcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZmlsdGVyZWRUYWJzO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0T3BlbmVkVGFicygpIHtcclxuICAgIGxldCB0YWJzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHt9KTtcclxuICAgIHJldHVybiBhd2FpdCBmaWx0ZXJUYWJzKHRhYnMpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RGFzaGJvYXJkVGFiKCkge1xyXG4gICAgbGV0IGRhc2hib2FyZFRhYnMgPSBhd2FpdCBicm93c2VyLnRhYnMucXVlcnkoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSB9KTtcclxuICAgIHJldHVybiBkYXNoYm9hcmRUYWJzWzBdO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlUmVsb2FkRGFzaGJvYXJkKCkge1xyXG4gICAgbGV0IHRhYnMgPSBhd2FpdCBicm93c2VyLnRhYnMucXVlcnkoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSB9KTtcclxuXHJcbiAgICBpZiAodGFicy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICBicm93c2VyLnRhYnMuY3JlYXRlKHsgdXJsOiBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKFwiZGFzaGJvYXJkLmh0bWxcIiksIGluZGV4OiAwLCBwaW5uZWQ6IHRydWUgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGJyb3dzZXIudGFicy5yZWxvYWQodGFic1swXS5pZCk7XHJcbiAgICAgICAgYnJvd3Nlci50YWJzLnVwZGF0ZSh0YWJzWzBdLmlkLCB7IGFjdGl2ZTogdHJ1ZSB9KTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5EYXNoYm9hcmQoKSB7XHJcbiAgICBsZXQgdGFicyA9IGF3YWl0IGJyb3dzZXIudGFicy5xdWVyeSh7IHVybDogYnJvd3Nlci5ydW50aW1lLmdldFVSTChcImRhc2hib2FyZC5odG1sXCIpIH0pO1xyXG5cclxuICAgIGlmICh0YWJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIGJyb3dzZXIudGFicy5jcmVhdGUoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSwgaW5kZXg6IDAsIHBpbm5lZDogdHJ1ZSB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYnJvd3Nlci50YWJzLnVwZGF0ZSh0YWJzWzBdLmlkLCB7IGFjdGl2ZTogdHJ1ZSB9KTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5DdXJyZW50VGFiKGlkKSB7XHJcbiAgICBicm93c2VyLnRhYnMudXBkYXRlKGlkLCB7IGFjdGl2ZTogdHJ1ZSB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5UYWJzKHRhYnMpIHtcclxuICAgIHRhYnMuZm9yRWFjaCgodGFiKSA9PiB7XHJcbiAgICAgICAgYnJvd3Nlci50YWJzLmNyZWF0ZSh7IHVybDogdGFiLnVybCB9KTtcclxuICAgIH0pXHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuVGFiR3JvdXAoYnVja2V0KSB7XHJcbiAgICBQcm9taXNlLmFsbChcclxuICAgICAgICBidWNrZXQudGFicy5tYXAodGFiID0+IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgIGJyb3dzZXIudGFicy5jcmVhdGUoeyB1cmw6IHRhYi51cmwgfSwgcmVzb2x2ZSk7XHJcbiAgICAgICAgfSkpXHJcbiAgICApLnRoZW4oKHRhYnMpID0+IHtcclxuICAgICAgICBjb25zdCB0YWJJZHMgPSB0YWJzLm1hcCh0YWIgPT4gdGFiLmlkKTtcclxuXHJcbiAgICAgICAgYnJvd3Nlci50YWJzLmdyb3VwKHsgdGFiSWRzOiB0YWJJZHMgfSwgKGdyb3VwSWQpID0+IHtcclxuICAgICAgICAgICAgYnJvd3Nlci50YWJHcm91cHMudXBkYXRlKGdyb3VwSWQsIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBidWNrZXQubmFtZSxcclxuICAgICAgICAgICAgICAgIGNvbG9yOiBidWNrZXQ/LmNvbG9yID8gYnVja2V0LmNvbG9yIDogJ2JsdWUnLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlblRhYkluV2luZG93KGJ1Y2tldCkge1xyXG4gICAgYnJvd3Nlci53aW5kb3dzLmNyZWF0ZSh7XHJcbiAgICAgICAgdXJsOiBidWNrZXQudGFicy5tYXAoKHRhYikgPT4gdGFiLnVybCksXHJcbiAgICAgICAgZm9jdXNlZDogdHJ1ZSxcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5zdXJlRGFzaGJvYXJkRmlyc3QoKSB7XHJcbiAgICBjb25zdCB0YWJzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHsgdXJsOiBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKFwiZGFzaGJvYXJkLmh0bWxcIikgfSk7XHJcbiAgICBpZiAodGFicy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICBhd2FpdCBicm93c2VyLnRhYnMuY3JlYXRlKHsgdXJsOiBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKFwiZGFzaGJvYXJkLmh0bWxcIiksIGluZGV4OiAwLCBwaW5uZWQ6IHRydWUgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IGRhc2hib2FyZFRhYiA9IHRhYnNbMF07XHJcbiAgICAgICAgaWYgKGRhc2hib2FyZFRhYi5pbmRleCAhPT0gMCkge1xyXG4gICAgICAgICAgICBhd2FpdCBicm93c2VyLnRhYnMubW92ZShkYXNoYm9hcmRUYWIuaWQsIHsgaW5kZXg6IDAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59IiwiZXhwb3J0IGNvbnN0IGVtcHR5UG9wVXBGYWxsYmFja01lc3NhZ2VzID0gW1xyXG4gICAgXCJObyB0YWJzIG9wZW4gcmlnaHQgbm93LiBUaW1lIHRvIGZvY3VzPyDwn5iMXCIsXHJcbiAgICBcIllvdSdyZSBhbGwgY2xlYXIuIE5vIHRhYnMgaW4gc2lnaHQuXCIsXHJcbiAgICBcIk5vIGFjdGl2ZSB0YWJzIGZvdW5kIGluIHRoaXMgd2luZG93LlwiLFxyXG4gICAgXCJZb3VyIGJyb3dzZXIgdGFiIG9jZWFuIGlzIGNhbG0g8J+nmFwiLFxyXG4gICAgXCJOb3RoaW5nIGhlcmUuIEhpdCDigJhBZGTigJkgd2hlbiB5b3UncmUgcmVhZHkgdG8gc2F2ZSBzb21lIHRhYnMhXCIsXHJcbl07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0RW1wdHlQb3BVcEZhbGxCYWNrTWVzc2FnZSgpIHtcclxuICAgIHJldHVybiBlbXB0eVBvcFVwRmFsbGJhY2tNZXNzYWdlc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBlbXB0eVBvcFVwRmFsbGJhY2tNZXNzYWdlcy5sZW5ndGgpXTtcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGRlZmF1bHRXb3Jrc3BhY2VzID0ge1xyXG4gICAgQUxMOiAnQWxsJyxcclxuICAgIEZBVk9SSVRFOiAnRmF2b3JpdGUnLFxyXG4gICAgTEFTVF9TRVNTSU9OOiAnTGFzdCBzZXNzaW9uJ1xyXG59IiwiY29uc3QgREJfTkFNRSA9ICdUYXJjaGl2ZURCJztcclxuaW1wb3J0IHsgZmlsdGVyVGFicyB9IGZyb20gJy4uL3NlcnZpY2VzJztcclxuaW1wb3J0IHsgZGVmYXVsdFdvcmtzcGFjZXMgfSBmcm9tICcuLi91dGlscy9jb25zdGFudHMvaW5kZXgnO1xyXG5jb25zdCBCVUNLRVRfU1RPUkVfTkFNRSA9ICdidWNrZXRzJztcclxuY29uc3QgU0VUVElOR1NfU1RPUkVfTkFNRSA9ICdzZXR0aW5ncyc7XHJcbmNvbnN0IFNFU1NJT05fU1RPUkVfTkFNRSA9ICdzZXNzaW9uJztcclxuY29uc3QgREJfVkVSU0lPTiA9IDE7XHJcblxyXG5mdW5jdGlvbiBvcGVuREIoKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSBpbmRleGVkREIub3BlbihEQl9OQU1FLCBEQl9WRVJTSU9OKTtcclxuXHJcbiAgICAgICAgcmVxdWVzdC5vbnVwZ3JhZGVuZWVkZWQgPSAoZXZlbnQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoQlVDS0VUX1NUT1JFX05BTUUpKSB7XHJcbiAgICAgICAgICAgICAgICBkYi5jcmVhdGVPYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSwgeyBrZXlQYXRoOiAnaWQnIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoU0VUVElOR1NfU1RPUkVfTkFNRSkpIHtcclxuICAgICAgICAgICAgICAgIGRiLmNyZWF0ZU9iamVjdFN0b3JlKFNFVFRJTkdTX1NUT1JFX05BTUUsIHsga2V5UGF0aDogXCJrZXlcIiB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFNFU1NJT05fU1RPUkVfTkFNRSkpIHtcclxuICAgICAgICAgICAgICAgIGRiLmNyZWF0ZU9iamVjdFN0b3JlKFNFU1NJT05fU1RPUkVfTkFNRSwgeyBrZXlQYXRoOiBcImtleVwiIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoKSA9PiByZXNvbHZlKHJlcXVlc3QucmVzdWx0KTtcclxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSAoKSA9PiByZWplY3QocmVxdWVzdC5lcnJvcik7XHJcbiAgICB9KTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0QWxsQnVja2V0cygpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKEJVQ0tFVF9TVE9SRV9OQU1FLCAncmVhZG9ubHknKTtcclxuICAgICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcclxuICAgICAgICBjb25zdCByZXF1ZXN0ID0gc3RvcmUuZ2V0QWxsKCk7XHJcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoKSA9PiByZXNvbHZlKHJlcXVlc3QucmVzdWx0KTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYWRkVGFic1RvQnVja2V0KHRhYnMpIHtcclxuICAgIGlmICh0YWJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG5cclxuICAgIGxldCBmaWx0ZXJlZFRhYnMgPSB0YWJzLmZpbHRlcigodGFiKSA9PiB7XHJcbiAgICAgICAgaWYgKHRhYi5jaGVja2VkICE9PSBmYWxzZSkgcmV0dXJuIHRhYjtcclxuICAgIH0pO1xyXG5cclxuICAgIGlmIChmaWx0ZXJlZFRhYnMubGVuZ3RoID09PSAwKSByZXR1cm47IC8vIHJldHVybiBpZiBubyB0YWJzXHJcblxyXG4gICAgY29uc3QgaWQgPSBjcnlwdG8ucmFuZG9tVVVJRCgpO1xyXG4gICAgY29uc3QgYnVja2V0ID0ge1xyXG4gICAgICAgIGlkLFxyXG4gICAgICAgIG5hbWU6IGlkLnNsaWNlKDAsIDgpLFxyXG4gICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgIHRhYnM6IGZpbHRlcmVkVGFicyxcclxuICAgICAgICB0YWc6IFtkZWZhdWx0V29ya3NwYWNlcy5BTExdLFxyXG4gICAgICAgIGlzTG9ja2VkOiBmYWxzZSxcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKS5hZGQoYnVja2V0KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRlbGV0ZUJ1Y2tldChpZCkge1xyXG4gICAgY29uc3QgYnVja2V0cyA9IGF3YWl0IGdldEFsbEJ1Y2tldHMoKTtcclxuICAgIGNvbnN0IGJ1Y2tldCA9IGJ1Y2tldHMuZmluZChiID0+IGIuaWQgPT09IGlkKTtcclxuICAgIGlmIChidWNrZXQ/LmlzTG9ja2VkKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKS5kZWxldGUoaWQpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVuYW1lQnVja2V0TmFtZShpZCwgbmFtZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpO1xyXG4gICAgY29uc3QgcmVxID0gYXdhaXQgc3RvcmUuZ2V0KGlkKTtcclxuXHJcbiAgICByZXEub25zdWNjZXNzID0gKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSByZXEucmVzdWx0O1xyXG5cclxuICAgICAgICBpZiAoZGF0YSkge1xyXG4gICAgICAgICAgICBkYXRhLm5hbWUgPSBuYW1lO1xyXG4gICAgICAgICAgICBzdG9yZS5wdXQoZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUJ1Y2tldExvY2soaWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKEJVQ0tFVF9TVE9SRV9OQU1FLCAncmVhZHdyaXRlJyk7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcclxuICAgIGNvbnN0IHJlcSA9IHN0b3JlLmdldChpZCk7XHJcblxyXG4gICAgcmVxLm9uc3VjY2VzcyA9ICgpID0+IHtcclxuICAgICAgICBjb25zdCBkYXRhID0gcmVxLnJlc3VsdDtcclxuICAgICAgICBpZiAoZGF0YSkge1xyXG4gICAgICAgICAgICBkYXRhLmlzTG9ja2VkID0gIWRhdGE/LmlzTG9ja2VkO1xyXG4gICAgICAgICAgICBzdG9yZS5wdXQoZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEFsbFdvcmtzcGFjZXMoKSB7XHJcbiAgICBjb25zdCBidWNrZXRzID0gYXdhaXQgZ2V0QWxsQnVja2V0cygpO1xyXG4gICAgYnVja2V0cy5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRBdC5sb2NhbGVDb21wYXJlKGEuY3JlYXRlZEF0KSk7XHJcblxyXG4gICAgY29uc3Qgd29ya3NwYWNlcyA9IHt9O1xyXG5cclxuICAgIGJ1Y2tldHMuZm9yRWFjaChidWNrZXQgPT4ge1xyXG4gICAgICAgIGJ1Y2tldD8udGFnPy5mb3JFYWNoKHRhZyA9PiB7XHJcbiAgICAgICAgICAgIGlmICghd29ya3NwYWNlc1t0YWddKSB3b3Jrc3BhY2VzW3RhZ10gPSBbXTtcclxuICAgICAgICAgICAgd29ya3NwYWNlc1t0YWddLnB1c2goYnVja2V0KTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB3b3Jrc3BhY2VzO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdG9nZ2xlVGFnKGlkLCB0YWcpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKEJVQ0tFVF9TVE9SRV9OQU1FLCAncmVhZHdyaXRlJyk7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcclxuICAgIGNvbnN0IHJlcSA9IHN0b3JlLmdldChpZCk7XHJcblxyXG4gICAgcmVxLm9uc3VjY2VzcyA9ICgpID0+IHtcclxuICAgICAgICBjb25zdCBkYXRhID0gcmVxLnJlc3VsdDtcclxuICAgICAgICBpZiAoZGF0YSAmJiAhZGF0YS50YWcuaW5jbHVkZXModGFnKSkge1xyXG4gICAgICAgICAgICBkYXRhLnRhZy5wdXNoKHRhZyk7XHJcbiAgICAgICAgICAgIHN0b3JlLnB1dChkYXRhKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IGRhdGEudGFnLmluZGV4T2YodGFnKTtcclxuICAgICAgICAgICAgZGF0YS50YWcuc3BsaWNlKGluZGV4LCAxKTtcclxuICAgICAgICAgICAgc3RvcmUucHV0KGRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkZWxldGVUYWIodGFiSWQsIGJ1Y2tldElkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihCVUNLRVRfU1RPUkVfTkFNRSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XHJcbiAgICBjb25zdCByZXEgPSBzdG9yZS5nZXQoYnVja2V0SWQpO1xyXG5cclxuICAgIHJlcS5vbnN1Y2Nlc3MgPSBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IHJlcS5yZXN1bHQ7XHJcbiAgICAgICAgaWYgKGRhdGE/LnRhYnM/Lmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgICAgICBzdG9yZS5kZWxldGUoYnVja2V0SWQpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGRhdGEudGFicyA9IGRhdGEudGFicy5maWx0ZXIoKHRhYikgPT4gdGFiLmlkICE9PSB0YWJJZCk7XHJcbiAgICAgICAgc3RvcmUucHV0KGRhdGEpO1xyXG4gICAgfTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNhdmVTZXR0aW5nKGtleSwgdmFsdWUpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFNFVFRJTkdTX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoU0VUVElOR1NfU1RPUkVfTkFNRSk7XHJcblxyXG4gICAgY29uc3Qgc2V0dGluZyA9IHsga2V5LCB2YWx1ZSB9O1xyXG4gICAgc3RvcmUucHV0KHNldHRpbmcpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0U2V0dGluZyhrZXkpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFNFVFRJTkdTX1NUT1JFX05BTUUsICdyZWFkb25seScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShTRVRUSU5HU19TVE9SRV9OQU1FKTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSBzdG9yZS5nZXQoa2V5KTtcclxuXHJcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIHJlc29sdmUocmVxdWVzdC5yZXN1bHQ/LnZhbHVlID8/IG51bGwpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gKCkgPT4gcmVqZWN0KHJlcXVlc3QuZXJyb3IpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB1cGRhdGVJc0FsbG93RHVwbGljYXRlVGFiKHZhbHVlKSB7XHJcbiAgICBhd2FpdCBzYXZlU2V0dGluZygnSVNfQUxMT1dfRFVQTElDQVRFX1RBQicsIHZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldElzQWxsb3dEdXBsaWNhdGVUYWIoKSB7XHJcbiAgICByZXR1cm4gYXdhaXQgZ2V0U2V0dGluZygnSVNfQUxMT1dfRFVQTElDQVRFX1RBQicpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlSXNBbGxvd1Bpbm5lZFRhYih2YWx1ZSkge1xyXG4gICAgYXdhaXQgc2F2ZVNldHRpbmcoJ0lTX0FMTE9XX1BJTk5FRF9UQUInLCB2YWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRJc0FsbG93UGlubmVkVGFiKCkge1xyXG4gICAgcmV0dXJuIGF3YWl0IGdldFNldHRpbmcoJ0lTX0FMTE9XX1BJTk5FRF9UQUInKTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNhdmVMYXN0U2Vzc2lvbih0YWJzKSB7XHJcbiAgICB0YWJzID0gYXdhaXQgZmlsdGVyVGFicyh0YWJzKVxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oU0VTU0lPTl9TVE9SRV9OQU1FLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoU0VTU0lPTl9TVE9SRV9OQU1FKTtcclxuXHJcbiAgICBhd2FpdCBzdG9yZS5jbGVhcigpO1xyXG5cclxuICAgIHN0b3JlLnB1dCh7IGtleTogXCJsYXN0U2Vzc2lvblwiLCB0YWJzIH0pO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0TGFzdFNlc3Npb24oKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihTRVNTSU9OX1NUT1JFX05BTUUsICdyZWFkb25seScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShTRVNTSU9OX1NUT1JFX05BTUUpO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSBzdG9yZS5nZXRBbGwoKTtcclxuICAgICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9ICgpID0+IHJlc29sdmUocmVxdWVzdC5yZXN1bHQpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleHBvcnRBbGxEYXRhQXNKc29uKCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuXHJcbiAgICBjb25zdCBnZXRBbGxGcm9tU3RvcmUgPSAoc3RvcmVOYW1lKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihzdG9yZU5hbWUsICdyZWFkb25seScpO1xyXG4gICAgICAgICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKHN0b3JlTmFtZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlcSA9IHN0b3JlLmdldEFsbCgpO1xyXG4gICAgICAgICAgICByZXEub25zdWNjZXNzID0gKCkgPT4gcmVzb2x2ZShyZXEucmVzdWx0KTtcclxuICAgICAgICAgICAgcmVxLm9uZXJyb3IgPSAoKSA9PiByZWplY3QocmVxLmVycm9yKTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgYnVja2V0cyA9IGF3YWl0IGdldEFsbEZyb21TdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldEFsbEZyb21TdG9yZShTRVRUSU5HU19TVE9SRV9OQU1FKTtcclxuXHJcbiAgICBjb25zdCBkYXRhID0ge1xyXG4gICAgICAgIGJ1Y2tldHMsXHJcbiAgICAgICAgc2V0dGluZ3MsXHJcbiAgICAgICAgZXhwb3J0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMildLCB7IHR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcclxuICAgIGNvbnN0IHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcblxyXG4gICAgY29uc3QgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuICAgIGEuaHJlZiA9IHVybDtcclxuICAgIGEuZG93bmxvYWQgPSBgdGFyY2hpdmUtZXhwb3J0LSR7ZGF0YS5leHBvcnRlZEF0fS5qc29uYDtcclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcbiAgICBhLmNsaWNrKCk7XHJcbiAgICBhLnJlbW92ZSgpO1xyXG4gICAgVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaW1wb3J0QWxsRGF0YUZyb21KU09OKGZpbGUpIHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcclxuXHJcbiAgICAgICAgcmVhZGVyLm9ubG9hZCA9IGFzeW5jIChldmVudCkgPT4ge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IEpTT04ucGFyc2UoZXZlbnQudGFyZ2V0LnJlc3VsdCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCFkYXRhLmJ1Y2tldHMgfHwgIWRhdGEuc2V0dGluZ3MpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgSlNPTiBzdHJ1Y3R1cmUnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oW0JVQ0tFVF9TVE9SRV9OQU1FLCBTRVRUSU5HU19TVE9SRV9OQU1FXSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgYnVja2V0U3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzZXR0aW5nU3RvcmUgPSB0eC5vYmplY3RTdG9yZShTRVRUSU5HU19TVE9SRV9OQU1FKTtcclxuXHJcbiAgICAgICAgICAgICAgICBidWNrZXRTdG9yZS5jbGVhcigpO1xyXG4gICAgICAgICAgICAgICAgc2V0dGluZ1N0b3JlLmNsZWFyKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgZGF0YT8uYnVja2V0cz8uZm9yRWFjaChidWNrZXQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGJ1Y2tldFN0b3JlLnB1dChidWNrZXQpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgZGF0YT8uc2V0dGluZ3M/LmZvckVhY2goc2V0dGluZyA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2V0dGluZ1N0b3JlLnB1dChzZXR0aW5nKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIHR4Lm9uY29tcGxldGUgPSAoKSA9PiByZXNvbHZlKHRydWUpO1xyXG4gICAgICAgICAgICAgICAgdHgub25lcnJvciA9ICgpID0+IHJlamVjdCh0eC5lcnJvcik7XHJcblxyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgcmVhZGVyLm9uZXJyb3IgPSAoKSA9PiByZWplY3QocmVhZGVyLmVycm9yKTtcclxuXHJcbiAgICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuIiwiaW1wb3J0IHsgYWRkVGFic1RvQnVja2V0LCBzYXZlTGFzdFNlc3Npb24gfSBmcm9tIFwiLi4vZGJcIjtcclxuaW1wb3J0IHsgZW5zdXJlRGFzaGJvYXJkRmlyc3QsIGdldE9wZW5lZFRhYnMsIG9wZW5EYXNoYm9hcmQgfSBmcm9tIFwiLi4vc2VydmljZXNcIjtcclxuaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gJ3d4dC9icm93c2VyJztcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUJhY2tncm91bmQoKCkgPT4ge1xyXG4gIGxldCBzdGFydHVwUGhhc2UgPSB0cnVlO1xyXG5cclxuICBicm93c2VyLnJ1bnRpbWUub25TdGFydHVwLmFkZExpc3RlbmVyKGFzeW5jICgpID0+IHtcclxuICAgIGNvbnN0IHsgY3VyclNlc3Npb24gfSA9IGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5nZXQoXCJjdXJyU2Vzc2lvblwiKTtcclxuICAgIGF3YWl0IHNhdmVMYXN0U2Vzc2lvbihjdXJyU2Vzc2lvbik7XHJcbiAgICBzdGFydHVwUGhhc2UgPSBmYWxzZTtcclxuXHJcbiAgICBlbnN1cmVEYXNoYm9hcmRGaXJzdCgpO1xyXG4gIH0pO1xyXG5cclxuICBicm93c2VyLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKHsgcmVhc29uIH0pID0+IHtcclxuICAgIGlmIChyZWFzb24gPT09ICdpbnN0YWxsJykge1xyXG4gICAgICBlbnN1cmVEYXNoYm9hcmRGaXJzdCgpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICBicm93c2VyLnRhYnMub25VcGRhdGVkLmFkZExpc3RlbmVyKGFzeW5jICh0YWJJZCwgY2hhbmdlSW5mbywgdGFiKSA9PiB7XHJcbiAgICBpZiAoY2hhbmdlSW5mby5zdGF0dXMgPT09IFwiY29tcGxldGVcIiAmJiB0YWIudXJsKSB7XHJcbiAgICAgIGxldCBzZXNzaW9uID0gYXdhaXQgZ2V0T3BlbmVkVGFicygpO1xyXG4gICAgICBpZiAoc3RhcnR1cFBoYXNlKSByZXR1cm47XHJcbiAgICAgIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5zZXQoeyBjdXJyU2Vzc2lvbjogc2Vzc2lvbiB9KTtcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgYnJvd3Nlci5jb21tYW5kcy5vbkNvbW1hbmQuYWRkTGlzdGVuZXIoYXN5bmMgKGNvbW1hbmQpID0+IHtcclxuICAgIGlmIChjb21tYW5kID09PSBcImFkZFRhYnNcIikge1xyXG4gICAgICBsZXQgdGFicyA9IGF3YWl0IGdldE9wZW5lZFRhYnMoKTtcclxuXHJcbiAgICAgIGxldCBmaWx0ZXJlZFRhYnMgPSB0YWJzLmZpbHRlcigodGFiKSA9PiB7XHJcbiAgICAgICAgaWYgKHRhYi50aXRsZSAhPT0gXCJhYm91dDpibGFua1wiKSByZXR1cm4gdGFiO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGlmIChmaWx0ZXJlZFRhYnMubGVuZ3RoID09PSAwKSByZXR1cm47XHJcblxyXG4gICAgICBhd2FpdCBhZGRUYWJzVG9CdWNrZXQoZmlsdGVyZWRUYWJzKTtcclxuXHJcbiAgICAgIGNvbnN0IGNoYW5uZWwgPSBuZXcgQnJvYWRjYXN0Q2hhbm5lbChcInRhcmNoaXZlX2NoYW5uZWxcIik7XHJcbiAgICAgIGNoYW5uZWwucG9zdE1lc3NhZ2UoeyB0eXBlOiBcIndvcmtzcGFjZXNfdXBkYXRlZFwiIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChjb21tYW5kID09PSBcInZpZXdCdWNrZXRzXCIpIHtcclxuICAgICAgYXdhaXQgb3BlbkRhc2hib2FyZCgpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59KTsiLCIvLyBzcmMvaW5kZXgudHNcbnZhciBfTWF0Y2hQYXR0ZXJuID0gY2xhc3Mge1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4pIHtcbiAgICBpZiAobWF0Y2hQYXR0ZXJuID09PSBcIjxhbGxfdXJscz5cIikge1xuICAgICAgdGhpcy5pc0FsbFVybHMgPSB0cnVlO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBbLi4uX01hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gXCIqXCI7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZ3JvdXBzID0gLyguKik6XFwvXFwvKC4qPykoXFwvLiopLy5leGVjKG1hdGNoUGF0dGVybik7XG4gICAgICBpZiAoZ3JvdXBzID09IG51bGwpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xuICAgICAgY29uc3QgW18sIHByb3RvY29sLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gZ3JvdXBzO1xuICAgICAgdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKTtcbiAgICAgIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XG4gICAgICB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBwcm90b2NvbCA9PT0gXCIqXCIgPyBbXCJodHRwXCIsIFwiaHR0cHNcIl0gOiBbcHJvdG9jb2xdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gaG9zdG5hbWU7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBwYXRobmFtZTtcbiAgICB9XG4gIH1cbiAgaW5jbHVkZXModXJsKSB7XG4gICAgaWYgKHRoaXMuaXNBbGxVcmxzKVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgdSA9IHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIgPyBuZXcgVVJMKHVybCkgOiB1cmwgaW5zdGFuY2VvZiBMb2NhdGlvbiA/IG5ldyBVUkwodXJsLmhyZWYpIDogdXJsO1xuICAgIHJldHVybiAhIXRoaXMucHJvdG9jb2xNYXRjaGVzLmZpbmQoKHByb3RvY29sKSA9PiB7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwc1wiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBzTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZmlsZVwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0ZpbGVNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmdHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGdHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJ1cm5cIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNVcm5NYXRjaCh1KTtcbiAgICB9KTtcbiAgfVxuICBpc0h0dHBNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHA6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0h0dHBzTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwczpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSG9zdFBhdGhNYXRjaCh1cmwpIHtcbiAgICBpZiAoIXRoaXMuaG9zdG5hbWVNYXRjaCB8fCAhdGhpcy5wYXRobmFtZU1hdGNoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGhvc3RuYW1lTWF0Y2hSZWdleHMgPSBbXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gpLFxuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoLnJlcGxhY2UoL15cXCpcXC4vLCBcIlwiKSlcbiAgICBdO1xuICAgIGNvbnN0IHBhdGhuYW1lTWF0Y2hSZWdleCA9IHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMucGF0aG5hbWVNYXRjaCk7XG4gICAgcmV0dXJuICEhaG9zdG5hbWVNYXRjaFJlZ2V4cy5maW5kKChyZWdleCkgPT4gcmVnZXgudGVzdCh1cmwuaG9zdG5hbWUpKSAmJiBwYXRobmFtZU1hdGNoUmVnZXgudGVzdCh1cmwucGF0aG5hbWUpO1xuICB9XG4gIGlzRmlsZU1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmaWxlOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc0Z0cE1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmdHA6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzVXJuTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IHVybjovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgY29udmVydFBhdHRlcm5Ub1JlZ2V4KHBhdHRlcm4pIHtcbiAgICBjb25zdCBlc2NhcGVkID0gdGhpcy5lc2NhcGVGb3JSZWdleChwYXR0ZXJuKTtcbiAgICBjb25zdCBzdGFyc1JlcGxhY2VkID0gZXNjYXBlZC5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XG4gICAgcmV0dXJuIFJlZ0V4cChgXiR7c3RhcnNSZXBsYWNlZH0kYCk7XG4gIH1cbiAgZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG4gIH1cbn07XG52YXIgTWF0Y2hQYXR0ZXJuID0gX01hdGNoUGF0dGVybjtcbk1hdGNoUGF0dGVybi5QUk9UT0NPTFMgPSBbXCJodHRwXCIsIFwiaHR0cHNcIiwgXCJmaWxlXCIsIFwiZnRwXCIsIFwidXJuXCJdO1xudmFyIEludmFsaWRNYXRjaFBhdHRlcm4gPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuLCByZWFzb24pIHtcbiAgICBzdXBlcihgSW52YWxpZCBtYXRjaCBwYXR0ZXJuIFwiJHttYXRjaFBhdHRlcm59XCI6ICR7cmVhc29ufWApO1xuICB9XG59O1xuZnVuY3Rpb24gdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKSB7XG4gIGlmICghTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5pbmNsdWRlcyhwcm90b2NvbCkgJiYgcHJvdG9jb2wgIT09IFwiKlwiKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCI6XCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYEhvc3RuYW1lIGNhbm5vdCBpbmNsdWRlIGEgcG9ydGApO1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCIqXCIpICYmIGhvc3RuYW1lLmxlbmd0aCA+IDEgJiYgIWhvc3RuYW1lLnN0YXJ0c1dpdGgoXCIqLlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGBJZiB1c2luZyBhIHdpbGRjYXJkICgqKSwgaXQgbXVzdCBnbyBhdCB0aGUgc3RhcnQgb2YgdGhlIGhvc3RuYW1lYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpIHtcbiAgcmV0dXJuO1xufVxuZXhwb3J0IHtcbiAgSW52YWxpZE1hdGNoUGF0dGVybixcbiAgTWF0Y2hQYXR0ZXJuXG59O1xuIl0sIm5hbWVzIjpbImJyb3dzZXIiLCJfYnJvd3NlciIsIl9hIl0sIm1hcHBpbmdzIjoiOzs7QUFBTyxXQUFTLGlCQUFpQixLQUFLO0FBQ3BDLFFBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxXQUFZLFFBQU8sRUFBRSxNQUFNLElBQUs7QUFDbEUsV0FBTztBQUFBLEVBQ1Q7QUNGTyxRQUFNQSxjQUFVLHNCQUFXLFlBQVgsbUJBQW9CLFlBQXBCLG1CQUE2QixNQUNoRCxXQUFXLFVBQ1gsV0FBVztBQ0ZSLFFBQU0sVUFBVUM7QUNFaEIsaUJBQWUsV0FBVyxNQUFNO0FBQ25DLFVBQU0s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
