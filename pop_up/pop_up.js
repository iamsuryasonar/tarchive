document.addEventListener("DOMContentLoaded", async () => {
    try {

        const addToBucketButton = document.querySelector("#add_to_bucket");
        const viewBucketsButton = document.querySelector("#view_buckets");
        const selectAllInput = document.querySelector("#select_all");
        const tabsEl = document.getElementById("tabs");

        let tabs = await getAllTabs();

        tabs.forEach(tab => {
            tab.checked = true;
        });

        selectAllInput.checked = true;

        let bucketTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("../page/buckets_page/buckets.html") });

        tabs = tabs.filter((tab) => {
            return tab.id !== bucketTabs[0]?.id;
        });

        renderTabs(tabs);

        addToBucketButton.addEventListener("click", addTabsToBucketHandler);
        viewBucketsButton.addEventListener("click", openBucketsPageHandler);
        selectAllInput.addEventListener("change", onSelectAllInputHandler);

        async function goToTabHandler(tab) {
            await chrome.tabs.update(tab.id, { active: true });
            await chrome.windows.update(tab.windowId, { focused: true });
        }

        async function addTabsToBucketHandler() {
            /*
                1. generate unique id
                2. create bucket object
                3. remove unchecked tabs
                4. get all buckets in local storage
                5. push the bucket to buckets
                6. reload or open buckets page
            */

            let randomId = crypto.randomUUID();

            let buckets = {
                id: randomId,
                name: randomId.slice(0, 8),
                createdAt: new Date().toISOString(),
                tabs: tabs,
            }

            buckets.tabs = buckets.tabs.filter((tab) => {
                return tab?.checked;
            });

            //todo -  also remove unused tabs

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

        function renderTabs() {
            const elements = new Set();

            for (const tab of tabs) {
                if (!tab?.title) continue;

                const title = tab.title.split("-")[0].trim();
                const pathname = new URL(tab.url);

                let tabEl = createTabEl(tab.checked, title, pathname);

                elements.add(tabEl);
            }
            tabsEl.innerHTML = "";
            tabsEl.append(...elements);
        }

        function createTabEl(checked = false, title, url) {
            let titleEl = document.createElement('h3');
            let pathEl = document.createElement('p');
            let anchorEl = document.createElement('a');
            let listItemEl = document.createElement('li');
            let inputDivEl = document.createElement('div');
            const checkboxEl = document.createElement("input");

            checkboxEl.type = "checkbox";
            checkboxEl.id = `${url}`;
            checkboxEl.name = `${title}`;
            checkboxEl.checked = checked;

            checkboxEl.addEventListener("change", onSelectInputHandler);

            titleEl.setAttribute('class', 'title');
            pathEl.setAttribute('class', 'path_name');

            titleEl.textContent = title;
            pathEl.textContent = url;

            anchorEl.setAttribute('class', 'title_path_a');
            anchorEl.appendChild(titleEl);
            anchorEl.appendChild(pathEl);

            anchorEl.addEventListener("click", () => goToTabHandler(tab));

            inputDivEl.setAttribute('class', 'header_div');
            inputDivEl.appendChild(checkboxEl);
            inputDivEl.appendChild(anchorEl);

            listItemEl.appendChild(inputDivEl);

            return listItemEl;
        }

        function onSelectAllInputHandler(e) {
            tabs.forEach((tab) => {
                tab.checked = e.target.checked;
                return tab;
            })
            renderTabs();
        }

        function onSelectInputHandler(e) {
            tabs.forEach((tab) => {
                if (tab.url === e.target.id) {
                    tab.checked = e.target.checked;
                }
            })
            renderTabs();
        }

    } catch (error) {
        console.log(error)
    }
});
