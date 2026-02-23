# Meta GitHub Pages

AI-generated visual showcase pages for any GitHub repository — built in seconds with [Cerebras](https://cerebras.ai) inference.

**Live demo:** [sebastiand-cerebras.github.io/meta-repo](https://sebastiand-cerebras.github.io/meta-repo)

## How It Works

1. **Pick** any public GitHub repository
2. **Generate** — Cerebras AI analyzes the repo and creates a polished, self-contained HTML page in a single LLM call (~5 seconds at 800+ tok/s)
3. **Deploy** — the page is committed and auto-deployed to GitHub Pages

Each generated page includes dark/light mode, stat tiles, architecture diagrams, code blocks, and hover animations — all in one self-contained HTML file with zero external dependencies.

## Prerequisites

- **Node.js** >= 18
- **GitHub CLI** — [cli.github.com](https://cli.github.com) (for git push and auto-enabling GitHub Pages)
- **Cerebras API Key** — [cloud.cerebras.ai](https://cloud.cerebras.ai) (free tier available)

## Quick Start

```bash
# 1. Clone and install
gh repo clone sebastiand-cerebras/meta-repo
cd meta-repo
npm install

# 2. Configure
echo "CEREBRAS_API_KEY=your-key" > .env

# 3. Start the local manager
node server.js
# → Open http://localhost:3200
```

## Usage

### Local Manager (GUI)

Start the server with `node server.js`, open `http://localhost:3200`, then:

- Enter a GitHub username to browse their public repos
- Select up to 5 repositories
- Click **Generate** — watch real-time progress as pages are created
- Generated pages auto-deploy to your GitHub Pages site

### Command Line

```bash
# Generate pages for specific repos
node generate.js owner/repo1 owner/repo2

# Skip git push (local-only)
node generate.js --no-push owner/repo1

# Reuse existing clones (faster)
node generate.js --no-clone owner/repo1

# Regenerate all existing pages
./regen-all.sh
```

## Project Structure

```
meta-repo/
├── server.js              # Express server (port 3200) — API + local manager
├── generate.js            # CLI generation script — clone, analyze, LLM call, write, push
├── local-manager.html     # Local manager UI (repo browser + generation)
├── index.html             # Public GitHub Pages gallery
├── config.js              # Optional branding overrides
├── regen-all.sh           # Batch-regenerate all pages in manifest
├── assets/
│   ├── styles.css         # Shared design system (CSS variables)
│   ├── logo-*.png         # Cerebras logos (dark/light)
│   ├── GitHub_Invertocat_*.svg
│   └── qr-repo.svg       # QR code to repo
├── slides/
│   └── index.html         # Presentation slides
├── repos/
│   ├── manifest.json      # Registry of all generated pages
│   └── <repo>/
│       └── index.html     # Generated visual page
├── .github/workflows/
│   └── deploy.yml         # GitHub Pages deployment
└── .nojekyll              # Bypass Jekyll processing
```

## Repo Type Detection

The generator auto-detects project type and applies a tailored visual template:

| Type | Detection | Visual Template |
|------|-----------|-----------------|
| **ML / Data Science** | `.ipynb` files, pandas/torch/tensorflow | Pipeline diagram, metric tiles, data preview |
| **API** | express/fastapi/flask/django | Endpoint gallery, architecture flow, auth section |
| **CLI** | bin/ directory, commander/yargs/click | Terminal window, command tree, install commands |
| **Frontend** | react/vue/svelte/next | Component map, route flow, tech stack badges |
| **Library** | package exports, `[lib]` in Cargo.toml | Install command, API surface table, usage example |
| **Infrastructure** | Dockerfile, .tf files, k8s/ | Architecture diagram, resource inventory, env pipeline |
| **Monorepo** | lerna/turbo/pnpm-workspace | Package constellation, dependency matrix |
| **Generic** | Fallback | Feature cards, how-it-works flow, tech stack |

## Configuration

### Environment Variables

```bash
CEREBRAS_API_KEY=...    # Required — Cerebras API key
NO_PUSH=1               # Optional — skip git push (same as --no-push flag)
```

### Branding (config.js)

```js
export default {
  brandName: 'My Repos',
  accentColor: '#E06439',
  logoDark: 'assets/logo-dark-mode.png',
  logoLight: 'assets/logo-light-mode.png',
  githubUsername: 'your-username',
};
```

## Tech Stack

- **LLM:** Cerebras `zai-glm-4.7` — single-call generation at 800+ tok/s
- **Server:** Node.js + Express (port 3200)
- **Frontend:** Vanilla HTML/CSS/JS, no build step
- **Deployment:** GitHub Pages via GitHub Actions
- **Design:** Apple-inspired, CSS custom properties, SF Pro, dark/light mode

## Cleanup

The generator clones repositories to `tmp/repos/` during generation (reused with `--no-clone`). Over time this can consume substantial disk space.

```bash
# Remove all cached clones
rm -rf tmp/

# Check disk usage before cleaning
du -sh tmp/
```

The `tmp/` directory is gitignored and safe to delete — it will be recreated as needed.

## License

MIT
