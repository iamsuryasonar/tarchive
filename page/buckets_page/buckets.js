document.addEventListener("DOMContentLoaded", async () => {

    chrome.storage.local.get(["allBuckets"], (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error retrieving data:", chrome.runtime.lastError);
        } else {

            const prevBuckets = result.allBuckets || [];

            if (prevBuckets.length === 0) {

                const h1 = document.querySelector("h1");

                const info = document.createElement("p");
                info.style.fontWeight = 'bold';
                info.style.fontSize = '1.4rem';
                info.style.marginTop = '4rem';
                info.style.placeSelf = 'center';
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

function reloadBucketsTab() {
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
    let card = document.createElement('div');
    card.setAttribute('class', 'bucket_card');

    let header_div = document.createElement('div');
    header_div.setAttribute('class', 'header_div');

    let button_group = document.createElement('div');
    button_group.setAttribute('class', 'button_group');

    const p = createBucketTitleEl(bucket.name);
    p.setAttribute('class', 'bucket_name');

    let openTabsButton = createButtonEl('open');
    openTabsButton.addEventListener('click', (e) => {
        openTabs(bucket.tabs);
    });

    let deleteBucketButton = createButtonEl('delete');
    deleteBucketButton.addEventListener('click', (e) => {
        deleteBucket(bucket.id, reloadBucketsTab);
    });

    button_group.appendChild(openTabsButton);
    button_group.appendChild(deleteBucketButton);

    header_div.appendChild(p);
    header_div.appendChild(button_group);

    card.appendChild(header_div);

    bucket.tabs.forEach(link => {
        let li = createBucketItemEl(link.url, link.title);
        card.appendChild(li);
    });

    const bucketList = document.getElementById("bucketList");
    bucketList.appendChild(card);
}

function createBucketTitleEl(name) {
    const title = document.createElement("p");
    title.textContent = name;
    title.style.margin = '4px';
    return title;
}

function createBucketItemEl(url, title) {
    const li = document.createElement("li");
    const a = document.createElement("a");

    a.href = url;
    a.textContent = title;
    a.target = "_blank";
    li.appendChild(a);
    return li;
}

function createButtonEl(textContent) {
    const button = document.createElement("button");
    button.setAttribute('class', 'button');
    button.textContent = textContent;
    return button
}
