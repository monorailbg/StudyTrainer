import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { ja as jaStrings } from './ja';

export type Lang = 'en' | 'ja';

type Vars = Record<string, string | number>;

// Replace {name} placeholders in a string with the matching var value.
function format(str: string, vars?: Vars): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

const T = {
  en: {
    // Nav
    nav_dashboard: 'Dashboard',
    nav_mindmap: 'Mind Map',
    nav_flashcards: 'Flashcards',
    nav_notes: 'Notes',
    nav_quiz: 'Quiz',
    nav_dictionary: 'Dictionary',
    nav_generate: 'Generate',
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
    // Generation
    gen_section: 'Generate Study Content',
    gen_desc: 'Use Claude AI to generate flashcards, notes, or quiz questions from your uploaded files.',
    gen_api_key_label: 'Gemini API Key',
    gen_api_key_placeholder: 'AIza...',
    gen_api_key_save: 'Save',
    gen_api_key_change: 'Change Key',
    gen_api_key_stored: 'Gemini API key active',
    gen_select_file: 'Select a file to generate from:',
    gen_select_type: 'What to generate:',
    gen_btn_fc: 'Flashcards',
    gen_btn_notes: 'Notes',
    gen_btn_quiz: 'Quiz',
    gen_go: 'Generate',
    gen_extracting: 'Extracting text...',
    gen_generating: 'Generating with Gemini...',
    gen_done_fc: 'Flashcards ready',
    gen_done_notes: 'Notes ready',
    gen_done_quiz: 'Quiz ready',
    gen_error: 'Generation failed. Check your API key and try again.',
    gen_view: 'View',
    gen_regenerate: 'Regenerate',
    fc_flip_hint: 'Click to flip',
    quiz_check: 'Check Answers',
    quiz_reset: 'Reset',
    quiz_score: 'Score',
    quiz_correct: 'Correct',
    quiz_incorrect: 'Incorrect',
  },
  ja: {
    nav_dashboard: 'ダッシュボード',
    nav_mindmap: 'マインドマップ',
    nav_flashcards: 'フラッシュカード',
    nav_notes: 'ノート',
    nav_quiz: 'クイズ',
    nav_dictionary: '辞書',
    nav_generate: '生成',
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
    // Generation
    gen_section: 'AI学習コンテンツ生成',
    gen_desc: 'アップロードしたファイルからフラッシュカード・ノート・クイズを生成します。',
    gen_api_key_label: 'Gemini APIキー',
    gen_api_key_placeholder: 'AIza...',
    gen_api_key_save: '保存',
    gen_api_key_change: 'キーを変更',
    gen_api_key_stored: 'Gemini APIキー有効',
    gen_select_file: '生成元ファイルを選択:',
    gen_select_type: '生成するコンテンツ:',
    gen_btn_fc: 'フラッシュカード',
    gen_btn_notes: 'ノート',
    gen_btn_quiz: 'クイズ',
    gen_go: '生成する',
    gen_extracting: 'テキスト抽出中...',
    gen_generating: 'Claude で生成中...',
    gen_done_fc: 'フラッシュカード完成',
    gen_done_notes: 'ノート完成',
    gen_done_quiz: 'クイズ完成',
    gen_error: '生成に失敗しました。APIキーを確認してください。',
    gen_view: '表示',
    gen_regenerate: '再生成',
    fc_flip_hint: 'クリックで反転',
    quiz_check: '答え合わせ',
    quiz_reset: 'リセット',
    quiz_score: 'スコア',
    quiz_correct: '正解',
    quiz_incorrect: '不正解',
  },
} as const;

export type TKey = keyof typeof T['en'];

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  // Key-based lookup for the original curated strings.
  t: (key: TKey) => string;
  // English-source lookup for general UI strings, with optional {var} interpolation.
  // Falls back to the English source when no Japanese translation exists.
  ts: (en: string, vars?: Vars) => string;
}

const Ctx = createContext<LangCtx>({
  lang: 'en',
  setLang: () => {},
  t: (k) => T.en[k],
  ts: (en, vars) => format(en, vars),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem('study-lang') as Lang) ?? 'en'
  );

  const handleSet = (l: Lang) => {
    setLang(l);
    localStorage.setItem('study-lang', l);
  };

  // Toggle the Japanese font stack on the document root.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('lang-ja', lang === 'ja');
    root.setAttribute('lang', lang);
  }, [lang]);

  const ts = (en: string, vars?: Vars) =>
    format(lang === 'ja' ? (jaStrings[en] ?? en) : en, vars);

  return (
    <Ctx.Provider value={{ lang, setLang: handleSet, t: (k) => T[lang][k] as string, ts }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLang = () => useContext(Ctx);
