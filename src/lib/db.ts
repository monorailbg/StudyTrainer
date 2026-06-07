// IndexedDB persistence for uploaded files and generated content.
// Files are stored as Blob (binary), so they survive page refresh.
// Content (flashcards / notes JSON) is stored alongside.
// Each generated quiz is stored as its own record in the `quizzes` store so a
// subject can keep a folder of "previous quizzes".

import type { GeneratedFlashcard, GeneratedNote, GeneratedQuizQuestion } from './generator';

const DB_NAME = 'StudyTrainerDB';
const DB_VERSION = 7;

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
      if (!db.objectStoreNames.contains('quizzes')) {
        const store = db.createObjectStore('quizzes', { keyPath: 'id' });
        store.createIndex('bySubject', 'subjectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('notes')) {
        const store = db.createObjectStore('notes', { keyPath: 'id' });
        store.createIndex('bySubject', 'subjectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('flashcardSets')) {
        const store = db.createObjectStore('flashcardSets', { keyPath: 'id' });
        store.createIndex('bySubject', 'subjectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('folders')) {
        const store = db.createObjectStore('folders', { keyPath: 'id' });
        store.createIndex('bySubject', 'subjectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('quizResults')) {
        const store = db.createObjectStore('quizResults', { keyPath: 'id' });
        store.createIndex('bySubject', 'subjectId', { unique: false });
        store.createIndex('byQuiz', 'quizId', { unique: false });
      }
      if (!db.objectStoreNames.contains('dictionaryEntries')) {
        const store = db.createObjectStore('dictionaryEntries', { keyPath: 'id' });
        store.createIndex('bySubject', 'subjectId', { unique: false });
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
  folderId?: string | null;
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

// ── Saved quizzes ────────────────────────────────────────────────────────────

export interface StoredQuiz {
  id:        string;
  subjectId: string;
  name:      string;
  createdAt: number;
  questions: GeneratedQuizQuestion[];
  folderId?: string | null;
}

export async function saveQuiz(quiz: StoredQuiz): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('quizzes', 'readwrite');
    tx.objectStore('quizzes').put(quiz);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getQuizzes(subjectId: string): Promise<StoredQuiz[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('quizzes', 'readonly');
    const req = tx.objectStore('quizzes').index('bySubject').getAll(subjectId);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteQuiz(quizId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('quizzes', 'readwrite');
    tx.objectStore('quizzes').delete(quizId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Saved notes ──────────────────────────────────────────────────────────────

export interface StoredNote {
  id:        string;
  subjectId: string;
  name:      string;
  createdAt: number;
  note:      GeneratedNote;
  folderId?: string | null;
}

export async function saveNote(note: StoredNote): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notes', 'readwrite');
    tx.objectStore('notes').put(note);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getNotes(subjectId: string): Promise<StoredNote[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('notes', 'readonly');
    const req = tx.objectStore('notes').index('bySubject').getAll(subjectId);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteNote(noteId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notes', 'readwrite');
    tx.objectStore('notes').delete(noteId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Saved flashcard sets ─────────────────────────────────────────────────────

export interface StoredFlashcardSet {
  id:        string;
  subjectId: string;
  name:      string;
  createdAt: number;
  cards:     GeneratedFlashcard[];
  folderId?: string | null;
}

export async function saveFlashcardSet(set: StoredFlashcardSet): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('flashcardSets', 'readwrite');
    tx.objectStore('flashcardSets').put(set);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getFlashcardSets(subjectId: string): Promise<StoredFlashcardSet[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('flashcardSets', 'readonly');
    const req = tx.objectStore('flashcardSets').index('bySubject').getAll(subjectId);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteFlashcardSet(setId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('flashcardSets', 'readwrite');
    tx.objectStore('flashcardSets').delete(setId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getAllFlashcardSets(): Promise<StoredFlashcardSet[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('flashcardSets', 'readonly');
    const req = tx.objectStore('flashcardSets').getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

export async function getAllNotes(): Promise<StoredNote[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('notes', 'readonly');
    const req = tx.objectStore('notes').getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

export async function getAllQuizzes(): Promise<StoredQuiz[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('quizzes', 'readonly');
    const req = tx.objectStore('quizzes').getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

// ── Folders ──────────────────────────────────────────────────────────────────
// User-created folders for organising files, flashcard sets, notes and quizzes.
// `kind` keeps each content type's folders separate.

export type FolderKind = 'file' | 'card' | 'note' | 'quiz';

export interface Folder {
  id:        string;
  subjectId: string;
  kind:      FolderKind;
  name:      string;
  createdAt: number;
}

export async function saveFolder(folder: Folder): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folders', 'readwrite');
    tx.objectStore('folders').put(folder);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getFolders(subjectId: string): Promise<Folder[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('folders', 'readonly');
    const req = tx.objectStore('folders').index('bySubject').getAll(subjectId);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteFolder(folderId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('folders', 'readwrite');
    tx.objectStore('folders').delete(folderId);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ── Quiz results ─────────────────────────────────────────────────────────────

export interface QuizResultQuestion {
  questionId:    string;
  questionText:  string;
  userAnswer:    string;   // text of the chosen option
  correctAnswer: string;   // text of the correct option
  wasCorrect:    boolean;
  options:       string[];
  explanation?:  string;
}

export interface QuizResult {
  id:               string;
  subjectId:        string;
  quizId:           string;
  quizTitle:        string;
  completedAt:      number;
  totalQuestions:   number;
  correctAnswers:   number;
  incorrectAnswers: number;
  scorePercent:     number;
  timeTakenSeconds: number;
  questions:        QuizResultQuestion[];
}

export async function saveQuizResult(result: QuizResult): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('quizResults', 'readwrite');
    tx.objectStore('quizResults').put(result);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getQuizResults(subjectId: string): Promise<QuizResult[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('quizResults', 'readonly');
    const req = tx.objectStore('quizResults').index('bySubject').getAll(subjectId);
    req.onsuccess = () => resolve((req.result ?? []).sort((a, b) => b.completedAt - a.completedAt));
    req.onerror   = () => reject(req.error);
  });
}

export async function getLatestQuizResult(subjectId: string, quizId: string): Promise<QuizResult | undefined> {
  const results = await getQuizResults(subjectId);
  return results.find(r => r.quizId === quizId);
}

export async function getAllQuizResults(): Promise<QuizResult[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('quizResults', 'readonly');
    const req = tx.objectStore('quizResults').getAll();
    req.onsuccess = () => resolve((req.result ?? []).sort((a, b) => b.completedAt - a.completedAt));
    req.onerror   = () => reject(req.error);
  });
}

// ── Dictionary entries ────────────────────────────────────────────────────────

export interface DictionaryEntry {
  id:               string;
  subjectId:        string;
  term:             string;
  definition:       string;
  folder?:          string;   // e.g. '翻訳' for Japanese entries
  sourceNoteTitle?: string;
  sourceNoteId?:    string;
  createdAt:        number;
}

export async function saveDictionaryEntry(entry: DictionaryEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('dictionaryEntries', 'readwrite');
    tx.objectStore('dictionaryEntries').put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getDictionaryEntries(subjectId: string): Promise<DictionaryEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction('dictionaryEntries', 'readonly');
    const req = tx.objectStore('dictionaryEntries').index('bySubject').getAll(subjectId);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteDictionaryEntry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('dictionaryEntries', 'readwrite');
    tx.objectStore('dictionaryEntries').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}
