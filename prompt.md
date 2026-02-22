# Meta GitHub Pages — Implementation Spec

A GitHub Pages site that serves as a visual portfolio of your public repositories. It auto-discovers repos, generates rich visual summaries for each using an LLM, and deploys them as subpages — all from one meta-repo.

## Design

- **Style**: Cerebras-inspired dark/light mode (see `cerebras-style-html-raws/` for reference CSS variables, card layout, and theme toggle)
- **Logo**: GitHub-style mark (Octocat SVG or similar) alongside the site title
- **Stack**: Static HTML/CSS/JS only — no build step, deployable directly to GitHub Pages

## Architecture

```
index.html              ← Main dashboard: repo list, selection UI, generation controls
repos/{repo-name}/      ← Generated visual pages (one per selected repo)
assets/                 ← Shared CSS, logo assets, fonts
generate.js             ← Node.js CLI script (runs locally, not in browser)
.env                    ← CEREBRAS_API_KEY
```

## Flow

### 1. Dashboard (`index.html` — hosted on GitHub Pages)
- On load, call `https://api.github.com/users/{username}/repos?sort=updated&per_page=100`
- Default username: auto-detect from repo owner, or allow text input
- Render repos as selectable cards sorted by `updated_at` (most recent first)
- Each card shows: repo name, description, language, last updated, stars
- Allow multi-select (up to 5 repos at a time)
- "Generate Pages" button triggers the local CLI flow

### 2. Local Generation (`generate.js` — runs via `node generate.js`)
- **Input**: list of selected repo full names (e.g., `seb/my-project`)
- **For each repo**:
  1. Clone into `tmp/repos/{repo-name}` (shallow clone, depth=1)
  2. Analyze: read README, package.json/Cargo.toml/etc., directory structure, key source files
  3. Build a context summary (~2000 tokens) of what the repo does, its tech stack, and notable features
  4. Call **Cerebras GLM-4** (`POST https://api.cerebras.ai/v1/chat/completions`, model: `zai-glm-4.7`) with the context
     - Prompt: "Generate a single-file HTML page that visually explains this project. Use the Apple-style design system (dark/light mode, CSS variables as specified). Focus on what the project does, why it matters, and how it works — not raw technical docs. Include sections: Overview, Key Features, Architecture, Tech Stack. Make it visually engaging with cards, icons, and color accents."
     - **Iterate 10 times**: each iteration reviews the previous output and refines it (fix layout issues, improve copy, add visual polish)
  5. Write final HTML to `repos/{repo-name}/index.html`
- After all repos are generated, update `index.html` to link to the new subpages
- Auto-commit and push: `git add . && git commit -m "Generate pages for {repo-names}" && git push`

### 3. External Repos
- The dashboard also accepts arbitrary `{owner}/{repo}` inputs (not just your own)
- External repos are visually tagged with a badge: "External — {owner}" on both the dashboard card and the generated page

### 4. Meta-Repo Bootstrap
- Provide a "Create Meta-Repo" button in the dashboard that runs:
  ```bash
  git init meta-github-pages && cd meta-github-pages && git remote add origin https://github.com/{user}/meta-github-pages.git
  ```
- Pre-fill the target repo field with `meta-github-pages`

## Visual Templates by Repo Type

The generator should **detect the repo type** during analysis (from files, README, dependencies) and use a specialized visual template. The goal: each page should *look like the thing it describes*, not just be a wall of text.

> **Instruction to LLM**: "Detect the project type from the analysis. Use the matching visual template below. The page must be visually engaging — use diagrams, flow arrows, interactive-looking cards, color-coded sections, and iconography. Avoid text-heavy layouts."

### Data / ML / Kaggle Notebook
**Detect**: `.ipynb` files, `pandas`/`numpy`/`scikit-learn`/`torch` in deps, `data/` folder, kaggle metadata
**Visualize as**: A research pipeline diagram
- Hero: dataset name + source badge (Kaggle, UCI, etc.)
- Horizontal pipeline flow: `Raw Data → Cleaning → Feature Engineering → Model → Evaluation → Results`
- Each stage is a clickable-looking card with icon + 1-line summary
- Key metrics panel: accuracy, F1, dataset size, # features — styled as big stat tiles
- "Data Snapshot" section: mock table preview (first 5 rows described)
- Color palette: blues/purples (scientific feel)

### API Server (FastAPI / Express / Flask)
**Detect**: `fastapi`/`flask`/`express` in deps, `main.py`/`app.py`/`server.js`, route definitions
**Visualize as**: An interactive API map
- Hero: service name + what it does in one sentence
- Endpoint gallery: each route as a card → `GET /users` with method badge (green GET, blue POST, red DELETE)
- Architecture strip: `Client → API Gateway → Routes → DB/Services` as a horizontal flow
- Auth & middleware shown as shield/lock icons in the flow
- Key stats: # endpoints, auth type, DB type
- Color palette: greens/teals (server/infra feel)

### CLI Tool
**Detect**: `bin/` folder, `commander`/`yargs`/`clap`/`argparse` in deps, shebang lines
**Visualize as**: A terminal-style showcase
- Hero: tool name in a faux terminal prompt (`$ my-tool --help`)
- Command tree: visual hierarchy of subcommands + flags, styled like a file tree
- "What it does" as 3 icon+text cards (e.g., "Scaffolds projects", "Runs migrations", "Deploys to cloud")
- Example usage section: dark code blocks with syntax-highlighted commands
- Color palette: dark bg with green/amber terminal accents

### Frontend App (React / Vue / Svelte)
**Detect**: `react`/`vue`/`svelte`/`next`/`nuxt` in deps, `src/components/`
**Visualize as**: A component showcase / UI gallery feel
- Hero: app name + purpose, with a gradient/glass card
- Component map: visual grid of key components as mini-cards with icons
- Page flow: `Landing → Auth → Dashboard → Settings` as a connected diagram
- Tech stack as logo badges (React, Tailwind, Vite, etc.)
- "Screens" section: describe key views as labeled wireframe-style cards
- Color palette: vibrant gradients (product/design feel)

### Library / SDK / Package
**Detect**: published to npm/PyPI/crates.io, `lib/` or `src/` with exports, no `app` entrypoint
**Visualize as**: A developer docs landing page
- Hero: package name + install command in a copy-able code block (`npm i my-lib`)
- "Why use this?" — 3 value-prop cards with icons
- API surface: key exports/functions as a clean table (name, description, return type)
- Dependency graph: what it depends on, shown as connected nodes
- Compatibility badges: Node versions, browser support, bundle size
- Color palette: neutral with accent highlights (docs feel)

### Infrastructure / DevOps / Terraform
**Detect**: `.tf` files, `Dockerfile`, `docker-compose.yml`, `k8s/` folder, Ansible/Pulumi files
**Visualize as**: A cloud architecture diagram
- Hero: what the infra provisions in one line
- Architecture diagram: services as labeled icons (DB, cache, queue, compute) connected by arrows
- Resource inventory: table of provisioned resources (type, name, region)
- Environment strip: `Dev → Staging → Prod` pipeline
- Config highlights: key variables/secrets (names only, no values)
- Color palette: slate/indigo (cloud/ops feel)

### Monorepo / Multi-Project
**Detect**: `packages/` or `apps/` folder, `lerna.json`, `pnpm-workspace.yaml`, `turbo.json`
**Visualize as**: A constellation map
- Hero: monorepo name + package count
- Package constellation: each package as a node in a visual graph, sized by LOC, connected by dependency edges
- Per-package cards: name, description, version, key exports
- Shared tooling strip: linter, formatter, CI — shown as icons
- Color palette: multi-hue (each package gets its own color)

### Catch-All / Generic
**Detect**: fallback when no specific pattern matches
**Visualize as**: The default project showcase (current behavior)
- Overview, Key Features, Architecture, Tech Stack as card sections
- Still visually engaging: use icons, stat tiles, and a clean layout
- Never just a README dump

This repo ships as a **public, whitelabel tool** — no company logos, no branding. Anyone who forks/clones it at a demo or event gets a clean, neutral version they can make their own.

### Public repo (whitelabel — what attendees get)
- No logo in the header — just a generic icon (e.g., a grid/portfolio icon) + site title
- Neutral accent color (keep the orange from the design system, or let users pick via CSS variable)
- `cerebras-style-html-raws/` is **gitignored** — never pushed to the public repo
- README focuses on "how to use this tool for your own repos"

### Private fork (branded — what we use for the demo)
- Swap in our logo via `assets/logo-dark-mode.png` / `assets/logo-light-mode.png`
- `cerebras-style-html-raws/` stays locally as the design reference
- Can be deployed to our own GitHub Pages for the live demo
- Keep this repo private; the public whitelabel repo is the one we share

### Implementation
- `index.html` checks for `assets/logo-dark-mode.png` — if it exists, show it; otherwise show the generic icon
- A `config.js` (optional) can override: `{ brandName, accentColor, logoPath }` for easy theming
- The generation prompt in `generate.js` should **not** embed any company name — keep generated pages neutral

## Key Details

| Item | Value |
|------|-------|
| LLM | Cerebras GLM-4 (`zai-glm-4.7` via `api.cerebras.ai`) |
| API key | `CEREBRAS_API_KEY` from `.env` |
| Max repos per run | 5 |
| Refinement iterations | 10 per repo |
| Cloning | Shallow (`--depth 1`), into `tmp/repos/` (gitignored) |
| Deployment | GitHub Pages from repo root (or `/docs`) |
| Public repo | Whitelabel, no logos, `cerebras-style-html-raws/` gitignored |
| Private repo | Branded fork with logos + design reference kept locally |

## File Responsibilities

| File | Role |
|------|------|
| `index.html` | Dashboard UI: browse repos, select, trigger generation, link to generated pages |
| `generate.js` | CLI: clone → analyze → LLM generate (×10 iterations) → write HTML → git push |
| `config.js` | Optional branding overrides (logo, accent color, site name) |
| `repos/*/index.html` | Generated visual pages (one per repo) |
| `cerebras-style-html-raws/` | Design reference — **gitignored**, private use only |
| `.gitignore` | Excludes `.env`, `tmp/`, `cerebras-style-html-raws/`, `node_modules/` | 





