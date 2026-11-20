// Usage: node smoke.mjs <file.html>...
// Loads each page with ?capture=1, reports console errors, screenshots every step, and checks
// that seek(t) gives the same picture (within an anti-aliasing tolerance) after seeking
// elsewhere and back.
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(here, 'shots');
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'],
});

// Counts pixels that differ noticeably between two PNG buffers, using a canvas in a blank page.
const differ = await browser.newPage();
async function diffPixels(bufA, bufB) {
  if (bufA.equals(bufB)) return 0;
  return differ.evaluate(async ([a, b]) => {
    const load = async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, img.width, img.height).data;
    };
    const [da, db] = [await load(a), await load(b)];
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) > 24) n++;
    }
    return n;
  }, [bufA.toString('base64'), bufB.toString('base64')]);
}

for (const file of process.argv.slice(2)) {
  const name = path.basename(file, '.html');
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));

  await page.goto(pathToFileURL(path.resolve(file)).href + '?capture=1');
  try {
    await page.waitForFunction(() => window.anim && window.anim.duration > 0, null, { timeout: 15000 });
  } catch {
    console.log(`${name}: FAIL window.anim never appeared`, errors);
    await page.screenshot({ path: path.join(shots, `${name}-broken.png`) });
    await page.close();
    continue;
  }
  const info = await page.evaluate(() => ({
    duration: window.anim.duration,
    steps: window.anim.steps.map((s) => ({ id: s.id, time: s.time })),
  }));

  const shot = async (t) => {
    await page.evaluate((tt) => window.anim.seek(tt), t);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return page.screenshot();
  };

  // One frame late in each step (just before the next step starts), plus the final frame.
  const times = info.steps.map((s, i) => {
    const next = i + 1 < info.steps.length ? info.steps[i + 1].time : info.duration;
    return { id: s.id, t: s.time + (next - s.time) * 0.85 };
  });
  times.push({ id: 'end', t: info.duration });
  for (const [i, { id, t }] of times.entries()) {
    fs.writeFileSync(path.join(shots, `${name}-${i + 1}-${id}.png`), await shot(t));
  }

  // Determinism: the same t, reached forwards, backwards and after a jump, at several probe
  // times. Chromium's rasteriser is not pixel-identical across seek routes (a few dozen
  // anti-aliased edge pixels can differ while every element attribute is equal), so frames are
  // compared with a tolerance instead of byte equality.
  const TOLERATED_PIXELS = 400;   // of 2,073,600; pixels whose largest channel delta exceeds 24
  let worst = 0;
  for (const f of [0.17, 0.43, 0.71, 0.93]) {
    const probe = info.duration * f;
    const a = await shot(probe);
    await shot(info.duration);
    const b = await shot(probe);
    await shot(0);
    const c = await shot(probe);
    worst = Math.max(worst, await diffPixels(a, b), await diffPixels(a, c));
  }
  const same = worst <= TOLERATED_PIXELS;

  console.log(`${name}: duration=${info.duration.toFixed(2)}s steps=${info.steps.length} ` +
    `seek-deterministic=${same} (worst diff ${worst}px) errors=${errors.length}`);
  for (const e of errors) console.log('   ', e);
  await page.close();
}
await browser.close();
