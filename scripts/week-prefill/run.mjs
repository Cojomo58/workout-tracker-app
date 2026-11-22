#!/usr/bin/env node
/**
 * Pure checks plus a browser pass for new-week editor prefill.
 * Usage: node scripts/week-prefill/run.mjs
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { runE2E } from './e2e.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const PORT = 5207;

function runPure() {
  return new Promise((resolve) => {
    const child = spawn('node', ['scripts/week-prefill/pure-checks.mjs'], {
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
    detached: true,
  });
}

function stopDevServer(dev) {
  if (!dev?.pid) return;
  try {
    process.kill(-dev.pid, 'SIGTERM');
  } catch {
    dev.kill('SIGTERM');
  }
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
  let serverLog = '';
  dev.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
  dev.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });
  try {
    const up = await waitForServer();
    if (!up) throw new Error(`dev server did not start\n${serverLog}`);
    process.env.VERIFY_BASE_URL = `http://127.0.0.1:${PORT}/workout-tracker-app/`;
    e2eResults = await runE2E();
  } finally {
    stopDevServer(dev);
  }

  const e2eFailed = e2eResults.filter(r => !r.pass);
  console.log(`\nE2E: ${e2eResults.length - e2eFailed.length}/${e2eResults.length} passed`);
  if (!pureOk || e2eFailed.length) {
    console.error(`\nVerification FAILED: pure=${pureOk}, e2e failures=${e2eFailed.length}`);
    process.exit(1);
  }
  console.log('\nAll week-prefill checks passed.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
