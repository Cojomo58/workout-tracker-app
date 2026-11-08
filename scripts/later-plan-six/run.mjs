#!/usr/bin/env node
/**
 * Runs pure + Playwright verification for later-plan-six.
 * Usage: node scripts/later-plan-six/run.mjs
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { runE2E } from './e2e-checks.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const PORT = 5199;

function runPure() {
  return new Promise((resolve) => {
    const child = spawn('node', ['scripts/later-plan-six/pure-checks.mjs'], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolve(code === 0));
  });
}

function startDevServer() {
  return spawn('npx', ['vite', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: repoRoot,
    env: { ...process.env, VITE_TEST_HOOKS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForServer(ms = 20000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/workout-tracker-app/`);
      if (res.ok) return true;
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  const pureOk = await runPure();
  const dev = startDevServer();
  let e2eResults = [];
  try {
    const up = await waitForServer();
    if (!up) throw new Error('dev server did not start');
    process.env.VERIFY_BASE_URL = `http://127.0.0.1:${PORT}/workout-tracker-app/`;
    e2eResults = await runE2E();
  } finally {
    dev.kill('SIGTERM');
  }

  const outPath = path.join(repoRoot, 'scripts/later-plan-six/last-run.json');
  fs.writeFileSync(outPath, JSON.stringify({ pureOk, e2eResults, at: new Date().toISOString() }, null, 2));

  const e2eFailed = e2eResults.filter(r => !r.pass);
  if (!pureOk || e2eFailed.length) {
    console.error(`\nVerification FAILED: pure=${pureOk}, e2e failures=${e2eFailed.length}`);
    process.exit(1);
  }
  console.log('\nAll later-plan-six checks passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
