import { addTabsToBucket, saveLastSession } from "../db";
import { ensureDashboardFirst, getOpenedTabs, openDashboard } from "../services";
import { browser } from 'wxt/browser';

export default defineBackground(() => {
  browser.runtime.onStartup.addListener(ensureDashboardFirst);

  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
      ensureDashboardFirst();
    }
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      let session = await getOpenedTabs();
      await browser.storage.local.set({ currSession: session });
    }
  });

  browser.windows.onRemoved.addListener(async (winId) => {
    const { currSession } = await browser.storage.local.get("currSession");
    await saveLastSession(currSession);
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