var background = function() {
  "use strict";
  var _a, _b;
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const browser$1 = ((_b = (_a = globalThis.browser) == null ? void 0 : _a.runtime) == null ? void 0 : _b.id) ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  async function getOpenedTabs() {
    const IS_ALLOW_PINNED = await getIsAllowPinnedTab();
    const IS_DUPLICATE_TAB_ALLOWED = await getIsAllowDuplicateTab();
    let tabs = await browser.tabs.query({});
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
  async function openDashboard() {
    let tabs = await browser.tabs.query({ url: browser.runtime.getURL("dashboard.html") });
    if (tabs.length === 0) {
      browser.tabs.create({ url: browser.runtime.getURL("dashboard.html"), index: 0, pinned: true });
    } else {
      browser.tabs.update(tabs[0].id, { active: true });
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
  async function saveCurrentSession() {
    const tabs = await getOpenedTabs();
    const db = await openDB();
    const tx = db.transaction(SESSION_STORE_NAME, "readwrite");
    const store = tx.objectStore(SESSION_STORE_NAME);
    await store.clear();
    store.put({ key: "lastSession", tabs });
  }
  const definition = defineBackground(() => {
    browser.runtime.onInstalled.addListener(({ reason }) => {
      if (reason === "install") {
        browser.tabs.create({ url: browser.runtime.getURL("dashboard.html"), index: 0, pinned: true });
      }
    });
    browser.runtime.onStartup.addListener(async () => {
      let tabs = await browser.tabs.query({ url: browser.runtime.getURL("dashboard.html") });
      if (tabs.length === 0) {
        browser.tabs.create({ url: browser.runtime.getURL("dashboard.html"), index: 0, pinned: true });
      }
    });
    browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && tab.url) {
        await saveCurrentSession();
      }
    });
    browser.commands.onCommand.addListener(async (command) => {
      if (command === "add-tabs") {
        let tabs = await getOpenedTabs();
        let filteredTabs = tabs.filter((tab) => {
          if (tab.title !== "about:blank") return tab;
        });
        if (filteredTabs.length === 0) return;
        await addTabsToBucket(filteredTabs);
      }
      if (command === "view-buckets") {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9zZXJ2aWNlcy9pbmRleC5qcyIsIi4uLy4uL3V0aWxzL2NvbnN0YW50cy9pbmRleC5qcyIsIi4uLy4uL2RiL2luZGV4LmpzIiwiLi4vLi4vZW50cnlwb2ludHMvYmFja2dyb3VuZC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVCYWNrZ3JvdW5kKGFyZykge1xuICBpZiAoYXJnID09IG51bGwgfHwgdHlwZW9mIGFyZyA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyBtYWluOiBhcmcgfTtcbiAgcmV0dXJuIGFyZztcbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG5pbXBvcnQgeyBnZXRJc0FsbG93RHVwbGljYXRlVGFiLCBnZXRJc0FsbG93UGlubmVkVGFiIH0gZnJvbSAnLi4vZGInO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0T3BlbmVkVGFicygpIHtcbiAgICBjb25zdCBJU19BTExPV19QSU5ORUQgPSBhd2FpdCBnZXRJc0FsbG93UGlubmVkVGFiKCk7XG4gICAgY29uc3QgSVNfRFVQTElDQVRFX1RBQl9BTExPV0VEID0gYXdhaXQgZ2V0SXNBbGxvd0R1cGxpY2F0ZVRhYigpO1xuXG4gICAgbGV0IHRhYnMgPSBhd2FpdCBicm93c2VyLnRhYnMucXVlcnkoe30pO1xuXG4gICAgbGV0IGZpbHRlcmVkVGFicyA9IHRhYnMuZmlsdGVyKHRhYiA9PiB7XG4gICAgICAgIGNvbnN0IHVybCA9IHRhYi51cmwgfHwgXCJcIjtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIHVybCAhPT0gXCJcIiAmJlxuICAgICAgICAgICAgIXVybC5zdGFydHNXaXRoKFwiY2hyb21lOi8vXCIpICYmXG4gICAgICAgICAgICAhdXJsLnN0YXJ0c1dpdGgoXCJjaHJvbWUtZXh0ZW5zaW9uOi8vXCIpICYmXG4gICAgICAgICAgICAhdXJsLnN0YXJ0c1dpdGgoXCJhYm91dDpcIilcbiAgICAgICAgKTtcbiAgICB9KTtcblxuICAgIGZpbHRlcmVkVGFicyA9IGZpbHRlcmVkVGFicy5maWx0ZXIodGFiID0+IHtcbiAgICAgICAgaWYgKCF0YWIucGlubmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0YWIucGlubmVkID09PSBJU19BTExPV19QSU5ORUQpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoIUlTX0RVUExJQ0FURV9UQUJfQUxMT1dFRCkge1xuICAgICAgICBjb25zdCBzZWVuID0gbmV3IFNldCgpO1xuICAgICAgICBmaWx0ZXJlZFRhYnMgPSBmaWx0ZXJlZFRhYnMuZmlsdGVyKCh0YWIpID0+IHtcbiAgICAgICAgICAgIGlmIChzZWVuLmhhcyh0YWIudXJsKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2Vlbi5hZGQodGFiLnVybCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIGZpbHRlcmVkVGFicztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldERhc2hib2FyZFRhYigpIHtcbiAgICBsZXQgZGFzaGJvYXJkVGFicyA9IGF3YWl0IGJyb3dzZXIudGFicy5xdWVyeSh7IHVybDogYnJvd3Nlci5ydW50aW1lLmdldFVSTChcImRhc2hib2FyZC5odG1sXCIpIH0pO1xuICAgIHJldHVybiBkYXNoYm9hcmRUYWJzWzBdO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlUmVsb2FkRGFzaGJvYXJkKCkge1xuICAgIGxldCB0YWJzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHsgdXJsOiBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKFwiZGFzaGJvYXJkLmh0bWxcIikgfSk7XG5cbiAgICBpZiAodGFicy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgYnJvd3Nlci50YWJzLmNyZWF0ZSh7IHVybDogYnJvd3Nlci5ydW50aW1lLmdldFVSTChcImRhc2hib2FyZC5odG1sXCIpLCBpbmRleDogMCwgcGlubmVkOiB0cnVlIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGJyb3dzZXIudGFicy5yZWxvYWQodGFic1swXS5pZCk7XG4gICAgICAgIGJyb3dzZXIudGFicy51cGRhdGUodGFic1swXS5pZCwgeyBhY3RpdmU6IHRydWUgfSk7XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlbkRhc2hib2FyZCgpIHtcbiAgICBsZXQgdGFicyA9IGF3YWl0IGJyb3dzZXIudGFicy5xdWVyeSh7IHVybDogYnJvd3Nlci5ydW50aW1lLmdldFVSTChcImRhc2hib2FyZC5odG1sXCIpIH0pO1xuXG4gICAgaWYgKHRhYnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGJyb3dzZXIudGFicy5jcmVhdGUoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSwgaW5kZXg6IDAsIHBpbm5lZDogdHJ1ZSB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBicm93c2VyLnRhYnMudXBkYXRlKHRhYnNbMF0uaWQsIHsgYWN0aXZlOiB0cnVlIH0pO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9wZW5DdXJyZW50VGFiKGlkKSB7XG4gICAgYnJvd3Nlci50YWJzLnVwZGF0ZShpZCwgeyBhY3RpdmU6IHRydWUgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvcGVuVGFicyh0YWJzKSB7XG4gICAgdGFicy5mb3JFYWNoKCh0YWIpID0+IHtcbiAgICAgICAgYnJvd3Nlci50YWJzLmNyZWF0ZSh7IHVybDogdGFiLnVybCB9KTtcbiAgICB9KVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gb3BlblRhYkdyb3VwKGJ1Y2tldCkge1xuICAgIFByb21pc2UuYWxsKFxuICAgICAgICBidWNrZXQudGFicy5tYXAodGFiID0+IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBicm93c2VyLnRhYnMuY3JlYXRlKHsgdXJsOiB0YWIudXJsIH0sIHJlc29sdmUpO1xuICAgICAgICB9KSlcbiAgICApLnRoZW4oKHRhYnMpID0+IHtcbiAgICAgICAgY29uc3QgdGFiSWRzID0gdGFicy5tYXAodGFiID0+IHRhYi5pZCk7XG5cbiAgICAgICAgYnJvd3Nlci50YWJzLmdyb3VwKHsgdGFiSWRzOiB0YWJJZHMgfSwgKGdyb3VwSWQpID0+IHtcbiAgICAgICAgICAgIGJyb3dzZXIudGFiR3JvdXBzLnVwZGF0ZShncm91cElkLCB7XG4gICAgICAgICAgICAgICAgdGl0bGU6IGJ1Y2tldC5uYW1lLFxuICAgICAgICAgICAgICAgIGNvbG9yOiBidWNrZXQ/LmNvbG9yID8gYnVja2V0LmNvbG9yIDogJ2JsdWUnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xufVxuIiwiZXhwb3J0IGNvbnN0IGVtcHR5UG9wVXBGYWxsYmFja01lc3NhZ2VzID0gW1xuICAgIFwiTm8gdGFicyBvcGVuIHJpZ2h0IG5vdy4gVGltZSB0byBmb2N1cz8g8J+YjFwiLFxuICAgIFwiWW91J3JlIGFsbCBjbGVhci4gTm8gdGFicyBpbiBzaWdodC5cIixcbiAgICBcIk5vIGFjdGl2ZSB0YWJzIGZvdW5kIGluIHRoaXMgd2luZG93LlwiLFxuICAgIFwiWW91ciBicm93c2VyIHRhYiBvY2VhbiBpcyBjYWxtIPCfp5hcIixcbiAgICBcIk5vdGhpbmcgaGVyZS4gSGl0IOKAmEFkZOKAmSB3aGVuIHlvdSdyZSByZWFkeSB0byBzYXZlIHNvbWUgdGFicyFcIixcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRFbXB0eVBvcFVwRmFsbEJhY2tNZXNzYWdlKCkge1xuICAgIHJldHVybiBlbXB0eVBvcFVwRmFsbGJhY2tNZXNzYWdlc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBlbXB0eVBvcFVwRmFsbGJhY2tNZXNzYWdlcy5sZW5ndGgpXTtcbn1cblxuZXhwb3J0IGNvbnN0IGRlZmF1bHRXb3Jrc3BhY2VzID0ge1xuICAgIEFMTDogJ0FsbCcsXG4gICAgRkFWT1JJVEU6ICdGYXZvcml0ZScsXG4gICAgTEFTVF9TRVNTSU9OOiAnTGFzdCBzZXNzaW9uJ1xufSIsImNvbnN0IERCX05BTUUgPSAnVGFyY2hpdmVEQic7XG5pbXBvcnQgeyBnZXRPcGVuZWRUYWJzIH0gZnJvbSAnLi4vc2VydmljZXMnO1xuaW1wb3J0IHsgZGVmYXVsdFdvcmtzcGFjZXMgfSBmcm9tICcuLi91dGlscy9jb25zdGFudHMvaW5kZXgnO1xuY29uc3QgQlVDS0VUX1NUT1JFX05BTUUgPSAnYnVja2V0cyc7XG5jb25zdCBTRVRUSU5HU19TVE9SRV9OQU1FID0gJ3NldHRpbmdzJztcbmNvbnN0IFNFU1NJT05fU1RPUkVfTkFNRSA9ICdzZXNzaW9uJztcbmNvbnN0IERCX1ZFUlNJT04gPSAxO1xuXG5mdW5jdGlvbiBvcGVuREIoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IGluZGV4ZWREQi5vcGVuKERCX05BTUUsIERCX1ZFUlNJT04pO1xuXG4gICAgICAgIHJlcXVlc3Qub251cGdyYWRlbmVlZGVkID0gKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBkYiA9IGV2ZW50LnRhcmdldC5yZXN1bHQ7XG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoQlVDS0VUX1NUT1JFX05BTUUpKSB7XG4gICAgICAgICAgICAgICAgZGIuY3JlYXRlT2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUsIHsga2V5UGF0aDogJ2lkJyB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFkYi5vYmplY3RTdG9yZU5hbWVzLmNvbnRhaW5zKFNFVFRJTkdTX1NUT1JFX05BTUUpKSB7XG4gICAgICAgICAgICAgICAgZGIuY3JlYXRlT2JqZWN0U3RvcmUoU0VUVElOR1NfU1RPUkVfTkFNRSwgeyBrZXlQYXRoOiBcImtleVwiIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWRiLm9iamVjdFN0b3JlTmFtZXMuY29udGFpbnMoU0VTU0lPTl9TVE9SRV9OQU1FKSkge1xuICAgICAgICAgICAgICAgIGRiLmNyZWF0ZU9iamVjdFN0b3JlKFNFU1NJT05fU1RPUkVfTkFNRSwgeyBrZXlQYXRoOiBcImtleVwiIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gKCkgPT4gcmVzb2x2ZShyZXF1ZXN0LnJlc3VsdCk7XG4gICAgICAgIHJlcXVlc3Qub25lcnJvciA9ICgpID0+IHJlamVjdChyZXF1ZXN0LmVycm9yKTtcbiAgICB9KTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZ2V0QWxsQnVja2V0cygpIHtcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKEJVQ0tFVF9TVE9SRV9OQU1FLCAncmVhZG9ubHknKTtcbiAgICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSBzdG9yZS5nZXRBbGwoKTtcbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoKSA9PiByZXNvbHZlKHJlcXVlc3QucmVzdWx0KTtcbiAgICB9KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFkZFRhYnNUb0J1Y2tldCh0YWJzKSB7XG4gICAgaWYgKHRhYnMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cbiAgICBsZXQgZmlsdGVyZWRUYWJzID0gdGFicy5maWx0ZXIoKHRhYikgPT4ge1xuICAgICAgICBpZiAodGFiLmNoZWNrZWQgIT09IGZhbHNlKSByZXR1cm4gdGFiO1xuICAgIH0pO1xuXG4gICAgaWYgKGZpbHRlcmVkVGFicy5sZW5ndGggPT09IDApIHJldHVybjsgLy8gcmV0dXJuIGlmIG5vIHRhYnNcblxuICAgIGNvbnN0IGlkID0gY3J5cHRvLnJhbmRvbVVVSUQoKTtcbiAgICBjb25zdCBidWNrZXQgPSB7XG4gICAgICAgIGlkLFxuICAgICAgICBuYW1lOiBpZC5zbGljZSgwLCA4KSxcbiAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHRhYnM6IGZpbHRlcmVkVGFicyxcbiAgICAgICAgdGFnOiBbZGVmYXVsdFdvcmtzcGFjZXMuQUxMXSxcbiAgICAgICAgaXNMb2NrZWQ6IGZhbHNlLFxuICAgIH07XG5cbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcbiAgICB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSkuYWRkKGJ1Y2tldCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkZWxldGVCdWNrZXQoaWQpIHtcbiAgICBjb25zdCBidWNrZXRzID0gYXdhaXQgZ2V0QWxsQnVja2V0cygpO1xuICAgIGNvbnN0IGJ1Y2tldCA9IGJ1Y2tldHMuZmluZChiID0+IGIuaWQgPT09IGlkKTtcbiAgICBpZiAoYnVja2V0Py5pc0xvY2tlZCkgcmV0dXJuO1xuXG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKEJVQ0tFVF9TVE9SRV9OQU1FLCAncmVhZHdyaXRlJyk7XG4gICAgdHgub2JqZWN0U3RvcmUoQlVDS0VUX1NUT1JFX05BTUUpLmRlbGV0ZShpZCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZW5hbWVCdWNrZXROYW1lKGlkLCBuYW1lKSB7XG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKEJVQ0tFVF9TVE9SRV9OQU1FLCAncmVhZHdyaXRlJyk7XG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XG4gICAgY29uc3QgcmVxID0gYXdhaXQgc3RvcmUuZ2V0KGlkKTtcblxuICAgIHJlcS5vbnN1Y2Nlc3MgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSByZXEucmVzdWx0O1xuXG4gICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICBkYXRhLm5hbWUgPSBuYW1lO1xuICAgICAgICAgICAgc3RvcmUucHV0KGRhdGEpO1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRvZ2dsZUJ1Y2tldExvY2soaWQpIHtcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcbiAgICBjb25zdCByZXEgPSBzdG9yZS5nZXQoaWQpO1xuXG4gICAgcmVxLm9uc3VjY2VzcyA9ICgpID0+IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IHJlcS5yZXN1bHQ7XG4gICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICBkYXRhLmlzTG9ja2VkID0gIWRhdGE/LmlzTG9ja2VkO1xuICAgICAgICAgICAgc3RvcmUucHV0KGRhdGEpO1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEFsbFdvcmtzcGFjZXMoKSB7XG4gICAgY29uc3QgYnVja2V0cyA9IGF3YWl0IGdldEFsbEJ1Y2tldHMoKTtcbiAgICBidWNrZXRzLnNvcnQoKGEsIGIpID0+IGIuY3JlYXRlZEF0LmxvY2FsZUNvbXBhcmUoYS5jcmVhdGVkQXQpKTtcblxuICAgIGNvbnN0IHdvcmtzcGFjZXMgPSB7fTtcblxuICAgIGJ1Y2tldHMuZm9yRWFjaChidWNrZXQgPT4ge1xuICAgICAgICBidWNrZXQ/LnRhZz8uZm9yRWFjaCh0YWcgPT4ge1xuICAgICAgICAgICAgaWYgKCF3b3Jrc3BhY2VzW3RhZ10pIHdvcmtzcGFjZXNbdGFnXSA9IFtdO1xuICAgICAgICAgICAgd29ya3NwYWNlc1t0YWddLnB1c2goYnVja2V0KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gd29ya3NwYWNlcztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHRvZ2dsZVRhZyhpZCwgdGFnKSB7XG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKEJVQ0tFVF9TVE9SRV9OQU1FLCAncmVhZHdyaXRlJyk7XG4gICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShCVUNLRVRfU1RPUkVfTkFNRSk7XG4gICAgY29uc3QgcmVxID0gc3RvcmUuZ2V0KGlkKTtcblxuICAgIHJlcS5vbnN1Y2Nlc3MgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSByZXEucmVzdWx0O1xuICAgICAgICBpZiAoZGF0YSAmJiAhZGF0YS50YWcuaW5jbHVkZXModGFnKSkge1xuICAgICAgICAgICAgZGF0YS50YWcucHVzaCh0YWcpO1xuICAgICAgICAgICAgc3RvcmUucHV0KGRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgaW5kZXggPSBkYXRhLnRhZy5pbmRleE9mKHRhZyk7XG4gICAgICAgICAgICBkYXRhLnRhZy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgc3RvcmUucHV0KGRhdGEpO1xuICAgICAgICB9XG4gICAgfTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRlbGV0ZVRhYih0YWJJZCwgYnVja2V0SWQpIHtcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oQlVDS0VUX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcbiAgICBjb25zdCByZXEgPSBzdG9yZS5nZXQoYnVja2V0SWQpO1xuXG4gICAgcmVxLm9uc3VjY2VzcyA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgY29uc3QgZGF0YSA9IHJlcS5yZXN1bHQ7XG4gICAgICAgIGlmIChkYXRhPy50YWJzPy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIHN0b3JlLmRlbGV0ZShidWNrZXRJZCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgZGF0YS50YWJzID0gZGF0YS50YWJzLmZpbHRlcigodGFiKSA9PiB0YWIuaWQgIT09IHRhYklkKTtcbiAgICAgICAgc3RvcmUucHV0KGRhdGEpO1xuICAgIH07XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzYXZlU2V0dGluZyhrZXksIHZhbHVlKSB7XG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFNFVFRJTkdTX1NUT1JFX05BTUUsICdyZWFkd3JpdGUnKTtcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFNFVFRJTkdTX1NUT1JFX05BTUUpO1xuXG4gICAgY29uc3Qgc2V0dGluZyA9IHsga2V5LCB2YWx1ZSB9O1xuICAgIHN0b3JlLnB1dChzZXR0aW5nKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFNldHRpbmcoa2V5KSB7XG4gICAgY29uc3QgZGIgPSBhd2FpdCBvcGVuREIoKTtcbiAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFNFVFRJTkdTX1NUT1JFX05BTUUsICdyZWFkb25seScpO1xuICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoU0VUVElOR1NfU1RPUkVfTkFNRSk7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBjb25zdCByZXF1ZXN0ID0gc3RvcmUuZ2V0KGtleSk7XG5cbiAgICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSAoKSA9PiB7XG4gICAgICAgICAgICByZXNvbHZlKHJlcXVlc3QucmVzdWx0Py52YWx1ZSA/PyBudWxsKTtcbiAgICAgICAgfTtcbiAgICAgICAgcmVxdWVzdC5vbmVycm9yID0gKCkgPT4gcmVqZWN0KHJlcXVlc3QuZXJyb3IpO1xuICAgIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlSXNBbGxvd0R1cGxpY2F0ZVRhYih2YWx1ZSkge1xuICAgIGF3YWl0IHNhdmVTZXR0aW5nKCdJU19BTExPV19EVVBMSUNBVEVfVEFCJywgdmFsdWUpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0SXNBbGxvd0R1cGxpY2F0ZVRhYigpIHtcbiAgICByZXR1cm4gYXdhaXQgZ2V0U2V0dGluZygnSVNfQUxMT1dfRFVQTElDQVRFX1RBQicpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlSXNBbGxvd1Bpbm5lZFRhYih2YWx1ZSkge1xuICAgIGF3YWl0IHNhdmVTZXR0aW5nKCdJU19BTExPV19QSU5ORURfVEFCJywgdmFsdWUpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0SXNBbGxvd1Bpbm5lZFRhYigpIHtcbiAgICByZXR1cm4gYXdhaXQgZ2V0U2V0dGluZygnSVNfQUxMT1dfUElOTkVEX1RBQicpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2F2ZUN1cnJlbnRTZXNzaW9uKCkge1xuICAgIGNvbnN0IHRhYnMgPSBhd2FpdCBnZXRPcGVuZWRUYWJzKCk7XG5cbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oU0VTU0lPTl9TVE9SRV9OQU1FLCBcInJlYWR3cml0ZVwiKTtcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFNFU1NJT05fU1RPUkVfTkFNRSk7XG5cbiAgICBhd2FpdCBzdG9yZS5jbGVhcigpO1xuXG4gICAgc3RvcmUucHV0KHsga2V5OiBcImxhc3RTZXNzaW9uXCIsIHRhYnMgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRMYXN0U2Vzc2lvbigpIHtcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xuICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oU0VTU0lPTl9TVE9SRV9OQU1FLCAncmVhZG9ubHknKTtcbiAgICBjb25zdCBzdG9yZSA9IHR4Lm9iamVjdFN0b3JlKFNFU1NJT05fU1RPUkVfTkFNRSk7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgY29uc3QgcmVxdWVzdCA9IHN0b3JlLmdldEFsbCgpO1xuICAgICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9ICgpID0+IHJlc29sdmUocmVxdWVzdC5yZXN1bHQpO1xuICAgIH0pO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhwb3J0QWxsRGF0YUFzSnNvbigpIHtcbiAgICBjb25zdCBkYiA9IGF3YWl0IG9wZW5EQigpO1xuXG4gICAgY29uc3QgZ2V0QWxsRnJvbVN0b3JlID0gKHN0b3JlTmFtZSkgPT4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihzdG9yZU5hbWUsICdyZWFkb25seScpO1xuICAgICAgICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZShzdG9yZU5hbWUpO1xuICAgICAgICAgICAgY29uc3QgcmVxID0gc3RvcmUuZ2V0QWxsKCk7XG4gICAgICAgICAgICByZXEub25zdWNjZXNzID0gKCkgPT4gcmVzb2x2ZShyZXEucmVzdWx0KTtcbiAgICAgICAgICAgIHJlcS5vbmVycm9yID0gKCkgPT4gcmVqZWN0KHJlcS5lcnJvcik7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICBjb25zdCBidWNrZXRzID0gYXdhaXQgZ2V0QWxsRnJvbVN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcbiAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IGdldEFsbEZyb21TdG9yZShTRVRUSU5HU19TVE9SRV9OQU1FKTtcblxuICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgIGJ1Y2tldHMsXG4gICAgICAgIHNldHRpbmdzLFxuICAgICAgICBleHBvcnRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICB9O1xuXG4gICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKFtKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKV0sIHsgdHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgIGNvbnN0IHVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XG5cbiAgICBjb25zdCBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgIGEuaHJlZiA9IHVybDtcbiAgICBhLmRvd25sb2FkID0gYHRhcmNoaXZlLWV4cG9ydC0ke2RhdGEuZXhwb3J0ZWRBdH0uanNvbmA7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTtcbiAgICBhLmNsaWNrKCk7XG4gICAgYS5yZW1vdmUoKTtcbiAgICBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBpbXBvcnRBbGxEYXRhRnJvbUpTT04oZmlsZSkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cbiAgICAgICAgcmVhZGVyLm9ubG9hZCA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gSlNPTi5wYXJzZShldmVudC50YXJnZXQucmVzdWx0KTtcblxuICAgICAgICAgICAgICAgIGlmICghZGF0YS5idWNrZXRzIHx8ICFkYXRhLnNldHRpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBKU09OIHN0cnVjdHVyZScpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGRiID0gYXdhaXQgb3BlbkRCKCk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKFtCVUNLRVRfU1RPUkVfTkFNRSwgU0VUVElOR1NfU1RPUkVfTkFNRV0sICdyZWFkd3JpdGUnKTtcbiAgICAgICAgICAgICAgICBjb25zdCBidWNrZXRTdG9yZSA9IHR4Lm9iamVjdFN0b3JlKEJVQ0tFVF9TVE9SRV9OQU1FKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzZXR0aW5nU3RvcmUgPSB0eC5vYmplY3RTdG9yZShTRVRUSU5HU19TVE9SRV9OQU1FKTtcblxuICAgICAgICAgICAgICAgIGJ1Y2tldFN0b3JlLmNsZWFyKCk7XG4gICAgICAgICAgICAgICAgc2V0dGluZ1N0b3JlLmNsZWFyKCk7XG5cbiAgICAgICAgICAgICAgICBkYXRhPy5idWNrZXRzPy5mb3JFYWNoKGJ1Y2tldCA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGJ1Y2tldFN0b3JlLnB1dChidWNrZXQpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgZGF0YT8uc2V0dGluZ3M/LmZvckVhY2goc2V0dGluZyA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHNldHRpbmdTdG9yZS5wdXQoc2V0dGluZyk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB0eC5vbmNvbXBsZXRlID0gKCkgPT4gcmVzb2x2ZSh0cnVlKTtcbiAgICAgICAgICAgICAgICB0eC5vbmVycm9yID0gKCkgPT4gcmVqZWN0KHR4LmVycm9yKTtcblxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgcmVhZGVyLm9uZXJyb3IgPSAoKSA9PiByZWplY3QocmVhZGVyLmVycm9yKTtcblxuICAgICAgICByZWFkZXIucmVhZEFzVGV4dChmaWxlKTtcbiAgICB9KTtcbn1cblxuIiwiaW1wb3J0IHsgYWRkVGFic1RvQnVja2V0LCBzYXZlQ3VycmVudFNlc3Npb24gfSBmcm9tIFwiLi4vZGJcIjtcbmltcG9ydCB7IGdldE9wZW5lZFRhYnMsIG9wZW5EYXNoYm9hcmQgfSBmcm9tIFwiLi4vc2VydmljZXNcIjtcbmltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUJhY2tncm91bmQoKCkgPT4ge1xuICBicm93c2VyLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKHsgcmVhc29uIH0pID0+IHtcbiAgICBpZiAocmVhc29uID09PSAnaW5zdGFsbCcpIHtcbiAgICAgIGJyb3dzZXIudGFicy5jcmVhdGUoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSwgaW5kZXg6IDAsIHBpbm5lZDogdHJ1ZSB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIGJyb3dzZXIucnVudGltZS5vblN0YXJ0dXAuYWRkTGlzdGVuZXIoYXN5bmMgKCkgPT4ge1xuICAgIGxldCB0YWJzID0gYXdhaXQgYnJvd3Nlci50YWJzLnF1ZXJ5KHsgdXJsOiBicm93c2VyLnJ1bnRpbWUuZ2V0VVJMKFwiZGFzaGJvYXJkLmh0bWxcIikgfSk7XG5cbiAgICBpZiAodGFicy5sZW5ndGggPT09IDApIHtcbiAgICAgIGJyb3dzZXIudGFicy5jcmVhdGUoeyB1cmw6IGJyb3dzZXIucnVudGltZS5nZXRVUkwoXCJkYXNoYm9hcmQuaHRtbFwiKSwgaW5kZXg6IDAsIHBpbm5lZDogdHJ1ZSB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIGJyb3dzZXIudGFicy5vblVwZGF0ZWQuYWRkTGlzdGVuZXIoYXN5bmMgKHRhYklkLCBjaGFuZ2VJbmZvLCB0YWIpID0+IHtcbiAgICBpZiAoY2hhbmdlSW5mby5zdGF0dXMgPT09IFwiY29tcGxldGVcIiAmJiB0YWIudXJsKSB7XG4gICAgICBhd2FpdCBzYXZlQ3VycmVudFNlc3Npb24oKTtcbiAgICB9XG4gIH0pO1xuXG4gIGJyb3dzZXIuY29tbWFuZHMub25Db21tYW5kLmFkZExpc3RlbmVyKGFzeW5jIChjb21tYW5kKSA9PiB7XG4gICAgaWYgKGNvbW1hbmQgPT09IFwiYWRkLXRhYnNcIikge1xuICAgICAgbGV0IHRhYnMgPSBhd2FpdCBnZXRPcGVuZWRUYWJzKCk7XG5cbiAgICAgIGxldCBmaWx0ZXJlZFRhYnMgPSB0YWJzLmZpbHRlcigodGFiKSA9PiB7XG4gICAgICAgIGlmICh0YWIudGl0bGUgIT09IFwiYWJvdXQ6YmxhbmtcIikgcmV0dXJuIHRhYjtcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoZmlsdGVyZWRUYWJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgICBhd2FpdCBhZGRUYWJzVG9CdWNrZXQoZmlsdGVyZWRUYWJzKTtcbiAgICB9XG5cbiAgICBpZiAoY29tbWFuZCA9PT0gXCJ2aWV3LWJ1Y2tldHNcIikge1xuICAgICAgYXdhaXQgb3BlbkRhc2hib2FyZCgpO1xuICAgIH1cbiAgfSk7XG59KTsiLCIvLyBzcmMvaW5kZXgudHNcbnZhciBfTWF0Y2hQYXR0ZXJuID0gY2xhc3Mge1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4pIHtcbiAgICBpZiAobWF0Y2hQYXR0ZXJuID09PSBcIjxhbGxfdXJscz5cIikge1xuICAgICAgdGhpcy5pc0FsbFVybHMgPSB0cnVlO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBbLi4uX01hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gXCIqXCI7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZ3JvdXBzID0gLyguKik6XFwvXFwvKC4qPykoXFwvLiopLy5leGVjKG1hdGNoUGF0dGVybik7XG4gICAgICBpZiAoZ3JvdXBzID09IG51bGwpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xuICAgICAgY29uc3QgW18sIHByb3RvY29sLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gZ3JvdXBzO1xuICAgICAgdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKTtcbiAgICAgIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XG4gICAgICB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBwcm90b2NvbCA9PT0gXCIqXCIgPyBbXCJodHRwXCIsIFwiaHR0cHNcIl0gOiBbcHJvdG9jb2xdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gaG9zdG5hbWU7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBwYXRobmFtZTtcbiAgICB9XG4gIH1cbiAgaW5jbHVkZXModXJsKSB7XG4gICAgaWYgKHRoaXMuaXNBbGxVcmxzKVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgdSA9IHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIgPyBuZXcgVVJMKHVybCkgOiB1cmwgaW5zdGFuY2VvZiBMb2NhdGlvbiA/IG5ldyBVUkwodXJsLmhyZWYpIDogdXJsO1xuICAgIHJldHVybiAhIXRoaXMucHJvdG9jb2xNYXRjaGVzLmZpbmQoKHByb3RvY29sKSA9PiB7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwc1wiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBzTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZmlsZVwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0ZpbGVNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmdHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGdHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJ1cm5cIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNVcm5NYXRjaCh1KTtcbiAgICB9KTtcbiAgfVxuICBpc0h0dHBNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHA6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0h0dHBzTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwczpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSG9zdFBhdGhNYXRjaCh1cmwpIHtcbiAgICBpZiAoIXRoaXMuaG9zdG5hbWVNYXRjaCB8fCAhdGhpcy5wYXRobmFtZU1hdGNoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGhvc3RuYW1lTWF0Y2hSZWdleHMgPSBbXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gpLFxuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoLnJlcGxhY2UoL15cXCpcXC4vLCBcIlwiKSlcbiAgICBdO1xuICAgIGNvbnN0IHBhdGhuYW1lTWF0Y2hSZWdleCA9IHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMucGF0aG5hbWVNYXRjaCk7XG4gICAgcmV0dXJuICEhaG9zdG5hbWVNYXRjaFJlZ2V4cy5maW5kKChyZWdleCkgPT4gcmVnZXgudGVzdCh1cmwuaG9zdG5hbWUpKSAmJiBwYXRobmFtZU1hdGNoUmVnZXgudGVzdCh1cmwucGF0aG5hbWUpO1xuICB9XG4gIGlzRmlsZU1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmaWxlOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc0Z0cE1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmdHA6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzVXJuTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IHVybjovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgY29udmVydFBhdHRlcm5Ub1JlZ2V4KHBhdHRlcm4pIHtcbiAgICBjb25zdCBlc2NhcGVkID0gdGhpcy5lc2NhcGVGb3JSZWdleChwYXR0ZXJuKTtcbiAgICBjb25zdCBzdGFyc1JlcGxhY2VkID0gZXNjYXBlZC5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XG4gICAgcmV0dXJuIFJlZ0V4cChgXiR7c3RhcnNSZXBsYWNlZH0kYCk7XG4gIH1cbiAgZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG4gIH1cbn07XG52YXIgTWF0Y2hQYXR0ZXJuID0gX01hdGNoUGF0dGVybjtcbk1hdGNoUGF0dGVybi5QUk9UT0NPTFMgPSBbXCJodHRwXCIsIFwiaHR0cHNcIiwgXCJmaWxlXCIsIFwiZnRwXCIsIFwidXJuXCJdO1xudmFyIEludmFsaWRNYXRjaFBhdHRlcm4gPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuLCByZWFzb24pIHtcbiAgICBzdXBlcihgSW52YWxpZCBtYXRjaCBwYXR0ZXJuIFwiJHttYXRjaFBhdHRlcm59XCI6ICR7cmVhc29ufWApO1xuICB9XG59O1xuZnVuY3Rpb24gdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKSB7XG4gIGlmICghTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5pbmNsdWRlcyhwcm90b2NvbCkgJiYgcHJvdG9jb2wgIT09IFwiKlwiKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCI6XCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYEhvc3RuYW1lIGNhbm5vdCBpbmNsdWRlIGEgcG9ydGApO1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCIqXCIpICYmIGhvc3RuYW1lLmxlbmd0aCA+IDEgJiYgIWhvc3RuYW1lLnN0YXJ0c1dpdGgoXCIqLlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGBJZiB1c2luZyBhIHdpbGRjYXJkICgqKSwgaXQgbXVzdCBnbyBhdCB0aGUgc3RhcnQgb2YgdGhlIGhvc3RuYW1lYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpIHtcbiAgcmV0dXJuO1xufVxuZXhwb3J0IHtcbiAgSW52YWxpZE1hdGNoUGF0dGVybixcbiAgTWF0Y2hQYXR0ZXJuXG59O1xuIl0sIm5hbWVzIjpbImJyb3dzZXIiLCJfYnJvd3NlciIsIl9hIl0sIm1hcHBpbmdzIjoiOzs7QUFBTyxXQUFTLGlCQUFpQixLQUFLO0FBQ3BDLFFBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxXQUFZLFFBQU8sRUFBRSxNQUFNLElBQUs7QUFDbEUsV0FBTztBQUFBLEVBQ1Q7QUNGTyxRQUFNQSxjQUFVLHNCQUFXLFlBQVgsbUJBQW9CLFlBQXBCLG1CQUE2QixNQUNoRCxXQUFXLFVBQ1gsV0FBVztBQ0ZSLFFBQU0sVUFBVUM7QUNFaEIsaUJBQWUsZ0JBQWdCO0FBQ2xDLFVBQU0sa0JBQWtCLE1BQU0sb0JBQXFCO0FBQ25ELFVBQU0sMkJBQTJCLE1BQU0sdUJBQXdCO0FBRS9ELFFBQUksT0FBTyxNQUFNLFFBQVEsS0FBSyxNQUFNLENBQUEsQ0FBRTtBQUV0QyxRQUFJLGVBQWUsS0FBSyxPQUFPLFNBQU87QUFDbEMsWUFBTSxNQUFNLElBQUksT0FBTztBQUN2QixhQUNJLFFBQVEsTUFDUixDQUFDLElBQUksV0FBVyxXQUFXLEtBQzNCLENBQUMsSUFBSSxXQUFXLHFCQUFxQixLQUNyQyxDQUFDLElBQUksV0FBVyxRQUFRO0FBQUEsSUFFcEMsQ0FBSztBQUVELG1CQUFlLGFBQWEsT0FBTyxTQUFPO0FBQ3RDLFVBQUksQ0FBQyxJQUFJLFFBQVE7QUFDYixlQUFPO0FBQUEsTUFDbkI7QUFFUSxVQUFJLElBQUksV0FBVyxpQkFBaUI7QUFDaEMsZUFBTztBQUFBLE1BQ25CLE9BQWU7QUFDSCxlQUFPO0FBQUEsTUFDbkI7QUFBQSxJQUNBLENBQUs7QUFFRCxRQUFJLENBQUMsMEJBQTBCO0FBQzNCLFlBQU0sT0FBTyxvQkFBSSxJQUFLO0FBQ3RCLHFCQUFlLGFBQWEsT0FBTyxDQUFDLFFBQVE7QUFDeEMsWUFBSSxLQUFLLElBQUksSUFBSSxHQUFHLEdBQUc7QUFDbkIsaUJBQU87QUFBQSxRQUN2QixPQUFtQjtBQUNILGVBQUssSUFBSSxJQUFJLEdBQUc7QUFDaEIsaUJBQU87QUFBQSxRQUN2QjtBQUFBLE1BQ1MsQ0FBQTtBQUFBLElBQ1Q7QUFFSSxXQUFPO0FBQUEsRUFDWDtBQWtCTyxpQkFBZSxnQkFBZ0I7QUFDbEMsUUFBSSxPQUFPLE1BQU0sUUFBUSxLQUFLLE1BQU0sRUFBRSxLQUFLLFFBQVEsUUFBUSxPQUFPLGdCQUFnQixFQUFDLENBQUU7QUFFckYsUUFBSSxLQUFLLFdBQVcsR0FBRztBQUNuQixjQUFRLEtBQUssT0FBTyxFQUFFLEtBQUssUUFBUSxRQUFRLE9BQU8sZ0JBQWdCLEdBQUcsT0FBTyxHQUFHLFFBQVEsS0FBSSxDQUFFO0FBQUEsSUFDckcsT0FBVztBQUNILGNBQVEsS0FBSyxPQUFPLEtBQUssQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLE1BQU07QUFBQSxJQUN4RDtBQUFBLEVBQ0E7QUMxRE8sUUFBTSxvQkFBb0I7QUFBQSxJQUM3QixLQUFLO0FBQUEsRUFHVDtBQ2hCQSxRQUFNLFVBQVU7QUFHaEIsUUFBTSxvQkFBb0I7QUFDMUIsUUFBTSxzQkFBc0I7QUFDNUIsUUFBTSxxQkFBcUI7QUFDM0IsUUFBTSxhQUFhO0FBRW5CLFdBQVMsU0FBUztBQUNkLFdBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3BDLFlBQU0sVUFBVSxVQUFVLEtBQUssU0FBUyxVQUFVO0FBRWxELGNBQVEsa0JBQWtCLENBQUMsVUFBVTtBQUNqQyxjQUFNLEtBQUssTUFBTSxPQUFPO0FBQ3hCLFlBQUksQ0FBQyxHQUFHLGlCQUFpQixTQUFTLGlCQUFpQixHQUFHO0FBQ2xELGFBQUcsa0JBQWtCLG1CQUFtQixFQUFFLFNBQVMsS0FBSSxDQUFFO0FBQUEsUUFDekU7QUFFWSxZQUFJLENBQUMsR0FBRyxpQkFBaUIsU0FBUyxtQkFBbUIsR0FBRztBQUNwRCxhQUFHLGtCQUFrQixxQkFBcUIsRUFBRSxTQUFTLE1BQUssQ0FBRTtBQUFBLFFBQzVFO0FBRVksWUFBSSxDQUFDLEdBQUcsaUJBQWlCLFNBQVMsa0JBQWtCLEdBQUc7QUFDbkQsYUFBRyxrQkFBa0Isb0JBQW9CLEVBQUUsU0FBUyxNQUFLLENBQUU7QUFBQSxRQUMzRTtBQUFBLE1BQ1M7QUFFRCxjQUFRLFlBQVksTUFBTSxRQUFRLFFBQVEsTUFBTTtBQUNoRCxjQUFRLFVBQVUsTUFBTSxPQUFPLFFBQVEsS0FBSztBQUFBLElBQ3BELENBQUs7QUFBQSxFQUNMO0FBWU8saUJBQWUsZ0JBQWdCLE1BQU07QUFDeEMsUUFBSSxLQUFLLFdBQVcsRUFBRztBQUV2QixRQUFJLGVBQWUsS0FBSyxPQUFPLENBQUMsUUFBUTtBQUNwQyxVQUFJLElBQUksWUFBWSxNQUFPLFFBQU87QUFBQSxJQUMxQyxDQUFLO0FBRUQsUUFBSSxhQUFhLFdBQVcsRUFBRztBQUUvQixVQUFNLEtBQUssT0FBTyxXQUFZO0FBQzlCLFVBQU0sU0FBUztBQUFBLE1BQ1g7QUFBQSxNQUNBLE1BQU0sR0FBRyxNQUFNLEdBQUcsQ0FBQztBQUFBLE1BQ25CLFlBQVcsb0JBQUksS0FBTSxHQUFDLFlBQWE7QUFBQSxNQUNuQyxNQUFNO0FBQUEsTUFDTixLQUFLLENBQUMsa0JBQWtCLEdBQUc7QUFBQSxNQUMzQixVQUFVO0FBQUEsSUFDYjtBQUVELFVBQU0sS0FBSyxNQUFNLE9BQVE7QUFDekIsVUFBTSxLQUFLLEdBQUcsWUFBWSxtQkFBbUIsV0FBVztBQUN4RCxPQUFHLFlBQVksaUJBQWlCLEVBQUUsSUFBSSxNQUFNO0FBQUEsRUFDaEQ7QUF3R08saUJBQWUsV0FBVyxLQUFLO0FBQ2xDLFVBQU0sS0FBSyxNQUFNLE9BQVE7QUFDekIsVUFBTSxLQUFLLEdBQUcsWUFBWSxxQkFBcUIsVUFBVTtBQUN6RCxVQUFNLFFBQVEsR0FBRyxZQUFZLG1CQUFtQjtBQUVoRCxXQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUNwQyxZQUFNLFVBQVUsTUFBTSxJQUFJLEdBQUc7QUFFN0IsY0FBUSxZQUFZLE1BQU07O0FBQ3RCLGtCQUFRQyxNQUFBLFFBQVEsV0FBUixnQkFBQUEsSUFBZ0IsVUFBUyxJQUFJO0FBQUEsTUFDeEM7QUFDRCxjQUFRLFVBQVUsTUFBTSxPQUFPLFFBQVEsS0FBSztBQUFBLElBQ3BELENBQUs7QUFBQSxFQUNMO0FBTU8saUJBQWUseUJBQXlCO0FBQzNDLFdBQU8sTUFBTSxXQUFXLHdCQUF3QjtBQUFBLEVBQ3BEO0FBTU8saUJBQWUsc0JBQXNCO0FBQ3hDLFdBQU8sTUFBTSxXQUFXLHFCQUFxQjtBQUFBLEVBQ2pEO0FBRU8saUJBQWUscUJBQXFCO0FBQ3ZDLFVBQU0sT0FBTyxNQUFNLGNBQWU7QUFFbEMsVUFBTSxLQUFLLE1BQU0sT0FBUTtBQUN6QixVQUFNLEtBQUssR0FBRyxZQUFZLG9CQUFvQixXQUFXO0FBQ3pELFVBQU0sUUFBUSxHQUFHLFlBQVksa0JBQWtCO0FBRS9DLFVBQU0sTUFBTSxNQUFPO0FBRW5CLFVBQU0sSUFBSSxFQUFFLEtBQUssZUFBZSxLQUFJLENBQUU7QUFBQSxFQUMxQztBQzdNQSxRQUFBLGFBQUEsaUJBQUEsTUFBQTtBQUNBLFlBQUEsUUFBQSxZQUFBLFlBQUEsQ0FBQSxFQUFBLE9BQUEsTUFBQTtBQUNBLFVBQUEsV0FBQSxXQUFBO0FBQ0EsZ0JBQUEsS0FBQSxPQUFBLEVBQUEsS0FBQSxRQUFBLFFBQUEsT0FBQSxnQkFBQSxHQUFBLE9BQUEsR0FBQSxRQUFBLEtBQUEsQ0FBQTtBQUFBLE1BQ0E7QUFBQSxJQUNBLENBQUE7QUFFQSxZQUFBLFFBQUEsVUFBQSxZQUFBLFlBQUE7QUFDQSxVQUFBLE9BQUEsTUFBQSxRQUFBLEtBQUEsTUFBQSxFQUFBLEtBQUEsUUFBQSxRQUFBLE9BQUEsZ0JBQUEsRUFBQSxDQUFBO0FBRUEsVUFBQSxLQUFBLFdBQUEsR0FBQTtBQUNBLGdCQUFBLEtBQUEsT0FBQSxFQUFBLEtBQUEsUUFBQSxRQUFBLE9BQUEsZ0JBQUEsR0FBQSxPQUFBLEdBQUEsUUFBQSxLQUFBLENBQUE7QUFBQSxNQUNBO0FBQUEsSUFDQSxDQUFBO0FBRUEsWUFBQSxLQUFBLFVBQUEsWUFBQSxPQUFBLE9BQUEsWUFBQSxRQUFBO0FBQ0EsVUFBQSxXQUFBLFdBQUEsY0FBQSxJQUFBLEtBQUE7QUFDQSxjQUFBLG1CQUFBO0FBQUEsTUFDQTtBQUFBLElBQ0EsQ0FBQTtBQUVBLFlBQUEsU0FBQSxVQUFBLFlBQUEsT0FBQSxZQUFBO0FBQ0EsVUFBQSxZQUFBLFlBQUE7QUFDQSxZQUFBLE9BQUEsTUFBQSxjQUFBO0FBRUEsWUFBQSxlQUFBLEtBQUEsT0FBQSxDQUFBLFFBQUE7QUFDQSxjQUFBLElBQUEsVUFBQSxjQUFBLFFBQUE7QUFBQSxRQUNBLENBQUE7QUFFQSxZQUFBLGFBQUEsV0FBQSxFQUFBO0FBRUEsY0FBQSxnQkFBQSxZQUFBO0FBQUEsTUFDQTtBQUVBLFVBQUEsWUFBQSxnQkFBQTtBQUNBLGNBQUEsY0FBQTtBQUFBLE1BQ0E7QUFBQSxJQUNBLENBQUE7QUFBQSxFQUNBLENBQUE7OztBQ3pDQSxN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
