# Design System — Global Business Studies Platform

## Visual Identity
"Focused Depth" — a premium study environment. Deep near-black canvas with a single calm accent (blue), layered 3D card shadows, and precision typography. Closest references: Linear, GitHub, a developer productivity tool built for long sessions.

No glassmorphism (except purposeful navbar blur). No gradient text. No decorative motion. No top/side stripe accents on cards. Depth through shadow layering, not color.

## Color

### Background Layers
- `--bg-deep: #0D1117` — page canvas
- `--bg-surface: #161B22` — cards and panels
- `--bg-elevated: #1F2937` — hovered states, secondary panels

### Borders
- `--border: #30363D` — default structural lines
- Focus/accent border: `rgba(61,126,255,0.4)`

### Accent
- `--accent: #3D7EFF` — primary action color (trust, clarity, focus)
- `--accent-muted: #1D3461` — accent tint for backgrounds
- Accent glow: `rgba(61,126,255,0.15)`

### Text
- `#E6EDF3` — primary (headings, card fronts)
- `#8B949E` — secondary (labels, metadata, captions)
- `#484F58` — muted (placeholders, hints)

### Semantic
- Success: `#2EA043` / `#56D364` (bright)
- Warning: `#D29922`
- Danger: `#F85149`

### Subject Colors (unchanged)
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

## Typography

### Fonts
- **Display/Headings**: `Sora` — geometric, clear, study-focused (weight 600-700)
- **Body/UI**: `Inter` — maximum legibility at small sizes (weight 300-600)
- **Numbers/Stats**: `JetBrains Mono` — terminal feel for data display

### Usage Rules
- Sora for: page headings, section titles, flashcard terms, subject names
- Inter for: body text, labels, buttons, navigation, everything else
- JetBrains Mono ONLY for: stat numbers, counters, scores, keyboard shortcut labels
- Never use Sora in buttons, data cells, or UI labels (product register rule)

### Scale
- 10px / weight 500 + 0.10-0.14em tracking + uppercase — metadata labels
- 12-13px / weight 400-500 — secondary UI, captions
- 14-15px / weight 400 — body content
- 16-18px / weight 600 (Sora) — card titles, section headings
- 24-32px / weight 600-700 (Sora) — page headings
- 28-40px / weight 400 (JetBrains Mono) — stat numbers

## 3D Card System

### Layer 1 — resting card
```css
background: #161B22;
border: 1px solid #30363D;
border-radius: 12px;
box-shadow:
  0 1px 0 rgba(255,255,255,0.04) inset,
  0 2px 4px rgba(0,0,0,0.4),
  0 8px 24px rgba(0,0,0,0.3);
```

### Layer 2 — lifted/hovered card
```css
transform: translateY(-3px) perspective(800px);
box-shadow:
  0 1px 0 rgba(255,255,255,0.06) inset,
  0 8px 16px rgba(0,0,0,0.5),
  0 24px 48px rgba(0,0,0,0.4),
  0 0 0 1px rgba(61,126,255,0.2);
border-color: rgba(61,126,255,0.3);
```

### Cursor-tracking tilt (subject cards)
`perspective(800px) rotateX(Ydeg) rotateY(Xdeg) translateY(-3px)` — max 5-7 degrees. 150ms transition.

### Flashcard flip
- Front: `#161B22`, border `color25`
- Back: `linear-gradient(135deg, #1D3461, #161B22)`, border `color40`
- Transition: `0.6s cubic-bezier(0.4, 0.2, 0.2, 1)`, `perspective: 1200px`

### Ambient glow
`body::before` — fixed radial gradient, `rgba(61,126,255,0.06)`, centered top, 800×600px ellipse.

## CSS Utility Classes
- `.card-panel` — resting card depth (bg + border + shadow + transition)
- `.card-panel-lift:hover` — lifted hover state
- `.mono` / `.tabular-nums` — JetBrains Mono with tnum features
- `.anim-shake` — wrong answer horizontal shake (0.35s)
- `.anim-correct` — correct answer scale bounce (0.4s)
- `.anim-fadein` — fade + translateY reveal (0.2s)

## Spacing
Base unit: 4px. Primary gaps: 4, 8, 12, 16, 20, 24, 32, 48, 64.

## Border Radius
- Cards / panels: 12px (`rounded-3xl` overridden to 12px in @theme)
- Buttons (rectangular): 7-8px
- Badges / tags: 4-6px
- Pill buttons / toggles: 9999px (`rounded-full`)

## Motion
All transitions: `cubic-bezier(0.4, 0.0, 0.2, 1)` — standard material curve.
- Hover lift: 150ms
- Flashcard flip: 600ms with preserve-3d
- Progress bars: 0.8s ease-out on mount
- Count-up numbers: 1s ease-out (requestAnimationFrame)
- Fade-in panels: 200ms

## Navbar
- Height: 56px, sticky, `backdrop-filter: blur(12px)`
- Background: `rgba(13,17,23,0.88)`, border-bottom `rgba(48,54,61,0.8)`
- Active nav: `rgba(255,255,255,0.05)` bg + 2px `#3D7EFF` underline with glow
- Logo: GBS + globe SVG in accent blue

## Anti-patterns (BANNED)
- Gradient text (`background-clip: text`)
- Side-stripe `border-left/right` accents on cards
- Hero-metric template (gradient accent + centered big number)
- Top-stripe card accents (use subject-colored icon bg instead)
- Glassmorphism used decoratively (navbar blur is purposeful)
- Identical card grids with only icon + heading + text
- Pure `#000` or `#fff`
- Display fonts (Sora) in buttons, labels, or data
