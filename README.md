# Meta GitHub Pages

A visual portfolio generator for GitHub repositories, powered by Cerebras AI. Automatically discover your repos, generate rich, beautiful visual pages, and deploy them as your portfolio site.

## Features

- **Interactive Dashboard** - Browse and select your GitHub repositories
- **AI-Powered Generation** - Creates stunning visual pages automatically using Cerebras AI
- **Type-Specific Templates** - Custom layouts for ML projects, APIs, CLIs, frontend apps, and more
- **Dark/Light Mode** - Fully themed with smooth transitions
- **Auto-Deployment** - Push to main, and GitHub Pages handles the rest
- **External Repos** - Generate pages for public repos from any GitHub user

## Getting Started

### Prerequisites

- Node.js >= 18
- A Cerebras API key from [cloud.cerebras.ai](https://cloud.cerebras.ai)
- Git

### Installation

1. Clone this repository:
```bash
git clone https://github.com/sebastiand-cerebras/meta-repo.git
cd meta-repo
```

2. Install dependencies:
```bash
npm install
```

3. Set up your Cerebras API key:
```bash
cp .env.example .env
# Edit .env and add your CEREBRAS_API_KEY
```

## Usage

### Running Locally

Serve the dashboard locally:
```bash
npx serve .
# OR
python3 -m http.server 8000
# OR
npx http-server .
```

Open http://localhost:8000 in your browser to access the dashboard.

### Generating Portfolio Pages

Generate pages for your repositories:
```bash
node generate.js owner/repo1 owner/repo2 owner/repo3
```

Example:
```bash
node generate.js sebastiand-cerebras/my-project vercel/next.js
```

**What happens:**
1. Clones repositories to `tmp/repos/`
2. Analyzes code structure, README, and dependencies
3. Uses Cerebras AI to generate a beautiful visual page
4. Saves the page to `repos/{repo-name}/index.html`
5. Updates `repos/manifest.json`
6. Commits and pushes changes to GitHub

### Options

- `--no-push` - Skip git commit and push
- `--no-clone` - Reuse existing clones in `tmp/repos/`
- `--iterations N` - Number of AI refinement iterations (default: 3)

Example:
```bash
node generate.js --iterations 10 --no-push owner/repo
```

## Project Structure

```
meta-repo/
├── index.html              # Main dashboard
├── assets/
│   └── styles.css          # Shared design system
├── generate.js             # Page generation script
├── config.js               # Optional branding config
├── .github/workflows/
│   └── deploy.yml          # GitHub Pages auto-deployment
├── repos/
│   ├── manifest.json       # Metadata about generated pages
│   ├── repo1/
│   │   └── index.html      # Generated page for repo1
│   └── repo2/
│       └── index.html      # Generated page for repo2
└── tmp/repos/              # Temporary clones during generation
```

## Deployment

This project is configured for automatic deployment to GitHub Pages. When you push to the `main` branch, GitHub Actions will automatically deploy your site.

The deployment URL is: `https://sebastiand-cerebras.github.io/meta-repo`

## Customization

### Branding

Edit `config.js` to customize the site:
- `brandName` - Site header title
- `accentColor` - CSS accent color
- `logoDark` / `logoLight` - Logo images
- `githubUsername` - Default username to load

### Type Templates

The generator automatically detects project types:
- **ML** - Research pipeline visualizations
- **API** - Interactive endpoint maps
- **CLI** - Terminal-style showcases
- **Frontend** - Component galleries
- **Library** - Developer docs landing pages
- **Infrastructure** - Cloud architecture diagrams
- **Monorepo** - Package constellations
- **Generic** - Clean project showcases

## Troubleshooting

**API Key Issues**
- Ensure your `.env` file has a valid `CEREBRAS_API_KEY`
- Check [cloud.cerebras.ai](https://cloud.cerebras.ai) for your API status

**GitHub Pages Not Deploying**
- Check the Actions tab for workflow errors
- Ensure GitHub Pages is enabled in repo settings
- Verify the `.github/workflows/deploy.yml` file exists

**Generated Pages Not Showing**
- Refresh the dashboard after generation
- Check that `repos/manifest.json` was updated
- Verify the pages are in `repos/{repo-name}/index.html`

## License

MIT

## Powered By

![Cerebras](https://cloud.cerebras.ai) - AI-powered intelligence at warp speed