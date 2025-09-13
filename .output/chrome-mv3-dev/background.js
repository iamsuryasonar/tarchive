var background = function() {
  "use strict";
  var _a, _b;
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const browser$1 = ((_b = (_a = globalThis.browser) == null ? void 0 : _a.runtime) == null ? void 0 : _b.id) ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  const defaultWorkspaces = {
    LAST_SESSION: "Last session"
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
  async function getAllBuckets() {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(BUCKET_STORE_NAME, "readonly");
      const store = tx.objectStore(BUCKET_STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
    });
  }
  async function addTabsToBucket(tabs, workspace) {
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
      tag: [workspace],
      isLocked: false
    };
    const db = await openDB();
    const tx = db.transaction(BUCKET_STORE_NAME, "readwrite");
    tx.objectStore(BUCKET_STORE_NAME).add(bucket);
  }
  async function deleteLastSession() {
    let tag = defaultWorkspaces.LAST_SESSION;
    const buckets = await getAllBuckets();
    const filteredBuckets = buckets.filter(
      (b) => Array.isArray(b.tag) && b.tag.includes(tag)
    );
    if (!filteredBuckets.length === 0) return;
    const db = await openDB();
    const tx = db.transaction(BUCKET_STORE_NAME, "readwrite");
    const store = tx.objectStore(BUCKET_STORE_NAME);
    filteredBuckets.forEach((bucket) => {
      if (bucket == null ? void 0 : bucket.isLocked) return;
      if (bucket.tag.length === 1) {
        store.delete(bucket.id);
      } else {
        bucket.tag = bucket.tag.filter((t) => t !== tag);
        store.put(bucket);
      }
    });
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
    const { currentSession } = await browser.storage.local.get("currentSession");
    if (currentSession == null ? void 0 : currentSession.length) {
      addTabsToBucket(currentSession, defaultWorkspaces.LAST_SESSION);
    }
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
      await deleteLastSession();
      await updateLastSessionFromCurrent();
    });
    browser.runtime.onStartup.addListener(async () => {
      await deleteLastSession();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi91dGlscy9jb25zdGFudHMvaW5kZXguanMiLCIuLi8uLi9kYi9pbmRleC5qcyIsIi4uLy4uL3NlcnZpY2VzL2luZGV4LmpzIiwiLi4vLi4vZW50cnlwb2ludHMvYmFja2dyb3VuZC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVCYWNrZ3JvdW5kKGFyZykge1xuICBpZiAoYXJnID09IG51bGwgfHwgdHlwZW9mIGFyZyA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyBtYWluOiBhcmcgfTtcbiAgcmV0dXJuIGFyZztcbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImV4cG9ydCBjb25zdCBlbXB0eVBvcFVwRmFsbGJhY2tNZXNzYWdlcyA9IFtcclxuICAgIFwiTm8gdGFicyBvcGVuIHJpZ2h0IG5vdy4gVGltZSB0byBmb2N1cz8g8J+YjFwiLFxyXG4gICAgXCJZb3UncmUgYWxsIGNsZWFyLiBObyB0YWJzIGluIHNpZ2h0LlwiLFxyXG4gICAgXCJObyBhY3RpdmUgdGFicyBmb3VuZCBpbiB0aGlzIHdpbmRvdy5cIixcclxuICAgIFwiWW91ciBicm93c2VyIHRhYiBvY2VhbiBpcyBjYWxtIPCfp5hcIixcclxuICAgIFwiTm90aGluZyBoZXJlLiBIaXQg4oCYQWRk4oCZIHdoZW4geW91J3JlIHJlYWR5IHRvIHNhdmUgc29tZSB0YWJzIVwiLFxyXG5dO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldEVtcHR5UG9wVXBGYWxsQmFja01lc3NhZ2UoKSB7XHJcbiAgICByZXR1cm4gZW1wdHlQb3BVcEZhbGxiYWNrTWVzc2FnZXNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZW1wdHlQb3BVcEZhbGxiYWNrTWVzc2FnZXMubGVuZ3RoKV07XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBkZWZhdWx0V29ya3NwYWNlcyA9IHtcclxuICAgIEFMTDogJ0FsbCcsXHJcbiAgICBGQVZPUklURTogJ0Zhdm9yaXRlJyxcclxuICAgIExBU1RfU0VTU0lPTjogJ0xhc3Qgc2Vzc2lvbidcclxufSIsImNvbnN0IERCX05BTUUgPSAnVGFyY2hpdmVEQic7XHJcbmltcG9ydCB7IGRlZmF1bHRXb3Jrc3BhY2VzIH0gZnJvbSAnLi4vdXRpbHMvY29uc3RhbnRzL2luZGV4JztcclxuY29uc3QgQlVDS0VUX1NUT1JFX05BTUUgPSAnYnVja2V0cyc7XHJcbmNvbnN0IFNFVFRJTkdTX1NUT1JFX05BTUUgPSAnc2V0dGluZ3MnO1xyXG5jb25zdCBTRVNTSU9OX1NUT1JFX05BTUUgPSAnc2Vzc2lvbic7XHJcbmNvbnN0IERCX1ZFUlNJT04gPSAxO1xyXG5cclxuZnVuY3Rpb24gb3BlbkRCKCkge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICBjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLm9wZW4oREJfTkFNRSwgREJfVkVSU0lPTik7XHJcblxyXG4gICAgICAgIHJlcXVlc3Qub251cGdyYWRlbmVlZGVkID0gKGV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGRiID0gZXZlbnQudGFyZ2V0LnJlc3VsdDtcclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKEJVQ0tFVF9TVE9SRV9OQU1FKSkge1xyXG4gICAgICAgICAgICAgICAgZGIuY3JlYXRlT2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUsIHsga2V5UGF0aDogJ2lkJyB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFNFVFRJTkdTX1NUT1JFX05BTUUpKSB7XHJcbiAgICAgICAgICAgICAgICBkYi5jcmVhdGVPYmplY3RTdG9yZShTRVRUSU5HU19TVE9SRV9OQU1FLCB7IGtleVBhdGg6IFwia2V5XCIgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhTRVNTSU9OX1NUT1JFX05BTUUpKSB7XHJcbiAgICAgICAgICAgICAgICBkYi5jcmVhdGVPYmplY3RTdG9yZShTRVNTSU9OX1NUT1JFX05BTUUsIHsga2V5UGF0aDogXCJrZXlcIiB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gKCkgPT4gcmVzb2x2ZShyZXF1ZXN0LnJlc3VsdCk7XHJcbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gKCkgPT4gcmVqZWN0KHJlcXVlc3QuZXJyb3IpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldEFsbEJ1Y2tldHMoKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihCVUNLRVRfU1RPUkVfTkFNRSwgJ3JlYWRvbmx5Jyk7XHJcbiAgICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XHJcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHN0b3JlLmdldEFsbCgpO1xyXG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gKCkgPT4gcmVzb2x2ZShyZXF1ZXN0LnJlc3VsdCk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFkZFRhYnNUb0J1Y2tldCh0YWJzLCB3b3Jrc3BhY2UpIHtcclxuICAgIGlmICh0YWJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG5cclxuICAgIGxldCBmaWx0ZXJlZFRhYnMgPSB0YWJzLmZpbHRlcigodGFiKSA9PiB7XHJcbiAgICAgICAgaWYgKHRhYi5jaGVja2VkICE9PSBmYWxzZSkgcmV0dXJuIHRhYjtcclxuICAgIH0pO1xyXG5cclxuICAgIGlmIChmaWx0ZXJlZFRhYnMubGVuZ3RoID09PSAwKSByZXR1cm47IC8vIHJldHVybiBpZiBubyB0YWJzXHJcblxyXG4gICAgY29uc3QgaWQgPSBjcnlwdG8ucmFuZG9tVVVJRCgpO1xyXG4gICAgY29uc3QgYnVja2V0ID0ge1xyXG4gICAgICAgIGlkLFxyXG4gICAgICAgIG5hbWU6IGlkLnNsaWNlKDAsIDgpLFxyXG4gICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgIHRhYnM6IGZpbHRlcmVkVGFicyxcclxuICAgICAgICB0YWc6IFt3b3Jrc3BhY2VdLFxyXG4gICAgICAgIGlzTG9ja2VkOiBmYWxzZSxcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKS5hZGQoYnVja2V0KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRlbGV0ZUJ1Y2tldChpZCkge1xyXG4gICAgaWYgKCFpZCkgcmV0dXJuO1xyXG4gICAgY29uc3QgYnVja2V0cyA9IGF3YWl0IGdldEFsbEJ1Y2tldHMoKTtcclxuICAgIGNvbnN0IGJ1Y2tldCA9IGJ1Y2tldHMuZmluZChiID0+IGIuaWQgPT09IGlkKTtcclxuICAgIGlmIChidWNrZXQ/LmlzTG9ja2VkKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKS5kZWxldGUoaWQpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVuYW1lQnVja2V0TmFtZShpZCwgbmFtZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpO1xyXG4gICAgY29uc3QgcmVxID0gYXdhaXQgc3RvcmUuZ2V0KGlkKTtcclxuXHJcbiAgICByZXEub25zdWNjZXNzID0gKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSByZXEucmVzdWx0O1xyXG5cclxuICAgICAgICBpZiAoZGF0YSkge1xyXG4gICAgICAgICAgICBkYXRhLm5hbWUgPSBuYW1lO1xyXG4gICAgICAgICAgICBzdG9yZS5wdXQoZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRlbGV0ZUxhc3RTZXNzaW9uKCkge1xyXG4gICAgbGV0IHRhZyA9IGRlZmF1bHRXb3Jrc3BhY2VzLkxBU1RfU0VTU0lPTjtcclxuICAgIGNvbnN0IGJ1Y2tldHMgPSBhd2FpdCBnZXRBbGxCdWNrZXRzKCk7XHJcbiAgICBjb25zdCBmaWx0ZXJlZEJ1Y2tldHMgPSBidWNrZXRzLmZpbHRlcihcclxuICAgICAgICBiID0+IEFycmF5LmlzQXJyYXkoYi50YWcpICYmIGIudGFnLmluY2x1ZGVzKHRhZylcclxuICAgICk7XHJcblxyXG4gICAgaWYgKCFmaWx0ZXJlZEJ1Y2tldHMubGVuZ3RoID09PSAwKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpO1xyXG5cclxuICAgIGZpbHRlcmVkQnVja2V0cy5mb3JFYWNoKGJ1Y2tldCA9PiB7XHJcbiAgICAgICAgaWYgKGJ1Y2tldD8uaXNMb2NrZWQpIHJldHVybjtcclxuICAgICAgICBpZiAoYnVja2V0LnRhZy5sZW5ndGggPT09IDEpIHtcclxuICAgICAgICAgICAgLy8gT25seSBMQVNUX1NFU1NJT04gdGFnIHRoZW4gZGVsZXRlIGJ1Y2tldFxyXG4gICAgICAgICAgICBzdG9yZS5kZWxldGUoYnVja2V0LmlkKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBNdWx0aXBsZSB0YWdzIHRoZW4gcmVtb3ZlIG9ubHkgTEFTVF9TRVNTSU9OIHRhZ1xyXG4gICAgICAgICAgICBidWNrZXQudGFnID0gYnVja2V0LnRhZy5maWx0ZXIodCA9PiB0ICE9PSB0YWcpO1xyXG4gICAgICAgICAgICBzdG9yZS5wdXQoYnVja2V0KTtcclxuICAgICAgICB9XHJcbiAgICB9KVxyXG59XHJcblxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUJ1Y2tldExvY2soaWQpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKEJVQ0tFVF9TVE9SRV9OQU1FLCAncmVhZHdyaXRlJyk7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcclxuICAgIGNvbnN0IHJlcSA9IHN0b3JlLmdldChpZCk7XHJcblxyXG4gICAgcmVxLm9uc3VjY2VzcyA9ICgpID0+IHtcclxuICAgICAgICBjb25zdCBkYXRhID0gcmVxLnJlc3VsdDtcclxuICAgICAgICBpZiAoZGF0YSkge1xyXG4gICAgICAgICAgICBkYXRhLmlzTG9ja2VkID0gIWRhdGE/LmlzTG9ja2VkO1xyXG4gICAgICAgICAgICBzdG9yZS5wdXQoZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEFsbFdvcmtzcGFjZXMoKSB7XHJcbiAgICBjb25zdCBidWNrZXRzID0gYXdhaXQgZ2V0QWxsQnVja2V0cygpO1xyXG4gICAgYnVja2V0cy5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRBdC5sb2NhbGVDb21wYXJlKGEuY3JlYXRlZEF0KSk7XHJcblxyXG4gICAgY29uc3Qgd29ya3NwYWNlcyA9IHt9O1xyXG5cclxuICAgIGJ1Y2tldHMuZm9yRWFjaChidWNrZXQgPT4ge1xyXG4gICAgICAgIGJ1Y2tldD8udGFnPy5mb3JFYWNoKHRhZyA9PiB7XHJcbiAgICAgICAgICAgIGlmICghd29ya3NwYWNlc1t0YWddKSB3b3Jrc3BhY2VzW3RhZ10gPSBbXTtcclxuICAgICAgICAgICAgd29ya3NwYWNlc1t0YWddLnB1c2goYnVja2V0KTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHdvcmtzcGFjZXNbZGVmYXVsdFdvcmtzcGFjZXMuQUxMXSA9IFsuLi5idWNrZXRzXTtcclxuXHJcbiAgICByZXR1cm4gd29ya3NwYWNlcztcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRvZ2dsZVRhZyhpZCwgdGFnKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihCVUNLRVRfU1RPUkVfTkFNRSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XHJcbiAgICBjb25zdCByZXEgPSBzdG9yZS5nZXQoaWQpO1xyXG5cclxuICAgIHJlcS5vbnN1Y2Nlc3MgPSAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IHJlcS5yZXN1bHQ7XHJcbiAgICAgICAgaWYgKGRhdGEgJiYgIWRhdGEudGFnLmluY2x1ZGVzKHRhZykpIHtcclxuICAgICAgICAgICAgZGF0YS50YWcucHVzaCh0YWcpO1xyXG4gICAgICAgICAgICBzdG9yZS5wdXQoZGF0YSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBkYXRhLnRhZy5pbmRleE9mKHRhZyk7XHJcbiAgICAgICAgICAgIGRhdGEudGFnLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICAgICAgICAgIHN0b3JlLnB1dChkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGVsZXRlVGFiKHRhYklkLCBidWNrZXRJZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpO1xyXG4gICAgY29uc3QgcmVxID0gc3RvcmUuZ2V0KGJ1Y2tldElkKTtcclxuXHJcbiAgICByZXEub25zdWNjZXNzID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSByZXEucmVzdWx0O1xyXG4gICAgICAgIGlmIChkYXRhPy50YWJzPy5sZW5ndGggPT09IDEpIHtcclxuICAgICAgICAgICAgc3RvcmUuZGVsZXRlKGJ1Y2tldElkKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuICAgICAgICBkYXRhLnRhYnMgPSBkYXRhLnRhYnMuZmlsdGVyKCh0YWIpID0+IHRhYi5pZCAhPT0gdGFiSWQpO1xyXG4gICAgICAgIHN0b3JlLnB1dChkYXRhKTtcclxuICAgIH07XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzYXZlU2V0dGluZyhrZXksIHZhbHVlKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihTRVRUSU5HU19TVE9SRV9OQU1FLCAncmVhZHdyaXRlJyk7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFNFVFRJTkdTX1NUT1JFX05BTUUpO1xyXG5cclxuICAgIGNvbnN0IHNldHRpbmcgPSB7IGtleSwgdmFsdWUgfTtcclxuICAgIHN0b3JlLnB1dChzZXR0aW5nKTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFNldHRpbmcoa2V5KSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihTRVRUSU5HU19TVE9SRV9OQU1FLCAncmVhZG9ubHknKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoU0VUVElOR1NfU1RPUkVfTkFNRSk7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICBjb25zdCByZXF1ZXN0ID0gc3RvcmUuZ2V0KGtleSk7XHJcblxyXG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gKCkgPT4ge1xyXG4gICAgICAgICAgICByZXNvbHZlKHJlcXVlc3QucmVzdWx0Py52YWx1ZSA/PyBudWxsKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9ICgpID0+IHJlamVjdChyZXF1ZXN0LmVycm9yKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlSXNBbGxvd0R1cGxpY2F0ZVRhYih2YWx1ZSkge1xyXG4gICAgYXdhaXQgc2F2ZVNldHRpbmcoJ0lTX0FMTE9XX0RVUExJQ0FURV9UQUInLCB2YWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRJc0FsbG93RHVwbGljYXRlVGFiKCkge1xyXG4gICAgcmV0dXJuIGF3YWl0IGdldFNldHRpbmcoJ0lTX0FMTE9XX0RVUExJQ0FURV9UQUInKTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUlzQWxsb3dQaW5uZWRUYWIodmFsdWUpIHtcclxuICAgIGF3YWl0IHNhdmVTZXR0aW5nKCdJU19BTExPV19QSU5ORURfVEFCJywgdmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0SXNBbGxvd1Bpbm5lZFRhYigpIHtcclxuICAgIHJldHVybiBhd2FpdCBnZXRTZXR0aW5nKCdJU19BTExPV19QSU5ORURfVEFCJyk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleHBvcnRBbGxEYXRhQXNKc29uKCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuXHJcbiAgICBjb25zdCBnZXRBbGxGcm9tU3RvcmUgPSAoc3RvcmVOYW1lKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihzdG9yZU5hbWUsICdyZWFkb25seScpO1xyXG4gICAgICAgICAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKHN0b3JlTmFtZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlcSA9IHN0b3JlLmdldEFsbCgpO1xyXG4gICAgICAgICAgICByZXEub25zdWNjZXNzID0gKCkgPT4gcmVzb2x2ZShyZXEucmVzdWx0KTtcclxuICAgICAgICAgICAgcmVxLm9uZXJyb3IgPSAoKSA9PiByZWplY3QocmVxLmVycm9yKTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgYnVja2V0cyA9IGF3YWl0IGdldEFsbEZyb21TdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XHJcbiAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldEFsbEZyb21TdG9yZShTRVRUSU5HU19TVE9SRV9OQU1FKTtcclxuXHJcbiAgICBjb25zdCBkYXRhID0ge1xyXG4gICAgICAgIGJ1Y2tldHMsXHJcbiAgICAgICAgc2V0dGluZ3MsXHJcbiAgICAgICAgZXhwb3J0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGJsb2IgPSBuZXcgQmxvYihbSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMildLCB7IHR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcclxuICAgIGNvbnN0IHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcblxyXG4gICAgY29uc3QgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcclxuICAgIGEuaHJlZiA9IHVybDtcclxuICAgIGEuZG93bmxvYWQgPSBgdGFyY2hpdmUtZXhwb3J0LSR7ZGF0YS5leHBvcnRlZEF0fS5qc29uYDtcclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcbiAgICBhLmNsaWNrKCk7XHJcbiAgICBhLnJlbW92ZSgpO1xyXG4gICAgVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gaW1wb3J0QWxsRGF0YUZyb21KU09OKGZpbGUpIHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZVxyXG4gICAgICAgICgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XHJcblxyXG4gICAgICAgICAgICByZWFkZXIub25sb2FkID0gYXN5bmMgKGV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKGV2ZW50LnRhcmdldC5yZXN1bHQpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWRhdGEuYnVja2V0cyB8fCAhZGF0YS5zZXR0aW5ncykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgSlNPTiBzdHJ1Y3R1cmUnKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oW0JVQ0tFVF9TVE9SRV9OQU1FLCBTRVRUSU5HU19TVE9SRV9OQU1FXSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJ1Y2tldFN0b3JlID0gdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNldHRpbmdTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFNFVFRJTkdTX1NUT1JFX05BTUUpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBidWNrZXRTdG9yZS5jbGVhcigpO1xyXG4gICAgICAgICAgICAgICAgICAgIHNldHRpbmdTdG9yZS5jbGVhcigpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBkYXRhPy5idWNrZXRzPy5mb3JFYWNoKGJ1Y2tldCA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1Y2tldFN0b3JlLnB1dChidWNrZXQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBkYXRhPy5zZXR0aW5ncz8uZm9yRWFjaChzZXR0aW5nID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0dGluZ1N0b3JlLnB1dChzZXR0aW5nKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdHgub25jb21wbGV0ZSA9ICgpID0+IHJlc29sdmUodHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgdHgub25lcnJvciA9ICgpID0+IHJlamVjdCh0eC5lcnJvcik7XHJcblxyXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICByZWFkZXIub25lcnJvciA9ICgpID0+IHJlamVjdChyZWFkZXIuZXJyb3IpO1xyXG5cclxuICAgICAgICAgICAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XHJcbiAgICAgICAgfSk7XHJcbn1cclxuXHJcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XHJcbmltcG9ydCB7IGFkZFRhYnNUb0J1Y2tldCwgZ2V0SXNBbGxvd0R1cGxpY2F0ZVRhYiwgZ2V0SXNBbGxvd1Bpbm5lZFRhYiB9IGZyb20gJy4uL2RiJztcclxuaW1wb3J0IHsgZGVmYXVsdFdvcmtzcGFjZXMgfSBmcm9tICcuLi91dGlscy9jb25zdGFudHMnO1xyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbHRlclRhYnModGFicykge1xyXG4gICAgY29uc3QgSVNfQUxMT1dfUElOTkVEID0gYXdhaXQgZ2V0SXNBbGxvd1Bpbm5lZFRhYigpO1xyXG4gICAgY29uc3QgSVNfRFVQTElDQVRFX1RBQl9BTExPV0VEID0gYXdhaXQgZ2V0SXNBbGxvd0R1cGxpY2F0ZVRhYigpO1xyXG5cclxuICAgIGxldCBmaWx0ZXJlZFRhYnMgPSB0YWJzPy5maWx0ZXIodGFiID0+IHtcclxuICAgICAgICBjb25zdCB1cmwgPSB0YWIudXJsIHx8IFwiXCI7XHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgdXJsICE9PSBcIlwiICYmXHJcbiAgICAgICAgICAgICF1cmwuc3RhcnRzV2l0aChcImNocm9tZTovL1wiKSAmJlxyXG4gICAgICAgICAgICAhdXJsLnN0YXJ0c1dpdGgoXCJjaHJvbWUtZXh0ZW5zaW9uOi8vXCIpICYmXHJcbiAgICAgICAgICAgICF1cmwuc3RhcnRzV2l0aChcImFib3V0OlwiKVxyXG4gICAgICAgICk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBmaWx0ZXJlZFRhYnMgPSBmaWx0ZXJlZFRhYnM/LmZpbHRlcih0YWIgPT4ge1xyXG4gICAgICAgIGlmICghdGFiPy5waW5uZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdGFiPy5waW5uZWQgPT09IElTX0FMTE9XX1BJTk5FRDtcclxuICAgIH0pO1xyXG5cclxuICAgIGlmICghSVNfRFVQTElDQVRFX1RBQl9BTExPV0VEKSB7XHJcbiAgICAgICAgY29uc3Qgc2VlbiA9IG5ldyBTZXQoKTtcclxuICAgICAgICBmaWx0ZXJlZFRhYnMgPSBmaWx0ZXJlZFRhYnMuZmlsdGVyKCh0YWIpID0+IHtcclxuICAgICAgICAgICAgaWYgKHNlZW4uaGFzKHRhYi51cmwpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzZWVuLmFkZCh0YWIudXJsKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSlcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZmlsdGVyZWRUYWJzO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0T3BlbmVkVGFicygpIHtcclxuICAgIGxldCB0YWJzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHt9KTtcclxuICAgIHJldHVybiBhd2FpdCBmaWx0ZXJUYWJzKHRhYnMpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0RGFzaGJvYXJkVGFiKCkge1xyXG4gICAgbGV0IGRhc2hib2FyZFRhYnMgPSBhd2FpdCBicm93c2VyLnRhYnMucXVlcnkoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSB9KTtcclxuICAgIHJldHVybiBkYXNoYm9hcmRUYWJzWzBdO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlUmVsb2FkRGFzaGJvYXJkKCkge1xyXG4gICAgbGV0IHRhYnMgPSBhd2FpdCBicm93c2VyLnRhYnMucXVlcnkoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSB9KTtcclxuXHJcbiAgICBpZiAodGFicy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICBicm93c2VyLnRhYnMuY3JlYXRlKHsgdXJsOiBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKFwiZGFzaGJvYXJkLmh0bWxcIiksIGluZGV4OiAwLCBwaW5uZWQ6IHRydWUgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGJyb3dzZXIudGFicy5yZWxvYWQodGFic1swXS5pZCk7XHJcbiAgICAgICAgYnJvd3Nlci50YWJzLnVwZGF0ZSh0YWJzWzBdLmlkLCB7IGFjdGl2ZTogdHJ1ZSB9KTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5EYXNoYm9hcmQoKSB7XHJcbiAgICBsZXQgdGFicyA9IGF3YWl0IGJyb3dzZXIudGFicy5xdWVyeSh7IHVybDogYnJvd3Nlci5ydW50aW1lLmdldFVSTChcImRhc2hib2FyZC5odG1sXCIpIH0pO1xyXG5cclxuICAgIGlmICh0YWJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIGJyb3dzZXIudGFicy5jcmVhdGUoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSwgaW5kZXg6IDAsIHBpbm5lZDogdHJ1ZSB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYnJvd3Nlci50YWJzLnVwZGF0ZSh0YWJzWzBdLmlkLCB7IGFjdGl2ZTogdHJ1ZSB9KTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5DdXJyZW50VGFiKGlkKSB7XHJcbiAgICBicm93c2VyLnRhYnMudXBkYXRlKGlkLCB7IGFjdGl2ZTogdHJ1ZSB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5UYWJzKHRhYnMpIHtcclxuICAgIHRhYnMuZm9yRWFjaCgodGFiKSA9PiB7XHJcbiAgICAgICAgYnJvd3Nlci50YWJzLmNyZWF0ZSh7IHVybDogdGFiLnVybCB9KTtcclxuICAgIH0pXHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuVGFiR3JvdXAoYnVja2V0KSB7XHJcbiAgICBQcm9taXNlLmFsbChcclxuICAgICAgICBidWNrZXQudGFicy5tYXAodGFiID0+IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgIGJyb3dzZXIudGFicy5jcmVhdGUoeyB1cmw6IHRhYi51cmwgfSwgcmVzb2x2ZSk7XHJcbiAgICAgICAgfSkpXHJcbiAgICApLnRoZW4oKHRhYnMpID0+IHtcclxuICAgICAgICBjb25zdCB0YWJJZHMgPSB0YWJzLm1hcCh0YWIgPT4gdGFiLmlkKTtcclxuXHJcbiAgICAgICAgYnJvd3Nlci50YWJzLmdyb3VwKHsgdGFiSWRzOiB0YWJJZHMgfSwgKGdyb3VwSWQpID0+IHtcclxuICAgICAgICAgICAgYnJvd3Nlci50YWJHcm91cHMudXBkYXRlKGdyb3VwSWQsIHtcclxuICAgICAgICAgICAgICAgIHRpdGxlOiBidWNrZXQubmFtZSxcclxuICAgICAgICAgICAgICAgIGNvbG9yOiBidWNrZXQ/LmNvbG9yID8gYnVja2V0LmNvbG9yIDogJ2JsdWUnLFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlblRhYkluV2luZG93KGJ1Y2tldCkge1xyXG4gICAgYnJvd3Nlci53aW5kb3dzLmNyZWF0ZSh7XHJcbiAgICAgICAgdXJsOiBidWNrZXQudGFicy5tYXAoKHRhYikgPT4gdGFiLnVybCksXHJcbiAgICAgICAgZm9jdXNlZDogdHJ1ZSxcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZW5zdXJlRGFzaGJvYXJkRmlyc3QoKSB7XHJcbiAgICBjb25zdCB0YWJzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHsgdXJsOiBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKFwiZGFzaGJvYXJkLmh0bWxcIikgfSk7XHJcbiAgICBpZiAodGFicy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICBhd2FpdCBicm93c2VyLnRhYnMuY3JlYXRlKHsgdXJsOiBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKFwiZGFzaGJvYXJkLmh0bWxcIiksIGluZGV4OiAwLCBwaW5uZWQ6IHRydWUgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IGRhc2hib2FyZFRhYiA9IHRhYnNbMF07XHJcbiAgICAgICAgaWYgKGRhc2hib2FyZFRhYi5pbmRleCAhPT0gMCkge1xyXG4gICAgICAgICAgICBhd2FpdCBicm93c2VyLnRhYnMubW92ZShkYXNoYm9hcmRUYWIuaWQsIHsgaW5kZXg6IDAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG4vKiAtLS0tLSBsYXN0IHNlc3Npb24gLS0tLS0gKi9cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldExhc3RTZXNzaW9uKCkge1xyXG4gICAgY29uc3QgeyBsYXN0U2Vzc2lvbiB9ID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldChcImxhc3RTZXNzaW9uXCIpO1xyXG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkobGFzdFNlc3Npb24pID8gbGFzdFNlc3Npb24gOiBbXTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNhdmVDdXJyZW50U2Vzc2lvbih0YWJzKSB7XHJcbiAgICBjb25zdCBmaWx0ZXJlZCA9IGF3YWl0IGZpbHRlclRhYnModGFicyk7XHJcbiAgICBpZiAoZmlsdGVyZWQ/Lmxlbmd0aCkge1xyXG4gICAgICAgIGF3YWl0IGJyb3dzZXIuc3RvcmFnZS5sb2NhbC5zZXQoeyBjdXJyZW50U2Vzc2lvbjogZmlsdGVyZWQgfSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB1cGRhdGVMYXN0U2Vzc2lvbkZyb21DdXJyZW50KCkge1xyXG4gICAgY29uc3QgeyBjdXJyZW50U2Vzc2lvbiB9ID0gYXdhaXQgYnJvd3Nlci5zdG9yYWdlLmxvY2FsLmdldChcImN1cnJlbnRTZXNzaW9uXCIpO1xyXG5cclxuICAgIGlmIChjdXJyZW50U2Vzc2lvbj8ubGVuZ3RoKSB7XHJcbiAgICAgICAgYWRkVGFic1RvQnVja2V0KGN1cnJlbnRTZXNzaW9uLCBkZWZhdWx0V29ya3NwYWNlcy5MQVNUX1NFU1NJT04pO1xyXG4gICAgfVxyXG5cclxufSIsImltcG9ydCB7IGFkZFRhYnNUb0J1Y2tldCwgZGVsZXRlTGFzdFNlc3Npb24gfSBmcm9tIFwiLi4vZGJcIjtcclxuaW1wb3J0IHsgZW5zdXJlRGFzaGJvYXJkRmlyc3QsIGdldE9wZW5lZFRhYnMsIG9wZW5EYXNoYm9hcmQsIHNhdmVDdXJyZW50U2Vzc2lvbiwgdXBkYXRlTGFzdFNlc3Npb25Gcm9tQ3VycmVudCB9IGZyb20gXCIuLi9zZXJ2aWNlc1wiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XHJcbiAgLy8gbWFpbnRhaW4gY3VycmVudFNlc3Npb24gb24gY3JlYXRlXHJcbiAgYnJvd3Nlci50YWJzLm9uQ3JlYXRlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XHJcbiAgICBicm93c2VyLnRhYnMucXVlcnkoe30sIHRhYnMgPT4gc2F2ZUN1cnJlbnRTZXNzaW9uKHRhYnMpKTtcclxuICB9KTtcclxuXHJcbiAgLy8gbWFpbnRhaW4gY3VycmVudFNlc3Npb24gb24gdXBkYXRlXHJcbiAgYnJvd3Nlci50YWJzLm9uVXBkYXRlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XHJcbiAgICBicm93c2VyLnRhYnMucXVlcnkoe30sIHRhYnMgPT4gc2F2ZUN1cnJlbnRTZXNzaW9uKHRhYnMpKTtcclxuICB9KTtcclxuXHJcbiAgLy8gbWFpbnRhaW4gY3VycmVudFNlc3Npb24gb24gcmVtb3ZlZFxyXG4gIGJyb3dzZXIudGFicy5vblJlbW92ZWQuYWRkTGlzdGVuZXIoKF8sIHJlbW92ZUluZm8pID0+IHtcclxuICAgIC8vIGRvbid0IHVwZGF0ZSB3aGVuIHdpbmRvdyBpcyBjbG9zZWQgaW5zdGVhZCBvZiB0YWJcclxuICAgIGlmIChyZW1vdmVJbmZvLmlzV2luZG93Q2xvc2luZykgcmV0dXJuO1xyXG4gICAgYnJvd3Nlci50YWJzLnF1ZXJ5KHt9LCB0YWJzID0+IHNhdmVDdXJyZW50U2Vzc2lvbih0YWJzKSk7XHJcbiAgfSk7XHJcblxyXG4gIC8vIHVwZGF0ZSBsYXN0U2Vzc2lvbiB3aGVuIHdpbmRvdyBjbG9zZXMgZXhjZXB0IHRoZSBsYXN0IHdpbmRvd1xyXG4gIGJyb3dzZXIud2luZG93cy5vblJlbW92ZWQuYWRkTGlzdGVuZXIoYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc3Qgd2luZG93cyA9IGF3YWl0IGJyb3dzZXIud2luZG93cy5nZXRBbGwoKTtcclxuXHJcbiAgICAvLyB3aGVuIGl0IGlzIHRoZSBsYXN0IHdpbmRvdyBhc3luYyBvcGVyYXRpb24gaXMgbm90IGV4ZWN1dGVkLCBzbyBoYW5kbGluZyB0aGlzIHVwZGF0ZSBiZWxvdyBvbiBzdGFydCB1cFxyXG4gICAgaWYgKHdpbmRvd3MubGVuZ3RoID09PSAwKSByZXR1cm47XHJcbiAgICBhd2FpdCBkZWxldGVMYXN0U2Vzc2lvbigpO1xyXG4gICAgYXdhaXQgdXBkYXRlTGFzdFNlc3Npb25Gcm9tQ3VycmVudCgpO1xyXG4gIH0pO1xyXG5cclxuICAvLyB1cGRhdGUgbGFzdFNlc3Npb24sIHdoZW4gaXQgd2FzIGNsb3NlZCBhbmQgbm90IHVwZGF0ZSB0aGUgaXRcclxuICBicm93c2VyLnJ1bnRpbWUub25TdGFydHVwLmFkZExpc3RlbmVyKGFzeW5jICgpID0+IHtcclxuICAgIGF3YWl0IGRlbGV0ZUxhc3RTZXNzaW9uKCk7XHJcbiAgICBhd2FpdCB1cGRhdGVMYXN0U2Vzc2lvbkZyb21DdXJyZW50KCk7XHJcbiAgfSk7XHJcblxyXG4gIGJyb3dzZXIucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoeyByZWFzb24gfSkgPT4ge1xyXG4gICAgaWYgKHJlYXNvbiA9PT0gJ2luc3RhbGwnKSB7XHJcbiAgICAgIGVuc3VyZURhc2hib2FyZEZpcnN0KCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIGJyb3dzZXIuY29tbWFuZHMub25Db21tYW5kLmFkZExpc3RlbmVyKGFzeW5jIChjb21tYW5kKSA9PiB7XHJcbiAgICBpZiAoY29tbWFuZCA9PT0gXCJhZGRUYWJzXCIpIHtcclxuICAgICAgbGV0IHRhYnMgPSBhd2FpdCBnZXRPcGVuZWRUYWJzKCk7XHJcblxyXG4gICAgICBsZXQgZmlsdGVyZWRUYWJzID0gdGFicy5maWx0ZXIoKHRhYikgPT4ge1xyXG4gICAgICAgIGlmICh0YWIudGl0bGUgIT09IFwiYWJvdXQ6YmxhbmtcIikgcmV0dXJuIHRhYjtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBpZiAoZmlsdGVyZWRUYWJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG5cclxuICAgICAgYXdhaXQgYWRkVGFic1RvQnVja2V0KGZpbHRlcmVkVGFicyk7XHJcblxyXG4gICAgICBjb25zdCBjaGFubmVsID0gbmV3IEJyb2FkY2FzdENoYW5uZWwoXCJ0YXJjaGl2ZV9jaGFubmVsXCIpO1xyXG4gICAgICBjaGFubmVsLnBvc3RNZXNzYWdlKHsgdHlwZTogXCJ3b3Jrc3BhY2VzX3VwZGF0ZWRcIiB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoY29tbWFuZCA9PT0gXCJ2aWV3QnVja2V0c1wiKSB7XHJcbiAgICAgIGF3YWl0IG9wZW5EYXNoYm9hcmQoKTtcclxuICAgIH1cclxuICB9KTtcclxufSk7IiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJuYW1lcyI6WyJicm93c2VyIiwiX2Jyb3dzZXIiLCJfYSJdLCJtYXBwaW5ncyI6Ijs7O0FBQU8sV0FBUyxpQkFBaUIsS0FBSztBQUNwQyxRQUFJLE9BQU8sUUFBUSxPQUFPLFFBQVEsV0FBWSxRQUFPLEVBQUUsTUFBTSxJQUFLO0FBQ2xFLFdBQU87QUFBQSxFQUNUO0FDRk8sUUFBTUEsY0FBVSxzQkFBVyxZQUFYLG1CQUFvQixZQUFwQixtQkFBNkIsTUFDaEQsV0FBVyxVQUNYLFdBQVc7QUNGUixRQUFNLFVBQVVDO0FDV2hCLFFBQU0sb0JBQW9CO0FBQUEsSUFHN0IsY0FBYztBQUFBLEVBQ2xCO0FDaEJB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ckY7QUFBQSxJQUNFLFdBQVcsS0FBSztBQUNkLFlBQU0sTUFBTSxvRUFBb0U7QUFBQSxJQUNwRjtBQUFBLElBQ0UsV0FBVyxLQUFLO0FBQ2QsWUFBTSxNQUFNLG9FQUFvRTtBQUFBLElBQ3BGO0FBQUEsSUFDRSxzQkFBc0IsU0FBUztBQUM3QixZQUFNLFVBQVUsS0FBSyxlQUFlLE9BQU87QUFDM0MsWUFBTSxnQkFBZ0IsUUFBUSxRQUFRLFNBQVMsSUFBSTtBQUNuRCxhQUFPLE9BQU8sSUFBSSxhQUFhLEdBQUc7QUFBQSxJQUN0QztBQUFBLElBQ0UsZUFBZSxRQUFRO0FBQ3JCLGFBQU8sT0FBTyxRQUFRLHVCQUF1QixNQUFNO0FBQUEsSUFDdkQ7QUFBQSxFQUNBO0FBQ0EsTUFBSSxlQUFlO0FBQ25CLGVBQWEsWUFBWSxDQUFDLFFBQVEsU0FBUyxRQUFRLE9BQU8sS0FBSztBQUMvRCxNQUFJLHNCQUFzQixjQUFjLE1BQU07QUFBQSxJQUM1QyxZQUFZLGNBQWMsUUFBUTtBQUNoQyxZQUFNLDBCQUEwQixZQUFZLE1BQU0sTUFBTSxFQUFFO0FBQUEsSUFDOUQ7QUFBQSxFQUNBO0FBQ0EsV0FBUyxpQkFBaUIsY0FBYyxVQUFVO0FBQ2hELFFBQUksQ0FBQyxhQUFhLFVBQVUsU0FBUyxRQUFRLEtBQUssYUFBYTtBQUM3RCxZQUFNLElBQUk7QUFBQSxRQUNSO0FBQUEsUUFDQSxHQUFHLFFBQVEsMEJBQTBCLGFBQWEsVUFBVSxLQUFLLElBQUksQ0FBQztBQUFBLE1BQ3ZFO0FBQUEsRUFDTDtBQUNBLFdBQVMsaUJBQWlCLGNBQWMsVUFBVTtBQUNoRCxRQUFJLFNBQVMsU0FBUyxHQUFHO0FBQ3ZCLFlBQU0sSUFBSSxvQkFBb0IsY0FBYyxnQ0FBZ0M7QUFDOUUsUUFBSSxTQUFTLFNBQVMsR0FBRyxLQUFLLFNBQVMsU0FBUyxLQUFLLENBQUMsU0FBUyxXQUFXLElBQUk7QUFDNUUsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsRUFDTDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwxLDIsN119
