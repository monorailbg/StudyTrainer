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

export type FolderKind = 'file' | 'card' | 'note' | 'quiz';

export interface CloudFolder {
  id:        string;
  subjectId: string;
  kind:      FolderKind;
  name:      string;
  createdAt: number;
}

export interface CloudFile {
  id:         string;
  subjectId:  string;
  name:       string;
  type:       string;
  size:       number;
  level:      string;
  storageUrl: string;
  createdAt:  number;
  folderId?:  string | null;
}

export interface CloudNote {
  id:        string;
  subjectId: string;
  name:      string;
  createdAt: number;
  note:      GeneratedNote;
  folderId?: string | null;
}

export interface CloudFlashcardSet {
  id:        string;
  subjectId: string;
  name:      string;
  createdAt: number;
  cards:     GeneratedFlashcard[];
  folderId?: string | null;
}

export interface CloudQuiz {
  id:        string;
  subjectId: string;
  name:      string;
  createdAt: number;
  questions: GeneratedQuizQuestion[];
  folderId?: string | null;
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
  let error: unknown;
  try {
    const result = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    error = result.error;
  } catch (fetchErr) {
    // fetch() threw — Supabase is unreachable. Log full details for debugging.
    console.error('[Supabase] upload fetch failed:', fetchErr);
    const url = (import.meta.env.VITE_SUPABASE_URL as string) || '(not set)';
    throw new Error(
      `Cannot reach Supabase (${url.slice(0, 40)}). ` +
      'Check: 1) Supabase project is not paused, 2) VITE_SUPABASE_URL is correct in Vercel env vars, 3) bucket "studytrainer" exists.',
    );
  }
  if (error) {
    console.error('[Supabase] upload error:', error);
    const msg = (error as { message?: string }).message ?? String(error);
    if (msg.includes('row-level security') || msg.includes('Unauthorized') || msg.includes('403')) {
      throw new Error('Supabase RLS policy missing. Run supabase/storage-policy.sql in Supabase → SQL Editor to make the bucket publicly readable/writable.');
    }
    if (msg.includes('not found') || msg.includes('404') || msg.includes('Bucket')) {
      throw new Error(`Supabase bucket "${STORAGE_BUCKET}" not found. Create it in Supabase → Storage.`);
    }
    throw new Error(msg);
  }
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

// ── Folders CRUD ───────────────────────────────────────────────────────────

export async function saveCloudFolder(folder: CloudFolder): Promise<void> {
  await setDoc(doc(db(), 'folders', folder.id), folder);
}

export async function getCloudFolders(subjectId: string): Promise<CloudFolder[]> {
  return getBySubject<CloudFolder>('folders', subjectId);
}

export async function deleteCloudFolder(folderId: string): Promise<void> {
  await deleteDoc(doc(db(), 'folders', folderId));
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

// ── Quiz results CRUD ─────────────────────────────────────────────────────

export interface CloudQuizResultQuestion {
  questionId:    string;
  questionText:  string;
  userAnswer:    string;
  correctAnswer: string;
  wasCorrect:    boolean;
  options:       string[];
  explanation?:  string;
}

export interface CloudQuizResult {
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
  questions:        CloudQuizResultQuestion[];
}

export async function saveCloudQuizResult(result: CloudQuizResult): Promise<void> {
  await setDoc(doc(db(), 'quizResults', result.id), result);
}

export async function getCloudQuizResults(subjectId: string): Promise<CloudQuizResult[]> {
  const items = await getBySubject<CloudQuizResult>('quizResults', subjectId);
  return items.sort((a, b) => b.completedAt - a.completedAt);
}

export async function getAllCloudQuizResults(): Promise<CloudQuizResult[]> {
  const items = await getAll<CloudQuizResult>('quizResults');
  return items.sort((a, b) => b.completedAt - a.completedAt);
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

// Backfills any locally-stored file that never made it into shared cloud
// storage — e.g. uploaded before Supabase was configured, or a previous
// upload attempt that failed silently — so it becomes visible to every
// other user instead of staying stuck on the one browser that uploaded it.
//
// Deliberately NOT gated by a one-time "already migrated" flag like
// migrateSubjectFromIndexedDB above: a transient failure (network blip,
// Supabase hiccup) must be retryable on the next visit, not permanently
// skipped because an unrelated migration flag got set first. It's cheap to
// re-run — once every local file has a matching cloud record, there's
// nothing left to upload and this is a single no-op Firestore query.
export interface BackfillResult {
  attempted: number;
  migrated:  number;
  /** Human-readable reason nothing was attempted (e.g. Supabase not configured, no local files). Undefined when files were actually attempted. */
  skippedReason?: string;
  /** First error message seen, useful for surfacing a toast without needing devtools. */
  lastError?: string;
}

export async function backfillLocalFilesToCloud(subjectId: string): Promise<BackfillResult> {
  if (!isSupabaseConfigured) return { attempted: 0, migrated: 0, skippedReason: 'Supabase not configured' };

  try {
    const idb = await import('./db');
    const idbFiles = await idb.getFiles(subjectId);
    if (idbFiles.length === 0) return { attempted: 0, migrated: 0, skippedReason: 'no local files for this subject' };

    const existingCloudIds = new Set((await getCloudFiles(subjectId)).map(f => f.id));
    const toMigrate = idbFiles.filter(f => !existingCloudIds.has(f.id));
    if (toMigrate.length === 0) return { attempted: 0, migrated: 0, skippedReason: 'already in sync' };

    let migrated = 0;
    let lastError: string | undefined;
    await Promise.all(toMigrate.map(async f => {
      try {
        const blobFile = new File([f.blob], f.name, { type: f.type });
        const storageUrl = await uploadFileToStorage(subjectId, f.id, blobFile);
        await saveCloudFile({
          id: f.id, subjectId, name: f.name, type: f.type, size: f.size,
          level: f.level, storageUrl, createdAt: Date.now(), folderId: f.folderId ?? null,
        });
        migrated++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn('[backfillLocalFilesToCloud] Failed to migrate file', f.name, '—', errMsg);
        lastError = errMsg;
      }
    }));
    return { attempted: toMigrate.length, migrated, lastError };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn('[backfillLocalFilesToCloud] Failed for subject', subjectId, '—', errMsg);
    return { attempted: 0, migrated: 0, lastError: errMsg };
  }
}
