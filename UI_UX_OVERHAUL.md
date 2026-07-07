# UI/UX Overhaul Plan

Implementation checklist for a visual and experiential upgrade of StudyTrainer.
Each item is written to be independently implementable. Work top to bottom
within a section; sections are ordered by impact. Keep every existing feature
working — this is a reskin/polish pass, not a rewrite. Verify each change in
both dark and light themes and at 375px / 768px / 1400px widths.

Ground rules for the implementing model:
- All colors flow through the CSS variables in `src/index.css` (`--bg-page`,
  `--bg-surface`, `--bg-elevated`, `--border-*`, `--text-*`, `--accent-*`).
  Extend that token set rather than hardcoding new hex values in components.
- The app uses inline styles + a few Tailwind utilities. Match whichever the
  file you're touching already uses.
- Respect `prefers-reduced-motion` for every new animation.
- Run `npx tsc --noEmit -p .` and `npm run build` after each item.

---

## 1. Design tokens & global foundation (`src/index.css`)

- [ ] Add a spacing scale (`--space-1` … `--space-8`: 4/8/12/16/20/24/32/48px)
      and a radius scale (`--radius-sm: 8px`, `--radius-md: 14px`,
      `--radius-lg: 20px`, `--radius-pill: 999px`). Migrate components
      opportunistically as they're touched in later items.
- [ ] Add elevation tokens: `--shadow-1` (subtle card), `--shadow-2` (raised
      card/hover), `--shadow-3` (modal). Dark theme shadows should be mostly
      transparent black + a faint 1px inset top highlight; light theme softer
      and warmer. Replace ad-hoc `boxShadow` literals.
- [ ] Add semantic status tokens: `--success`, `--warning`, `--danger`,
      `--info` (+ `-bg` and `-border` variants at ~10% / ~30% alpha). Replace
      the scattered `#56D364` / `#F97979` / `#D29922` / `rgba(46,160,67,…)`
      literals in QuizViewer, Toast, SubjectPage.
- [ ] Add an accent gradient token (`--accent-gradient`: subtle blue→violet in
      dark, amber→orange in light) for primary CTAs and stat highlights.
- [ ] Unify focus styles: one global `:focus-visible` ring
      (2px `--accent-primary` at 60%, 2px offset) for all interactive
      elements; remove per-component `outline: none` where it kills focus
      visibility entirely.
- [ ] Custom scrollbar styling (thin, `--border-base` thumb, transparent
      track) applied to internal scroll containers (sidebar, chat panes,
      quiz breakdown), not the page body.
- [ ] Add a `.text-gradient` utility (background-clip text with
      `--accent-gradient`) for hero numerals and page titles used in later
      items.

## 2. Motion & micro-interactions (global)

- [ ] Define 3 canonical transitions in CSS vars: `--ease-out-fast`
      (150ms cubic-bezier(0.2,0,0,1)), `--ease-out-med` (250ms same),
      `--ease-spring` (400ms cubic-bezier(0.34,1.56,0.64,1)). Use everywhere
      instead of the current mix of `0.15s`/`0.2s`/`0.3s` linear-ish values.
- [ ] Page-level enter animation: content area fades in + rises 8px on route
      change (extend the existing `.anim-fadein` and apply via the router
      layout in `src/App.tsx`).
- [ ] Staggered list entrance: FolderBoard grids, file cards, and quiz
      breakdown rows animate in with 30ms/item stagger (CSS
      `animation-delay: calc(var(--i) * 30ms)`, index passed as inline
      custom property). Cap at 12 items to avoid long waits.
- [ ] Button press feedback: all pill buttons get `transform: scale(0.97)` on
      `:active` and a soft accent glow on hover (reuse `.btn-accent`'s
      treatment; make it a shared class instead of one-off).
- [ ] Card hover: `card-panel-lift` gets a slight border-color shift to the
      subject/accent color at 30% alpha in addition to the existing lift.
- [ ] Number tickers: reuse QuizViewer's `useCountUp` for the Home stat tiles
      and subject dashboards (extract it to `src/lib/useCountUp.ts` first).
- [ ] Skeleton loading states: shimmer placeholder blocks (CSS gradient
      animation) for the subject page while IndexedDB/Firestore loads, the
      quiz history list, and Home stats — replace blank/empty flashes.

## 3. Navbar (`src/components/Navbar.tsx`)

- [ ] Active-route indicator: an animated underline/pill that slides between
      nav links (layout: absolutely-positioned marker moved via transform,
      like the existing toggle knobs) instead of the current static styling.
- [ ] Scroll-aware polish: increase pill background opacity and shadow once
      `scrollY > 8` so the glass HUD reads against content (single scroll
      listener, `requestAnimationFrame`-throttled).
- [ ] Add a subtle 1px bottom gradient hairline to the pill
      (transparent → `--accent-primary`22 → transparent) in dark mode.
- [ ] Mobile menu: animate open/close (fade + 12px slide, 200ms) and stagger
      the link rows; currently it pops instantly.
- [ ] Add a global "⌘K / Ctrl+K" command palette button in the navbar that
      opens a quick-jump dialog (subjects, pages, recent quizzes/notes —
      fuzzy filter over data already in stores). New component
      `src/components/CommandPalette.tsx`.

## 4. Home / dashboard (`src/pages/Home.tsx`)

- [ ] Hero: apply `.text-gradient` to the main heading and give the globe a
      radial vignette so it blends into `--bg-page` instead of hard-edging.
- [ ] Stat tiles: upgrade to small "bento" cards — icon in a tinted rounded
      square, `useCountUp` number, one-line sublabel, `--shadow-1`,
      hover lift. Consistent 4-col grid → 2-col at 768px → 1-col at 480px.
- [ ] Streak: replace the bare number with a 7-day dot row (filled/empty per
      day, today pulsing) + flame icon when streak ≥ 3.
- [ ] Subject cards: colored left accent bar (subject color), progress ring
      (SVG, 28px) showing quiz average, and a "last studied X ago" line from
      activity data. Hover: ring animates from 0 to value once per mount.
- [ ] Exam countdown chips: color-shift by urgency (≥14d neutral, 3–13d
      warning, ≤2d danger) using the new status tokens.
- [ ] Empty dashboard state (no subjects): full-width friendly illustration
      area (large icon + copy + primary CTA to create a subject), replacing
      whatever sparse default renders today.

## 5. Subject page shell (`src/pages/SubjectPage.tsx`)

- [ ] Banner: layer a very subtle dot-grid or diagonal-line SVG pattern at
      ~4% opacity over the existing radial gradient; move the exam-date
      pill to sit on the banner's bottom edge (half-overlapping) so the
      banner reads as a header card.
- [ ] Sidebar: active section gets a 3px subject-color accent bar on the
      left + tinted background; section counts become small pill badges
      (`8` files, `3 saved`) instead of plain text sublabels.
- [ ] Sidebar collapse animation: width transition 200ms with content fade;
      currently it snaps.
- [ ] Tab strip (Files/Cards/Notes/Quiz/…): convert to the sliding-marker
      pattern from item 3.1 so switching sections feels continuous.
- [ ] File cards: file-type icon color-coded (PDF red-tint, image
      violet-tint, text neutral), word-count/size as a mono caption, and a
      3-dot overflow menu (Rename/Move/Delete) replacing the always-visible
      icon-button row — cleaner cards, same actions.
- [ ] Upload dropzone: on dragover, animate the dashed border into the
      subject color and scale the upload icon 1.1x with `--ease-spring`;
      on drop, play a brief success pulse before the file card appears.
- [ ] Generate panel (bottom-right): give it `--shadow-3`, a slide-up entry,
      and sticky positioning that avoids overlapping the Local-only-mode
      toast (bottom-left). Progress state: replace the plain text with a
      slim animated progress bar (chunk N of M → percentage width).
- [ ] Folder chips/board: folders get a tinted folder icon and item-count
      badge; drag-over target highlights with a dashed subject-color ring
      (there's partial styling today — make it consistent across all four
      content types).

## 6. Quiz experience (`src/components/QuizViewer.tsx`)

- [ ] Setup screen: mode cards (Focused/Test/Practice) get icons and a
      selected state with subject-color border + check badge; "Begin" CTA
      uses `--accent-gradient` + glow.
- [ ] Focused mode: slim progress bar at the top (answered/total, animated
      width) plus "Q 3 / 10" mono counter; questions transition with a
      120ms horizontal slide+fade on next.
- [ ] Option buttons: letter chip fills with the option tint on hover;
      correct reveal plays a 200ms green pulse, wrong pick a 150ms shake
      (both skipped under reduced motion).
- [ ] Results screen: animate the score bar segments growing in sequence,
      confetti (already exists for redo-perfect) also at ≥90% on first
      results, and grade text slides up under the counted percentage.
- [ ] Question breakdown rows: replace ✅/❌ emoji with SVG check/cross in
      tinted circles (consistent cross-platform rendering); expanded row
      content gets a 150ms height/opacity transition.
- [ ] Test mode: sticky bottom bar showing `answered/total` with a mini
      progress bar and the Check Answers button, so the CTA is always
      reachable on long tests.
- [ ] Redo flow: "Redo wrong answers" button gets a subtle attention pulse
      (2 iterations) when the results screen first shows and there are
      wrong answers.

## 7. Flashcards (`src/components/FlashcardViewer.tsx`)

- [ ] 3D card flip on reveal (600ms rotateY with perspective, front/back
      faces) instead of any instant content swap; reduced-motion falls back
      to crossfade.
- [ ] Deck illusion: two offset, slightly-scaled shadow cards behind the
      active card; on rate/advance, the top card animates out in the swipe
      direction (left = again/hard, right = good/easy) and the deck shifts
      forward.
- [ ] SRS rating buttons: color-code (danger/warning/success/info tints),
      show the resulting interval under each label ("10m", "1d", "4d"),
      and support keyboard 1–4 with visible keycap hints.
- [ ] Session progress: thin top bar + "12 left" counter; end-of-session
      screen gets the same stat-tile treatment as quiz results (reviewed,
      accuracy, streak effect).

## 8. Notes reader (`src/components/NotesViewer.tsx`)

- [ ] Reading progress bar: 2px subject-color bar fixed under the navbar,
      driven by scroll position of the notes container.
- [ ] Sticky mini table-of-contents (section list) on ≥1100px viewports,
      right-aligned, with the current section highlighted via
      IntersectionObserver; click scrolls smoothly.
- [ ] Section cards: "understood" toggle becomes a satisfying animated
      check (circle draws in, card border tints success at 20%); understood
      sections get a slight desaturation so remaining work stands out.
- [ ] Typography pass: bump body line-height to 1.7, cap measure at ~68ch,
      increase heading letter-spacing contrast — reading comfort first.

## 9. Empty states, feedback & dialogs (cross-cutting)

- [ ] Replace all `window.confirm` / bare confirmations with a shared
      `ConfirmDialog` component (danger-styled primary action, `--shadow-3`,
      scale-in 150ms). Audit SubjectPage delete flows.
- [ ] Toasts (`src/components/Toast.tsx`): slide+fade entry from bottom,
      progress hairline showing time-to-dismiss, max 3 stacked with older
      ones compressing; success/info/error use the status tokens.
- [ ] Per-section empty states: each content tab (Files/Cards/Notes/Quiz/
      Dictionary) gets its own icon + one-liner + contextual CTA (e.g. Quiz
      tab empty state offers both "Generate from files" and "Create your
      own quiz") instead of the single generic EmptyState.
- [ ] Error states: generation failures render as an inline card with icon,
      message, and a Retry button — not just red text.

## 10. Mobile polish (≤768px)

- [ ] Subject page: bottom tab bar (Files/Cards/Notes/Quiz/More) replacing
      the sidebar for section switching; thumb-reachable, active tab tinted.
- [ ] Quiz options: minimum 48px touch height, full-bleed cards with 12px
      gutters; sticky Next button above the safe-area inset.
- [ ] Modals (QuizBuilder, dialogs): become bottom sheets on mobile
      (slide-up, drag-handle bar, max-height 92dvh, scroll inside).
- [ ] Use `100dvh` instead of `100vh` in the `--nav-height` calc consumers
      so iOS Safari's collapsing URL bar doesn't cause jumps.
- [ ] Audit tap targets in the navbar mobile menu and file-card action
      menus to ≥44px.

## 11. Accessibility & consistency sweep

- [ ] Full keyboard pass on quiz flow: options focusable with visible ring,
      arrow-key navigation between options, Enter to pick, N for next.
- [ ] `aria-live="polite"` on toast container, generation progress, and
      quiz score reveal so screen readers announce them.
- [ ] Modals (QuizBuilder, command palette, confirm dialog): focus trap,
      Escape to close, focus restored to the opener on close.
- [ ] Check all tinted-text-on-tinted-bg combos (option letter chips,
      status pills) against WCAG AA in both themes; darken/lighten token
      values as needed rather than per-component overrides.
- [ ] Replace remaining emoji-as-UI (✅ ❌ ⏱ 🏢 stat icons) with the SVG
      icon set for visual consistency; keep emoji only in user content.

## 12. Performance-adjacent polish

- [ ] Route-level code splitting via `React.lazy` for heavy pages
      (GlobeView/Home hero, KnowledgeGraph, MindMap, Companies) — kills the
      2MB main chunk warning and speeds first paint of everything else.
- [ ] `content-visibility: auto` on quiz-breakdown rows and long note
      sections (some exists — extend to the quiz history list).
- [ ] Preload the two display fonts with `<link rel="preload">` and
      `font-display: swap` to stop the visible FOUT on first visit.
