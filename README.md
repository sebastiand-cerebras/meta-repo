# Meta GitHub Pages

A visual portfolio generator for GitHub repositories, powered by Cerebras AI. Automatically discover your repos, generate rich, beautiful visual pages, and deploy them as your portfolio site.

## Architecture

This project consists of two services:

### 1. Hosted Display (`index.html`)
A clean, read-only portfolio gallery that showcases your generated pages. This is what visitors see on GitHub Pages.

- **Purpose**: Display generated portfolio pages to visitors
- **Deployment**: Hosted on GitHub Pages
- **Features**: Clean gallery, "Open Portfolio Manager" button, how-to section
- **No authentication or generation** - just for viewing results

### 2. Portfolio Manager (`local-manager.html`)
A local tool (with backend server) for discovering repositories and generating pages.

- **Purpose**: Browse GitHub repos, select what to generate, auto-generate pages
- **Runs**: Locally with `npm start` (Express server on localhost:3000)
- **Features**:
  - GitHub repository browsing (by username)
  - Selection panel (max 5 repos at a time)
  - **Automatic generation** (one click, no manual commands)
  - Real-time progress streaming
  - **Auto-deploys to your GitHub Pages** when complete
- **Theme**: Light mode default

## Workflow

1. **Start the server** - Run `npm start` to launch the local manager
2. **Browse** - Enter your GitHub username to load your repositories
3. **Select** - Choose up to 5 repositories by clicking on cards
4. **Generate** - Click "Generate Pages" and watch the real-time progress
5. **View** - When complete, click "View Your Portfolio" to see the hosted pages

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

4. Start the local manager:
```bash
npm start
```

5. Open your browser to:
```
http://localhost:3000
```

## Usage

### Generating Portfolio Pages

1. **Open Portfolio Manager**

   After running `npm start`, open http://localhost:3000 in your browser

2. **Load Your Repositories**

   - Enter your GitHub username
   - Click "Load Repos"
   - Browse through your repositories

3. **Select Repositories**

   - Click on up to 5 repository cards to select them
   - Selected repos will be highlighted with an accent color

4. **Generate Pages**

   - Click "Generate Pages" in the sticky selection panel
   - Watch the real-time progress as the AI:
     - Clones your repositories
     - Analyzes code structure
     - Calls Cerebras AI to generate visual pages
     - Creates beautiful, interactive showcase pages

5. **View Your Portfolio**

   - When generation completes, click "View Your Portfolio"
   - This takes you to your hosted GitHub Pages site
   - Your new pages will be visible in the gallery

### Viewing the Portfolio Gallery

The gallery is automatically deployed to GitHub Pages. Visit:
- **Your site**: `https://sebastiand-cerebras.github.io/meta-repo`
- Or your configured `homepageUrl` if different

## Project Structure

```
meta-repo/
├── server.js               # Backend server for auto-generation (new)
├── index.html              # Hosted: Portfolio gallery (read-only showcase)
├── local-manager.html      # Local: Repo browser with auto-generation
├── generate.js             # Page generation script (used by server)
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

The generation happens automatically when you click "Generate Pages", but you can also run it manually with options:

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

### Server Not Starting

**Port 3000 already in use?**
- Change the port by editing `server.js` and modifying `const PORT = 3000;`

**Dependencies missing?**
- Run `npm install` to install all required packages

### Generation Issues

**API Key Issues**
- Ensure your `.env` file has a valid `CEREBRAS_API_KEY`
- Check [cloud.cerebras.ai](https://cloud.cerebras.ai) for your API status

**Generation stuck or slow?**
- Cerebras AI generation can take 1-3 minutes per repository
- Watch the progress modal for real-time updates
- If it fails, check the error message in the modal

**Pages not appearing after generation?**
- The manager will automatically reload the manifest
- If you're viewing the hosted site, wait 1-2 minutes for GitHub Actions to deploy
- Check the Actions tab on GitHub to see deployment status

### GitHub API Issues

**Rate limit hit?**
- GitHub API allows 60 requests/hour for unauthenticated requests
- Wait an hour and try again
- Consider creating a GitHub personal access token

**Repos not loading?**
- Verify the username is correct
- Check that the account has public repositories
- Try a different username to test

## License

MIT

## Powered By

![Cerebras](https://cloud.cerebras.ai) - AI-powered intelligence at warp speed