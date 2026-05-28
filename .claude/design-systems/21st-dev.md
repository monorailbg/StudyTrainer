# 21st.dev — Community Component Registry

## What It Is
21st.dev is an open community registry of React + TypeScript UI components, similar in concept to shadcn/ui but community-driven. Components are copy-paste ready, not installed as npm packages.

> Note: The community/components page currently requires authentication to browse (returns 403). Reference this doc manually or visit https://21st.dev when authenticated.

## How to Use Components
1. Browse https://21st.dev/community/components to find a component
2. Copy the component source code directly into your project
3. Components are typically written for React + TypeScript + Tailwind CSS

## Component Categories Typically Found
- Animated buttons, magnetic hover effects
- Glassmorphism cards (skip these per our DESIGN.md)
- Fancy input fields with floating labels
- Progress indicators and loading states
- Navigation menus, dropdown components
- Data display: tables, stat cards, charts wrappers
- Micro-interaction elements: ripple effects, confetti triggers
- Text animations: typewriter, scramble, gradient text (skip gradient text per DESIGN.md)

## Usage Guidelines for This Project
When pulling components from 21st.dev:
- Strip out glassmorphism/blur effects (banned per DESIGN.md)
- Strip out gradient text (banned)
- Replace any pastel/light-mode colour tokens with our dark palette
- Ensure all touch targets are ≥44px before using
- Replace emoji icons with SVG alternatives
- Test with keyboard navigation (tab + enter)
- Verify contrast ratio ≥4.5:1 against our `#07111f` background

## Integration with MCP (if available)
If the shadcn/ui MCP server is connected, use it for component discovery:
```
mcp__shadcn__search_components "card hover animation"
```
21st.dev components can supplement this with more experimental/creative options.
