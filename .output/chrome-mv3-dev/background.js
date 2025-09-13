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
    let filteredTabs = tabs == null ? void 0 : tabs.filter((tab) => {
      const url = tab.url || "";
      return url !== "" && !url.startsWith("chrome://") && !url.startsWith("chrome-extension://") && !url.startsWith("about:");
    });
    filteredTabs = filteredTabs == null ? void 0 : filteredTabs.filter((tab) => {
      if (!(tab == null ? void 0 : tab.pinned)) {
        return true;
      }
      return (tab == null ? void 0 : tab.pinned) === IS_ALLOW_PINNED;
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
  async function saveCurrentSession(tabs) {
    const filtered = await filterTabs(tabs);
    if (filtered == null ? void 0 : filtered.length) {
      await browser.storage.local.set({ currentSession: filtered });
    }
  }
  async function updateLastSessionFromCurrent() {
    console.log("step2");
    const { currentSession } = await browser.storage.local.get("currentSession");
    console.log("step3");
    if (currentSession == null ? void 0 : currentSession.length) {
      console.log("step4", currentSession);
      await browser.storage.local.set({ lastSession: currentSession });
      const { lastSession } = await browser.storage.local.get("lastSession");
      console.log("step5", lastSession);
    }
    console.log("step6");
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
  const definition = defineBackground(() => {
    browser.tabs.onCreated.addListener(() => {
      browser.tabs.query({}, (tabs) => saveCurrentSession(tabs));
    });
    browser.tabs.onUpdated.addListener(() => {
      browser.tabs.query({}, (tabs) => saveCurrentSession(tabs));
    });
    browser.tabs.onRemoved.addListener((_, removeInfo) => {
      if (removeInfo.isWindowClosing) return;
      browser.tabs.query({}, (tabs) => saveCurrentSession(tabs));
    });
    browser.windows.onRemoved.addListener(async () => {
      const windows = await browser.windows.getAll();
      if (windows.length === 0) return;
      await updateLastSessionFromCurrent();
    });
    browser.runtime.onStartup.addListener(async () => {
      await updateLastSessionFromCurrent();
    });
    browser.runtime.onInstalled.addListener(({ reason }) => {
      if (reason === "install") {
        ensureDashboardFirst();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zZXJ2aWNlcy9pbmRleC5qcyIsIi4uLy4uL3V0aWxzL2NvbnN0YW50cy9pbmRleC5qcyIsIi4uLy4uL2RiL2luZGV4LmpzIiwiLi4vLi4vZW50cnlwb2ludHMvYmFja2dyb3VuZC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVCYWNrZ3JvdW5kKGFyZykge1xuICBpZiAoYXJnID09IG51bGwgfHwgdHlwZW9mIGFyZyA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyBtYWluOiBhcmcgfTtcbiAgcmV0dXJuIGFyZztcbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XHJcbmltcG9ydCB7IGdldElzQWxsb3dEdXBsaWNhdGVUYWIsIGdldElzQWxsb3dQaW5uZWRUYWIgfSBmcm9tICcuLi9kYic7XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmlsdGVyVGFicyh0YWJzKSB7XHJcbiAgICBjb25zdCBJU19BTExPV19QSU5ORUQgPSBhd2FpdCBnZXRJc0FsbG93UGlubmVkVGFiKCk7XHJcbiAgICBjb25zdCBJU19EVVBMSUNBVEVfVEFCX0FMTE9XRUQgPSBhd2FpdCBnZXRJc0FsbG93RHVwbGljYXRlVGFiKCk7XHJcblxyXG4gICAgbGV0IGZpbHRlcmVkVGFicyA9IHRhYnM/LmZpbHRlcih0YWIgPT4ge1xyXG4gICAgICAgIGNvbnN0IHVybCA9IHRhYi51cmwgfHwgXCJcIjtcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICB1cmwgIT09IFwiXCIgJiZcclxuICAgICAgICAgICAgIXVybC5zdGFydHNXaXRoKFwiY2hyb21lOi8vXCIpICYmXHJcbiAgICAgICAgICAgICF1cmwuc3RhcnRzV2l0aChcImNocm9tZS1leHRlbnNpb246Ly9cIikgJiZcclxuICAgICAgICAgICAgIXVybC5zdGFydHNXaXRoKFwiYWJvdXQ6XCIpXHJcbiAgICAgICAgKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGZpbHRlcmVkVGFicyA9IGZpbHRlcmVkVGFicz8uZmlsdGVyKHRhYiA9PiB7XHJcbiAgICAgICAgaWYgKCF0YWI/LnBpbm5lZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0YWI/LnBpbm5lZCA9PT0gSVNfQUxMT1dfUElOTkVEO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKCFJU19EVVBMSUNBVEVfVEFCX0FMTE9XRUQpIHtcclxuICAgICAgICBjb25zdCBzZWVuID0gbmV3IFNldCgpO1xyXG4gICAgICAgIGZpbHRlcmVkVGFicyA9IGZpbHRlcmVkVGFicy5maWx0ZXIoKHRhYikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoc2Vlbi5oYXModGFiLnVybCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHNlZW4uYWRkKHRhYi51cmwpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmaWx0ZXJlZFRhYnM7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRPcGVuZWRUYWJzKCkge1xyXG4gICAgbGV0IHRhYnMgPSBhd2FpdCBicm93c2VyLnRhYnMucXVlcnkoe30pO1xyXG4gICAgcmV0dXJuIGF3YWl0IGZpbHRlclRhYnModGFicyk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXREYXNoYm9hcmRUYWIoKSB7XHJcbiAgICBsZXQgZGFzaGJvYXJkVGFicyA9IGF3YWl0IGJyb3dzZXIudGFicy5xdWVyeSh7IHVybDogYnJvd3Nlci5ydW50aW1lLmdldFVSTChcImRhc2hib2FyZC5odG1sXCIpIH0pO1xyXG4gICAgcmV0dXJuIGRhc2hib2FyZFRhYnNbMF07XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVSZWxvYWREYXNoYm9hcmQoKSB7XHJcbiAgICBsZXQgdGFicyA9IGF3YWl0IGJyb3dzZXIudGFicy5xdWVyeSh7IHVybDogYnJvd3Nlci5ydW50aW1lLmdldFVSTChcImRhc2hib2FyZC5odG1sXCIpIH0pO1xyXG5cclxuICAgIGlmICh0YWJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIGJyb3dzZXIudGFicy5jcmVhdGUoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSwgaW5kZXg6IDAsIHBpbm5lZDogdHJ1ZSB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYnJvd3Nlci50YWJzLnJlbG9hZCh0YWJzWzBdLmlkKTtcclxuICAgICAgICBicm93c2VyLnRhYnMudXBkYXRlKHRhYnNbMF0uaWQsIHsgYWN0aXZlOiB0cnVlIH0pO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlbkRhc2hib2FyZCgpIHtcclxuICAgIGxldCB0YWJzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHsgdXJsOiBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKFwiZGFzaGJvYXJkLmh0bWxcIikgfSk7XHJcblxyXG4gICAgaWYgKHRhYnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgYnJvd3Nlci50YWJzLmNyZWF0ZSh7IHVybDogYnJvd3Nlci5ydW50aW1lLmdldFVSTChcImRhc2hib2FyZC5odG1sXCIpLCBpbmRleDogMCwgcGlubmVkOiB0cnVlIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBicm93c2VyLnRhYnMudXBkYXRlKHRhYnNbMF0uaWQsIHsgYWN0aXZlOiB0cnVlIH0pO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb3BlbkN1cnJlbnRUYWIoaWQpIHtcclxuICAgIGJyb3dzZXIudGFicy51cGRhdGUoaWQsIHsgYWN0aXZlOiB0cnVlIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb3BlblRhYnModGFicykge1xyXG4gICAgdGFicy5mb3JFYWNoKCh0YWIpID0+IHtcclxuICAgICAgICBicm93c2VyLnRhYnMuY3JlYXRlKHsgdXJsOiB0YWIudXJsIH0pO1xyXG4gICAgfSlcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5UYWJHcm91cChidWNrZXQpIHtcclxuICAgIFByb21pc2UuYWxsKFxyXG4gICAgICAgIGJ1Y2tldC50YWJzLm1hcCh0YWIgPT4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgYnJvd3Nlci50YWJzLmNyZWF0ZSh7IHVybDogdGFiLnVybCB9LCByZXNvbHZlKTtcclxuICAgICAgICB9KSlcclxuICAgICkudGhlbigodGFicykgPT4ge1xyXG4gICAgICAgIGNvbnN0IHRhYklkcyA9IHRhYnMubWFwKHRhYiA9PiB0YWIuaWQpO1xyXG5cclxuICAgICAgICBicm93c2VyLnRhYnMuZ3JvdXAoeyB0YWJJZHM6IHRhYklkcyB9LCAoZ3JvdXBJZCkgPT4ge1xyXG4gICAgICAgICAgICBicm93c2VyLnRhYkdyb3Vwcy51cGRhdGUoZ3JvdXBJZCwge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IGJ1Y2tldC5uYW1lLFxyXG4gICAgICAgICAgICAgICAgY29sb3I6IGJ1Y2tldD8uY29sb3IgPyBidWNrZXQuY29sb3IgOiAnYmx1ZScsXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuVGFiSW5XaW5kb3coYnVja2V0KSB7XHJcbiAgICBicm93c2VyLndpbmRvd3MuY3JlYXRlKHtcclxuICAgICAgICB1cmw6IGJ1Y2tldC50YWJzLm1hcCgodGFiKSA9PiB0YWIudXJsKSxcclxuICAgICAgICBmb2N1c2VkOiB0cnVlLFxyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbnN1cmVEYXNoYm9hcmRGaXJzdCgpIHtcclxuICAgIGNvbnN0IHRhYnMgPSBhd2FpdCBicm93c2VyLnRhYnMucXVlcnkoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSB9KTtcclxuICAgIGlmICh0YWJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIGF3YWl0IGJyb3dzZXIudGFicy5jcmVhdGUoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSwgaW5kZXg6IDAsIHBpbm5lZDogdHJ1ZSB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc3QgZGFzaGJvYXJkVGFiID0gdGFic1swXTtcclxuICAgICAgICBpZiAoZGFzaGJvYXJkVGFiLmluZGV4ICE9PSAwKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IGJyb3dzZXIudGFicy5tb3ZlKGRhc2hib2FyZFRhYi5pZCwgeyBpbmRleDogMCB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qIC0tLS0tIGxhc3Qgc2Vzc2lvbiAtLS0tLSAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0TGFzdFNlc3Npb24oKSB7XHJcbiAgICBjb25zdCB7IGxhc3RTZXNzaW9uIH0gPSBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuZ2V0KFwibGFzdFNlc3Npb25cIik7XHJcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShsYXN0U2Vzc2lvbikgPyBsYXN0U2Vzc2lvbiA6IFtdO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2F2ZUN1cnJlbnRTZXNzaW9uKHRhYnMpIHtcclxuICAgIGNvbnN0IGZpbHRlcmVkID0gYXdhaXQgZmlsdGVyVGFicyh0YWJzKTtcclxuICAgIGlmIChmaWx0ZXJlZD8ubGVuZ3RoKSB7XHJcbiAgICAgICAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnNldCh7IGN1cnJlbnRTZXNzaW9uOiBmaWx0ZXJlZCB9KTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUxhc3RTZXNzaW9uRnJvbUN1cnJlbnQoKSB7XHJcbiAgICBjb25zb2xlLmxvZygnc3RlcDInKTtcclxuXHJcbiAgICBjb25zdCB7IGN1cnJlbnRTZXNzaW9uIH0gPSBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuZ2V0KFwiY3VycmVudFNlc3Npb25cIik7XHJcbiAgICBjb25zb2xlLmxvZygnc3RlcDMnKTtcclxuXHJcbiAgICBpZiAoY3VycmVudFNlc3Npb24/Lmxlbmd0aCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdzdGVwNCcsIGN1cnJlbnRTZXNzaW9uKTtcclxuXHJcbiAgICAgICAgYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLnNldCh7IGxhc3RTZXNzaW9uOiBjdXJyZW50U2Vzc2lvbiB9KTtcclxuICAgICAgICBjb25zdCB7IGxhc3RTZXNzaW9uIH0gPSBhd2FpdCBicm93c2VyLnN0b3JhZ2UubG9jYWwuZ2V0KFwibGFzdFNlc3Npb25cIik7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ3N0ZXA1JywgbGFzdFNlc3Npb24pO1xyXG5cclxuICAgIH1cclxuICAgIGNvbnNvbGUubG9nKCdzdGVwNicpO1xyXG5cclxufSIsImV4cG9ydCBjb25zdCBlbXB0eVBvcFVwRmFsbGJhY2tNZXNzYWdlcyA9IFtcclxuICAgIFwiTm8gdGFicyBvcGVuIHJpZ2h0IG5vdy4gVGltZSB0byBmb2N1cz8g8J+YjFwiLFxyXG4gICAgXCJZb3UncmUgYWxsIGNsZWFyLiBObyB0YWJzIGluIHNpZ2h0LlwiLFxyXG4gICAgXCJObyBhY3RpdmUgdGFicyBmb3VuZCBpbiB0aGlzIHdpbmRvdy5cIixcclxuICAgIFwiWW91ciBicm93c2VyIHRhYiBvY2VhbiBpcyBjYWxtIPCfp5hcIixcclxuICAgIFwiTm90aGluZyBoZXJlLiBIaXQg4oCYQWRk4oCZIHdoZW4geW91J3JlIHJlYWR5IHRvIHNhdmUgc29tZSB0YWJzIVwiLFxyXG5dO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldEVtcHR5UG9wVXBGYWxsQmFja01lc3NhZ2UoKSB7XHJcbiAgICByZXR1cm4gZW1wdHlQb3BVcEZhbGxiYWNrTWVzc2FnZXNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZW1wdHlQb3BVcEZhbGxiYWNrTWVzc2FnZXMubGVuZ3RoKV07XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBkZWZhdWx0V29ya3NwYWNlcyA9IHtcclxuICAgIEFMTDogJ0FsbCcsXHJcbiAgICBGQVZPUklURTogJ0Zhdm9yaXRlJyxcclxuICAgIExBU1RfU0VTU0lPTjogJ0xhc3Qgc2Vzc2lvbidcclxufSIsImNvbnN0IERCX05BTUUgPSAnVGFyY2hpdmVEQic7XHJcbmltcG9ydCB7IGZpbHRlclRhYnMgfSBmcm9tICcuLi9zZXJ2aWNlcyc7XHJcbmltcG9ydCB7IGRlZmF1bHRXb3Jrc3BhY2VzIH0gZnJvbSAnLi4vdXRpbHMvY29uc3RhbnRzL2luZGV4JztcclxuY29uc3QgQlVDS0VUX1NUT1JFX05BTUUgPSAnYnVja2V0cyc7XHJcbmNvbnN0IFNFVFRJTkdTX1NUT1JFX05BTUUgPSAnc2V0dGluZ3MnO1xyXG5jb25zdCBTRVNTSU9OX1NUT1JFX05BTUUgPSAnc2Vzc2lvbic7XHJcbmNvbnN0IERCX1ZFUlNJT04gPSAxO1xyXG5sZXQgZGVib3VuY2VUaW1lciA9IG51bGw7XHJcblxyXG5mdW5jdGlvbiBvcGVuREIoKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSBpbmRleGVkREIub3BlbihEQl9OQU1FLCBEQl9WRVJTSU9OKTtcclxuXHJcbiAgICAgICAgcmVxdWVzdC5vbnVwZ3JhZGVuZWVkZWQgPSAoZXZlbnQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgZGIgPSBldmVudC50YXJnZXQucmVzdWx0O1xyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoQlVDS0VUX1NUT1JFX05BTUUpKSB7XHJcbiAgICAgICAgICAgICAgICBkYi5jcmVhdGVPYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSwgeyBrZXlQYXRoOiAnaWQnIH0pO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoU0VUVElOR1NfU1RPUkVfTkFNRSkpIHtcclxuICAgICAgICAgICAgICAgIGRiLmNyZWF0ZU9iamVjdFN0b3JlKFNFVFRJTkdTX1NUT1JFX05BTUUsIHsga2V5UGF0aDogXCJrZXlcIiB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFNFU1NJT05fU1RPUkVfTkFNRSkpIHtcclxuICAgICAgICAgICAgICAgIGRiLmNyZWF0ZU9iamVjdFN0b3JlKFNFU1NJT05fU1RPUkVfTkFNRSwgeyBrZXlQYXRoOiBcImtleVwiIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoKSA9PiByZXNvbHZlKHJlcXVlc3QucmVzdWx0KTtcclxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSAoKSA9PiByZWplY3QocmVxdWVzdC5lcnJvcik7XHJcbiAgICB9KTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZ2V0QWxsQnVja2V0cygpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKEJVQ0tFVF9TVE9SRV9OQU1FLCAncmVhZG9ubHknKTtcclxuICAgICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcclxuICAgICAgICBjb25zdCByZXF1ZXN0ID0gc3RvcmUuZ2V0QWxsKCk7XHJcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoKSA9PiByZXNvbHZlKHJlcXVlc3QucmVzdWx0KTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYWRkVGFic1RvQnVja2V0KHRhYnMpIHtcclxuICAgIGlmICh0YWJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG5cclxuICAgIGxldCBmaWx0ZXJlZFRhYnMgPSB0YWJzLmZpbHRlcigodGFiKSA9PiB7XHJcbiAgICAgICAgaWYgKHRhYi5jaGVja2VkICE9PSBmYWxzZSkgcmV0dXJuIHRhYjtcclxuICAgIH0pO1xyXG5cclxuICAgIGlmIChmaWx0ZXJlZFRhYnMubGVuZ3RoID09PSAwKSByZXR1cm47IC8vIHJldHVybiBpZiBubyB0YWJzXHJcblxyXG4gICAgY29uc3QgaWQgPSBjcnlwdG8ucmFuZG9tVVVJRCgpO1xyXG4gICAgY29uc3QgYnVja2V0ID0ge1xyXG4gICAgICAgIGlkLFxyXG4gICAgICAgIG5hbWU6IGlkLnNsaWNlKDAsIDgpLFxyXG4gICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgIHRhYnM6IGZpbHRlcmVkVGFicyxcclxuICAgICAgICB0YWc6IFtkZWZhdWx0V29ya3NwYWNlcy5BTExdLFxyXG4gICAgICAgIGlzTG9ja2VkOiBmYWxzZSxcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKS5hZGQoYnVja2V0KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRlbGV0ZUJ1Y2tldChpZCkge1xyXG4gICAgY29uc3QgYnVja2V0cyA9IGF3YWl0IGdldEFsbEJ1Y2tldHMoKTtcclxuICAgIGNvbnN0IGJ1Y2tldCA9IGJ1Y2tldHMuZmluZChiID0+IGIuaWQgPT09IGlkKTtcclxuICAgIGlmIChidWNrZXQ/LmlzTG9ja2VkKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKS5kZWxldGUoaWQpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVuYW1lQnVja2V0TmFtZShpZCwgbmFtZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpO1xyXG4gICAgY29uc3QgcmVxID0gYXdhaXQgc3RvcmUuZ2V0KGlkKTtcclxuXHJcbiAgICByZXEub25zdWNjZXNzID0gKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSByZXEucmVzdWx0O1xyXG5cclxuICAgICAgICBpZiAoZGF0YSkge1xyXG4gICAgICAgICAgICBkYXRhLm5hbWUgPSBuYW1lO1xyXG4gICAgICAgICAgICBzdG9yZS5wdXQoZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUJ1Y2tldExvY2soaWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKEJVQ0tFVF9TVE9SRV9OQU1FLCAncmVhZHdyaXRlJyk7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcclxuICAgIGNvbnN0IHJlcSA9IHN0b3JlLmdldChpZCk7XHJcblxyXG4gICAgcmVxLm9uc3VjY2VzcyA9ICgpID0+IHtcclxuICAgICAgICBjb25zdCBkYXRhID0gcmVxLnJlc3VsdDtcclxuICAgICAgICBpZiAoZGF0YSkge1xyXG4gICAgICAgICAgICBkYXRhLmlzTG9ja2VkID0gIWRhdGE/LmlzTG9ja2VkO1xyXG4gICAgICAgICAgICBzdG9yZS5wdXQoZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEFsbFdvcmtzcGFjZXMoKSB7XHJcbiAgICBjb25zdCBidWNrZXRzID0gYXdhaXQgZ2V0QWxsQnVja2V0cygpO1xyXG4gICAgYnVja2V0cy5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRBdC5sb2NhbGVDb21wYXJlKGEuY3JlYXRlZEF0KSk7XHJcblxyXG4gICAgY29uc3Qgd29ya3NwYWNlcyA9IHt9O1xyXG5cclxuICAgIGJ1Y2tldHMuZm9yRWFjaChidWNrZXQgPT4ge1xyXG4gICAgICAgIGJ1Y2tldD8udGFnPy5mb3JFYWNoKHRhZyA9PiB7XHJcbiAgICAgICAgICAgIGlmICghd29ya3NwYWNlc1t0YWddKSB3b3Jrc3BhY2VzW3RhZ10gPSBbXTtcclxuICAgICAgICAgICAgd29ya3NwYWNlc1t0YWddLnB1c2goYnVja2V0KTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB3b3Jrc3BhY2VzO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdG9nZ2xlVGFnKGlkLCB0YWcpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKEJVQ0tFVF9TVE9SRV9OQU1FLCAncmVhZHdyaXRlJyk7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcclxuICAgIGNvbnN0IHJlcSA9IHN0b3JlLmdldChpZCk7XHJcblxyXG4gICAgcmVxLm9uc3VjY2VzcyA9ICgpID0+IHtcclxuICAgICAgICBjb25zdCBkYXRhID0gcmVxLnJlc3VsdDtcclxuICAgICAgICBpZiAoZGF0YSAmJiAhZGF0YS50YWcuaW5jbHVkZXModGFnKSkge1xyXG4gICAgICAgICAgICBkYXRhLnRhZy5wdXNoKHRhZyk7XHJcbiAgICAgICAgICAgIHN0b3JlLnB1dChkYXRhKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IGRhdGEudGFnLmluZGV4T2YodGFnKTtcclxuICAgICAgICAgICAgZGF0YS50YWcuc3BsaWNlKGluZGV4LCAxKTtcclxuICAgICAgICAgICAgc3RvcmUucHV0KGRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkZWxldGVUYWIodGFiSWQsIGJ1Y2tldElkKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihCVUNLRVRfU1RPUkVfTkFNRSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XHJcbiAgICBjb25zdCByZXEgPSBzdG9yZS5nZXQoYnVja2V0SWQpO1xyXG5cclxuICAgIHJlcS5vbnN1Y2Nlc3MgPSBhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IHJlcS5yZXN1bHQ7XHJcbiAgICAgICAgaWYgKGRhdGE/LnRhYnM/Lmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgICAgICBzdG9yZS5kZWxldGUoYnVja2V0SWQpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGRhdGEudGFicyA9IGRhdGEudGFicy5maWx0ZXIoKHRhYikgPT4gdGFiLmlkICE9PSB0YWJJZCk7XHJcbiAgICAgICAgc3RvcmUucHV0KGRhdGEpO1xyXG4gICAgfTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNhdmVTZXR0aW5nKGtleSwgdmFsdWUpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFNFVFRJTkdTX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoU0VUVElOR1NfU1RPUkVfTkFNRSk7XHJcblxyXG4gICAgY29uc3Qgc2V0dGluZyA9IHsga2V5LCB2YWx1ZSB9O1xyXG4gICAgc3RvcmUucHV0KHNldHRpbmcpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0U2V0dGluZyhrZXkpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFNFVFRJTkdTX1NUT1JFX05BTUUsICdyZWFkb25seScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShTRVRUSU5HU19TVE9SRV9OQU1FKTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSBzdG9yZS5nZXQoa2V5KTtcclxuXHJcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoKSA9PiB7XHJcbiAgICAgICAgICAgIHJlc29sdmUocmVxdWVzdC5yZXN1bHQ/LnZhbHVlID8/IG51bGwpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gKCkgPT4gcmVqZWN0KHJlcXVlc3QuZXJyb3IpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB1cGRhdGVJc0FsbG93RHVwbGljYXRlVGFiKHZhbHVlKSB7XHJcbiAgICBhd2FpdCBzYXZlU2V0dGluZygnSVNfQUxMT1dfRFVQTElDQVRFX1RBQicsIHZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldElzQWxsb3dEdXBsaWNhdGVUYWIoKSB7XHJcbiAgICByZXR1cm4gYXdhaXQgZ2V0U2V0dGluZygnSVNfQUxMT1dfRFVQTElDQVRFX1RBQicpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlSXNBbGxvd1Bpbm5lZFRhYih2YWx1ZSkge1xyXG4gICAgYXdhaXQgc2F2ZVNldHRpbmcoJ0lTX0FMTE9XX1BJTk5FRF9UQUInLCB2YWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRJc0FsbG93UGlubmVkVGFiKCkge1xyXG4gICAgcmV0dXJuIGF3YWl0IGdldFNldHRpbmcoJ0lTX0FMTE9XX1BJTk5FRF9UQUInKTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNhdmVMYXN0U2Vzc2lvbih0YWJzKSB7XHJcbiAgICB0YWJzID0gYXdhaXQgZmlsdGVyVGFicyh0YWJzKVxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oU0VTU0lPTl9TVE9SRV9OQU1FLCBcInJlYWR3cml0ZVwiKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoU0VTU0lPTl9TVE9SRV9OQU1FKTtcclxuXHJcbiAgICBhd2FpdCBzdG9yZS5jbGVhcigpO1xyXG5cclxuICAgIHN0b3JlLnB1dCh7IGtleTogXCJsYXN0U2Vzc2lvblwiLCB0YWJzIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZGVib3VuY2VTYXZlU2Vzc2lvbih0YWJzLCBkZWxheSA9IDEwMDApIHtcclxuICAgIGlmIChkZWJvdW5jZVRpbWVyKSBjbGVhclRpbWVvdXQoZGVib3VuY2VUaW1lcik7XHJcblxyXG4gICAgZGVib3VuY2VUaW1lciA9IHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIGF3YWl0IHNhdmVMYXN0U2Vzc2lvbih0YWJzKTtcclxuICAgIH0sIGRlbGF5KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldExhc3RTZXNzaW9uKCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oU0VTU0lPTl9TVE9SRV9OQU1FLCAncmVhZG9ubHknKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoU0VTU0lPTl9TVE9SRV9OQU1FKTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICBjb25zdCByZXF1ZXN0ID0gc3RvcmUuZ2V0QWxsKCk7XHJcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoKSA9PiByZXNvbHZlKHJlcXVlc3QucmVzdWx0KTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhwb3J0QWxsRGF0YUFzSnNvbigpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcblxyXG4gICAgY29uc3QgZ2V0QWxsRnJvbVN0b3JlID0gKHN0b3JlTmFtZSkgPT4ge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oc3RvcmVOYW1lLCAncmVhZG9ubHknKTtcclxuICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShzdG9yZU5hbWUpO1xyXG4gICAgICAgICAgICBjb25zdCByZXEgPSBzdG9yZS5nZXRBbGwoKTtcclxuICAgICAgICAgICAgcmVxLm9uc3VjY2VzcyA9ICgpID0+IHJlc29sdmUocmVxLnJlc3VsdCk7XHJcbiAgICAgICAgICAgIHJlcS5vbmVycm9yID0gKCkgPT4gcmVqZWN0KHJlcS5lcnJvcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGJ1Y2tldHMgPSBhd2FpdCBnZXRBbGxGcm9tU3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpO1xyXG4gICAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBnZXRBbGxGcm9tU3RvcmUoU0VUVElOR1NfU1RPUkVfTkFNRSk7XHJcblxyXG4gICAgY29uc3QgZGF0YSA9IHtcclxuICAgICAgICBidWNrZXRzLFxyXG4gICAgICAgIHNldHRpbmdzLFxyXG4gICAgICAgIGV4cG9ydGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW0pTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpXSwgeyB0eXBlOiAnYXBwbGljYXRpb24vanNvbicgfSk7XHJcbiAgICBjb25zdCB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xyXG5cclxuICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcbiAgICBhLmhyZWYgPSB1cmw7XHJcbiAgICBhLmRvd25sb2FkID0gYHRhcmNoaXZlLWV4cG9ydC0ke2RhdGEuZXhwb3J0ZWRBdH0uanNvbmA7XHJcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGEpO1xyXG4gICAgYS5jbGljaygpO1xyXG4gICAgYS5yZW1vdmUoKTtcclxuICAgIFVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGltcG9ydEFsbERhdGFGcm9tSlNPTihmaWxlKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XHJcblxyXG4gICAgICAgIHJlYWRlci5vbmxvYWQgPSBhc3luYyAoZXZlbnQpID0+IHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGV2ZW50LnRhcmdldC5yZXN1bHQpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghZGF0YS5idWNrZXRzIHx8ICFkYXRhLnNldHRpbmdzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIEpTT04gc3RydWN0dXJlJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFtCVUNLRVRfU1RPUkVfTkFNRSwgU0VUVElOR1NfU1RPUkVfTkFNRV0sICdyZWFkd3JpdGUnKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGJ1Y2tldFN0b3JlID0gdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpO1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2V0dGluZ1N0b3JlID0gdHgub2JqZWN0U3RvcmUoU0VUVElOR1NfU1RPUkVfTkFNRSk7XHJcblxyXG4gICAgICAgICAgICAgICAgYnVja2V0U3RvcmUuY2xlYXIoKTtcclxuICAgICAgICAgICAgICAgIHNldHRpbmdTdG9yZS5jbGVhcigpO1xyXG5cclxuICAgICAgICAgICAgICAgIGRhdGE/LmJ1Y2tldHM/LmZvckVhY2goYnVja2V0ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBidWNrZXRTdG9yZS5wdXQoYnVja2V0KTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGRhdGE/LnNldHRpbmdzPy5mb3JFYWNoKHNldHRpbmcgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHNldHRpbmdTdG9yZS5wdXQoc2V0dGluZyk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICB0eC5vbmNvbXBsZXRlID0gKCkgPT4gcmVzb2x2ZSh0cnVlKTtcclxuICAgICAgICAgICAgICAgIHR4Lm9uZXJyb3IgPSAoKSA9PiByZWplY3QodHguZXJyb3IpO1xyXG5cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHJlYWRlci5vbmVycm9yID0gKCkgPT4gcmVqZWN0KHJlYWRlci5lcnJvcik7XHJcblxyXG4gICAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGUpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbiIsImltcG9ydCB7IGFkZFRhYnNUb0J1Y2tldCB9IGZyb20gXCIuLi9kYlwiO1xyXG5pbXBvcnQgeyBlbnN1cmVEYXNoYm9hcmRGaXJzdCwgZ2V0T3BlbmVkVGFicywgb3BlbkRhc2hib2FyZCwgc2F2ZUN1cnJlbnRTZXNzaW9uLCB1cGRhdGVMYXN0U2Vzc2lvbkZyb21DdXJyZW50IH0gZnJvbSBcIi4uL3NlcnZpY2VzXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcclxuICAvLyBtYWludGFpbiBjdXJyZW50U2Vzc2lvbiBvbiBjcmVhdGVcclxuICBicm93c2VyLnRhYnMub25DcmVhdGVkLmFkZExpc3RlbmVyKCgpID0+IHtcclxuICAgIGJyb3dzZXIudGFicy5xdWVyeSh7fSwgdGFicyA9PiBzYXZlQ3VycmVudFNlc3Npb24odGFicykpO1xyXG4gIH0pO1xyXG5cclxuICAvLyBtYWludGFpbiBjdXJyZW50U2Vzc2lvbiBvbiB1cGRhdGVcclxuICBicm93c2VyLnRhYnMub25VcGRhdGVkLmFkZExpc3RlbmVyKCgpID0+IHtcclxuICAgIGJyb3dzZXIudGFicy5xdWVyeSh7fSwgdGFicyA9PiBzYXZlQ3VycmVudFNlc3Npb24odGFicykpO1xyXG4gIH0pO1xyXG5cclxuICAvLyBtYWludGFpbiBjdXJyZW50U2Vzc2lvbiBvbiByZW1vdmVkXHJcbiAgYnJvd3Nlci50YWJzLm9uUmVtb3ZlZC5hZGRMaXN0ZW5lcigoXywgcmVtb3ZlSW5mbykgPT4ge1xyXG4gICAgLy8gZG9uJ3QgdXBkYXRlIHdoZW4gd2luZG93IGlzIGNsb3NlZCBpbnN0ZWFkIG9mIHRhYlxyXG4gICAgaWYgKHJlbW92ZUluZm8uaXNXaW5kb3dDbG9zaW5nKSByZXR1cm47XHJcbiAgICBicm93c2VyLnRhYnMucXVlcnkoe30sIHRhYnMgPT4gc2F2ZUN1cnJlbnRTZXNzaW9uKHRhYnMpKTtcclxuICB9KTtcclxuXHJcbiAgLy8gdXBkYXRlIGxhc3RTZXNzaW9uIHdoZW4gd2luZG93IGNsb3NlcyBleGNlcHQgdGhlIGxhc3Qgd2luZG93XHJcbiAgYnJvd3Nlci53aW5kb3dzLm9uUmVtb3ZlZC5hZGRMaXN0ZW5lcihhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zdCB3aW5kb3dzID0gYXdhaXQgYnJvd3Nlci53aW5kb3dzLmdldEFsbCgpO1xyXG5cclxuICAgIC8vIHdoZW4gaXQgaXMgdGhlIGxhc3Qgd2luZG93IGFzeW5jIG9wZXJhdGlvbiBpcyBub3QgZXhlY3V0ZWQsIHNvIGhhbmRsaW5nIHRoaXMgdXBkYXRlIGJlbG93IG9uIHN0YXJ0IHVwXHJcbiAgICBpZiAod2luZG93cy5sZW5ndGggPT09IDApIHJldHVybjtcclxuICAgIGF3YWl0IHVwZGF0ZUxhc3RTZXNzaW9uRnJvbUN1cnJlbnQoKTtcclxuICB9KTtcclxuXHJcbiAgLy8gdXBkYXRlIGxhc3RTZXNzaW9uLCB3aGVuIGl0IHdhcyBjbG9zZWQgYW5kIG5vdCB1cGRhdGUgdGhlIGl0XHJcbiAgYnJvd3Nlci5ydW50aW1lLm9uU3RhcnR1cC5hZGRMaXN0ZW5lcihhc3luYyAoKSA9PiB7XHJcbiAgICBhd2FpdCB1cGRhdGVMYXN0U2Vzc2lvbkZyb21DdXJyZW50KCk7XHJcbiAgfSk7XHJcblxyXG4gIGJyb3dzZXIucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoeyByZWFzb24gfSkgPT4ge1xyXG4gICAgaWYgKHJlYXNvbiA9PT0gJ2luc3RhbGwnKSB7XHJcbiAgICAgIGVuc3VyZURhc2hib2FyZEZpcnN0KCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIGJyb3dzZXIuY29tbWFuZHMub25Db21tYW5kLmFkZExpc3RlbmVyKGFzeW5jIChjb21tYW5kKSA9PiB7XHJcbiAgICBpZiAoY29tbWFuZCA9PT0gXCJhZGRUYWJzXCIpIHtcclxuICAgICAgbGV0IHRhYnMgPSBhd2FpdCBnZXRPcGVuZWRUYWJzKCk7XHJcblxyXG4gICAgICBsZXQgZmlsdGVyZWRUYWJzID0gdGFicy5maWx0ZXIoKHRhYikgPT4ge1xyXG4gICAgICAgIGlmICh0YWIudGl0bGUgIT09IFwiYWJvdXQ6YmxhbmtcIikgcmV0dXJuIHRhYjtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBpZiAoZmlsdGVyZWRUYWJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG5cclxuICAgICAgYXdhaXQgYWRkVGFic1RvQnVja2V0KGZpbHRlcmVkVGFicyk7XHJcblxyXG4gICAgICBjb25zdCBjaGFubmVsID0gbmV3IEJyb2FkY2FzdENoYW5uZWwoXCJ0YXJjaGl2ZV9jaGFubmVsXCIpO1xyXG4gICAgICBjaGFubmVsLnBvc3RNZXNzYWdlKHsgdHlwZTogXCJ3b3Jrc3BhY2VzX3VwZGF0ZWRcIiB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoY29tbWFuZCA9PT0gXCJ2aWV3QnVja2V0c1wiKSB7XHJcbiAgICAgIGF3YWl0IG9wZW5EYXNoYm9hcmQoKTtcclxuICAgIH1cclxuICB9KTtcclxufSk7IiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJuYW1lcyI6WyJicm93c2VyIiwiX2Jyb3dzZXIiLCJfYSJdLCJtYXBwaW5ncyI6Ijs7O0FBQU8sV0FBUyxpQkFBaUIsS0FBSztBQUNwQyxRQUFJLE9BQU8sUUFBUSxPQUFPLFFBQVEsV0FBWSxRQUFPLEVBQUUsTUFBTSxJQUFLO0FBQ2xFLFdBQU87QUFBQSxFQUNUO0FDRk8sUUFBTUEsY0FBVSxzQkFBVyxZQUFYLG1CQUFvQixZQUFwQixtQkFBNkIsTUFDaEQsV0FBVyxVQUNYLFdBQVc7QUNGUixRQUFNLFVBQVVDO0FDRWhCLGlCQUFlLFdBQVcsTUFBTTtBQUNuQyxVQUFNLGtCQUFrQixN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LGFBQWE7QUFDN0QsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0EsR0FBRyxRQUFRLDBCQUEwQixhQUFhLFVBQVUsS0FBSyxJQUFJLENBQUM7QUFBQSxNQUN2RTtBQUFBLEVBQ0w7QUFDQSxXQUFTLGlCQUFpQixjQUFjLFVBQVU7QUFDaEQsUUFBSSxTQUFTLFNBQVMsR0FBRztBQUN2QixZQUFNLElBQUksb0JBQW9CLGNBQWMsZ0NBQWdDO0FBQzlFLFFBQUksU0FBUyxTQUFTLEdBQUcsS0FBSyxTQUFTLFNBQVMsS0FBSyxDQUFDLFNBQVMsV0FBVyxJQUFJO0FBQzVFLFlBQU0sSUFBSTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLEVBQ0w7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMSwyLDddfQ==
