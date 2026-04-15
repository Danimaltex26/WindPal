// IndexedDB wrapper for offline photo queue
const DB_NAME = 'windpal-offline';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode = 'readonly') {
  const transaction = db.transaction(STORE_NAME, mode);
  return transaction.objectStore(STORE_NAME);
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Add a queued item: { id, files (as base64), analysis_type, status, created_at, result, error }
export async function addToQueue(item) {
  const db = await openDb();
  const store = tx(db, 'readwrite');
  await promisify(store.put(item));
  db.close();
}

// Get all queue items, sorted by created_at desc
export async function getQueue() {
  const db = await openDb();
  const store = tx(db);
  const items = await promisify(store.getAll());
  db.close();
  return items.sort((a, b) => b.created_at - a.created_at);
}

// Get items by status
export async function getQueueByStatus(status) {
  const db = await openDb();
  const store = tx(db);
  const index = store.index('status');
  const items = await promisify(index.getAll(status));
  db.close();
  return items;
}

// Update an item
export async function updateQueueItem(id, updates) {
  const db = await openDb();
  const store = tx(db, 'readwrite');
  const item = await promisify(store.get(id));
  if (item) {
    Object.assign(item, updates);
    await promisify(store.put(item));
  }
  db.close();
}

// Remove an item
export async function removeFromQueue(id) {
  const db = await openDb();
  const store = tx(db, 'readwrite');
  await promisify(store.delete(id));
  db.close();
}

// Get pending count
export async function getPendingCount() {
  const items = await getQueueByStatus('pending');
  return items.length;
}

// Get completed count (unviewed)
export async function getCompletedCount() {
  const items = await getQueueByStatus('completed');
  return items.length;
}

// Convert File to base64 for IndexedDB storage
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Convert base64 back to File for upload
export function base64ToFile(b64obj) {
  const arr = b64obj.data.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], b64obj.name, { type: mime });
}
