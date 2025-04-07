document.addEventListener("DOMContentLoaded", async () => {
    try {

        const addToBucketButton = document.getElementById("add_to_bucket");
        const viewBucketsButton = document.getElementById("view_buckets");
        const selectAllInput = document.getElementById("select_all");
        const tabsEl = document.getElementById("tabs");

        addToBucketButton.addEventListener("click", addTabsToBucket);
        viewBucketsButton.addEventListener("click", openDashboard);
        selectAllInput.addEventListener("change", onSelectAllTabs);

        tabsEl.addEventListener("change", onInputChange);
        tabsEl.addEventListener("click", onTabClicked);

        let tabs;

        async function initialize() {
            tabs = await getAllTabs();
            tabs = selectAllTabs();
            tabs = await removeDashboardTab();

            renderTabs(tabs);
        }

        initialize();

        async function getAllTabs() {
            let tabs = await chrome.tabs.query({});
            return tabs;
        }

        function selectAllTabs() {
            // initially selecting all tabs
            tabs.forEach(tab => {
                tab.checked = true;
            });

            selectAllInput.checked = true;
            return tabs;
        }

        async function removeDashboardTab() {
            // not required to add dashboard tab to bucket
            let relatedTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("../pages/dashboard/dashboard.html") });

            return tabs.filter((tab) => {
                return tab.id !== relatedTabs[0]?.id;
            });
        }

        async function addTabsToBucket() {
            /*
                1. generate unique id
                2. create bucket object
                3. remove non checked tabs
                4. get all buckets in local storage
                5. push the bucket to buckets
                6. reload or open buckets pages
            */

            let randomId = crypto.randomUUID();

            let bucket = {
                id: randomId,
                name: randomId.slice(0, 8),
                createdAt: new Date().toISOString(),
                tabs: tabs,
            }

            bucket.tabs = bucket.tabs.filter((tab) => {
                return tab?.checked;
            });

            //todo -  also remove empty tabs

            if (bucket.tabs.length === 0) return;

            let result = await chrome.storage.local.get(["allBuckets"]);
            let prevBuckets = result.allBuckets || [];

            prevBuckets.push(bucket);

            chrome.storage.local.set({ allBuckets: prevBuckets }, async () => {
                let tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("../pages/dashboard/dashboard.html") });

                if (tabs.length === 0) {
                    chrome.tabs.create({ url: chrome.runtime.getURL("../pages/dashboard/dashboard.html"), index: 0, pinned: true });
                } else {
                    chrome.tabs.reload(tabs[0].id);
                    chrome.tabs.update(tabs[0].id, { active: true });
                }
            });
        }

        async function openDashboard() {
            let tabs = await chrome.tabs.query({ url: chrome.runtime.getURL("../pages/dashboard/dashboard.html") });

            if (tabs.length === 0) {
                await chrome.tabs.create({ url: chrome.runtime.getURL("../pages/dashboard/dashboard.html"), index: 0, pinned: true });
            } else {
                await chrome.tabs.update(tabs[0].id, { active: true });
            }
        }

        function onSelectAllTabs(e) {
            tabs.forEach((tab) => {
                tab.checked = e.target.checked;
                return tab;
            })
            renderTabs(tabs);
        }

        async function goToTab(id, windowId) {
            await chrome.tabs.update(id, { active: true });
            await chrome.windows.update(windowId, { focused: true });
        }

        function onSelectTab(e) {
            let count = 0;

            tabs.forEach((tab) => {
                if (tab.url === e.target.id) {
                    tab.checked = e.target.checked;
                }
                if (tab.checked) {
                    count++;
                }
            })

            // update select all checkbox
            if (count === tabs.length) {
                selectAllInput.checked = true;
            } else {
                selectAllInput.checked = false;
            }
            renderTabs(tabs);
        }

        function renderTabs(tabs) {
            // for each tab in the browser window create a div 
            // append the div to the DOM

            const elements = [];

            for (const tab of tabs) {
                if (!tab?.title) continue;

                const title = tab.title.split("-")[0].trim();
                const pathname = new URL(tab.url);

                let newTab = {
                    ...tab,
                    title: title,
                    url: pathname,
                    checked: tab?.checked ? tab.checked : false,
                }

                let tabEl = createTabEl(newTab);

                elements.push(tabEl);
            }
            tabsEl.innerHTML = "";
            tabsEl.append(...elements);
        }

        function createTabEl({ title, checked, url, id, windowId }) {
            let tabEl = `
                <div class="header_div">
                    <input type="checkbox" id=${url} name=${title} ${checked ? "checked" : ""}/>
                    <div class="title_path_a" data-windowid=${windowId} data-tabid=${id}>
                        <h3 class="title">${title}</h3>
                        <p class="path_name">${url}</p>
                    </div>
                </div>
            `
            let liEl = document.createElement('li');
            liEl.innerHTML = tabEl;

            return liEl;
        }

        function onInputChange(e) {
            if (e.target.tagName === 'INPUT' && e.target.type === "checkbox") {
                onSelectTab(e);
            }
        }

        function onTabClicked(e) {
            if (e.target.tagName === 'INPUT' && e.target.type === "checkbox") return;

            let headerDiv = e.target.closest('.title_path_a');

            if (headerDiv) {
                let tabId = Number(headerDiv.dataset["tabid"]);
                let tabWindowId = Number(headerDiv.dataset["windowid"]);

                goToTab(tabId, tabWindowId);
            }
        }
    } catch (error) {
        console.log(error)
    }
});
