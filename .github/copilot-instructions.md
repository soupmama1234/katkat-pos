<!-- .github/copilot-instructions.md - Guidance for AI coding agents -->
# Copilot / AI agent instructions for katkatPOS-frontend

Purpose: give an AI code assistant the exact, actionable context needed to be productive in this repo.

- **Project type:** Single-page React app built with Vite (see [package.json](package.json#L1-L40) and [vite.config.js](vite.config.js#L1-L20)).
- **Entry points:** UI root is [src/main.jsx](src/main.jsx#L1-L40) which mounts `App` from [src/App.jsx](src/App.jsx#L1-L200).

Quick workflows
- Install deps: `npm install` (project uses `vite`, `react`, eslint devDeps).
- Dev server: `npm run dev` → Vite with HMR.
- Build: `npm run build` → production build.
- Preview build: `npm run preview`.
- Lint: `npm run lint` (uses ESLint; config file: `eslint.config.js`).

Architecture & key patterns
- Single-page React UI: the entire app state and UI currently live in `src/App.jsx`.
  - `products` is a static array inside `src/App.jsx` (see [src/App.jsx](src/App.jsx#L1-L80)).
  - `cart` is local component state and updated via `addToCart` / `decreaseQty` functions (see [src/App.jsx](src/App.jsx#L10-L120)).
- Styling approach: mostly inline styles inside JSX (no CSS-in-JS library). `src/index.css` exists for base styles.
- No backend in this repo: there are no network calls or API modules present — features that require persistence or external integration will need a new service layer.

Conventions & patterns to follow (observable in code)
- State: prefer simple React `useState` for feature-level state (as in `App.jsx`). If extracting logic, maintain clear separation: UI components → state hooks → small pure helper functions.
- File additions: follow existing pattern of default-exported React components (e.g., `export default App;`).
- Language: code is JavaScript ESM (`"type": "module"` in `package.json`) and React 19. Prefer `.jsx` extension for components.
- Linting: run `npm run lint` after edits; adhere to rules in `eslint.config.js`.

Integration points & dependencies
- External deps: `react`, `react-dom`, `vite`, `@vitejs/plugin-react` (see [package.json](package.json#L1-L40)).
- Native platform: Vite dev server, open http://localhost:5173 by default.

What to look for when changing behavior
- Cart logic: editing `addToCart` / `decreaseQty` in [src/App.jsx](src/App.jsx#L20-L120) affects totals and UI; keep operations immutable (existing code uses spread/`map`).
- If introducing async/API calls, add a `src/services/` folder and mockable interfaces; tests and mocks are not present now.

Examples (copyable)
- Start dev server:
```
npm install
npm run dev
```
- Add a new component: create `src/components/MyComp.jsx`, default-export a function, import in `src/App.jsx`.

Limitations & notes
- No tests or CI configs detected — avoid assuming test frameworks exist.
- No `.github/copilot-instructions.md` or agent rules existed previously; this file is authoritative for AI assistants.
- UI text contains Thai; preserve localization when editing strings.

If anything above is unclear or you want more examples (e.g., where to add routes, how to persist cart to localStorage), tell me which area to expand.
