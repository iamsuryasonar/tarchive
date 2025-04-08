export async function getOpenedTabs() {
    let tabs = await chrome.tabs.query({});
    let dashboardTab = await getDashboardTab();
    let filteredTabs = tabs.filter((tab) => tab.id !== dashboardTab?.id);
    return filteredTabs;
}

export async function addTabsToBucket(tabs) {
    /*
        1. generate unique id
        2. create bucket object
        3. remove unchecked tabs
        4. get all buckets in local storage
        5. push the bucket to buckets
        6. reload or open buckets page
    */

    if (tabs.length === 0) return;

    let randomId = crypto.randomUUID();

    let bucket = {
        id: randomId,
        name: randomId.slice(0, 8),
        createdAt: new Date().toISOString(),
        tabs: tabs,
    }

    let result = await chrome.storage.local.get(["allBuckets"]);
    let prevBuckets = result.allBuckets || [];

    prevBuckets.push(bucket);

    await chrome.storage.local.set({ allBuckets: prevBuckets });
}

export async function deleteBucket(id) {
    let result = await chrome.storage.local.get(["allBuckets"]);
    let prevBuckets = result.allBuckets || [];
    prevBuckets = prevBuckets.filter(bucket => bucket.id !== id);
    await chrome.storage.local.set({ allBuckets: prevBuckets });
}

export async function renameBucketName(id, name) {
    let result = await chrome.storage.local.get(["allBuckets"]);
    let prevBuckets = result.allBuckets || [];
    prevBuckets = prevBuckets.map(bucket => {
        if (bucket.id === id) {
            bucket.name = name;
        }

        return bucket;
    });
    await chrome.storage.local.set({ allBuckets: prevBuckets });
}

export async function getBucketsFromLocal() {
    let result = await chrome.storage.local.get(["allBuckets"]);
    const prevBuckets = result.allBuckets || [];
    prevBuckets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return prevBuckets;
}

export async function getDashboardTab() {
    let dashboardTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("dashboard.html") });
    return dashboardTabs[0];
}

export async function createReloadDashboard() {
    let tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("dashboard.html") });

    if (tabs.length === 0) {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html"), index: 0, pinned: true });
    } else {
        chrome.tabs.reload(tabs[0].id);
        chrome.tabs.update(tabs[0].id, { active: true });
    }
}

export async function openDashboard() {
    let tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("dashboard.html") });

    if (tabs.length === 0) {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html"), index: 0, pinned: true });
    } else {
        chrome.tabs.update(tabs[0].id, { active: true });
    }
}

export function openTabs(tabs) {
    tabs.forEach((tab) => {
        chrome.tabs.create({ url: tab.url });
    })
}

