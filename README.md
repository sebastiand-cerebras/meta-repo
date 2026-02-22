# Meta GitHub Pages

A visual portfolio generator for GitHub repositories, powered by Cerebras AI. Automatically discover your repos, generate rich, beautiful visual pages, and deploy them as your portfolio site.

## Architecture

This project consists of two services:

### 1. Hosted Display (`index.html`)
A clean, read-only portfolio gallery that showcases your generated pages. This is what visitors see on GitHub Pages.

- **Purpose**: Display generated portfolio pages to visitors
- **Deployment**: Hosted on GitHub Pages
- **Features**: Clean gallery, "Clone Local Manager" button, how-to section
- **No authentication or repo selection** - just for viewing results

### 2. Local Manager (`local-manager.html`)
A local tool for discovering repositories, managing selections, and generating pages.

- **Purpose**: Browse repos, select what to generate, run `generate.js`
- **Runs**: Locally in your browser
- **Features**:
  - Local repository scanning (via File System Access API)
  - GitHub repository browsing
  - External repo input
  - Selection panel (max 5 repos at a time)
  - gh CLI authentication status
  - Generate command display
- **Theme**: Light mode default

## Workflow

1. **Download** - Clone this repo and open `local-manager.html` locally
2. **Browse** - Scan local repos or browse GitHub repos
3. **Select** - Choose up to 5 repositories (or enter external repos)
4. **Generate** - Run the displayed `generate.js` command
5. **Deploy** - Push changes to deploy to GitHub Pages
6. **View** - Visitors see your portfolio gallery at the hosted URL

## Getting Started

### Prerequisites

- Node.js >= 18
- A Cerebras API key from [cloud.cerebras.ai](https://cloud.cerebras.ai)
- Git
- gh CLI (optional, recommended)

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

4. (Optional) Set up gh CLI for GitHub operations:
```bash
gh auth login
```

## Usage

### Using the Local Manager

1. Open `local-manager.html` in your browser:
```bash
open local-manager.html
# or serve it
npx serve . open http://localhost:3000/local-manager.html
```

2. Browse repositories:
   - **Local Repos**: Click "Scan Directories" to search for git repos (uses File System Access API)
   - **GitHub Repos**: Enter a username to browse public GitHub repositories
   - **External**: Manually add any `owner/repo` for external repositories

3. Select repositories (up to 5) by clicking on cards

4. Copy the generate command and run it:
```bash
node generate.js owner/repo1 owner/repo2 owner/repo3
```

5. Push to deploy:
```bash
git add repos/
git commit -m "Generate pages for my repos"
git push
```

6. Visit the hosted URL to see your portfolio gallery

### Viewing the Portfolio Gallery

The gallery is automatically deployed to GitHub Pages when you push. Visit:
- **Your site**: `https://sebastiand-cerebras.github.io/meta-repo`
- Or your configured `homepageUrl` if different

## Project Structure

```
meta-repo/
├── index.html              # Hosted: Portfolio gallery (read-only showcase)
├── local-manager.html      # Local: Repo browser, auth, generation interface
├── generate.js             # Page generation script
├── config.js               # Optional branding config
├── assets/
│   └── styles.css          # Shared design system
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

## Generate.js Options

Generate pages with options:

```bash
# Basic usage
node generate.js owner/repo1 owner/repo2

# Skip git push
node generate.js --no-push owner/repo1

# Reuse existing clones (faster)
node generate.js --no-clone owner/repo1

# More iterations (better quality, slower)
node generate.js --iterations 10 owner/repo1 owner/repo2
```

**Options:**
- `--no-push` - Skip git commit and push
- `--no-clone` - Reuse existing clones in `tmp/repos/`
- `--iterations N` - Number of AI refinement iterations (default: 3)

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

## Deployment

This project is configured for automatic deployment to GitHub Pages. When you push to the `main` branch, GitHub Actions will automatically deploy your site.

The deployment URL is: `https://sebastiand-cerebras.github.io/meta-repo`

## Troubleshooting

### Local Manager Issues

**Local repo scanning not working?**
- File System Access API requires HTTPS or localhost
- Try using `npx serve .` instead of opening `file://`
- Or use GitHub repos / external repos instead

**GitHub repos not loading?**
- Check GitHub API rate limits
- Verify username is correct
- Try refreshing after a minute

### Generation Issues

**API Key Issues**
- Ensure your `.env` file has a valid `CEREBRAS_API_KEY`
- Check [cloud.cerebras.ai](https://cloud.cerebras.ai) for your API status

**gh CLI not authenticated**
- Run `gh auth login` in your terminal
- Check status with `gh auth status`
- Local Manager shows auth status manually

**Generated Pages Not Showing**
- Refresh the dashboard after generation
- Check that `repos/manifest.json` was updated
- Verify the pages are in `repos/{repo-name}/index.html`

### Deployment Issues

**GitHub Pages Not Deploying**
- Check the Actions tab for workflow errors
- Ensure GitHub Pages is enabled in repo settings
- Verify the `.github/workflows/deploy.yml` file exists

## License

MIT

## Powered By

![Cerebras](https://cloud.cerebras.ai) - AI-powered intelligence at warp speed