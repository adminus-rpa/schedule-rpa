# Frontend Domain

## Purpose
Svelte 5 single-page application built with Vite. It serves as a digital signage display for the schedule, designed for large screens and unattended operation.

## Ownership
- `src/App.svelte` and `src/main.ts`: Application bootstrap, store initialization, and keyboard binding.
- `src/stores/*`: Global state management (`config`, `schedule`, `sse`, `clock`, `layout`).
- `src/components/*`: Layout components (`Board`, `Panel`, `Page`, `TopBar`, etc.).
- `src/styles/legacy.css`: Global DOM-based styling, layout constraints, and visual island definitions.

## Local Contracts
- **Resilience**: The frontend must handle SSE connection drops via automatic reconnection and gracefully recover from API errors.
- **Visual Integrity**: The schedule display must enforce boundaries without overflow. `legacy.css` controls layout constraints, while local scoped styles handle component-specific visuals.
- **Responsiveness**: Recompute layout grids (like groups per page) automatically on window resize.

## Work Guidance
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`) for all reactivity.
- CSS changes should avoid magic numbers; prefer clamping `clamp()` and container query logic.
- Do not use TailwindCSS unless explicitly approved. Stick to vanilla CSS custom properties for theming.

## Verification
- Run `npm run build` followed by `npm run preview` to ensure production builds succeed without Svelte compilation errors.
- Verify smooth page rotation intervals and lack of horizontal/vertical overflow in the browser.

## Child DOX Index
This domain has no child directories requiring their own DOX files.
