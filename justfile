# Meta GitHub Pages - Task Runner
# Install: brew install just
# Usage: just <command>

# Default recipe (shows available commands)
default:
    @just --list

# ============================================================
# Setup
# ============================================================

# Check prerequisites (node, gh, npm)
check:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "🔍 Checking prerequisites..."
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Install: brew install node"
        exit 1
    fi
    echo "✅ Node.js $(node --version)"
    if ! command -v npm &> /dev/null; then
        echo "❌ npm not found"
        exit 1
    fi
    echo "✅ npm $(npm --version)"
    if ! command -v gh &> /dev/null; then
        echo "❌ GitHub CLI not found. Install: brew install gh"
        exit 1
    fi
    echo "✅ gh $(gh --version | head -1)"
    if ! command -v git &> /dev/null; then
        echo "❌ git not found"
        exit 1
    fi
    echo "✅ git $(git --version)"
    echo ""
    echo "All prerequisites satisfied ✨"

# Install project dependencies
install:
    @echo "📦 Installing dependencies..."
    npm install
    @echo "✅ Dependencies installed"

# Setup environment (create .env from .env.example)
setup:
    #!/usr/bin/env bash
    if [ -f .env ]; then
        echo "⚠️  .env already exists, skipping..."
    else
        cp .env.example .env
        echo "✅ Created .env from .env.example"
        echo "⚠️  Edit .env and add your CEREBRAS_API_KEY"
    fi

# Full setup: check → install → setup .env
init: check install setup
    @echo ""
    @echo "🎉 Setup complete!"
    @echo ""
    @echo "Next steps:"
    @echo "  1. Edit .env and add your CEREBRAS_API_KEY from https://cloud.cerebras.ai"
    @echo "  2. Authenticate with GitHub: gh auth login"
    @echo "  3. Start the server: just start"

# ============================================================
# Server
# ============================================================

# Start the local manager (port 3200)
start:
    @echo "🚀 Starting local manager on http://localhost:3200"
    node server.js

# Stop any running server on port 3200
stop:
    @echo "🛑 Stopping server on port 3200..."
    @lsof -ti:3200 | xargs kill -9 2>/dev/null || echo "No server running"

# Restart the server
restart: stop start

# ============================================================
# Generation
# ============================================================

# Generate pages for specific repos (usage: just generate owner/repo1 owner/repo2)
generate *REPOS:
    node generate.js {{REPOS}}

# Generate without pushing to GitHub
generate-local *REPOS:
    node generate.js --no-push {{REPOS}}

# Regenerate all pages in manifest.json
regen-all:
    @echo "🔄 Regenerating all pages..."
    ./regen-all.sh

# Regenerate all pages without pushing
regen-all-local:
    @echo "🔄 Regenerating all pages (local only)..."
    ./regen-all.sh --no-push

# ============================================================
# Cleanup
# ============================================================

# Delete a generated page (usage: just delete repo-name)
delete REPO:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ ! -d "repos/{{REPO}}" ]; then
        echo "❌ repos/{{REPO}}/ does not exist"
        exit 1
    fi
    echo "🗑️  Deleting repos/{{REPO}}/"
    rm -rf "repos/{{REPO}}/"
    echo "📝 Updating manifest.json..."
    node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('repos/manifest.json','utf8')); m.generated=m.generated.filter(e=>e.repo!=='{{REPO}}'); fs.writeFileSync('repos/manifest.json',JSON.stringify(m,null,2));"
    echo "✅ Deleted {{REPO}}"
    echo "💾 Commit changes:"
    echo "   git add repos/ && git commit -m 'Remove {{REPO}} page' && git push"

# Clean cached repo clones (tmp/)
clean:
    @echo "🧹 Cleaning tmp/ directory..."
    @du -sh tmp/ 2>/dev/null || echo "tmp/ is empty"
    rm -rf tmp/
    @echo "✅ Cleaned"

# Show disk usage of tmp/
disk:
    @echo "💾 Disk usage:"
    @du -sh tmp/ 2>/dev/null || echo "tmp/ does not exist"
    @echo ""
    @echo "Cached repos:"
    @ls tmp/repos/ 2>/dev/null | wc -l | xargs echo "  "

# ============================================================
# Development
# ============================================================

# View manifest.json
manifest:
    @cat repos/manifest.json | jq '.'

# List all generated pages
list:
    @echo "📄 Generated pages:"
    @cat repos/manifest.json | jq -r '.generated[] | "  \(.repo) (\(.type)) - \(.owner)"'

# Open local manager in browser
open:
    @open http://localhost:3200

# Open GitHub Pages site in browser
open-pages:
    @open https://sebastiand-cerebras.github.io/meta-repo

# ============================================================
# Git
# ============================================================

# Commit and push current changes
push MESSAGE="Update pages":
    git add repos/
    git commit -m "{{MESSAGE}}"
    git push

# View git status
status:
    @git status --short
