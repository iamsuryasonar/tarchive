document.addEventListener("DOMContentLoaded", async () => {

    chrome.storage.local.get(["allBuckets"], (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error retrieving data:", chrome.runtime.lastError);
        } else {

            const prevBuckets = result.allBuckets || [];

            if (prevBuckets.length === 0) {

                const h1 = document.querySelector("h1");

                const info = createEl("p", 'info');
                info.textContent = 'You have no buckets, yet!';

                h1.insertAdjacentElement("afterend", info);
                return;
            }

            prevBuckets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

            prevBuckets.forEach(bucket => {
                renderBucketCard(bucket);
            });
        }
    });
});

function reloadDashboardPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.reload(tabs[0].id);
        }
    });
}

function openTabs(tabs) {
    tabs.forEach((tab) => {
        chrome.tabs.create({ url: tab.url });
    })
}

async function deleteBucket(id, callback) {
    let result = await chrome.storage.local.get(["allBuckets"]);

    let prevBuckets = result.allBuckets || [];

    prevBuckets = prevBuckets.filter(bucket => bucket.id !== id);

    chrome.storage.local.set({ allBuckets: prevBuckets }, () => {
        callback();
    });
}

function renderBucketCard(bucket) {
    const { id, name, tabs } = bucket;

    const card = createEl('div', 'bucket_card');
    const headerDiv = createEl('div', 'header_div');
    const buttonGroup = createEl('div', 'button_group');
    const titleEl = createEl('p', 'bucket_name');
    titleEl.textContent = name;

    const openTabsButton = createEl('button', 'button');
    openTabsButton.textContent = 'open';
    openTabsButton.addEventListener('click', () => openTabs(tabs));

    const deleteButton = createEl('button', 'button');
    deleteButton.textContent = 'delete';
    deleteButton.addEventListener('click', () => deleteBucket(id, reloadDashboardPage));

    buttonGroup.append(openTabsButton, deleteButton);
    headerDiv.append(titleEl, buttonGroup);

    card.appendChild(headerDiv);

    tabs.forEach(({ url, title }) => {
        const li = createBucketItemEl(url, title);
        card.appendChild(li);
    });

    document.getElementById("bucketList").appendChild(card);
}

const createEl = (tag, className) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
};

function createBucketItemEl(url, title) {
    const li = document.createElement("li");

    const anchorTag = `
        <a href = ${url} target = '_blank' > ${title}</ >
    `
    li.innerHTML = anchorTag;
    return li;
}
