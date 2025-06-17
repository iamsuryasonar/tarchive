import { browser } from 'wxt/browser';

export async function getOpenedTabs() {
    let IS_GET_PINNED = false; // todo - get this from local storage, make it configurable in settings
    let tabs = await browser.tabs.query({ pinned: IS_GET_PINNED });
    let dashboardTab = await getDashboardTab();
    let filteredTabs = tabs.filter((tab) => tab.id !== dashboardTab?.id);
    return filteredTabs;
}

export async function addTabsToBucket(tabs) {
    const IS_DUPLICATE_ALLOWED = false; // todo - get this from local storage, make it configurable in settings
    /*
        1. generate unique id
        2. create bucket object
        3. remove unchecked tabs
        4. get all buckets in local storage
        5. push the bucket to buckets
        6. reload or open buckets page
    */
    if (tabs.length === 0) return;

    let filteredTabs = tabs;

    if (!IS_DUPLICATE_ALLOWED) {
        let set = new Set();

        filteredTabs = tabs.filter((tab) => {
            if (set.has(tab.url)) {
                return false;
            } else {
                set.add(tab.url);
                return true;
            }
        })
    }

    let randomId = crypto.randomUUID();

    let bucket = {
        id: randomId,
        name: randomId.slice(0, 8),
        createdAt: new Date().toISOString(),
        tabs: filteredTabs,
    }

    let result = await browser.storage.local.get(["allBuckets"]);
    let prevBuckets = result.allBuckets || [];

    prevBuckets.push(bucket);

    await browser.storage.local.set({ allBuckets: prevBuckets });
}

export async function deleteBucket(id) {
    let result = await browser.storage.local.get(["allBuckets"]);
    let prevBuckets = result.allBuckets || [];
    prevBuckets = prevBuckets.filter(bucket => {
        if (bucket.id === id && !bucket?.isLocked) return false;
        return true;
    });
    await browser.storage.local.set({ allBuckets: prevBuckets });
}

export async function renameBucketName(id, name) {
    let result = await browser.storage.local.get(["allBuckets"]);
    let prevBuckets = result.allBuckets || [];
    prevBuckets = prevBuckets.map(bucket => {
        if (bucket.id === id) {
            bucket.name = name;
        }

        return bucket;
    });
    await browser.storage.local.set({ allBuckets: prevBuckets });
}

export async function toggleBucketLock(id) {
    let result = await browser.storage.local.get(["allBuckets"]);
    let prevBuckets = result.allBuckets || [];

    let newBuckets = prevBuckets.map(bucket => {
        if (bucket.id === id) {
            bucket.isLocked = !bucket?.isLocked;
        }

        return bucket;
    });

    await browser.storage.local.set({ allBuckets: newBuckets });
}

export async function getBucketsFromLocal() {
    let result = await browser.storage.local.get(["allBuckets"]);
    const prevBuckets = result.allBuckets || [];
    prevBuckets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return prevBuckets;
}

export async function getDashboardTab() {
    let dashboardTabs = await browser.tabs.query({ url: browser.runtime.getURL("dashboard.html") });
    return dashboardTabs[0];
}

export async function createReloadDashboard() {
    let tabs = await browser.tabs.query({ url: browser.runtime.getURL("dashboard.html") });

    if (tabs.length === 0) {
        browser.tabs.create({ url: browser.runtime.getURL("dashboard.html"), index: 0, pinned: true });
    } else {
        browser.tabs.reload(tabs[0].id);
        browser.tabs.update(tabs[0].id, { active: true });
    }
}

export async function openDashboard() {
    let tabs = await browser.tabs.query({ url: browser.runtime.getURL("dashboard.html") });

    if (tabs.length === 0) {
        browser.tabs.create({ url: browser.runtime.getURL("dashboard.html"), index: 0, pinned: true });
    } else {
        browser.tabs.update(tabs[0].id, { active: true });
    }
}

export function openCurrentTab(id) {
    browser.tabs.update(id, { active: true });
}

export function openTabs(tabs) {
    tabs.forEach((tab) => {
        browser.tabs.create({ url: tab.url });
    })
}

export async function openTabGroup(bucket) {
    Promise.all(
        bucket.tabs.map(tab => new Promise((resolve) => {
            browser.tabs.create({ url: tab.url }, resolve);
        }))
    ).then((tabs) => {
        const tabIds = tabs.map(tab => tab.id);

        browser.tabs.group({ tabIds: tabIds }, (groupId) => {
            browser.tabGroups.update(groupId, {
                title: bucket.name,
                color: bucket?.color ? bucket.color : 'blue',
            });
        });
    });
}
