# UI/UX Pro Max — Design Intelligence Skill

Applied design system for this project. Key rules enforced:

## Active Rules
- **No emoji icons** — use SVG only
- **Touch targets ≥ 44×44px** on all interactive elements
- **Contrast ≥ 4.5:1** in dark mode
- **Reduced-motion** respected via CSS `prefers-reduced-motion`
- **Mobile-first** responsive grid
- **No glass/blur effects** — depth via background color layers only

## Design System Applied

### Color Palette (Dark Editorial / iOS 26 Spatial)
- `--bg`: `#07111f` — deepest layer
- `--surface`: `#0d1a2e` — card surface
- `--elevated`: `#162236` — elevated / hover
- `--border`: `#1e2d45` — dividers
- `--border-active`: `#2d4465` — active borders
- `--accent`: `#d4a843` — gold primary
- `--text-1`: `#f0f4f8` — primary text
- `--text-2`: `#94a3b8` — secondary
- `--text-3`: `#4a5a6e` — muted

### Typography
- **Display/Headings**: DM Serif Display — weight 400 (the italic version for emphasis)
- **Body/UI**: IBM Plex Sans — 300/400/500/600
- **Numbers/Stats**: IBM Plex Mono via font-variant-numeric: tabular-nums

### Spacing Scale
4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64 · 80

### Animation
- Hover transitions: 150ms ease
- Card lift: `translateY(-2px)`
- No spring physics (too playful for editorial)
- Respects `prefers-reduced-motion`

### Component Patterns
- Cards: flat border `1px solid var(--border)`, hover border `var(--accent)` at 40% opacity
- Buttons: min-height 44px, clear pressed state
- Inputs: `background: var(--surface)`, border focus `var(--accent)`
- Progress: thin 2px bars, not rounded pill shapes
- Badges: `background: var(--accent) at 12%`, `color: var(--accent)`, uppercase 11px tracking

### Style: iOS 26 Spatial (no gloss)
Depth through:
1. Background layering (not blur)
2. Border weight changes on interaction  
3. Precise shadows via `box-shadow: 0 1px 3px rgba(0,0,0,0.4)`
4. Color temperature shifts (warmer = closer, cooler = further)
5. Typography scale contrast

Avoided: backdrop-filter, rgba transparency stacking, glass morphism, neon glows.
