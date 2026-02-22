#!/usr/bin/env node
/**
 * server.js — Local generation server
 *
 * Usage: npm start → http://localhost:3200
 *
 * Architecture: generation runs as a background job (not tied to any HTTP
 * connection). The client polls GET /api/jobs/:id for progress.
 */

import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3200;

// In-memory job store
const jobs = new Map();

// Middleware
app.use(cors());
app.use(express.json());

// GET / — serve the manager UI directly
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'local-manager.html'));
});

// Static files — AFTER custom routes so / serves local-manager, not index.html
app.use(express.static(__dirname));

// POST /api/generate — start generation as background job, return job ID
app.post('/api/generate', (req, res) => {
  const { repos } = req.body;

  if (!repos || !Array.isArray(repos) || repos.length === 0) {
    return res.status(400).json({ error: 'No repos provided' });
  }

  if (repos.length > 5) {
    return res.status(400).json({ error: 'Maximum 5 repos per generation' });
  }

  const jobId = crypto.randomUUID();
  const job = {
    id: jobId,
    status: 'running',    // running | success | error
    logs: [],
    startedAt: Date.now(),
  };
  jobs.set(jobId, job);

  // Spawn generate.js — runs in background, NOT tied to this request
  const args = [path.join(__dirname, 'generate.js'), ...repos];
  const child = spawn(process.execPath, args, {
    cwd: __dirname,
    env: { ...process.env }
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => job.logs.push({ type: 'stdout', message: line, ts: Date.now() }));
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());
    lines.forEach(line => job.logs.push({ type: 'stderr', message: line, ts: Date.now() }));
  });

  child.on('close', (code, signal) => {
    if (code === 0) {
      job.status = 'success';
      job.logs.push({ type: 'success', message: 'Generation completed successfully!', ts: Date.now() });
    } else {
      job.status = 'error';
      job.logs.push({ type: 'error', message: `Generation failed (exit code ${code}, signal ${signal})`, ts: Date.now() });
    }
    job.finishedAt = Date.now();
    // Clean up old jobs after 30 minutes
    setTimeout(() => jobs.delete(jobId), 30 * 60 * 1000);
  });

  child.on('error', (err) => {
    job.status = 'error';
    job.logs.push({ type: 'error', message: `Failed to start: ${err.message}`, ts: Date.now() });
    job.finishedAt = Date.now();
  });

  // Return immediately with job ID
  res.json({ jobId });
});

// GET /api/jobs/:id — poll job status and logs
app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Support ?since=<index> to get only new log lines
  const since = parseInt(req.query.since) || 0;
  res.json({
    id: job.id,
    status: job.status,
    logs: job.logs.slice(since),
    totalLogs: job.logs.length,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt || null,
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
  console.log(`📁 Serving from: ${__dirname}\n`);
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