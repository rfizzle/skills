// Video export for the explainer-animation prototypes (the "animation" deliverable).
//
// Usage:
//   node export.mjs <file.html> [--out <dir>] [--narration full|caption|off] [--fps 30]
//        [--gif-width 1280] [--gif-fps 15] [--only full|steps|stills|gif ...] [--range <startSec>,<endSec>]
//
// Loads the page headlessly at 1920x1080 with ?capture=1&narration=<mode> (default full: phase
// rail, step title and the narrative body text; caption keeps the title only, off shows the
// diagram alone), seeks window.anim to i/fps for every frame, screenshots each frame ONCE into a temp
// directory, and builds every output from those frames. The temp directory is removed at the end.
//
// Outputs, default directory ./explainer-out/<html basename>/ under the current working directory:
//   full.mp4            whole timeline, H.264 yuv420p 1920x1080, +faststart, CRF 16
//   steps/NN-<id>.mp4   one clip per step, from its start to its rest frame, plus a 0.5 s hold of that frame
//   stills/NN-<id>.png  the rest frame of each step (for PDF decks)
//   full.gif            two-pass palette GIF, --gif-width wide at --gif-fps
//   manifest.json       source, duration, fps, narration, per-step id/title/start/end/clip/still
// --only limits which outputs are built (default all). --range limits capture to a time window
// (development aid): steps are clipped to the window and only the touched steps are written.
// ffmpeg comes from PATH when present, else from ffmpeg-static in EXPLAINER_BROWSER_DIR (lib/browser.mjs).
// manifest.json also records the page's EXK.BUILD.kitVersion when it has one.
// Exit code is non-zero if the page logs console errors or window.anim never appears.
import { launchBrowser, findFfmpeg } from './lib/browser.mjs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HOLD_SECONDS = 0.5;
// A step's last frames are its exit: the title and callouts fade out before the next step. Clips
// and stills must end on the step at rest, with everything still on screen. Pages may give each
// step a `rest` time; otherwise rest is taken as this long before the step's end.
const REST_BEFORE_END = 0.7;
const here = path.dirname(fileURLToPath(import.meta.url));

function fail(msg) { console.error('export: ' + msg); process.exit(1); }

// ---- arguments ----
const argv = process.argv.slice(2);
const opts = { out: null, narration: 'full', fps: 30, gifWidth: 1280, gifFps: 15, only: null, range: null };
let file = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const val = () => { if (i + 1 >= argv.length) fail(`${a} needs a value`); return argv[++i]; };
  if (a === '--out') opts.out = val();
  else if (a === '--narration') opts.narration = val();
  else if (a === '--fps') opts.fps = Number(val());
  else if (a === '--gif-width') opts.gifWidth = Number(val());
  else if (a === '--gif-fps') opts.gifFps = Number(val());
  else if (a === '--range') opts.range = val().split(',').map(Number);
  else if (a === '--only') {
    opts.only = [];
    while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts.only.push(argv[++i]);
  } else if (a.startsWith('--')) fail(`unknown option ${a}`);
  else if (file === null) file = a;
  else fail(`unexpected argument ${a}`);
}
if (!file) fail('usage: node export.mjs <file.html> [--out dir] [--narration full|caption|off] [--fps 30] [--gif-width 1280] [--gif-fps 15] [--only full|steps|stills|gif ...] [--range a,b]');
if (!['caption', 'full', 'off'].includes(opts.narration)) fail('--narration must be caption, full or off');
if (!(opts.fps > 0) || !(opts.gifFps > 0) || !(opts.gifWidth > 0)) fail('--fps, --gif-fps and --gif-width must be positive numbers');
const allKinds = ['full', 'steps', 'stills', 'gif'];
const kinds = new Set(opts.only && opts.only.length ? opts.only : allKinds);
for (const k of kinds) if (!allKinds.includes(k)) fail(`--only: unknown output "${k}"`);
if (opts.range && (opts.range.length !== 2 || opts.range.some((x) => !Number.isFinite(x)) || opts.range[0] >= opts.range[1])) fail('--range must be <startSec>,<endSec> with start < end');
const htmlPath = path.resolve(file);
if (!fs.existsSync(htmlPath)) fail(`no such file: ${htmlPath}`);
const outDir = path.resolve(opts.out ?? path.join('explainer-out', path.basename(htmlPath, path.extname(htmlPath))));

// ---- ffmpeg ----
const ffmpeg = await findFfmpeg();
function runFfmpeg(args) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (r.status !== 0) fail(`ffmpeg failed (${args.slice(-1)[0]}):\n${r.stderr}`);
}

// ---- load page ----
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(pathToFileURL(htmlPath).href + `?capture=1&narration=${opts.narration}`);
try {
  await page.waitForFunction(() => window.anim && window.anim.duration > 0, null, { timeout: 15000 });
} catch {
  await browser.close();
  fail('window.anim did not appear within 15 s' + (errors.length ? '\n  ' + errors.join('\n  ') : ''));
}
await page.evaluate(() => document.fonts.ready);
const info = await page.evaluate(() => ({
  duration: window.anim.duration,
  steps: window.anim.steps.map((s) => ({ id: s.id, time: s.time, title: s.title, rest: s.rest })),
  kitVersion: (window.EXK && window.EXK.BUILD && window.EXK.BUILD.kitVersion) || null,
}));

// ---- plan frames ----
const fps = opts.fps;
const total = Math.round(info.duration * fps);           // frames 0..total-1 cover the timeline
const pad = (n) => String(n).padStart(2, '0');
const f0 = opts.range ? Math.max(0, Math.floor(opts.range[0] * fps)) : 0;
const f1 = opts.range ? Math.min(total, Math.ceil(opts.range[1] * fps)) : total;   // exclusive
if (f1 <= f0) { await browser.close(); fail('--range lies outside the timeline'); }
const startsF = info.steps.map((s) => Math.round(s.time * fps));
const steps = info.steps.map((s, i) => {
  const a = startsF[i], b = i + 1 < startsF.length ? startsF[i + 1] : total;
  const ca = Math.max(a, f0), cb = Math.min(b, f1);   // clipped to --range
  const restT = Number.isFinite(s.rest) ? s.rest : b / fps - REST_BEFORE_END;
  const r = Math.min(cb - 1, Math.max(ca, Math.round(restT * fps)));   // frame the step rests on
  return { ...s, index: i + 1, a: ca, b: cb, r, name: `${pad(i + 1)}-${s.id}`, active: cb > ca };
}).filter((s) => s.active);
const needAll = kinds.has('full') || kinds.has('gif');
const needed = new Set();
if (needAll) for (let i = f0; i < f1; i++) needed.add(i);
else {
  for (const s of steps) {
    if (kinds.has('steps')) for (let i = s.a; i <= s.r; i++) needed.add(i);
    if (kinds.has('stills')) needed.add(s.r);
  }
}

// ---- capture ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'export-frames-'));
const framePath = (i) => path.join(tmp, `f${String(i).padStart(6, '0')}.png`);
const cleanup = () => fs.rmSync(tmp, { recursive: true, force: true });
process.on('exit', cleanup);
const list = [...needed].sort((x, y) => x - y);
let lastLog = 0;
const t0 = Date.now();
for (let n = 0; n < list.length; n++) {
  await page.evaluate((t) => window.anim.seek(t), list[n] / fps);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: framePath(list[n]) });
  if (Date.now() - lastLog >= 1000 || n === list.length - 1) {
    lastLog = Date.now();
    process.stdout.write(`\rframes ${n + 1}/${list.length}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}
process.stdout.write('\n');
await browser.close();
if (errors.length) fail(`page reported ${errors.length} console error(s):\n  ` + errors.join('\n  '));

// ---- encode ----
fs.mkdirSync(outDir, { recursive: true });
const written = [];
const seqIn = (a, b) => ['-framerate', String(fps), '-start_number', String(a), '-t', String((b - a) / fps), '-i', path.join(tmp, 'f%06d.png')];
const h264 = ['-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart'];

if (kinds.has('full')) {
  console.log('encoding full.mp4');
  runFfmpeg([...seqIn(f0, f1), ...h264, path.join(outDir, 'full.mp4')]);
  written.push('full.mp4');
}
if (kinds.has('steps')) {
  fs.mkdirSync(path.join(outDir, 'steps'), { recursive: true });
  for (const s of steps) {
    console.log(`encoding steps/${s.name}.mp4`);
    s.clip = `steps/${s.name}.mp4`;
    runFfmpeg([...seqIn(s.a, s.r + 1), '-vf', `tpad=stop_mode=clone:stop_duration=${HOLD_SECONDS}`, ...h264, path.join(outDir, s.clip)]);
    written.push(s.clip);
  }
}
if (kinds.has('stills')) {
  fs.mkdirSync(path.join(outDir, 'stills'), { recursive: true });
  for (const s of steps) {
    s.still = `stills/${s.name}.png`;
    fs.copyFileSync(framePath(s.r), path.join(outDir, s.still));
    written.push(s.still);
  }
}
if (kinds.has('gif')) {
  console.log('encoding full.gif');
  const pal = path.join(tmp, 'palette.png');
  const scale = `fps=${opts.gifFps},scale=${opts.gifWidth}:-1:flags=lanczos`;
  runFfmpeg([...seqIn(f0, f1), '-vf', `${scale},palettegen=stats_mode=diff`, pal]);
  runFfmpeg([...seqIn(f0, f1), '-i', pal, '-lavfi', `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, path.join(outDir, 'full.gif')]);
  written.push('full.gif');
}

const manifest = {
  source: htmlPath,
  duration: info.duration,
  fps,
  narration: opts.narration,
  ...(info.kitVersion ? { kitVersion: info.kitVersion } : {}),
  ...(opts.range ? { range: opts.range } : {}),
  steps: steps.map((s) => ({
    id: s.id, title: s.title, start: s.a / fps, rest: s.r / fps, end: s.b / fps,
    clip: s.clip ?? null, still: s.still ?? null,
  })),
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
written.push('manifest.json');

console.log(`\nwritten to ${outDir}`);
for (const w of written) {
  const kb = fs.statSync(path.join(outDir, w)).size / 1024;
  console.log(`  ${w.padEnd(40)} ${kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb.toFixed(0) + ' KB'}`);
}
