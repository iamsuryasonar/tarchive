const DB_NAME = 'TarchiveDB';
const BUCKET_STORE_NAME = 'buckets';
const SETTINGS_STORE_NAME = 'settings';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(BUCKET_STORE_NAME)) {
                db.createObjectStore(BUCKET_STORE_NAME, { keyPath: 'id' });
            }

            if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
                db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: "key" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllBuckets() {
    const db = await openDB();
    return new Promise((resolve) => {
        const tx = db.transaction(BUCKET_STORE_NAME, 'readonly');
        const store = tx.objectStore(BUCKET_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

export async function addTabsToBucket(tabs) {
    if (tabs.length === 0) return;

    const IS_DUPLICATE_TAB_ALLOWED = await getIsAllowDuplicateTab();

    let filteredTabs = tabs;

    if (!IS_DUPLICATE_TAB_ALLOWED) {
        const seen = new Set();
        filteredTabs = tabs.filter((tab) => {
            if (seen.has(tab.url)) {
                console.log('re', tab.url)
                return false;
            } else {
                seen.add(tab.url);
                console.log('add', tab.url)
                return true;
            }
        })
    }

    filteredTabs = filteredTabs.filter((tab) => {
        if (tab.checked !== false) return tab;
    });


    filteredTabs = filteredTabs.filter(tab => {
        return tab.url && !tab.url.match(/^(chrome|about):/);
    });

    if (filteredTabs.length === 0) return; // return if no tabs

    const id = crypto.randomUUID();
    const bucket = {
        id,
        name: id.slice(0, 8),
        createdAt: new Date().toISOString(),
        tabs: filteredTabs,
        tag: ['All'],
        isLocked: false,
    };

    const db = await openDB();
    const tx = db.transaction(BUCKET_STORE_NAME, 'readwrite');
    tx.objectStore(BUCKET_STORE_NAME).add(bucket);
}

export async function deleteBucket(id) {
    const buckets = await getAllBuckets();
    const bucket = buckets.find(b => b.id === id);
    if (bucket?.isLocked) return;
    const db = await openDB();
    const tx = db.transaction(BUCKET_STORE_NAME, 'readwrite');
    tx.objectStore(BUCKET_STORE_NAME).delete(id);
}

export async function renameBucketName(id, name) {
    const db = await openDB();
    const tx = db.transaction(BUCKET_STORE_NAME, 'readwrite');
    const store = tx.objectStore(BUCKET_STORE_NAME);
    const bucket = await store.get(id);

    bucket.onsuccess = () => {
        const data = bucket.result;
        if (data) {
            data.name = name;
            store.put(data);
        }
    };
}

export async function toggleBucketLock(id) {
    const db = await openDB();
    const tx = db.transaction(BUCKET_STORE_NAME, 'readwrite');
    const store = tx.objectStore(BUCKET_STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => {
        const data = req.result;
        if (data) {
            data.isLocked = !data?.isLocked;
            store.put(data);
        }
    };
}

export async function getAllWorkspaces() {
    const buckets = await getAllBuckets();
    buckets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const workspaces = {};

    buckets.forEach(bucket => {
        bucket?.tag?.forEach(tag => {
            if (!workspaces[tag]) workspaces[tag] = [];
            workspaces[tag].push(bucket);
        });
    });

    return workspaces;
}

export async function toggleTag(id, tag) {
    const db = await openDB();
    const tx = db.transaction(BUCKET_STORE_NAME, 'readwrite');
    const store = tx.objectStore(BUCKET_STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => {
        const data = req.result;
        if (data && !data.tag.includes(tag)) {
            data.tag.push(tag);
            store.put(data);
        } else {
            const index = data.tag.indexOf(tag);
            data.tag.splice(index, 1);
            store.put(data);
        }
    };
}

export async function saveSetting(key, value) {
    const db = await openDB();
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');

    const setting = { key, value };
    store.put(setting);
}

export async function getSetting(key) {
    const db = await openDB();
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');

    return new Promise((resolve, reject) => {
        const request = store.get(key);

        request.onsuccess = () => {
            resolve(request.result?.value ?? null);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function updateIsAllowDuplicateTab(value) {
    await saveSetting('IS_ALLOW_DUPLICATE_TAB', value);
}

export async function getIsAllowDuplicateTab() {
    return await getSetting('IS_ALLOW_DUPLICATE_TAB');
}
