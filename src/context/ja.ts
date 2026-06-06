// English-source → Japanese translations for UI chrome.
//
// Keys are the exact English strings passed to `ts(...)`. Any string missing
// here falls back to its English source automatically, so partial coverage is
// always safe. AI-generated study content (flashcard fronts/backs, note bodies,
// quiz questions) is intentionally NOT translated here — only the app's own UI.
//
// Interpolation: use {name} placeholders in both the English source and the
// Japanese value, e.g. ts('Scored {p}%', { p: 80 }).

export const ja: Record<string, string> = {
  // ── Navigation / chrome ───────────────────────────────────────────────────
  'Dashboard': 'ダッシュボード',
  'Mind Map': 'マインドマップ',
  'Flashcards': 'フラッシュカード',
  'Notes': 'ノート',
  'Note': 'ノート',
  'Quiz': 'クイズ',
  'Generate': '生成',
  'Manage': '管理',
  'Language': '言語',
  'Japanese': '日本語',
  'English': '英語',
  'Both': '両方',
  'Switch to {label}': '{label}に切り替え',
  'Study Trainer': 'スタディトレーナー',
  'Global Business Studies': 'グローバルビジネス学習',
  'Open menu': 'メニューを開く',
  'Close menu': 'メニューを閉じる',

  // ── API key banner ────────────────────────────────────────────────────────
  'Gemini API key configured': 'Gemini APIキー設定済み',
  'Gemini API key required': 'Gemini APIキーが必要です',
  'Paste your API key (starts with AQ.)': 'APIキーを貼り付け（AQ. で始まります）',
  'Get a free key →': '無料キーを取得 →',
  'Save': '保存',
  'Remove': '削除',

  // ── Cloud status / dim / toast ────────────────────────────────────────────
  'Firebase (notes/flashcards/quizzes) and Supabase (file storage) are not configured.':
    'Firebase（ノート／フラッシュカード／クイズ）と Supabase（ファイルストレージ）が設定されていません。',
  'Firebase is not configured — notes, flashcards and quizzes will not be shared.':
    'Firebase が設定されていません — ノート、フラッシュカード、クイズは共有されません。',
  'Supabase is not configured — uploaded files will not be shared.':
    'Supabase が設定されていません — アップロードしたファイルは共有されません。',
  'Local-only mode': 'ローカルのみモード',
  'Dismiss': '閉じる',
  // ── Home / dashboard ──────────────────────────────────────────────────────
  'Cards': 'カード',
  'Explore': '見る',
  'Globe': 'グローブ',
  'Good morning.': 'おはようございます。',
  'Good afternoon.': 'こんにちは。',
  'Good evening.': 'こんばんは。',
  'Click a subject on the globe to dive in.': 'グローブ上の科目をクリックして始めましょう。',
  'Scroll': 'スクロール',
  'You have {cards} due for review across {subjects}.':
    '{subjects}にわたって復習予定の{cards}があります。',
  '{n} subjects': '{n} 科目',
  '{n} due': '復習予定 {n} 件',
  'Review': '復習',
  'Upcoming Exams': '今後の試験',
  '{n} days left': '残り {n} 日',
  'Today': '今日',
  '{n} days ago': '{n} 日前',
  'Continue where you left off': '続きから学習する',
  'Resume': '再開',
  'Remove {name} from recents': '{name} を最近の項目から削除',
  '{n} cards': '{n} カード',
  '{n} notes': '{n} ノート',
  '{n} questions': '{n} 問題',
  'AI powered': 'AI搭載',
  'No core subjects. Star one in': '主要科目がありません。次でスター登録してください:',

  // ── Built-in subject titles ───────────────────────────────────────────────
  'International Trade': '国際貿易',
  'Marketing': 'マーケティング',
  'Finance': 'ファイナンス',
  'Economics': '経済学',
  'Chinese': '中国語',
  'Research for Business Studies': 'ビジネス研究法',
  'English for Qualifications and Practical communication': '資格・実践コミュニケーション英語',
  'Business Economics': 'ビジネス経済学',
  'Pre Seminar': 'プレゼミ',
  'Accounting Advanced': '上級会計',
  'Management': '経営学',

  // ── Built-in subject descriptions ─────────────────────────────────────────
  'Comparative advantage, trade policy, Heckscher-Ohlin, terms of trade.':
    '比較優位、貿易政策、ヘクシャー＝オリーン、交易条件。',
  'Marketing mix, segmentation, brand equity, consumer behaviour.':
    'マーケティングミックス、セグメンテーション、ブランドエクイティ、消費者行動。',
  'NPV, IRR, WACC, capital markets, EMH, risk and return.':
    'NPV、IRR、WACC、資本市場、効率的市場仮説、リスクとリターン。',
  'Elasticity, GDP, monetary policy, game theory and market structures.':
    '弾力性、GDP、金融政策、ゲーム理論、市場構造。',
  'Japanese language studies: grammar, vocabulary and kanji.':
    '日本語学習：文法、語彙、漢字。',
  'Mandarin Chinese language studies: grammar, vocabulary and hanzi.':
    '中国語（標準語）学習：文法、語彙、漢字。',
  'Research methods, methodology, data collection and analysis.':
    '研究手法、方法論、データ収集と分析。',
  'English for academic qualifications and practical, real-world communication.':
    '学術資格と実践的な実世界コミュニケーションのための英語。',
  'Applied economics: business cycles, fiscal policy, exchange rates.':
    '応用経済学：景気循環、財政政策、為替レート。',
  'Academic writing, research skills, presentation and citation.':
    'アカデミックライティング、研究スキル、プレゼンテーション、引用。',
  'Advanced financial reporting, consolidation, IFRS standards.':
    '上級財務報告、連結、IFRS基準。',
  'Managerial theory, organisational behaviour, leadership and change.':
    '経営理論、組織行動、リーダーシップと変革。',
  'Level 1': 'レベル1',
  'Level 2': 'レベル2',
  'Level 3': 'レベル3',
};
