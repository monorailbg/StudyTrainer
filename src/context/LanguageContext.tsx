import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'ja';

const T = {
  en: {
    // Nav
    nav_dashboard: 'Dashboard',
    nav_flashcards: 'Flashcards',
    nav_notes: 'Notes',
    nav_quiz: 'Quiz',
    tagline: 'Study Platform',
    // Dashboard
    dash_title: 'Study Dashboard',
    dash_sub: 'Track your progress across all subjects and study modes.',
    stats_studied: 'Cards Studied',
    stats_known: 'Cards Known',
    stats_score: 'Avg Quiz Score',
    stats_notes: 'Notes Read',
    of: 'of',
    total: 'total',
    sessions: 'sessions',
    not_started: 'Not started',
    marked_correct: 'marked correct',
    study_modes: 'Study Modes',
    core_subjects: 'Core Subjects',
    extended: 'Extended Curriculum',
    known: 'known',
    // Subject page
    upload_tab: 'Upload',
    empty_fc: 'No flashcards yet. Upload study materials to get started.',
    empty_notes: 'No notes yet. Upload a PDF to generate summaries.',
    empty_quiz: 'No quiz questions yet. Upload materials first.',
    upload_title: 'Upload Study Materials',
    upload_desc: 'Drop PDFs or images here, or click to browse',
    drop_active: 'Release to upload',
    file_types: 'PDF · PNG · JPG · WEBP',
    uploaded_files: 'Uploaded Files',
    no_files: 'No files uploaded yet',
    session_note: 'Files stored for this session',
    remove: 'Remove',
    open: 'Open',
    upload_cta: 'Upload Materials',
    back: '← Dashboard',
    extended_label: 'Extended Curriculum',
    core_label: 'Core Curriculum',
    cards: 'cards',
    questions: 'questions',
    notes_count: 'notes',
  },
  ja: {
    nav_dashboard: 'ダッシュボード',
    nav_flashcards: 'フラッシュカード',
    nav_notes: 'ノート',
    nav_quiz: 'クイズ',
    tagline: '学習プラットフォーム',
    dash_title: '学習ダッシュボード',
    dash_sub: '全科目のフラッシュカード・ノート・クイズの進捗を管理します。',
    stats_studied: '学習済みカード',
    stats_known: '習得済みカード',
    stats_score: 'クイズ平均点',
    stats_notes: '読了ノート',
    of: '/',
    total: '合計',
    sessions: 'セッション',
    not_started: '未開始',
    marked_correct: '正解済み',
    study_modes: '学習モード',
    core_subjects: '主要科目',
    extended: '拡張カリキュラム',
    known: '習得済み',
    upload_tab: 'アップロード',
    empty_fc: '教材なし。学習素材をアップロードして始めましょう。',
    empty_notes: 'ノートなし。PDFをアップロードしてサマリーを作成。',
    empty_quiz: 'クイズなし。先に学習素材をアップロードしてください。',
    upload_title: '学習教材をアップロード',
    upload_desc: 'PDFまたは画像をドロップ、またはクリックして参照',
    drop_active: 'ここでリリース',
    file_types: 'PDF · PNG · JPG · WEBP',
    uploaded_files: 'アップロード済みファイル',
    no_files: 'ファイルなし',
    session_note: 'ファイルはセッション中のみ保存',
    remove: '削除',
    open: '開く',
    upload_cta: '教材をアップロード',
    back: '← ダッシュボード',
    extended_label: '拡張カリキュラム',
    core_label: '主要カリキュラム',
    cards: 'カード',
    questions: '問題',
    notes_count: 'ノート',
  },
} as const;

export type TKey = keyof typeof T['en'];

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
}

const Ctx = createContext<LangCtx>({
  lang: 'en',
  setLang: () => {},
  t: (k) => T.en[k],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem('study-lang') as Lang) ?? 'en'
  );

  const handleSet = (l: Lang) => {
    setLang(l);
    localStorage.setItem('study-lang', l);
  };

  return (
    <Ctx.Provider value={{ lang, setLang: handleSet, t: (k) => T[lang][k] as string }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLang = () => useContext(Ctx);
