/**
 * scripts/collect-evidence.js
 * ════════════════════════════════════════════════════════════════════════════
 * Runs the Playwright test suite 3 consecutive times using Node built-ins only.
 * Captures list reporter output into UTF-8 logs: evidence/logs/run-N.txt
 * Captures JSON reporter output into UTF-8 reports: evidence/reports/results-run-N.json
 * Copies run 3 JSON report to: evidence/reports/results-latest.json
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT, 'evidence', 'logs');
const REPORTS_DIR = path.join(ROOT, 'evidence', 'reports');

fs.mkdirSync(LOGS_DIR, { recursive: true });
fs.mkdirSync(REPORTS_DIR, { recursive: true });

console.log('Starting automated 3-run evidence collection...');

for (let run = 1; run <= 3; run++) {
  console.log(`\n── Starting Run ${run} of 3 ──`);

  const logFile = path.join(LOGS_DIR, `run-${run}.txt`);
  const reportFile = path.join(REPORTS_DIR, `results-run-${run}.json`);

  const env = {
    ...process.env,
    PLAYWRIGHT_JSON_OUTPUT_NAME: reportFile,
  };

  const startTime = Date.now();
  const res = spawnSync('npx', ['playwright', 'test', '--reporter=list,json'], {
    cwd: ROOT,
    env,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Combine stdout and stderr into list log
  const output = (res.stdout || '') + (res.stderr ? '\n' + res.stderr : '');
  fs.writeFileSync(logFile, output, { encoding: 'utf8' });

  console.log(`Run ${run} completed in ${duration}s with exit code ${res.status}`);
  console.log(`Saved log:    evidence/logs/run-${run}.txt (UTF-8)`);
  console.log(`Saved report: evidence/reports/results-run-${run}.json (UTF-8)`);

  if (res.status !== 0) {
    console.error(`Run ${run} failed! Review log at ${logFile}`);
    process.exit(res.status || 1);
  }
}

// Copy run-3 report to results-latest.json
const run3Report = path.join(REPORTS_DIR, 'results-run-3.json');
const latestReport = path.join(REPORTS_DIR, 'results-latest.json');
fs.copyFileSync(run3Report, latestReport);
console.log(`\nCopied results-run-3.json -> evidence/reports/results-latest.json`);
console.log('Evidence collection successfully finished for all 3 runs.');
