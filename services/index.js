import { browser } from 'wxt/browser';
import { addTabsToBucket, deleteLastSession, getIsAllowDuplicateTab, getIsAllowPinnedTab } from '../db';
import { defaultWorkspaces } from '../utils/constants';

export async function filterTabs(tabs) {
    const IS_ALLOW_PINNED = await getIsAllowPinnedTab();
    const IS_DUPLICATE_TAB_ALLOWED = await getIsAllowDuplicateTab();

    let filteredTabs = tabs?.filter(tab => {
        const url = tab.url || "";
        return (
            url !== "" &&
            !url.startsWith("chrome://") &&
            !url.startsWith("chrome-extension://") &&
            !url.startsWith("about:")
        );
    });

    filteredTabs = filteredTabs?.filter(tab => {
        if (!tab?.pinned) {
            return true;
        }

        return tab?.pinned === IS_ALLOW_PINNED;
    });

    if (!IS_DUPLICATE_TAB_ALLOWED) {
        const seen = new Set();
        filteredTabs = filteredTabs.filter((tab) => {
            if (seen.has(tab.url)) {
                return false;
            } else {
                seen.add(tab.url);
                return true;
            }
        })
    }

    return filteredTabs;
}

export async function getOpenedTabs() {
    let tabs = await browser.tabs.query({});
    return await filterTabs(tabs);
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

export async function openTabInWindow(bucket) {
    browser.windows.create({
        url: bucket.tabs.map((tab) => tab.url),
        focused: true,
    });
}

export async function ensureDashboardFirst() {
    const tabs = await browser.tabs.query({ url: browser.runtime.getURL("dashboard.html") });
    if (tabs.length === 0) {
        await browser.tabs.create({ url: browser.runtime.getURL("dashboard.html"), index: 0, pinned: true });
    } else {
        const dashboardTab = tabs[0];
        if (dashboardTab.index !== 0) {
            await browser.tabs.move(dashboardTab.id, { index: 0 });
        }
    }
}

/* ----- last session ----- */
function extractTabsFromSession(data) {
    const tabs = [];

    data.forEach(item => {
        if (item.tab) {
            tabs.push(item.tab);
        } else if (item.window && Array.isArray(item.window.tabs)) {
            tabs.push(...item.window.tabs);
        }
    });

    return tabs;
}

export async function updateLastSession(sessions) {
    const allTabs = extractTabsFromSession(sessions);
    await deleteLastSession();
    const filteredTabs = await filterTabs(allTabs);
    if (filteredTabs?.length) {
        addTabsToBucket(filteredTabs, defaultWorkspaces.LAST_SESSION);
    }
}