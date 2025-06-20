import { addTabsToBucket, saveCurrentSession } from "../db";
import { getOpenedTabs, openDashboard } from "../services";
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
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