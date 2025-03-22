// onboarding 
chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL("../page/buckets_page/buckets.html"), index: 0, pinned: true });
    }
});

chrome.runtime.onStartup.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("../page/buckets_page/buckets.html"), index: 0, pinned: true });
});