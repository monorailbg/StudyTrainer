/**
 * Cloud persistence layer.
 *
 * Firestore (Firebase) stores structured metadata:
 *   /uploadedFiles/{fileId}       – file metadata + Supabase storage URL
 *   /notes/{noteId}               – GeneratedNote + metadata
 *   /flashcardSets/{setId}        – GeneratedFlashcard[] + metadata
 *   /quizzes/{quizId}             – GeneratedQuizQuestion[] + metadata
 *
 * Supabase Storage holds file bytes at: study-files/files/{subjectId}/{fileId}
 */

import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where,
  type Firestore,
} from 'firebase/firestore';
import type { GeneratedFlashcard, GeneratedNote, GeneratedQuizQuestion } from './generator';
import { firebaseDb, isFirebaseConfigured } from './firebase';
import { supabase, isSupabaseConfigured, STORAGE_BUCKET } from './supabase';

// Re-export so callers can gate on cloud features without importing individual lib files.
export { isFirebaseConfigured, isSupabaseConfigured };

// ── Cloud document types ───────────────────────────────────────────────────

export interface CloudFile {
  id:         string;
  subjectId:  string;
  name:       string;
  type:       string;
  size:       number;
  level:      string;
  storageUrl: string;
  createdAt:  number;
}

export interface CloudNote {
  id:        string;
  subjectId: string;
  name:      string;
  createdAt: number;
  note:      GeneratedNote;
}

export interface CloudFlashcardSet {
  id:        string;
  subjectId: string;
  name:      string;
  createdAt: number;
  cards:     GeneratedFlashcard[];
}

export interface CloudQuiz {
  id:        string;
  subjectId: string;
  name:      string;
  createdAt: number;
  questions: GeneratedQuizQuestion[];
}

// ── Internal helpers ───────────────────────────────────────────────────────

function db(): Firestore {
  if (!firebaseDb) throw new Error('Firebase not configured');
  return firebaseDb;
}

async function getAll<T>(col: string): Promise<T[]> {
  const snap = await getDocs(collection(db(), col));
  return snap.docs.map(d => d.data() as T);
}

async function getBySubject<T>(col: string, subjectId: string): Promise<T[]> {
  const snap = await getDocs(query(collection(db(), col), where('subjectId', '==', subjectId)));
  return snap.docs.map(d => d.data() as T);
}

// ── File storage (Supabase) ────────────────────────────────────────────────

export async function uploadFileToStorage(subjectId: string, fileId: string, file: File): Promise<string> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase Storage is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  const path = `files/${subjectId}/${fileId}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFileFromStorage(subjectId: string, fileId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const path = `files/${subjectId}/${fileId}`;
  await supabase.storage.from(STORAGE_BUCKET).remove([path]).catch(() => {});
}

// ── File metadata CRUD ─────────────────────────────────────────────────────

export async function saveCloudFile(file: CloudFile): Promise<void> {
  await setDoc(doc(db(), 'uploadedFiles', file.id), file);
}

export async function getCloudFiles(subjectId: string): Promise<CloudFile[]> {
  const items = await getBySubject<CloudFile>('uploadedFiles', subjectId);
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteCloudFile(subjectId: string, fileId: string): Promise<void> {
  await Promise.all([
    deleteDoc(doc(db(), 'uploadedFiles', fileId)),
    deleteFileFromStorage(subjectId, fileId),
  ]);
}

// ── Notes CRUD ─────────────────────────────────────────────────────────────

export async function saveCloudNote(note: CloudNote): Promise<void> {
  await setDoc(doc(db(), 'notes', note.id), note);
}

export async function getCloudNotes(subjectId: string): Promise<CloudNote[]> {
  const items = await getBySubject<CloudNote>('notes', subjectId);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllCloudNotes(): Promise<CloudNote[]> {
  const items = await getAll<CloudNote>('notes');
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteCloudNote(noteId: string): Promise<void> {
  await deleteDoc(doc(db(), 'notes', noteId));
}

export async function renameCloudNote(noteId: string, name: string): Promise<void> {
  const ref_ = doc(db(), 'notes', noteId);
  const snap = await getDoc(ref_);
  if (snap.exists()) await setDoc(ref_, { ...snap.data(), name });
}

// ── Flashcard sets CRUD ────────────────────────────────────────────────────

export async function saveCloudFlashcardSet(set: CloudFlashcardSet): Promise<void> {
  await setDoc(doc(db(), 'flashcardSets', set.id), set);
}

export async function getCloudFlashcardSets(subjectId: string): Promise<CloudFlashcardSet[]> {
  const items = await getBySubject<CloudFlashcardSet>('flashcardSets', subjectId);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllCloudFlashcardSets(): Promise<CloudFlashcardSet[]> {
  const items = await getAll<CloudFlashcardSet>('flashcardSets');
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteCloudFlashcardSet(setId: string): Promise<void> {
  await deleteDoc(doc(db(), 'flashcardSets', setId));
}

export async function renameCloudFlashcardSet(setId: string, name: string): Promise<void> {
  const ref_ = doc(db(), 'flashcardSets', setId);
  const snap = await getDoc(ref_);
  if (snap.exists()) await setDoc(ref_, { ...snap.data(), name });
}

// ── Quizzes CRUD ───────────────────────────────────────────────────────────

export async function saveCloudQuiz(quiz: CloudQuiz): Promise<void> {
  await setDoc(doc(db(), 'quizzes', quiz.id), quiz);
}

export async function getCloudQuizzes(subjectId: string): Promise<CloudQuiz[]> {
  const items = await getBySubject<CloudQuiz>('quizzes', subjectId);
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllCloudQuizzes(): Promise<CloudQuiz[]> {
  const items = await getAll<CloudQuiz>('quizzes');
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteCloudQuiz(quizId: string): Promise<void> {
  await deleteDoc(doc(db(), 'quizzes', quizId));
}

export async function renameCloudQuiz(quizId: string, name: string): Promise<void> {
  const ref_ = doc(db(), 'quizzes', quizId);
  const snap = await getDoc(ref_);
  if (snap.exists()) await setDoc(ref_, { ...snap.data(), name });
}

// ── IndexedDB → Firestore migration ───────────────────────────────────────
// Runs once per subject. Pushes any locally-generated content to Firestore
// so existing users don't lose their work when switching to cloud mode.

export async function migrateSubjectFromIndexedDB(subjectId: string): Promise<void> {
  const migKey = `firebase-migrated-${subjectId}`;
  if (localStorage.getItem(migKey)) return;

  try {
    // Lazy-import IndexedDB functions to avoid circular deps
    const idb = await import('./db');

    const [idbNotes, idbSets, idbQuizzes] = await Promise.all([
      idb.getNotes(subjectId),
      idb.getFlashcardSets(subjectId),
      idb.getQuizzes(subjectId),
    ]);

    await Promise.all([
      ...idbNotes.map(n => saveCloudNote({ id: n.id, subjectId, name: n.name, createdAt: n.createdAt, note: n.note }).catch(() => {})),
      ...idbSets.map(s => saveCloudFlashcardSet({ id: s.id, subjectId, name: s.name, createdAt: s.createdAt, cards: s.cards }).catch(() => {})),
      ...idbQuizzes.map(q => saveCloudQuiz({ id: q.id, subjectId, name: q.name, createdAt: q.createdAt, questions: q.questions }).catch(() => {})),
    ]);

    localStorage.setItem(migKey, '1');
  } catch {
    // Migration is best-effort — never block the app
  }
}
