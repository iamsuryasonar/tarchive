chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL("../pages/dashboard/dashboard.html"), index: 0, pinned: true });
    }
});

chrome.runtime.onStartup.addListener(async () => {
    let tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("../pages/dashboard/dashboard.html") });

    if (tabs.length === 0) {
        chrome.tabs.create({ url: chrome.runtime.getURL("../pages/dashboard/dashboard.html"), index: 0, pinned: true });
    }
});