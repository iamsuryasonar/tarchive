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
      ...workspace ? { tag: [workspace] } : { tag: [] },
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
  function extractTabsFromSession(data) {
    const tabs = [];
    data.forEach((item) => {
      if (item.tab) {
        tabs.push(item.tab);
      } else if (item.window && Array.isArray(item.window.tabs)) {
        tabs.push(...item.window.tabs);
      }
    });
    return tabs;
  }
  async function updateLastSession(sessions) {
    const allTabs = extractTabsFromSession(sessions);
    await deleteLastSession();
    const filteredTabs = await filterTabs(allTabs);
    if (filteredTabs == null ? void 0 : filteredTabs.length) {
      addTabsToBucket(filteredTabs, defaultWorkspaces.LAST_SESSION);
    }
  }
  const definition = defineBackground(() => {
    browser.sessions.getRecentlyClosed({}, async (sessions) => {
      await updateLastSession(sessions);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi91dGlscy9jb25zdGFudHMvaW5kZXguanMiLCIuLi8uLi9kYi9pbmRleC5qcyIsIi4uLy4uL3NlcnZpY2VzL2luZGV4LmpzIiwiLi4vLi4vZW50cnlwb2ludHMvYmFja2dyb3VuZC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVCYWNrZ3JvdW5kKGFyZykge1xuICBpZiAoYXJnID09IG51bGwgfHwgdHlwZW9mIGFyZyA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyBtYWluOiBhcmcgfTtcbiAgcmV0dXJuIGFyZztcbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImV4cG9ydCBjb25zdCBlbXB0eVBvcFVwRmFsbGJhY2tNZXNzYWdlcyA9IFtcclxuICAgIFwiTm8gdGFicyBvcGVuIHJpZ2h0IG5vdy4gVGltZSB0byBmb2N1cz8g8J+YjFwiLFxyXG4gICAgXCJZb3UncmUgYWxsIGNsZWFyLiBObyB0YWJzIGluIHNpZ2h0LlwiLFxyXG4gICAgXCJObyBhY3RpdmUgdGFicyBmb3VuZCBpbiB0aGlzIHdpbmRvdy5cIixcclxuICAgIFwiWW91ciBicm93c2VyIHRhYiBvY2VhbiBpcyBjYWxtIPCfp5hcIixcclxuICAgIFwiTm90aGluZyBoZXJlLiBIaXQg4oCYQWRk4oCZIHdoZW4geW91J3JlIHJlYWR5IHRvIHNhdmUgc29tZSB0YWJzIVwiLFxyXG5dO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldEVtcHR5UG9wVXBGYWxsQmFja01lc3NhZ2UoKSB7XHJcbiAgICByZXR1cm4gZW1wdHlQb3BVcEZhbGxiYWNrTWVzc2FnZXNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogZW1wdHlQb3BVcEZhbGxiYWNrTWVzc2FnZXMubGVuZ3RoKV07XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBkZWZhdWx0V29ya3NwYWNlcyA9IHtcclxuICAgIEFMTDogJ0FsbCcsXHJcbiAgICBGQVZPUklURTogJ0Zhdm9yaXRlJyxcclxuICAgIExBU1RfU0VTU0lPTjogJ0xhc3Qgc2Vzc2lvbidcclxufSIsImNvbnN0IERCX05BTUUgPSAnVGFyY2hpdmVEQic7XHJcbmltcG9ydCB7IGRlZmF1bHRXb3Jrc3BhY2VzIH0gZnJvbSAnLi4vdXRpbHMvY29uc3RhbnRzL2luZGV4JztcclxuY29uc3QgQlVDS0VUX1NUT1JFX05BTUUgPSAnYnVja2V0cyc7XHJcbmNvbnN0IFNFVFRJTkdTX1NUT1JFX05BTUUgPSAnc2V0dGluZ3MnO1xyXG5jb25zdCBTRVNTSU9OX1NUT1JFX05BTUUgPSAnc2Vzc2lvbic7XHJcbmNvbnN0IERCX1ZFUlNJT04gPSAxO1xyXG5cclxuZnVuY3Rpb24gb3BlbkRCKCkge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICBjb25zdCByZXF1ZXN0ID0gaW5kZXhlZERCLm9wZW4oREJfTkFNRSwgREJfVkVSU0lPTik7XHJcblxyXG4gICAgICAgIHJlcXVlc3Qub251cGdyYWRlbmVlZGVkID0gKGV2ZW50KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGRiID0gZXZlbnQudGFyZ2V0LnJlc3VsdDtcclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKEJVQ0tFVF9TVE9SRV9OQU1FKSkge1xyXG4gICAgICAgICAgICAgICAgZGIuY3JlYXRlT2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUsIHsga2V5UGF0aDogJ2lkJyB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFNFVFRJTkdTX1NUT1JFX05BTUUpKSB7XHJcbiAgICAgICAgICAgICAgICBkYi5jcmVhdGVPYmplY3RTdG9yZShTRVRUSU5HU19TVE9SRV9OQU1FLCB7IGtleVBhdGg6IFwia2V5XCIgfSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghZGIub2JqZWN0U3RvcmVOYW1lcy5jb250YWlucyhTRVNTSU9OX1NUT1JFX05BTUUpKSB7XHJcbiAgICAgICAgICAgICAgICBkYi5jcmVhdGVPYmplY3RTdG9yZShTRVNTSU9OX1NUT1JFX05BTUUsIHsga2V5UGF0aDogXCJrZXlcIiB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gKCkgPT4gcmVzb2x2ZShyZXF1ZXN0LnJlc3VsdCk7XHJcbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gKCkgPT4gcmVqZWN0KHJlcXVlc3QuZXJyb3IpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGdldEFsbEJ1Y2tldHMoKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihCVUNLRVRfU1RPUkVfTkFNRSwgJ3JlYWRvbmx5Jyk7XHJcbiAgICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XHJcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHN0b3JlLmdldEFsbCgpO1xyXG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gKCkgPT4gcmVzb2x2ZShyZXF1ZXN0LnJlc3VsdCk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFkZFRhYnNUb0J1Y2tldCh0YWJzLCB3b3Jrc3BhY2UpIHtcclxuICAgIGlmICh0YWJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xyXG5cclxuICAgIGxldCBmaWx0ZXJlZFRhYnMgPSB0YWJzLmZpbHRlcigodGFiKSA9PiB7XHJcbiAgICAgICAgaWYgKHRhYi5jaGVja2VkICE9PSBmYWxzZSkgcmV0dXJuIHRhYjtcclxuICAgIH0pO1xyXG5cclxuICAgIGlmIChmaWx0ZXJlZFRhYnMubGVuZ3RoID09PSAwKSByZXR1cm47IC8vIHJldHVybiBpZiBubyB0YWJzXHJcblxyXG4gICAgY29uc3QgaWQgPSBjcnlwdG8ucmFuZG9tVVVJRCgpO1xyXG4gICAgY29uc3QgYnVja2V0ID0ge1xyXG4gICAgICAgIGlkLFxyXG4gICAgICAgIG5hbWU6IGlkLnNsaWNlKDAsIDgpLFxyXG4gICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgIHRhYnM6IGZpbHRlcmVkVGFicyxcclxuICAgICAgICAuLi4od29ya3NwYWNlID8geyB0YWc6IFt3b3Jrc3BhY2VdIH0gOiB7IHRhZzogW10gfSksXHJcbiAgICAgICAgaXNMb2NrZWQ6IGZhbHNlLFxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihCVUNLRVRfU1RPUkVfTkFNRSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpLmFkZChidWNrZXQpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGVsZXRlQnVja2V0KGlkKSB7XHJcbiAgICBpZiAoIWlkKSByZXR1cm47XHJcbiAgICBjb25zdCBidWNrZXRzID0gYXdhaXQgZ2V0QWxsQnVja2V0cygpO1xyXG4gICAgY29uc3QgYnVja2V0ID0gYnVja2V0cy5maW5kKGIgPT4gYi5pZCA9PT0gaWQpO1xyXG4gICAgaWYgKGJ1Y2tldD8uaXNMb2NrZWQpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihCVUNLRVRfU1RPUkVfTkFNRSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpLmRlbGV0ZShpZCk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZW5hbWVCdWNrZXROYW1lKGlkLCBuYW1lKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihCVUNLRVRfU1RPUkVfTkFNRSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XHJcbiAgICBjb25zdCByZXEgPSBhd2FpdCBzdG9yZS5nZXQoaWQpO1xyXG5cclxuICAgIHJlcS5vbnN1Y2Nlc3MgPSAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IHJlcS5yZXN1bHQ7XHJcblxyXG4gICAgICAgIGlmIChkYXRhKSB7XHJcbiAgICAgICAgICAgIGRhdGEubmFtZSA9IG5hbWU7XHJcbiAgICAgICAgICAgIHN0b3JlLnB1dChkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGVsZXRlTGFzdFNlc3Npb24oKSB7XHJcbiAgICBsZXQgdGFnID0gZGVmYXVsdFdvcmtzcGFjZXMuTEFTVF9TRVNTSU9OO1xyXG4gICAgY29uc3QgYnVja2V0cyA9IGF3YWl0IGdldEFsbEJ1Y2tldHMoKTtcclxuICAgIGNvbnN0IGZpbHRlcmVkQnVja2V0cyA9IGJ1Y2tldHMuZmlsdGVyKFxyXG4gICAgICAgIGIgPT4gQXJyYXkuaXNBcnJheShiLnRhZykgJiYgYi50YWcuaW5jbHVkZXModGFnKVxyXG4gICAgKTtcclxuXHJcbiAgICBpZiAoIWZpbHRlcmVkQnVja2V0cy5sZW5ndGggPT09IDApIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihCVUNLRVRfU1RPUkVfTkFNRSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XHJcblxyXG4gICAgZmlsdGVyZWRCdWNrZXRzLmZvckVhY2goYnVja2V0ID0+IHtcclxuICAgICAgICBpZiAoYnVja2V0Py5pc0xvY2tlZCkgcmV0dXJuO1xyXG4gICAgICAgIGlmIChidWNrZXQudGFnLmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICAgICAgICAvLyBPbmx5IExBU1RfU0VTU0lPTiB0YWcgdGhlbiBkZWxldGUgYnVja2V0XHJcbiAgICAgICAgICAgIHN0b3JlLmRlbGV0ZShidWNrZXQuaWQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIE11bHRpcGxlIHRhZ3MgdGhlbiByZW1vdmUgb25seSBMQVNUX1NFU1NJT04gdGFnXHJcbiAgICAgICAgICAgIGJ1Y2tldC50YWcgPSBidWNrZXQudGFnLmZpbHRlcih0ID0+IHQgIT09IHRhZyk7XHJcbiAgICAgICAgICAgIHN0b3JlLnB1dChidWNrZXQpO1xyXG4gICAgICAgIH1cclxuICAgIH0pXHJcbn1cclxuXHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdG9nZ2xlQnVja2V0TG9jayhpZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpO1xyXG4gICAgY29uc3QgcmVxID0gc3RvcmUuZ2V0KGlkKTtcclxuXHJcbiAgICByZXEub25zdWNjZXNzID0gKCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSByZXEucmVzdWx0O1xyXG4gICAgICAgIGlmIChkYXRhKSB7XHJcbiAgICAgICAgICAgIGRhdGEuaXNMb2NrZWQgPSAhZGF0YT8uaXNMb2NrZWQ7XHJcbiAgICAgICAgICAgIHN0b3JlLnB1dChkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0QWxsV29ya3NwYWNlcygpIHtcclxuICAgIGNvbnN0IGJ1Y2tldHMgPSBhd2FpdCBnZXRBbGxCdWNrZXRzKCk7XHJcbiAgICBidWNrZXRzLnNvcnQoKGEsIGIpID0+IGIuY3JlYXRlZEF0LmxvY2FsZUNvbXBhcmUoYS5jcmVhdGVkQXQpKTtcclxuXHJcbiAgICBjb25zdCB3b3Jrc3BhY2VzID0ge307XHJcblxyXG4gICAgYnVja2V0cy5mb3JFYWNoKGJ1Y2tldCA9PiB7XHJcbiAgICAgICAgYnVja2V0Py50YWc/LmZvckVhY2godGFnID0+IHtcclxuICAgICAgICAgICAgaWYgKCF3b3Jrc3BhY2VzW3RhZ10pIHdvcmtzcGFjZXNbdGFnXSA9IFtdO1xyXG4gICAgICAgICAgICB3b3Jrc3BhY2VzW3RhZ10ucHVzaChidWNrZXQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgYWxsQnVja2V0cyA9IGJ1Y2tldHMuZmlsdGVyKGJ1Y2tldCA9PiBidWNrZXQ/LnRhZz8uaW5jbHVkZXMoZGVmYXVsdFdvcmtzcGFjZXMuTEFTVF9TRVNTSU9OKSA9PT0gZmFsc2UpO1xyXG4gICAgd29ya3NwYWNlc1tkZWZhdWx0V29ya3NwYWNlcy5BTExdID0gYWxsQnVja2V0cztcclxuXHJcbiAgICByZXR1cm4gd29ya3NwYWNlcztcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRvZ2dsZVRhZyhpZCwgdGFnKSB7XHJcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG4gICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihCVUNLRVRfU1RPUkVfTkFNRSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XHJcbiAgICBjb25zdCByZXEgPSBzdG9yZS5nZXQoaWQpO1xyXG5cclxuICAgIHJlcS5vbnN1Y2Nlc3MgPSAoKSA9PiB7XHJcbiAgICAgICAgY29uc3QgZGF0YSA9IHJlcS5yZXN1bHQ7XHJcbiAgICAgICAgaWYgKGRhdGEgJiYgIWRhdGEudGFnLmluY2x1ZGVzKHRhZykpIHtcclxuICAgICAgICAgICAgZGF0YS50YWcucHVzaCh0YWcpO1xyXG4gICAgICAgICAgICBzdG9yZS5wdXQoZGF0YSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBkYXRhLnRhZy5pbmRleE9mKHRhZyk7XHJcbiAgICAgICAgICAgIGRhdGEudGFnLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICAgICAgICAgIHN0b3JlLnB1dChkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZGVsZXRlVGFiKHRhYklkLCBidWNrZXRJZCkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcclxuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpO1xyXG4gICAgY29uc3QgcmVxID0gc3RvcmUuZ2V0KGJ1Y2tldElkKTtcclxuXHJcblxyXG4gICAgcmVxLm9uc3VjY2VzcyA9IGFzeW5jICgpID0+IHtcclxuICAgICAgICBjb25zdCBkYXRhID0gcmVxLnJlc3VsdDtcclxuICAgICAgICBpZiAoZGF0YT8uaXNMb2NrZWQpIHJldHVybjtcclxuICAgICAgICBpZiAoZGF0YT8udGFicz8ubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgICAgICAgIHN0b3JlLmRlbGV0ZShidWNrZXRJZCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgZGF0YS50YWJzID0gZGF0YS50YWJzLmZpbHRlcigodGFiKSA9PiB0YWIuaWQgIT09IHRhYklkKTtcclxuICAgICAgICBzdG9yZS5wdXQoZGF0YSk7XHJcbiAgICB9O1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2F2ZVNldHRpbmcoa2V5LCB2YWx1ZSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oU0VUVElOR1NfU1RPUkVfTkFNRSwgJ3JlYWR3cml0ZScpO1xyXG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShTRVRUSU5HU19TVE9SRV9OQU1FKTtcclxuXHJcbiAgICBjb25zdCBzZXR0aW5nID0geyBrZXksIHZhbHVlIH07XHJcbiAgICBzdG9yZS5wdXQoc2V0dGluZyk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTZXR0aW5nKGtleSkge1xyXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcclxuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oU0VUVElOR1NfU1RPUkVfTkFNRSwgJ3JlYWRvbmx5Jyk7XHJcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFNFVFRJTkdTX1NUT1JFX05BTUUpO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHN0b3JlLmdldChrZXkpO1xyXG5cclxuICAgICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9ICgpID0+IHtcclxuICAgICAgICAgICAgcmVzb2x2ZShyZXF1ZXN0LnJlc3VsdD8udmFsdWUgPz8gbnVsbCk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICByZXF1ZXN0Lm9uZXJyb3IgPSAoKSA9PiByZWplY3QocmVxdWVzdC5lcnJvcik7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUlzQWxsb3dEdXBsaWNhdGVUYWIodmFsdWUpIHtcclxuICAgIGF3YWl0IHNhdmVTZXR0aW5nKCdJU19BTExPV19EVVBMSUNBVEVfVEFCJywgdmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0SXNBbGxvd0R1cGxpY2F0ZVRhYigpIHtcclxuICAgIHJldHVybiBhd2FpdCBnZXRTZXR0aW5nKCdJU19BTExPV19EVVBMSUNBVEVfVEFCJyk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB1cGRhdGVJc0FsbG93UGlubmVkVGFiKHZhbHVlKSB7XHJcbiAgICBhd2FpdCBzYXZlU2V0dGluZygnSVNfQUxMT1dfUElOTkVEX1RBQicsIHZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldElzQWxsb3dQaW5uZWRUYWIoKSB7XHJcbiAgICByZXR1cm4gYXdhaXQgZ2V0U2V0dGluZygnSVNfQUxMT1dfUElOTkVEX1RBQicpO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhwb3J0QWxsRGF0YUFzSnNvbigpIHtcclxuICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XHJcblxyXG4gICAgY29uc3QgZ2V0QWxsRnJvbVN0b3JlID0gKHN0b3JlTmFtZSkgPT4ge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oc3RvcmVOYW1lLCAncmVhZG9ubHknKTtcclxuICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShzdG9yZU5hbWUpO1xyXG4gICAgICAgICAgICBjb25zdCByZXEgPSBzdG9yZS5nZXRBbGwoKTtcclxuICAgICAgICAgICAgcmVxLm9uc3VjY2VzcyA9ICgpID0+IHJlc29sdmUocmVxLnJlc3VsdCk7XHJcbiAgICAgICAgICAgIHJlcS5vbmVycm9yID0gKCkgPT4gcmVqZWN0KHJlcS5lcnJvcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IGJ1Y2tldHMgPSBhd2FpdCBnZXRBbGxGcm9tU3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpO1xyXG4gICAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBnZXRBbGxGcm9tU3RvcmUoU0VUVElOR1NfU1RPUkVfTkFNRSk7XHJcblxyXG4gICAgY29uc3QgZGF0YSA9IHtcclxuICAgICAgICBidWNrZXRzLFxyXG4gICAgICAgIHNldHRpbmdzLFxyXG4gICAgICAgIGV4cG9ydGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBibG9iID0gbmV3IEJsb2IoW0pTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpXSwgeyB0eXBlOiAnYXBwbGljYXRpb24vanNvbicgfSk7XHJcbiAgICBjb25zdCB1cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGJsb2IpO1xyXG5cclxuICAgIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcbiAgICBhLmhyZWYgPSB1cmw7XHJcbiAgICBhLmRvd25sb2FkID0gYHRhcmNoaXZlLWV4cG9ydC0ke2RhdGEuZXhwb3J0ZWRBdH0uanNvbmA7XHJcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGEpO1xyXG4gICAgYS5jbGljaygpO1xyXG4gICAgYS5yZW1vdmUoKTtcclxuICAgIFVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGltcG9ydEFsbERhdGFGcm9tSlNPTihmaWxlKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2VcclxuICAgICAgICAoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xyXG5cclxuICAgICAgICAgICAgcmVhZGVyLm9ubG9hZCA9IGFzeW5jIChldmVudCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShldmVudC50YXJnZXQucmVzdWx0KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkYXRhLmJ1Y2tldHMgfHwgIWRhdGEuc2V0dGluZ3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIEpTT04gc3RydWN0dXJlJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFtCVUNLRVRfU1RPUkVfTkFNRSwgU0VUVElOR1NfU1RPUkVfTkFNRV0sICdyZWFkd3JpdGUnKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBidWNrZXRTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXR0aW5nU3RvcmUgPSB0eC5vYmplY3RTdG9yZShTRVRUSU5HU19TVE9SRV9OQU1FKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgYnVja2V0U3RvcmUuY2xlYXIoKTtcclxuICAgICAgICAgICAgICAgICAgICBzZXR0aW5nU3RvcmUuY2xlYXIoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YT8uYnVja2V0cz8uZm9yRWFjaChidWNrZXQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBidWNrZXRTdG9yZS5wdXQoYnVja2V0KTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YT8uc2V0dGluZ3M/LmZvckVhY2goc2V0dGluZyA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldHRpbmdTdG9yZS5wdXQoc2V0dGluZyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHR4Lm9uY29tcGxldGUgPSAoKSA9PiByZXNvbHZlKHRydWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHR4Lm9uZXJyb3IgPSAoKSA9PiByZWplY3QodHguZXJyb3IpO1xyXG5cclxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgcmVhZGVyLm9uZXJyb3IgPSAoKSA9PiByZWplY3QocmVhZGVyLmVycm9yKTtcclxuXHJcbiAgICAgICAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGUpO1xyXG4gICAgICAgIH0pO1xyXG59XHJcblxyXG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xyXG5pbXBvcnQgeyBhZGRUYWJzVG9CdWNrZXQsIGRlbGV0ZUxhc3RTZXNzaW9uLCBnZXRJc0FsbG93RHVwbGljYXRlVGFiLCBnZXRJc0FsbG93UGlubmVkVGFiIH0gZnJvbSAnLi4vZGInO1xyXG5pbXBvcnQgeyBkZWZhdWx0V29ya3NwYWNlcyB9IGZyb20gJy4uL3V0aWxzL2NvbnN0YW50cyc7XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmlsdGVyVGFicyh0YWJzKSB7XHJcbiAgICBjb25zdCBJU19BTExPV19QSU5ORUQgPSBhd2FpdCBnZXRJc0FsbG93UGlubmVkVGFiKCk7XHJcbiAgICBjb25zdCBJU19EVVBMSUNBVEVfVEFCX0FMTE9XRUQgPSBhd2FpdCBnZXRJc0FsbG93RHVwbGljYXRlVGFiKCk7XHJcblxyXG4gICAgbGV0IGZpbHRlcmVkVGFicyA9IHRhYnM/LmZpbHRlcih0YWIgPT4ge1xyXG4gICAgICAgIGNvbnN0IHVybCA9IHRhYi51cmwgfHwgXCJcIjtcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICB1cmwgIT09IFwiXCIgJiZcclxuICAgICAgICAgICAgIXVybC5zdGFydHNXaXRoKFwiY2hyb21lOi8vXCIpICYmXHJcbiAgICAgICAgICAgICF1cmwuc3RhcnRzV2l0aChcImNocm9tZS1leHRlbnNpb246Ly9cIikgJiZcclxuICAgICAgICAgICAgIXVybC5zdGFydHNXaXRoKFwiYWJvdXQ6XCIpXHJcbiAgICAgICAgKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGZpbHRlcmVkVGFicyA9IGZpbHRlcmVkVGFicz8uZmlsdGVyKHRhYiA9PiB7XHJcbiAgICAgICAgaWYgKCF0YWI/LnBpbm5lZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0YWI/LnBpbm5lZCA9PT0gSVNfQUxMT1dfUElOTkVEO1xyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKCFJU19EVVBMSUNBVEVfVEFCX0FMTE9XRUQpIHtcclxuICAgICAgICBjb25zdCBzZWVuID0gbmV3IFNldCgpO1xyXG4gICAgICAgIGZpbHRlcmVkVGFicyA9IGZpbHRlcmVkVGFicy5maWx0ZXIoKHRhYikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoc2Vlbi5oYXModGFiLnVybCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHNlZW4uYWRkKHRhYi51cmwpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmaWx0ZXJlZFRhYnM7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRPcGVuZWRUYWJzKCkge1xyXG4gICAgbGV0IHRhYnMgPSBhd2FpdCBicm93c2VyLnRhYnMucXVlcnkoe30pO1xyXG4gICAgcmV0dXJuIGF3YWl0IGZpbHRlclRhYnModGFicyk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXREYXNoYm9hcmRUYWIoKSB7XHJcbiAgICBsZXQgZGFzaGJvYXJkVGFicyA9IGF3YWl0IGJyb3dzZXIudGFicy5xdWVyeSh7IHVybDogYnJvd3Nlci5ydW50aW1lLmdldFVSTChcImRhc2hib2FyZC5odG1sXCIpIH0pO1xyXG4gICAgcmV0dXJuIGRhc2hib2FyZFRhYnNbMF07XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVSZWxvYWREYXNoYm9hcmQoKSB7XHJcbiAgICBsZXQgdGFicyA9IGF3YWl0IGJyb3dzZXIudGFicy5xdWVyeSh7IHVybDogYnJvd3Nlci5ydW50aW1lLmdldFVSTChcImRhc2hib2FyZC5odG1sXCIpIH0pO1xyXG5cclxuICAgIGlmICh0YWJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIGJyb3dzZXIudGFicy5jcmVhdGUoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSwgaW5kZXg6IDAsIHBpbm5lZDogdHJ1ZSB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYnJvd3Nlci50YWJzLnJlbG9hZCh0YWJzWzBdLmlkKTtcclxuICAgICAgICBicm93c2VyLnRhYnMudXBkYXRlKHRhYnNbMF0uaWQsIHsgYWN0aXZlOiB0cnVlIH0pO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlbkRhc2hib2FyZCgpIHtcclxuICAgIGxldCB0YWJzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHsgdXJsOiBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKFwiZGFzaGJvYXJkLmh0bWxcIikgfSk7XHJcblxyXG4gICAgaWYgKHRhYnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgYnJvd3Nlci50YWJzLmNyZWF0ZSh7IHVybDogYnJvd3Nlci5ydW50aW1lLmdldFVSTChcImRhc2hib2FyZC5odG1sXCIpLCBpbmRleDogMCwgcGlubmVkOiB0cnVlIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBicm93c2VyLnRhYnMudXBkYXRlKHRhYnNbMF0uaWQsIHsgYWN0aXZlOiB0cnVlIH0pO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb3BlbkN1cnJlbnRUYWIoaWQpIHtcclxuICAgIGJyb3dzZXIudGFicy51cGRhdGUoaWQsIHsgYWN0aXZlOiB0cnVlIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb3BlblRhYnModGFicykge1xyXG4gICAgdGFicy5mb3JFYWNoKCh0YWIpID0+IHtcclxuICAgICAgICBicm93c2VyLnRhYnMuY3JlYXRlKHsgdXJsOiB0YWIudXJsIH0pO1xyXG4gICAgfSlcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9wZW5UYWJHcm91cChidWNrZXQpIHtcclxuICAgIFByb21pc2UuYWxsKFxyXG4gICAgICAgIGJ1Y2tldC50YWJzLm1hcCh0YWIgPT4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgYnJvd3Nlci50YWJzLmNyZWF0ZSh7IHVybDogdGFiLnVybCB9LCByZXNvbHZlKTtcclxuICAgICAgICB9KSlcclxuICAgICkudGhlbigodGFicykgPT4ge1xyXG4gICAgICAgIGNvbnN0IHRhYklkcyA9IHRhYnMubWFwKHRhYiA9PiB0YWIuaWQpO1xyXG5cclxuICAgICAgICBicm93c2VyLnRhYnMuZ3JvdXAoeyB0YWJJZHM6IHRhYklkcyB9LCAoZ3JvdXBJZCkgPT4ge1xyXG4gICAgICAgICAgICBicm93c2VyLnRhYkdyb3Vwcy51cGRhdGUoZ3JvdXBJZCwge1xyXG4gICAgICAgICAgICAgICAgdGl0bGU6IGJ1Y2tldC5uYW1lLFxyXG4gICAgICAgICAgICAgICAgY29sb3I6IGJ1Y2tldD8uY29sb3IgPyBidWNrZXQuY29sb3IgOiAnYmx1ZScsXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBvcGVuVGFiSW5XaW5kb3coYnVja2V0KSB7XHJcbiAgICBicm93c2VyLndpbmRvd3MuY3JlYXRlKHtcclxuICAgICAgICB1cmw6IGJ1Y2tldC50YWJzLm1hcCgodGFiKSA9PiB0YWIudXJsKSxcclxuICAgICAgICBmb2N1c2VkOiB0cnVlLFxyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBlbnN1cmVEYXNoYm9hcmRGaXJzdCgpIHtcclxuICAgIGNvbnN0IHRhYnMgPSBhd2FpdCBicm93c2VyLnRhYnMucXVlcnkoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSB9KTtcclxuICAgIGlmICh0YWJzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIGF3YWl0IGJyb3dzZXIudGFicy5jcmVhdGUoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSwgaW5kZXg6IDAsIHBpbm5lZDogdHJ1ZSB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc3QgZGFzaGJvYXJkVGFiID0gdGFic1swXTtcclxuICAgICAgICBpZiAoZGFzaGJvYXJkVGFiLmluZGV4ICE9PSAwKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IGJyb3dzZXIudGFicy5tb3ZlKGRhc2hib2FyZFRhYi5pZCwgeyBpbmRleDogMCB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qIC0tLS0tIGxhc3Qgc2Vzc2lvbiAtLS0tLSAqL1xyXG5mdW5jdGlvbiBleHRyYWN0VGFic0Zyb21TZXNzaW9uKGRhdGEpIHtcclxuICAgIGNvbnN0IHRhYnMgPSBbXTtcclxuXHJcbiAgICBkYXRhLmZvckVhY2goaXRlbSA9PiB7XHJcbiAgICAgICAgaWYgKGl0ZW0udGFiKSB7XHJcbiAgICAgICAgICAgIHRhYnMucHVzaChpdGVtLnRhYik7XHJcbiAgICAgICAgfSBlbHNlIGlmIChpdGVtLndpbmRvdyAmJiBBcnJheS5pc0FycmF5KGl0ZW0ud2luZG93LnRhYnMpKSB7XHJcbiAgICAgICAgICAgIHRhYnMucHVzaCguLi5pdGVtLndpbmRvdy50YWJzKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gdGFicztcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUxhc3RTZXNzaW9uKHNlc3Npb25zKSB7XHJcbiAgICBjb25zdCBhbGxUYWJzID0gZXh0cmFjdFRhYnNGcm9tU2Vzc2lvbihzZXNzaW9ucyk7XHJcbiAgICBhd2FpdCBkZWxldGVMYXN0U2Vzc2lvbigpO1xyXG4gICAgY29uc3QgZmlsdGVyZWRUYWJzID0gYXdhaXQgZmlsdGVyVGFicyhhbGxUYWJzKTtcclxuICAgIGlmIChmaWx0ZXJlZFRhYnM/Lmxlbmd0aCkge1xyXG4gICAgICAgIGFkZFRhYnNUb0J1Y2tldChmaWx0ZXJlZFRhYnMsIGRlZmF1bHRXb3Jrc3BhY2VzLkxBU1RfU0VTU0lPTik7XHJcbiAgICB9XHJcbn0iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XHJcbmltcG9ydCB7IGFkZFRhYnNUb0J1Y2tldCB9IGZyb20gXCIuLi9kYlwiO1xyXG5pbXBvcnQgeyBlbnN1cmVEYXNoYm9hcmRGaXJzdCwgZ2V0T3BlbmVkVGFicywgb3BlbkRhc2hib2FyZCwgdXBkYXRlTGFzdFNlc3Npb24gfSBmcm9tIFwiLi4vc2VydmljZXNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUJhY2tncm91bmQoKCkgPT4ge1xyXG4gIGJyb3dzZXIuc2Vzc2lvbnMuZ2V0UmVjZW50bHlDbG9zZWQoe30sIGFzeW5jIChzZXNzaW9ucykgPT4ge1xyXG4gICAgYXdhaXQgdXBkYXRlTGFzdFNlc3Npb24oc2Vzc2lvbnMpO1xyXG4gIH0pO1xyXG5cclxuICBicm93c2VyLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKHsgcmVhc29uIH0pID0+IHtcclxuICAgIGlmIChyZWFzb24gPT09ICdpbnN0YWxsJykge1xyXG4gICAgICBlbnN1cmVEYXNoYm9hcmRGaXJzdCgpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICBicm93c2VyLmNvbW1hbmRzLm9uQ29tbWFuZC5hZGRMaXN0ZW5lcihhc3luYyAoY29tbWFuZCkgPT4ge1xyXG4gICAgaWYgKGNvbW1hbmQgPT09IFwiYWRkVGFic1wiKSB7XHJcbiAgICAgIGxldCB0YWJzID0gYXdhaXQgZ2V0T3BlbmVkVGFicygpO1xyXG5cclxuICAgICAgbGV0IGZpbHRlcmVkVGFicyA9IHRhYnMuZmlsdGVyKCh0YWIpID0+IHtcclxuICAgICAgICBpZiAodGFiLnRpdGxlICE9PSBcImFib3V0OmJsYW5rXCIpIHJldHVybiB0YWI7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKGZpbHRlcmVkVGFicy5sZW5ndGggPT09IDApIHJldHVybjtcclxuXHJcbiAgICAgIGF3YWl0IGFkZFRhYnNUb0J1Y2tldChmaWx0ZXJlZFRhYnMpO1xyXG5cclxuICAgICAgY29uc3QgY2hhbm5lbCA9IG5ldyBCcm9hZGNhc3RDaGFubmVsKFwidGFyY2hpdmVfY2hhbm5lbFwiKTtcclxuICAgICAgY2hhbm5lbC5wb3N0TWVzc2FnZSh7IHR5cGU6IFwid29ya3NwYWNlc191cGRhdGVkXCIgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGNvbW1hbmQgPT09IFwidmlld0J1Y2tldHNcIikge1xyXG4gICAgICBhd2FpdCBvcGVuRGFzaGJvYXJkKCk7XHJcbiAgICB9XHJcbiAgfSk7XHJcbn0pOyIsIi8vIHNyYy9pbmRleC50c1xudmFyIF9NYXRjaFBhdHRlcm4gPSBjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybikge1xuICAgIGlmIChtYXRjaFBhdHRlcm4gPT09IFwiPGFsbF91cmxzPlwiKSB7XG4gICAgICB0aGlzLmlzQWxsVXJscyA9IHRydWU7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IFsuLi5fTWF0Y2hQYXR0ZXJuLlBST1RPQ09MU107XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBncm91cHMgPSAvKC4qKTpcXC9cXC8oLio/KShcXC8uKikvLmV4ZWMobWF0Y2hQYXR0ZXJuKTtcbiAgICAgIGlmIChncm91cHMgPT0gbnVsbClcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBcIkluY29ycmVjdCBmb3JtYXRcIik7XG4gICAgICBjb25zdCBbXywgcHJvdG9jb2wsIGhvc3RuYW1lLCBwYXRobmFtZV0gPSBncm91cHM7XG4gICAgICB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpO1xuICAgICAgdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKTtcbiAgICAgIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSk7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IHByb3RvY29sID09PSBcIipcIiA/IFtcImh0dHBcIiwgXCJodHRwc1wiXSA6IFtwcm90b2NvbF07XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBob3N0bmFtZTtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IHBhdGhuYW1lO1xuICAgIH1cbiAgfVxuICBpbmNsdWRlcyh1cmwpIHtcbiAgICBpZiAodGhpcy5pc0FsbFVybHMpXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCB1ID0gdHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIiA/IG5ldyBVUkwodXJsKSA6IHVybCBpbnN0YW5jZW9mIExvY2F0aW9uID8gbmV3IFVSTCh1cmwuaHJlZikgOiB1cmw7XG4gICAgcmV0dXJuICEhdGhpcy5wcm90b2NvbE1hdGNoZXMuZmluZCgocHJvdG9jb2wpID0+IHtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBzXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cHNNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmaWxlXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRmlsZU1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZ0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0Z0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcInVyblwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc1Vybk1hdGNoKHUpO1xuICAgIH0pO1xuICB9XG4gIGlzSHR0cE1hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cDpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSHR0cHNNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHBzOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIb3N0UGF0aE1hdGNoKHVybCkge1xuICAgIGlmICghdGhpcy5ob3N0bmFtZU1hdGNoIHx8ICF0aGlzLnBhdGhuYW1lTWF0Y2gpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgaG9zdG5hbWVNYXRjaFJlZ2V4cyA9IFtcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaCksXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gucmVwbGFjZSgvXlxcKlxcLi8sIFwiXCIpKVxuICAgIF07XG4gICAgY29uc3QgcGF0aG5hbWVNYXRjaFJlZ2V4ID0gdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5wYXRobmFtZU1hdGNoKTtcbiAgICByZXR1cm4gISFob3N0bmFtZU1hdGNoUmVnZXhzLmZpbmQoKHJlZ2V4KSA9PiByZWdleC50ZXN0KHVybC5ob3N0bmFtZSkpICYmIHBhdGhuYW1lTWF0Y2hSZWdleC50ZXN0KHVybC5wYXRobmFtZSk7XG4gIH1cbiAgaXNGaWxlTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZpbGU6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzRnRwTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZ0cDovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNVcm5NYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogdXJuOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBjb252ZXJ0UGF0dGVyblRvUmVnZXgocGF0dGVybikge1xuICAgIGNvbnN0IGVzY2FwZWQgPSB0aGlzLmVzY2FwZUZvclJlZ2V4KHBhdHRlcm4pO1xuICAgIGNvbnN0IHN0YXJzUmVwbGFjZWQgPSBlc2NhcGVkLnJlcGxhY2UoL1xcXFxcXCovZywgXCIuKlwiKTtcbiAgICByZXR1cm4gUmVnRXhwKGBeJHtzdGFyc1JlcGxhY2VkfSRgKTtcbiAgfVxuICBlc2NhcGVGb3JSZWdleChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbiAgfVxufTtcbnZhciBNYXRjaFBhdHRlcm4gPSBfTWF0Y2hQYXR0ZXJuO1xuTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUyA9IFtcImh0dHBcIiwgXCJodHRwc1wiLCBcImZpbGVcIiwgXCJmdHBcIiwgXCJ1cm5cIl07XG52YXIgSW52YWxpZE1hdGNoUGF0dGVybiA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4sIHJlYXNvbikge1xuICAgIHN1cGVyKGBJbnZhbGlkIG1hdGNoIHBhdHRlcm4gXCIke21hdGNoUGF0dGVybn1cIjogJHtyZWFzb259YCk7XG4gIH1cbn07XG5mdW5jdGlvbiB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpIHtcbiAgaWYgKCFNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmluY2x1ZGVzKHByb3RvY29sKSAmJiBwcm90b2NvbCAhPT0gXCIqXCIpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgJHtwcm90b2NvbH0gbm90IGEgdmFsaWQgcHJvdG9jb2wgKCR7TWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5qb2luKFwiLCBcIil9KWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKSB7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIjpcIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBgSG9zdG5hbWUgY2Fubm90IGluY2x1ZGUgYSBwb3J0YCk7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIipcIikgJiYgaG9zdG5hbWUubGVuZ3RoID4gMSAmJiAhaG9zdG5hbWUuc3RhcnRzV2l0aChcIiouXCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYElmIHVzaW5nIGEgd2lsZGNhcmQgKCopLCBpdCBtdXN0IGdvIGF0IHRoZSBzdGFydCBvZiB0aGUgaG9zdG5hbWVgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSkge1xuICByZXR1cm47XG59XG5leHBvcnQge1xuICBJbnZhbGlkTWF0Y2hQYXR0ZXJuLFxuICBNYXRjaFBhdHRlcm5cbn07XG4iXSwibmFtZXMiOlsiYnJvd3NlciIsIl9icm93c2VyIiwiX2EiXSwibWFwcGluZ3MiOiI7OztBQUFPLFdBQVMsaUJBQWlCLEtBQUs7QUFDcEMsUUFBSSxPQUFPLFFBQVEsT0FBTyxRQUFRLFdBQVksUUFBTyxFQUFFLE1BQU0sSUFBSztBQUNsRSxXQUFPO0FBQUEsRUFDVDtBQ0ZPLFFBQU1BLGNBQVUsc0JBQVcsWUFBWCxtQkFBb0IsWUFBcEIsbUJBQTZCLE1BQ2hELFdBQVcsVUFDWCxXQUFXO0FDRlIsUUFBTSxVQUFVQztBQ1doQixRQUFNLG9CQUFvQjtBQUFBLElBRzdCLGNBQWM7QUFBQSxFQUNsQjtBQ2hCQSxRQUFNLFVBQVU7QUFFaEIsUUFBTSxvQkFBb0I7QUFDMUIsUUFBTSxzQkFBc0I7QUFDNUIsUUFBTSxxQkFBcUI7QUFDM0IsUUFBTSxhQUFh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
