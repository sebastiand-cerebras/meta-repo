# Plan: Add Backend Server for Auto-Generation

## Original Request
Transform the local manager to:
1. Remove external repo feature - only GitHub repos by username
2. Remove "check auth manually" feature - not needed
3. Just input a username and pull all GitHub repos
4. When selected repos, automatically execute `node generate.js` via a backend server (don't show the command to user)
5. Show explanation of what's happening during generation with progress updates
6. When done, direct user to go to the hosted GitHub overview page to find the new repos

## User Clarifications
- Backend server is fine for local use - won't be hosted on GitHub Pages
- Browser cannot directly execute Node.js, need a server proxy
- GitHub Pages doesn't support backend servers, so this is purely for local development

## Goal
Create a seamless experience where user:
1. Opens local-manager.html with backend server running
2. Types username, clicks "Load Repos"
3. Selects repos (up to 5)
4. Clicks "Generate Pages"
5. Backend automatically runs `generate.js` and streams progress
6. When complete, shows link to hosted portfolio page

## Approach

### Phase 1: Create Backend Server (server.js)
Create a simple Express server with:
- Static file serving for local-manager.html
- POST endpoint `/api/generate` that:
  - Receives list of repos to generate
  - Spawns `generate.js` as a child process
  - Streams stdout/stderr back to client via Server-Sent Events (SSE)
  - Returns completion status
- Runs on localhost:3000

### Phase 2: Simplify local-manager.html
Remove:
- External repo input section
- GitHub CLI auth check section
- "Generate Command" panel with copy button

Update:
- Username input → GitHub repos (keep)
- Selection panel (keep)
- "Generate Pages" button → triggers backend API call instead of showing command
- Add real-time progress display with streaming updates
- On completion, show success message with link to hosted page
- Loading states and error handling

### Phase 3: Update generate.js
Ensure `generate.js` can be called programmatically with repo arguments
- Keep its existing functionality
- May need to ensure it writes to stdout/stderr for streaming

### Phase 4: Update package.json
- Add `express` dependency
- Add `start` script: `node server.js`
- Update README with new workflow

### Phase 5: Test end-to-end
- Start server
- Open localhost:3000
- Load repos, select, generate
- Verify streaming progress works
- Verify pages actually generated
- Verify manifest.json updated

## Key Files

**Create:**
- `server.js` - Express backend server with SSE streaming

**Modify:**
- `local-manager.html` - Remove external/auth sections, add auto-generation with progress
- `package.json` - Add express dependency and start script
- `README.md` - Update workflow to use server

**Review:**
- `generate.js` - Ensure compatibility with programmatic execution

## File Structure After Changes

```
meta-repo/
├── server.js               # Backend server (new)
├── index.html              # Hosted: Portfolio gallery
├── local-manager.html      # Local:Repo browser, auto-generation (simplified)
├── generate.js             # Page generation script
├── package.json            # Updated with express
├── assets/
│   └── styles.css
├── .github/workflows/
│   └── deploy.yml          # GitHub Pages auto-deployment
├── repos/
│   ├── manifest.json
│   └── repo1/index.html
└── README.md
```

## Design Details

### Backend Server (server.js)
```javascript
- Express app listening on port 3000
- Static files served from root directory
- POST /api/generate endpoint:
  - Body: { repos: ["owner/repo1", "owner/repo2"] }
  - Spawns: child_process.spawn('node', ['generate.js', ...repos])
  - Streams: stdout/stderr to client via SSE
  - Returns: JSON with success/error and manifest reload trigger
```

### Local Manager Frontend Changes
**Removed sections:**
- "Add External Repo" section
- "GitHub CLI Auth" section with check button
- "Command Panel" that shows copy-able command

**New components:**
- "Generate Pages" button:
  - Calls `fetch('/api/generate', { method: 'POST', body: JSON.stringify({ repos }) })`
  - Shows progress modal with streaming logs
  - Disables button during generation
  - On success: reloads manifest, shows success message with link

- Progress Modal:
  - Overlay showing "Generating pages..."
  - Real-time log output from generate.js
  - Loading spinner
  - "View Portfolio" button when complete

- Hero text update:
  - No more "run command" instructions
  - Just "Select repos and click Generate"

### User Flow After Changes
1. `npm install` → `npm start` (starts server on localhost:3000)
2. Browser opens to localhost:3000/local-manager.html
3. Type username → Load Repos
4. Click up to 5 repos to select
5. Click "Generate Pages" button
6. See progress: "Cloning repos...", "Calling Cerebras AI...", "Generating visual pages..."
7. Completion: "✅ Generated 3 pages! View your portfolio →"
8. Click link to go to hosted portfolio page

## Risks

1. **Dependency on local server** - User must run `npm start`, not just open HTML file
   - **Mitigation**: Clear instructions in README: "Run `npm start` then open localhost:3000"

2. **Streaming complexity** - SSE needs proper implementation for real-time updates
   - **Mitigation**: Test spawning process and streaming carefully; fallback to polling if needed

3. **Generate.js blocking** - Long-running generation may timeout
   - **Mitigation**: Increase server timeout, show progress to keep user engaged

4. **Error handling** - If generate.js fails, user needs helpful error message
   - **Mitigation**: Stream stderr to UI, show final error status clearly

## Verification

After completion:
1. ✅ `npm install` works without errors
2. ✅ `npm start` starts server on localhost:3000
3. ✅ localhost:3000/local-manager.html loads
4. ✅ External repo section removed
5. ✅ GitHub CLI auth check removed
6. ✅ Username input loads GitHub repos correctly
7. ✅ Clicking repos selects them (up to 5)
8. ✅ "Generate Pages" button triggers backend call
9. ✅ Progress modal shows streaming logs
10. ✅ Generation completes successfully
11. ✅ Manifest.json updated with new entries
12. ✅ Success message shows "View Portfolio" link
13. ✅ Link goes to correct hosted URL
14. ✅ README.md updated with new workflow