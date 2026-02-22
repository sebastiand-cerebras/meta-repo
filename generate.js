#!/usr/bin/env node
/**
 * generate.js — Meta GitHub Pages Generator
 *
 * Usage:
 *   node generate.js owner/repo1 owner/repo2 ...
 *
 * Options:
 *   --no-push      Skip git commit and push
 *   --no-clone     Skip cloning (re-use existing tmp/repos/ clones)
 *   --iterations N Number of LLM refinement iterations (default: 10)
 *
 * Requires:
 *   - Node.js >= 18 (native fetch)
 *   - .env file with CEREBRAS_API_KEY
 *   - npm install (for dotenv)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ============================================================
// Config
// ============================================================
const CEREBRAS_API = 'https://api.cerebras.ai/v1/chat/completions';
const MODEL        = 'zai-glm-4.7';
const MAX_REPOS    = 5;

// ============================================================
// .env loader (no dotenv dependency required)
// ============================================================
function loadEnv() {
  const envPath = join(__dirname, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  }
}

// ============================================================
// CLI argument parsing
// ============================================================
function parseArgs(argv) {
  const repos = [];
  let noPush   = false;
  let noClone  = false;
  let iterations = 3;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--no-push')    { noPush = true; continue; }
    if (arg === '--no-clone')   { noClone = true; continue; }
    if (arg === '--iterations') { iterations = parseInt(argv[++i], 10) || 3; continue; }
    if (arg.startsWith('--'))   continue; // unknown flag
    if (arg.includes('/'))      repos.push(arg);
  }

  return { repos, noPush, noClone, iterations };
}

// ============================================================
// File helpers
// ============================================================
function readFileSafe(filePath, maxChars = 3000) {
  try { return readFileSync(filePath, 'utf8').slice(0, maxChars); }
  catch { return null; }
}

/** Recursive directory tree, returns string like `tree` output. */
function dirTree(dir, maxDepth = 2, depth = 0, prefix = '') {
  if (depth >= maxDepth) return '';
  let out = '';
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return ''; }

  const IGNORE = new Set(['node_modules', '__pycache__', '.git', 'dist', 'build',
    '.next', '.nuxt', 'target', 'venv', '.venv', '.mypy_cache', 'coverage']);

  const filtered = entries
    .filter(e => !e.name.startsWith('.') && !IGNORE.has(e.name))
    .slice(0, 40); // cap

  filtered.forEach((entry, i) => {
    const isLast   = i === filtered.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    out += prefix + connector + entry.name + (entry.isDirectory() ? '/' : '') + '\n';
    if (entry.isDirectory() && depth < maxDepth - 1) {
      out += dirTree(join(dir, entry.name), maxDepth, depth + 1, prefix + (isLast ? '    ' : '│   '));
    }
  });
  return out;
}

/** Check if any file in dir (recursively, depth-limited) matches predicate. */
function findFile(dir, predicate, maxDepth = 3, depth = 0) {
  if (depth > maxDepth) return false;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return false; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (predicate(e.name, e.isDirectory())) return true;
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== '.git') {
      if (findFile(join(dir, e.name), predicate, maxDepth, depth + 1)) return true;
    }
  }
  return false;
}

// ============================================================
// Repo type detection
// ============================================================
function detectType(repoPath) {
  const has    = (name)    => existsSync(join(repoPath, name));
  const hasDir = (name)    => has(name) && (() => { try { return readdirSync(join(repoPath, name)).length > 0; } catch { return false; } })();

  /** Search all candidate package files for pattern */
  const pkgMatches = (pattern) => {
    for (const f of ['package.json', 'requirements.txt', 'Cargo.toml',
                      'pyproject.toml', 'go.mod', 'setup.py', 'Gemfile']) {
      const c = readFileSafe(join(repoPath, f), 4000);
      if (c && pattern.test(c)) return true;
    }
    return false;
  };

  // ML / Data Science
  if (findFile(repoPath, n => n.endsWith('.ipynb'), 2)) return 'ml';
  if (pkgMatches(/pandas|numpy|scikit.learn|torch|tensorflow|keras|xgboost|lightgbm/i)) return 'ml';

  // Monorepo
  if (has('lerna.json') || has('turbo.json') || has('pnpm-workspace.yaml') ||
      hasDir('packages') || hasDir('apps')) return 'monorepo';

  // Infrastructure / DevOps
  if (findFile(repoPath, n => n.endsWith('.tf'), 2)) return 'infra';
  if (has('Dockerfile') || has('docker-compose.yml') || has('docker-compose.yaml') ||
      hasDir('k8s') || hasDir('kubernetes') || hasDir('.github/workflows') && !pkgMatches(/react|vue|svelte|next|flask|fastapi/i)) {
    if (has('Dockerfile') || has('docker-compose.yml')) return 'infra';
  }

  // Frontend
  if (pkgMatches(/["']react["']|["']vue["']|["']svelte["']|["']next["']|["']nuxt["']|["']angular["']|["']solid-js["']/i)) return 'frontend';

  // API Server
  if (pkgMatches(/fastapi|flask|express|fastify|django|gin|actix-web|fiber|hono/i)) return 'api';

  // CLI Tool
  if (hasDir('bin') || pkgMatches(/commander|yargs|clap|argparse|click|cobra|oclif/i)) return 'cli';

  // Library / SDK
  const pkg = readFileSafe(join(repoPath, 'package.json'), 2000);
  if (pkg) {
    try {
      const p = JSON.parse(pkg);
      if (p.main || p.exports || p.module || p.types) return 'library';
    } catch {}
  }
  if (readFileSafe(join(repoPath, 'Cargo.toml'), 2000)?.includes('[lib]')) return 'library';

  return 'generic';
}

// ============================================================
// Repo analysis
// ============================================================
function analyzeRepo(repoPath, owner, repo) {
  const analysis = { owner, repo, type: 'generic', structure: '', readme: '', packageFile: '', packageContent: '', sourceFiles: [] };

  // Directory tree
  analysis.structure = dirTree(repoPath, 2);

  // README
  for (const f of ['README.md', 'README.rst', 'README.txt', 'README']) {
    const c = readFileSafe(join(repoPath, f), 4000);
    if (c) { analysis.readme = c; break; }
  }

  // Primary package / manifest file
  for (const f of ['package.json', 'Cargo.toml', 'pyproject.toml', 'requirements.txt', 'go.mod', 'setup.py', 'Gemfile', 'composer.json']) {
    const c = readFileSafe(join(repoPath, f), 2500);
    if (c) { analysis.packageContent = c; analysis.packageFile = f; break; }
  }

  // Detect type
  analysis.type = detectType(repoPath);

  // Key source files by type
  const candidates = {
    ml:       ['train.py', 'model.py', 'src/train.py', 'src/model.py', 'main.py'],
    api:      ['main.py', 'app.py', 'server.js', 'app.js', 'src/main.py', 'src/app.ts'],
    cli:      ['src/main.rs', 'src/main.py', 'bin/cli.js', 'cmd/root.go', 'main.go', 'cli.py'],
    frontend: ['src/App.tsx', 'src/App.jsx', 'src/app.tsx', 'src/main.tsx', 'pages/index.tsx', 'src/routes/+page.svelte'],
    library:  ['src/index.ts', 'src/index.js', 'src/lib.rs', 'src/lib.ts', 'lib/index.js', 'index.ts'],
    infra:    ['Dockerfile', 'docker-compose.yml', 'main.tf', '.github/workflows/deploy.yml'],
    monorepo: ['package.json', 'turbo.json', 'lerna.json'],
    generic:  ['main.py', 'main.js', 'main.go', 'main.rs', 'index.js', 'index.ts', 'app.py'],
  };

  for (const p of (candidates[analysis.type] || candidates.generic)) {
    const c = readFileSafe(join(repoPath, p), 1500);
    if (c) {
      analysis.sourceFiles.push({ name: p, content: c });
      if (analysis.sourceFiles.length >= 2) break;
    }
  }

  return analysis;
}

// ============================================================
// Type-specific visual template descriptions
// ============================================================
function getTypeTemplate(type) {
  const templates = {
    ml: `
VISUAL TEMPLATE: Research Pipeline / Data Science
- Hero section: dataset/project name with a prominent "data science" visual indicator
- Horizontal pipeline diagram showing stages as connected cards:
  Raw Data → Preprocessing → Feature Engineering → Model Training → Evaluation → Results
- Key metrics panel: accuracy, F1, RMSE, or similar — displayed as large colorful STAT TILES
- "Data Snapshot" section: mock/described table preview of the dataset (5 rows)
- Model architecture or algorithm callout card
- Results visualization section with bar/line chart represented as styled divs
- Color palette: blues, purples, teals — scientific feel
- Icons: 🧪 📊 🔬 📈 🤖`,

    api: `
VISUAL TEMPLATE: Interactive API Map
- Hero: service name + one-sentence description of what the API does
- Endpoint gallery: each route as a card with METHOD badge:
  GET (green), POST (blue), PUT (yellow), DELETE (red), PATCH (orange)
  Include: path, brief description, request/response summary
- Architecture diagram as a horizontal flow:
  Client → API Gateway → Middleware → Routes → Database/Services
- Authentication section with shield icon showing auth method (JWT, OAuth, API key)
- Key stats tiles: number of endpoints, auth type, database, avg response time
- Color palette: greens, teals, with method-color accents
- Icons: 🌐 🔒 ⚡ 🛡️ 📡`,

    cli: `
VISUAL TEMPLATE: Terminal-Style Showcase
- Hero: tool name displayed in a REALISTIC dark terminal window with the command:
  $ tool-name --help  (then show the help output styled as terminal text)
- Command tree: visual hierarchy of subcommands and flags, styled like a file tree
  ├── command1 [flags]
  └── command2 [flags]
- "What it does" as 3 punchy icon+text feature cards
- Example usage section: multiple dark code blocks with realistic, practical examples
- Installation section: package manager commands (npm install -g / cargo install / pip install)
- Color palette: dark background (#0d1117), green terminal text, amber for prompts
- Icons: 💻 ⚙️ 🔧 🚀 📦`,

    frontend: `
VISUAL TEMPLATE: Component Showcase / UI Gallery
- Hero: app name + tagline, with a gradient glass card and screenshot-like wireframe
- Component map: a visual grid of key UI components as mini labeled cards with icons
- Page/route flow diagram: screens connected by arrows
  e.g. Landing → Login → Dashboard → Settings → Profile
- Tech stack badges: logos/names of React/Vue/Svelte, styling library, build tool, etc.
- "Key Screens" section: describe/sketch 3-4 main views as labeled wireframe-style cards
- Feature highlights: 3-6 cards describing what makes the UX special
- Color palette: vibrant gradients, glassmorphism, product-design feel
- Icons: 🎨 ✨ 📱 🖥️ ⚡`,

    library: `
VISUAL TEMPLATE: Developer Docs Landing Page
- Hero: package name + ONE-LINE install command in a prominent copyable code block:
  npm install package-name  or  pip install package  or  cargo add package
  Include version badge and download count stat
- "Why use this?" — exactly 3 value-proposition cards with icons and 2-3 sentence descriptions
- API surface table: key functions/methods/classes with signatures and one-line descriptions
- Code example: a realistic, practical usage example in a styled dark code block
- Compatibility section: language/runtime version badges, browser support, bundle size
- Ecosystem/dependency diagram if relevant
- Color palette: clean neutral with accent highlights — professional docs feel
- Icons: 📦 ⚡ 🔌 🛠️ 📚`,

    infra: `
VISUAL TEMPLATE: Cloud Architecture Diagram
- Hero: what infrastructure this provisions/manages in one clear sentence
- Architecture diagram using styled divs and arrows to show:
  Services (DB, cache, queue, compute nodes) connected by labeled arrows
  Color-code by service type (database=blue, cache=red, compute=green, etc.)
- Resource inventory table: service/resource name, type, region, purpose
- Environment pipeline strip: Dev → Staging → Production with status indicators
- Configuration highlights: key env vars and config options (names and descriptions ONLY — no values)
- Security section: IAM/RBAC, networking rules, secrets management approach
- Color palette: slate, indigo, with service-type color accents
- Icons: ☁️ 🗄️ ⚡ 🔒 🌐 📊`,

    monorepo: `
VISUAL TEMPLATE: Constellation / Package Map
- Hero: monorepo name + total package count + brief description
- Package constellation: a visual graph where each package is a node (styled card)
  Sized differently based on importance/LOC, connected by dependency arrows
  Each package gets its own accent color
- Per-package cards: name, version, description, key exports/entry points
- Dependency matrix: show which packages depend on which (visual grid or arrow map)
- Shared tooling strip: linter, formatter, test runner, CI — shown as icon badges
- Getting started section: install + build commands
- Color palette: multi-hue — each package has its own color from a defined palette
- Icons: 🗂️ 📦 🔗 ⚙️ 🚀`,

    generic: `
VISUAL TEMPLATE: Project Showcase (Default)
- Hero: project name, one-sentence description, and 2-3 key value props as badges
- Overview card: what problem it solves, who it's for, why it matters — NOT a README dump
- Key Features: 4-6 feature cards, each with an icon, name, and 1-2 sentence description
- How It Works / Architecture: diagram or numbered step-by-step flow with visual connectors
- Tech Stack: language/framework/tool badges in a grid
- Getting Started: installation and quick-start code in a dark code block
- Color palette: clean, professional with orange accent highlights
- Icons: chosen to match the project domain`,
  };

  return templates[type] || templates.generic;
}

// ============================================================
// Build LLM context (stays under ~4000 tokens / ~16KB)
// ============================================================
function buildContext(analysis, isExternal) {
  const sections = [];

  sections.push(`## Repository: ${analysis.owner}/${analysis.repo}`);
  if (isExternal) {
    sections.push(`⚠️  EXTERNAL REPOSITORY — You MUST display an "External — ${analysis.owner}" badge prominently at the top of the page (below the repo title). Style it with an orange/warning color.`);
  }
  sections.push(`## Detected Project Type: ${analysis.type}`);

  sections.push('## Directory Structure\n```\n' + (analysis.structure || '(empty)') + '```');

  if (analysis.readme) {
    sections.push('## README (truncated)\n' + analysis.readme.slice(0, 3500));
  } else {
    sections.push('## README\n(No README found)');
  }

  if (analysis.packageContent) {
    sections.push(`## ${analysis.packageFile}\n\`\`\`\n${analysis.packageContent}\n\`\`\``);
  }

  for (const sf of analysis.sourceFiles) {
    sections.push(`## ${sf.name} (key source file)\n\`\`\`\n${sf.content}\n\`\`\``);
  }

  return sections.join('\n\n');
}

// ============================================================
// CSS design system (inlined into generated pages)
// ============================================================
const DESIGN_CSS = `
:root {
  --bg-primary:#f5f5f7; --bg-secondary:#ffffff; --bg-tertiary:#f0f0f2; --bg-card:#ffffff;
  --text-primary:rgb(43,25,16); --text-secondary:#86868b; --border-color:rgba(0,0,0,0.08);
  --accent-color:rgb(224,100,57); --accent-hover:rgb(200,85,45); --accent-subtle:rgba(224,100,57,0.1);
  --success-color:#34c759; --warning-color:#ff9500; --error-color:#ff3b30; --info-color:#007aff;
  --shadow-sm:0 1px 2px 0 rgba(0,0,0,0.05);
  --shadow-md:0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06);
  --shadow-lg:0 8px 32px rgba(0,0,0,0.12);
  --radius-sm:8px; --radius-md:12px; --radius-lg:16px; --radius-xl:24px;
}
[data-theme="dark"] {
  --bg-primary:#000000; --bg-secondary:#1c1c1e; --bg-tertiary:#2c2c2e; --bg-card:#1c1c1e;
  --text-primary:#f5f5f7; --text-secondary:#86868b; --border-color:rgba(255,255,255,0.1);
  --accent-color:rgb(224,100,57); --accent-hover:rgb(240,115,70); --accent-subtle:rgba(224,100,57,0.15);
  --success-color:#30d158; --warning-color:#ff9f0a; --error-color:#ff453a; --info-color:#0a84ff;
  --shadow-sm:0 1px 2px 0 rgba(0,0,0,0.3);
  --shadow-md:0 4px 6px -1px rgba(0,0,0,0.4),0 2px 4px -1px rgba(0,0,0,0.2);
  --shadow-lg:0 8px 32px rgba(0,0,0,0.5);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
body{background:var(--bg-primary);color:var(--text-primary);min-height:100vh;transition:background .3s,color .3s}
`.trim();

// ============================================================
// Cerebras API call
// ============================================================
async function callCerebras(apiKey, messages) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const t0 = Date.now();
      const res = await fetch(CEREBRAS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          max_tokens: 8192,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(120_000), // 2-minute timeout
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from API');

      // tokens/sec — prefer Cerebras time_info, fall back to wall clock
      const completionTokens = data.usage?.completion_tokens ?? 0;
      const elapsedSec = data.time_info?.completion_time ?? ((Date.now() - t0) / 1000);
      const tps = elapsedSec > 0 ? Math.round(completionTokens / elapsedSec) : 0;

      return { content, tps };
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        process.stderr.write(`    ⚠  API attempt ${attempt} failed (${err.message}), retrying…\n`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastError;
}

/** Extract HTML from a response that might wrap it in a code fence. */
function extractHTML(content) {
  // Try ```html ... ``` block
  const fenced = content.match(/```html?\s*([\s\S]+?)```/i);
  if (fenced) return fenced[1].trim();
  // Try raw <!DOCTYPE html> block
  const doctype = content.match(/(<!DOCTYPE html[\s\S]+)/i);
  if (doctype) return doctype[1].trim();
  return content.trim();
}

// ============================================================
// Generate a visual page (LLM iterations)
// ============================================================
async function generatePage(apiKey, analysis, isExternal, iterations) {
  const context      = buildContext(analysis, isExternal);
  const typeTemplate = getTypeTemplate(analysis.type);

  const SYSTEM = `You are an expert UI/UX designer and front-end developer creating beautiful, self-contained HTML showcase pages for GitHub repositories.

Design System CSS Variables (USE THESE EXACTLY):
\`\`\`css
${DESIGN_CSS}
\`\`\`

Hard rules:
1. Output ONLY a complete HTML document starting with <!DOCTYPE html> — no preamble, no explanation.
2. All CSS and JavaScript must be inline (no external dependencies, no CDN links).
3. Include a dark/light mode toggle: toggle the \`data-theme\` attribute on the \`<html>\` element; persist to localStorage.
4. The page must be mobile-responsive.
5. Make it visually STUNNING — use cards, icons (Unicode or inline SVG), gradients, stat tiles, diagrams.
6. Do NOT dump the README verbatim — transform and curate the content visually.
7. Include a "← Back to Explorer" link at the top linking to ../../index.html.`;

  const INITIAL_PROMPT = `Repository context:
${context}

Visual template for "${analysis.type}" projects:
${typeTemplate}

Generate a complete single-file HTML page that visually showcases the ${analysis.owner}/${analysis.repo} repository.

Requirements:
- Follow the visual template above for "${analysis.type}" projects
- Use the CSS design system variables provided
- Include: what it does, why it matters, how it works, tech stack
- Make it visually ENGAGING — not a wall of text
- Include a realistic, working dark/light mode toggle
- Include a "← Back to Explorer" link at the top (href="../../index.html")
${isExternal ? `- Add an "External — ${analysis.owner}" warning badge near the top, styled in warning orange` : ''}

Output only the complete HTML document.`;

  const REFINEMENT_LABELS = [
    'Improving visual hierarchy and layout…',
    'Enhancing typography and spacing…',
    'Adding more icons, diagrams, and visual elements…',
    'Refining color usage and contrast…',
    'Improving content clarity and copywriting…',
    'Enhancing cards, stat tiles, and data displays…',
    'Perfecting dark/light mode consistency…',
    'Adding interactive flourishes and hover effects…',
    'Final visual polish and responsiveness…',
  ];

  // Iteration 1: initial generation
  process.stdout.write(`    Iteration  1/${iterations}: Generating initial HTML… `);
  const r1 = await callCerebras(apiKey, [
    { role: 'system',  content: SYSTEM },
    { role: 'user',    content: INITIAL_PROMPT },
  ]);
  log(`${r1.tps} tok/s`);
  let html = extractHTML(r1.content);

  // Iterations 2–N: refinement
  for (let i = 2; i <= iterations; i++) {
    const label = REFINEMENT_LABELS[i - 2] || 'Refining…';
    process.stdout.write(`    Iteration ${String(i).padStart(2)}/${iterations}: ${label} `);

    const refinePrompt = `You previously generated this HTML page for the ${analysis.owner}/${analysis.repo} (${analysis.type}) repository.

Current version:
\`\`\`html
${html.slice(0, 12000)}
\`\`\`

This is iteration ${i} of ${iterations}. Make SIGNIFICANT improvements:
- Fix any layout bugs, broken dark mode, or poor contrast
- Add richer visual elements: diagrams, flow arrows, stat tiles, progress indicators
- Improve information density and scannability — use a grid layout where possible
- Ensure every section matches the "${analysis.type}" visual template
- Tighten copy: be specific, punchy, and informative
- Enhance mobile responsiveness
${isExternal ? `- Keep the "External — ${analysis.owner}" badge prominently visible` : ''}

Output only the improved complete HTML document.`;

    const rN = await callCerebras(apiKey, [
      { role: 'system', content: SYSTEM },
      { role: 'user',   content: refinePrompt },
    ]);
    log(`${rN.tps} tok/s`);
    html = extractHTML(rN.content);
  }

  return html;
}

// ============================================================
// Manifest management
// ============================================================
function readManifest() {
  const p = join(__dirname, 'repos', 'manifest.json');
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch { return { generated: [] }; }
}

function writeManifest(manifest) {
  mkdirSync(join(__dirname, 'repos'), { recursive: true });
  writeFileSync(join(__dirname, 'repos', 'manifest.json'), JSON.stringify(manifest, null, 2));
}

function upsertManifestEntry(manifest, entry) {
  const idx = manifest.generated.findIndex(e => e.fullName === entry.fullName);
  if (idx >= 0) manifest.generated[idx] = entry;
  else manifest.generated.push(entry);
}

// ============================================================
// Git helpers
// ============================================================
function detectGitUsername() {
  try {
    const origin = execSync('git remote get-url origin', { cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe'] })
      .toString().trim();
    const m = origin.match(/github\.com[:/]([^/]+)\//);
    if (m) return m[1];
  } catch {}
  return process.env.GITHUB_USERNAME || null;
}

function gitExec(cmd) {
  return execSync(cmd, { cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

// ============================================================
// Logging
// ============================================================
function log(msg) { process.stdout.write(msg + '\n'); }

// ============================================================
// Main
// ============================================================
async function main() {
  loadEnv();

  const { repos: repoArgs, noPush, noClone, iterations } = parseArgs(process.argv.slice(2));

  if (repoArgs.length === 0) {
    log('Usage: node generate.js owner/repo1 owner/repo2 ...');
    log('');
    log('Options:');
    log('  --no-push         Skip git commit and push');
    log('  --no-clone        Reuse existing tmp/repos/ clones');
    log('  --iterations N    Number of refinement iterations (default: 10)');
    log('');
    log('Example:');
    log('  node generate.js seb/my-project johndoe/cool-lib');
    process.exit(1);
  }

  if (repoArgs.length > MAX_REPOS) {
    log(`Error: maximum ${MAX_REPOS} repos per run (got ${repoArgs.length}).`);
    process.exit(1);
  }

  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    log('Error: CEREBRAS_API_KEY not set.');
    log('Create a .env file:  echo "CEREBRAS_API_KEY=your_key" > .env');
    process.exit(1);
  }

  const homeUser = detectGitUsername();
  const tmpDir   = join(__dirname, 'tmp', 'repos');
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(join(__dirname, 'repos'), { recursive: true });

  const manifest = readManifest();
  const generated = [];

  for (const fullName of repoArgs) {
    const parts = fullName.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      log(`\n✗ Invalid format: "${fullName}" — expected owner/repo`);
      continue;
    }
    const [owner, repo] = parts;
    const isExternal = homeUser && owner.toLowerCase() !== homeUser.toLowerCase();

    log(`\n${'─'.repeat(60)}`);
    log(`📦 ${fullName}${isExternal ? '  (external)' : ''}`);
    log(`${'─'.repeat(60)}`);

    // --- Clone ---
    const cloneDir = join(tmpDir, `${owner}-${repo}`);
    if (noClone && existsSync(cloneDir)) {
      log('  ⟳  Using existing clone');
    } else {
      if (existsSync(cloneDir)) {
        log('  ⟳  Refreshing existing clone…');
        try {
          gitExec(`git -C "${cloneDir}" fetch --depth 1 origin HEAD`);
          gitExec(`git -C "${cloneDir}" reset --hard FETCH_HEAD`);
        } catch {
          log('  ↓  Clone refresh failed, re-cloning…');
          try { execSync(`rm -rf "${cloneDir}"`, { stdio: 'pipe' }); } catch {}
          try {
            execSync(`git clone --depth 1 "https://github.com/${owner}/${repo}.git" "${cloneDir}"`, {
              stdio: ['pipe', 'pipe', 'pipe'], timeout: 90_000,
            });
          } catch (err) {
            log(`  ✗  Clone failed: ${err.message.slice(0, 120)}`);
            continue;
          }
        }
      } else {
        log(`  ↓  Cloning https://github.com/${owner}/${repo} …`);
        try {
          execSync(`git clone --depth 1 "https://github.com/${owner}/${repo}.git" "${cloneDir}"`, {
            stdio: ['pipe', 'pipe', 'pipe'], timeout: 90_000,
          });
        } catch (err) {
          log(`  ✗  Clone failed: ${err.message.slice(0, 120)}`);
          log('     (Is the repo public? Is the name correct?)');
          continue;
        }
      }
    }

    // --- Analyse ---
    log('  🔍 Analysing repository…');
    const analysis = analyzeRepo(cloneDir, owner, repo);
    log(`  🏷  Detected type: ${analysis.type}`);

    // --- Generate ---
    log(`  ✨ Generating visual page (${iterations} iterations)…`);
    let html;
    try {
      html = await generatePage(apiKey, analysis, isExternal, iterations);
    } catch (err) {
      log(`  ✗  Generation failed: ${err.message}`);
      continue;
    }

    // --- Write ---
    const outDir  = join(__dirname, 'repos', repo);
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'index.html');
    writeFileSync(outPath, html, 'utf8');

    const sizeKB = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
    log(`  ✅ Written: repos/${repo}/index.html  (${sizeKB} KB)`);

    const entry = {
      owner,
      repo,
      fullName,
      path: `repos/${repo}/index.html`,
      url:  `repos/${repo}/`,
      isExternal: Boolean(isExternal),
      type: analysis.type,
      generatedAt: new Date().toISOString(),
    };
    upsertManifestEntry(manifest, entry);
    generated.push(entry);
  }

  if (!generated.length) {
    log('\n❌ No pages were generated successfully.');
    process.exit(1);
  }

  // --- Update manifest ---
  writeManifest(manifest);
  log(`\n📋 Updated repos/manifest.json (${manifest.generated.length} total entries)`);

  // --- Git commit + push ---
  if (noPush) {
    log('\n⏭  Skipping git commit (--no-push).');
  } else {
    log('\n🚀 Committing and pushing to GitHub…');
    try {
      const names = generated.map(g => g.repo).join(', ');
      gitExec('git add repos/');
      gitExec(`git commit -m "Generate pages for ${names}"`);
      gitExec('git push');
      log('✅ Pushed!');
      log('\n🎉 Your pages are live! Refresh index.html to see them.');
      for (const g of generated) {
        log(`   → repos/${g.repo}/`);
      }
    } catch (err) {
      log('⚠️  Git push failed. Run manually:');
      log(`   git add repos/ && git commit -m "Generate pages for ${generated.map(g => g.repo).join(', ')}" && git push`);
    }
  }

  log('');
}

main().catch(err => {
  process.stderr.write(`\nFatal: ${err.message}\n`);
  process.exit(1);
});
