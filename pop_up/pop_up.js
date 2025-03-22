document.addEventListener("DOMContentLoaded", async () => {

    const addToBucketButton = document.querySelector("#add_to_bucket");
    const viewBucketsButton = document.querySelector("#view_buckets");
    const tabsEl = document.getElementById("tabs");

    const tabs = await getAllTabs();

    const elements = new Set();

    for (const tab of tabs) {
        if (!tab?.title) continue;

        const title = tab.title.split("-")[0].trim();
        const pathname = new URL(tab.url);

        let tabEl = createTabEl(title, pathname);

        tabEl.addEventListener("click", () => (goToTabHandler(tab)));

        elements.add(tabEl);
    }

    tabsEl.append(...elements);

    addToBucketButton.addEventListener("click", addTabsToBucketHandler);
    viewBucketsButton.addEventListener("click", openBucketsPageHandler);

    async function goToTabHandler(tab) {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
    }

    async function addTabsToBucketHandler() {
        /*
            1. generate unique id
            2. create bucket object
            3. remove buckets page from tabs
            4. get all buckets in local storage
            5. push the bucket to buckets
            6. reload or open buckets page
        */

        let randomId = crypto.randomUUID();

        let buckets = {
            id: randomId,
            name: randomId.slice(0, 8),
            tabs: tabs,
        }

        let bucketTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("../page/buckets_page/buckets.html") });

        buckets.tabs = buckets.tabs.filter((tab) => {
            return tab.id !== bucketTabs[0]?.id;
        });

        let result = await chrome.storage.local.get(["allBuckets"]);
        let prevBuckets = result.allBuckets || [];

        prevBuckets.push(buckets);

        chrome.storage.local.set({ allBuckets: prevBuckets }, async () => {
            let tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("../page/buckets_page/buckets.html") });

            if (tabs.length > 0) {
                chrome.tabs.reload(tabs[0].id);
                chrome.tabs.update(tabs[0].id, { active: true });
            } else {
                chrome.tabs.create({ url: chrome.runtime.getURL("../page/buckets_page/buckets.html"), index: 0, pinned: true });
            }
        });
    }

    async function openBucketsPageHandler() {
        let tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("../page/buckets_page/buckets.html") });

        if (tabs.length > 0) {
            await chrome.tabs.update(tabs[0].id, { active: true });
        } else {
            await chrome.tabs.create({ url: chrome.runtime.getURL("../page/buckets_page/buckets.html"), index: 0, pinned: true });
        }
    }

    async function getAllTabs() {
        let tabs = await chrome.tabs.query({});
        return tabs;
    }

    function createTabEl(title, url) {
        let titleEl = document.createElement('h3');
        let pathEl = document.createElement('p');
        let anchorEl = document.createElement('a');
        let listItemEl = document.createElement('li');

        titleEl.setAttribute('class', 'title')
        pathEl.setAttribute('class', 'path_name');

        titleEl.textContent = title;
        pathEl.textContent = url;

        anchorEl.appendChild(titleEl);
        anchorEl.appendChild(pathEl);
        listItemEl.appendChild(anchorEl)

        return listItemEl;
    }
});
