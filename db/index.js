const DB_NAME = 'TarchiveDB';
import { filterTabs } from '../services';
import { defaultWorkspaces } from '../utils/constants/index';
const BUCKET_STORE_NAME = 'buckets';
const SETTINGS_STORE_NAME = 'settings';
const SESSION_STORE_NAME = 'session';
const DB_VERSION = 1;
let debounceTimer = null;

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

            if (!db.objectStoreNames.contains(SESSION_STORE_NAME)) {
                db.createObjectStore(SESSION_STORE_NAME, { keyPath: "key" });
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

    let filteredTabs = tabs.filter((tab) => {
        if (tab.checked !== false) return tab;
    });

    if (filteredTabs.length === 0) return; // return if no tabs

    const id = crypto.randomUUID();
    const bucket = {
        id,
        name: id.slice(0, 8),
        createdAt: new Date().toISOString(),
        tabs: filteredTabs,
        tag: [defaultWorkspaces.ALL],
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
    const req = await store.get(id);

    req.onsuccess = () => {
        const data = req.result;

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

export async function deleteTab(tabId, bucketId) {
    const db = await openDB();
    const tx = db.transaction(BUCKET_STORE_NAME, 'readwrite');
    const store = tx.objectStore(BUCKET_STORE_NAME);
    const req = store.get(bucketId);

    req.onsuccess = async () => {
        const data = req.result;
        if (data?.tabs?.length === 1) {
            store.delete(bucketId);
            return;
        }
        data.tabs = data.tabs.filter((tab) => tab.id !== tabId);
        store.put(data);
    };
}

export async function saveSetting(key, value) {
    const db = await openDB();
    const tx = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE_NAME);

    const setting = { key, value };
    store.put(setting);
}

export async function getSetting(key) {
    const db = await openDB();
    const tx = db.transaction(SETTINGS_STORE_NAME, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE_NAME);

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

export async function updateIsAllowPinnedTab(value) {
    await saveSetting('IS_ALLOW_PINNED_TAB', value);
}

export async function getIsAllowPinnedTab() {
    return await getSetting('IS_ALLOW_PINNED_TAB');
}

export async function saveLastSession(tabs) {
    tabs = await filterTabs(tabs)
    const db = await openDB();
    const tx = db.transaction(SESSION_STORE_NAME, "readwrite");
    const store = tx.objectStore(SESSION_STORE_NAME);

    await store.clear();

    store.put({ key: "lastSession", tabs });
}

export function debounceSaveSession(tabs, delay = 1000) {
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
        await saveLastSession(tabs);
    }, delay);
}

export async function getLastSession() {
    const db = await openDB();
    const tx = db.transaction(SESSION_STORE_NAME, 'readonly');
    const store = tx.objectStore(SESSION_STORE_NAME);

    return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

export async function exportAllDataAsJson() {
    const db = await openDB();

    const getAllFromStore = (storeName) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    };

    const buckets = await getAllFromStore(BUCKET_STORE_NAME);
    const settings = await getAllFromStore(SETTINGS_STORE_NAME);

    const data = {
        buckets,
        settings,
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `tarchive-export-${data.exportedAt}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export async function importAllDataFromJSON(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);

                if (!data.buckets || !data.settings) {
                    throw new Error('Invalid JSON structure');
                }

                const db = await openDB();

                const tx = db.transaction([BUCKET_STORE_NAME, SETTINGS_STORE_NAME], 'readwrite');
                const bucketStore = tx.objectStore(BUCKET_STORE_NAME);
                const settingStore = tx.objectStore(SETTINGS_STORE_NAME);

                bucketStore.clear();
                settingStore.clear();

                data?.buckets?.forEach(bucket => {
                    bucketStore.put(bucket);
                });

                data?.settings?.forEach(setting => {
                    settingStore.put(setting);
                });

                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);

            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = () => reject(reader.error);

        reader.readAsText(file);
    });
}

