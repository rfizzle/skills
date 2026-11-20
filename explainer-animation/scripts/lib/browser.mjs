// Finds a browser harness (Playwright + Chromium, ffmpeg) for the render checks, frames and export.
//
// The harness is a directory named by EXPLAINER_BROWSER_DIR holding node_modules/playwright (and
// optionally ffmpeg-static). Without the variable, a plain `import('playwright')` is tried.
// If the directory also holds syslibs/root/usr/lib and syslibs/fonts.conf (the layout made by
// scripts/setup-browser-harness.sh), those are put on LD_LIBRARY_PATH and
// FONTCONFIG_FILE for the browser process only, so the scripts run as plain `node ...`.
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'];
const dir = process.env.EXPLAINER_BROWSER_DIR ? path.resolve(process.env.EXPLAINER_BROWSER_DIR) : null;

export function die(msg) {
  console.error(msg);
  process.exit(2);
}

function harnessRequire() {
  return dir && fs.existsSync(path.join(dir, 'package.json')) ? createRequire(path.join(dir, 'package.json')) : null;
}

async function loadPlaywright() {
  const req = harnessRequire();
  if (req) {
    try { return req('playwright'); } catch {}
  }
  try { return await import('playwright'); } catch {}
  die(
    'No browser available: Playwright was not found.\n' +
    '  Set EXPLAINER_BROWSER_DIR to a directory that has node_modules/playwright (and ffmpeg-static for export),\n' +
    '  or install playwright where node can resolve it. To build such a directory on a Linux machine without\n' +
    '  system libraries, run scripts/setup-browser-harness.sh <dir>. See references/checks.md.' +
    (dir ? `\n  EXPLAINER_BROWSER_DIR=${dir} has no usable node_modules/playwright.` : ''));
}

function browserEnv() {
  if (!dir) return undefined;
  const lib = path.join(dir, 'syslibs/root/usr/lib');
  const fonts = path.join(dir, 'syslibs/fonts.conf');
  if (!fs.existsSync(lib) || !fs.existsSync(fonts)) return undefined;
  const ld = process.env.LD_LIBRARY_PATH ? lib + ':' + process.env.LD_LIBRARY_PATH : lib;
  return { ...process.env, LD_LIBRARY_PATH: ld, FONTCONFIG_FILE: fonts };
}

// Launches headless Chromium with the WebGL flags the isometric pages need.
export async function launchBrowser() {
  const pw = await loadPlaywright();
  const chromium = pw.chromium ?? pw.default?.chromium;
  const env = browserEnv();
  try {
    return await chromium.launch({ args: GL_ARGS, ...(env ? { env } : {}) });
  } catch (e) {
    die(`Chromium failed to start: ${String(e.message).split('\n')[0]}\n` +
      '  Check EXPLAINER_BROWSER_DIR (see references/checks.md); on Linux without system libraries use\n' +
      '  scripts/setup-browser-harness.sh to build the harness; browsers come from `npx playwright install chromium`.');
  }
}

// Returns the ffmpeg executable: PATH first, then ffmpeg-static in the harness directory.
export async function findFfmpeg() {
  if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg';
  const req = harnessRequire();
  if (req) {
    try {
      const p = req('ffmpeg-static');
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }
  try {
    const p = (await import('ffmpeg-static')).default;
    if (p && fs.existsSync(p)) return p;
  } catch {}
  die('No ffmpeg: not on PATH and ffmpeg-static was not found. Install ffmpeg, or run `npm install ffmpeg-static` in the ' +
    'EXPLAINER_BROWSER_DIR directory (see references/checks.md).');
}
