#!/usr/bin/env node
/**
 * server.js — Local development server for meta-github-pages
 *
 * Serves local-manager.html and provides backend API for auto-generation
 *
 * Usage:
 *   npm start
 *   or
 *   node server.js
 *
 * Then open: http://localhost:3000/local-manager.html
 */

import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// GET / — serve local manager directly as the default page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'local-manager.html'));
});

// GET /local-manager — serve without .html extension
app.get('/local-manager', (req, res) => {
  res.sendFile(path.join(__dirname, 'local-manager.html'));
});

// Static files — AFTER custom routes so / serves local-manager, not index.html
app.use(express.static(__dirname));

// POST /api/generate — runs generate.js and streams output
app.post('/api/generate', (req, res) => {
  const { repos } = req.body;

  if (!repos || !Array.isArray(repos) || repos.length === 0) {
    return res.status(400).json({ error: 'No repos provided' });
  }

  if (repos.length > 5) {
    return res.status(400).json({ error: 'Maximum 5 repos per generation' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial event
  res.write(`data: ${JSON.stringify({ type: 'start', message: 'Starting generation...' })}\n\n`);

  // Spawn generate.js as child process
  const args = [path.join(__dirname, 'generate.js'), ...repos];
  const child = spawn(process.execPath, args, {
    cwd: __dirname,
    env: { ...process.env, NO_PUSH: '1' } // Don't auto-push
  });

  let output = '';
  let errorOutput = '';

  child.stdout.on('data', (data) => {
    output += data.toString();
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      res.write(`data: ${JSON.stringify({ type: 'stdout', message: line })}\n\n`);
    });
  });

  child.stderr.on('data', (data) => {
    errorOutput += data.toString();
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      res.write(`data: ${JSON.stringify({ type: 'stderr', message: line })}\n\n`);
    });
  });

  child.on('close', (code) => {
    if (code === 0) {
      res.write(`data: ${JSON.stringify({ type: 'success', message: 'Generation completed successfully!' })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: `Generation failed with exit code ${code}`, error: errorOutput })}\n\n`);
    }
    res.end();
  });

  child.on('error', (err) => {
    res.write(`data: ${JSON.stringify({ type: 'error', message: `Failed to start generation: ${err.message}` })}\n\n`);
    res.end();
  });

  // Close connection if client disconnects
  req.on('close', () => {
    child.kill();
  });
});

// GET /api/manifest — reload manifest.json
app.get('/api/manifest', (req, res) => {
  try {
    const manifestPath = path.join(__dirname, 'repos', 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      res.json(data);
    } else {
      res.status(404).json({ error: 'Manifest not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Repository Explorer running at http://localhost:${PORT}`);
  console.log(`📁 Serving from: ${__dirname}`);
  console.log(`\nOpen http://localhost:${PORT}/local-manager.html in your browser\n`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  process.exit(0);
});