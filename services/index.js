import { browser } from 'wxt/browser';

export async function getOpenedTabs() {
    let IS_GET_PINNED = false; // todo - get this from local storage, make it configurable in settings
    let tabs = await browser.tabs.query({ pinned: IS_GET_PINNED });
    let dashboardTab = await getDashboardTab();
    let filteredTabs = tabs.filter((tab) => tab.id !== dashboardTab?.id);
    return filteredTabs;
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
