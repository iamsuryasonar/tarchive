import { addTabsToBucket, deleteLastSession } from "../db";
import { ensureDashboardFirst, getOpenedTabs, openDashboard, saveCurrentSession, updateLastSessionFromCurrent } from "../services";

export default defineBackground(() => {
  // maintain currentSession on create
  browser.tabs.onCreated.addListener(() => {
    browser.tabs.query({}, tabs => saveCurrentSession(tabs));
  });

  // maintain currentSession on update
  browser.tabs.onUpdated.addListener(() => {
    browser.tabs.query({}, tabs => saveCurrentSession(tabs));
  });

  // maintain currentSession on removed
  browser.tabs.onRemoved.addListener((_, removeInfo) => {
    // don't update when window is closed instead of tab
    if (removeInfo.isWindowClosing) return;
    browser.tabs.query({}, tabs => saveCurrentSession(tabs));
  });

  // update lastSession when window closes except the last window
  browser.windows.onRemoved.addListener(async () => {
    const windows = await browser.windows.getAll();

    // when it is the last window async operation is not executed, so handling this update below on start up
    if (windows.length === 0) return;
    await deleteLastSession();
    await updateLastSessionFromCurrent();
  });

  // update lastSession, when it was closed and not update the it
  browser.runtime.onStartup.addListener(async () => {
    await deleteLastSession();
    await updateLastSessionFromCurrent();
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