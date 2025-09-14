import { browser } from "wxt/browser";
import { addTabsToBucket } from "../db";
import { ensureDashboardFirst, getOpenedTabs, openDashboard, updateLastSession } from "../services";

export default defineBackground(() => {
  browser.sessions.getRecentlyClosed({}, async (sessions) => {
    await updateLastSession(sessions);
  });

  browser.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
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