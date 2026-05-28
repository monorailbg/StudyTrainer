# Design System — Global Business Studies Platform

## Visual Identity
Dark editorial aesthetic. Deep navy canvas with gold/amber accent. Sharp, authoritative, typographically driven. Closest reference: a financial terminal crossed with an academic journal.

No glass morphism. No gradients on text. No decorative blur. Depth through background-color layering only.

## Color

### Background Layers (dark-mode-native)
- `--bg`: `#07111f` — deepest canvas, page background
- `--surface`: `#0d1a2e` — card backgrounds
- `--elevated`: `#162236` — hovered/elevated cards, active states
- `--border`: `#1e2d45` — default dividers and borders
- `--border-active`: `#2d4465` — hover/focus border state

### Text
- `--text-1`: `#f0f4f8` — primary text
- `--text-2`: `#94a3b8` — secondary text
- `--text-3`: `#4a5a6e` — muted / de-emphasised

### Accent (gold)
- `--accent`: `#d4a843` — primary brand accent (use sparingly)
- `--accent-subtle`: `rgba(212,168,67,0.12)` — accent background tints
- `--accent-border`: `rgba(212,168,67,0.30)` — accent border at 30% opacity

### Subject Colours (one per subject)
- International Trade: `#d4a843`
- Marketing: `#60a5fa`
- Finance: `#4ade80`
- Economics: `#c084fc`
- Japanese: `#f87171`
- Chinese: `#fb923c`
- Research for Business Studies: `#22d3ee`
- EQ and PC: `#a78bfa`
- Business Economics: `#fbbf24`
- Pre Seminar: `#818cf8`
- Accounting Advanced: `#34d399`
- Management: `#f472b6`

### Status Colours
- Success: `#4ade80`
- Error: `#f87171`
- Warning: `#fbbf24`
- Info: `#60a5fa`

## Typography

### Fonts
- **Display/Headings**: `DM Serif Display` (Google Fonts) — weight 400, italic variant for pull quotes
- **Body/UI**: `IBM Plex Sans` — weights 300/400/500/600
- **Numbers/Stats**: `font-variant-numeric: tabular-nums` via IBM Plex Mono for stat displays

### Scale
| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Display | clamp(2rem, 4vw, 2.8rem) | 400 (serif) | Page titles |
| Heading 1 | 1.4rem | 400 (serif) | Section headers |
| Heading 2 | 1.1rem | 400 (serif) | Card titles |
| Body | 14–15px | 400 | Content paragraphs |
| Label | 13px | 500–600 | UI labels, buttons |
| Caption | 11–12px | 500 | Badges, metadata |
| Overline | 10px | 600 | UPPERCASE section labels, 0.15em tracking |

## Spacing
Base unit: 4px. Key values: 4, 8, 12, 16, 20, 24, 32, 48, 64, 80

## Border Radius
- Cards: 12–14px
- Buttons / inputs: 7–8px
- Badges / pills: 4–5px
- Pill chips: 6px
- Icons containers: 8–10px

## Components

### Cards
- Background: `--surface`
- Border: `1px solid --border`
- Hover: border changes to `subject-color + 50–60% opacity`, `translateY(-2px)` lift
- No shadow by default. Depth via background colour layers.
- Accent stripe (3px top border in subject colour) for core-subject cards

### Buttons (primary)
- Background: `--accent` (#d4a843)
- Text: `#07111f` (near-black)
- Min-height: 44px (accessibility)
- Border-radius: 8px
- Hover: opacity 0.9, subtle scale

### Buttons (secondary / ghost)
- Background: transparent → `--elevated` on hover
- Border: `1px solid --border`
- Text: `--text-2`

### Subject-coloured buttons
- Background: `subject-color + 14% opacity`
- Border: `subject-color + 30% opacity`
- Text: `subject-color`
- Hover: bump opacity to 28%

### Badges
- Background: `subject-color + 14% opacity`
- Text: `subject-color`
- Border: `subject-color + 28% opacity`
- Font: 10–11px, weight 600, 0.04em tracking
- Padding: 2–4px 7–10px
- Radius: 4–5px

### Inputs / Selects
- Background: `--surface` or `--elevated`
- Border: `1px solid #4a5568` (Tailwind slate-500)
- Focus: border → `--accent`
- Text: `--text-1`

### Progress bars
- Height: 2px (thin, editorial)
- Track: `--border`
- Fill: `--accent` or subject colour
- No border-radius (sharp/crisp)

### Flip cards (flashcard mode)
- preserve-3d + backface-visibility hidden
- 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)

## Animation
- Hover transitions: 150ms ease
- Card lift: `translateY(-2px)` on hover
- No bounce, no elastic easing
- Respect `prefers-reduced-motion`

## Navbar
- Sticky, `--bg` background, bottom border `1px solid --border`
- Logo left, nav links centre, language toggle right
- Active link: `--elevated` background pill, full weight

## Anti-patterns (BANNED)
- Gradient text (`background-clip: text`)
- Glassmorphism / `backdrop-filter` decoratively
- Side-stripe `border-left` accents on cards
- Hero-metric template (big number, gradient accent stat cards)
- Identical card grid repeats with icon+heading+text only
- Pure `#000` or `#fff` (always tinted)
- Emoji as icons (use SVG only)
