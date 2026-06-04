// IndexedDB persistence for uploaded files and generated content.
// Files are stored as Blob (binary), so they survive page refresh.
// Content (flashcards / notes / quiz JSON) is stored alongside.

const DB_NAME = 'StudyTrainerDB';
const DB_VERSION = 1;

let _db: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return _db;
  _db = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('files')) {
        const store = db.createObjectStore('files', { keyPath: 'id' });
        store.createIndex('bySubject', 'subjectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('content')) {
        db.createObjectStore('content', { keyPath: 'id' });
      }
    };
    req.onsuccess  = () => resolve(req.result);
    req.onerror    = () => { _db = null; reject(req.error); };
    req.onblocked  = () => { _db = null; reject(new Error('IDB blocked')); };
  });
  return _db;
}

// ── Files ──────────────────────────────────────────────────────────────────────

export interface StoredFile {
  id:        string;
  subjectId: string;
  name:      string;
  type:      string;
  size:      number;
  level:     string;
  blob:      Blob;
}

export async function saveFile(file: StoredFile): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(file);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getFiles(subjectId: string): Promise<StoredFile[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('files', 'readonly');
    const req = tx.objectStore('files').index('bySubject').getAll(subjectId);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteFile(fileId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').delete(fileId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Generated content ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveContent(subjectId: string, content: Record<string, any>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('content', 'readwrite');
    tx.objectStore('content').put({ id: subjectId, ...content });
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getContent(subjectId: string): Promise<Record<string, any> | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('content', 'readonly');
    const req = tx.objectStore('content').get(subjectId);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
