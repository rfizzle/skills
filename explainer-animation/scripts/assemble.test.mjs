import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assemble, assertOffline, inlinePage, vendorBlock } from './lib/assemble.mjs';
import { loadKit, manifestFiles } from './lib/load-kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const storyPath = path.join(here, 'testdata', 'minimal.story.json');
const build = path.join(here, 'build.mjs');
const EXK = loadKit();
const story = () => EXK.normalize(JSON.parse(fs.readFileSync(storyPath, 'utf8')));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exk-assemble-'));

test('manifest lists existing files with pure and bundle', () => {
  for (const f of manifestFiles()) {
    assert.ok(fs.existsSync(path.join(root, 'assets', 'kit', f.file)), f.file);
    assert.equal(typeof f.pure, 'boolean');
    assert.ok(f.bundle.every((b) => ['scene', 'replay'].includes(b)));
  }
});

test('scene page: vendor, kit, story, boot; no network references', () => {
  const html = assemble({ story: story(), style: 'flat', builtAt: '2026-01-01T00:00:00Z' });
  assert.match(html, /gsap\.registerPlugin/);
  assert.match(html, /EXK\.boot\(\)/);
  assert.match(html, /EXK\.STORY = /);
  assert.match(html, /"kitVersion":"0\.1\.0"/);
  assert.match(html, /GSAP 3\.13\.0/);
  assert.doesNotMatch(html, /<!--@/);
  assert.doesNotMatch(html, /src="http|url\(http/);
  assert.equal((html.match(/<script>/g) || []).length, 3 + 1 + 1 + 1 + 1); // 3 gsap, registerPlugin, kit, story, boot
  assert.ok(html.indexOf('GSAP 3.13.0') < html.indexOf('kit/00-ns.js') && html.indexOf('kit/00-ns.js') < html.indexOf('EXK.STORY'));
});

test('replay page has no GSAP', () => {
  const html = assemble({ story: story(), replay: true });
  assert.doesNotMatch(html, /registerPlugin|gsap\.min|\bgsap\.(to|timeline)/);
  assert.match(html, /EXK\.boot\(\)/);
  assert.doesNotMatch(html, /<!--@/);
});

test('story JSON cannot close the script tag', () => {
  const s = story();
  s.meta.title = 'x </script><script>alert(1)</script> & y';
  const html = assemble({ story: s, style: 'flat' });
  assert.doesNotMatch(html, /<\/script><script>alert/);
  assert.match(html, /<title>x &lt;\/script&gt;/);
});

test('assertOffline refuses src and url to http', () => {
  assert.throws(() => assertOffline('<script src="https://x/y.js"></script>'), /network/);
  assert.throws(() => assertOffline('a { background: url(http://x/y.png) }'), /network/);
  assert.doesNotThrow(() => assertOffline('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
});

test('extra files may not create a second timeline', () => {
  const f = path.join(tmp, 'bad.scene.js');
  fs.writeFileSync(f, 'const t = gsap.timeline({paused:true});');
  assert.throws(() => assemble({ story: story(), style: 'flat', extraPath: f }), /gsap\.timeline\(/);
  fs.writeFileSync(f, 'EXK.scenes.x = {};');
  assert.match(assemble({ story: story(), style: 'flat', extraPath: f }), /EXK\.scenes\.x = \{\}/);
});

test('inlinePage replaces the three CDN tags and nothing else', () => {
  const page = [
    '<html><body>',
    '<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/MotionPathPlugin.min.js"></script>',
    '<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/DrawSVGPlugin.min.js"></script>',
    '<script>gsap.registerPlugin(MotionPathPlugin, DrawSVGPlugin); const mine = 1;</script>',
    '</body></html>',
  ].join('\n');
  const out = inlinePage(page);
  assert.doesNotMatch(out, /<script[^>]*\bsrc=/);
  assert.match(out, /const mine = 1;/);
  assert.ok(out.includes(fs.readFileSync(path.join(root, 'assets/vendor/gsap-3.13.0/DrawSVGPlugin.min.js'), 'utf8').trim()));
  assert.throws(() => inlinePage(page.replace('</body>', '<img style="background:url(http://x/a.png)"></body>')), /network/);
});

test('vendored files keep their licence headers', () => {
  for (const n of ['gsap', 'MotionPathPlugin', 'DrawSVGPlugin']) {
    const head = fs.readFileSync(path.join(root, 'assets/vendor/gsap-3.13.0', `${n}.min.js`), 'utf8').slice(0, 400);
    assert.match(head, /3\.13\.0/);
    assert.match(head, /gsap\.com\/standard-license/);
  }
  assert.match(vendorBlock(), /standard-license/);
});

test('build.mjs writes a page from the minimal story', () => {
  const out = path.join(tmp, 'x.html');
  const r = spawnSync(process.execPath, [build, storyPath, '--style', 'flat', '-o', out], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const html = fs.readFileSync(out, 'utf8');
  assert.match(html, /gsap\.registerPlugin/);
  assert.match(html, /EXK\.boot\(\)/);
  assert.doesNotMatch(html, /src="http|url\(http/);
});

test('build.mjs refuses an invalid story and a missing --style', () => {
  const bad = path.join(here, 'testdata', 'invalid', 'title-too-long.story.json');
  const r = spawnSync(process.execPath, [build, bad, '--style', 'flat', '-o', path.join(tmp, 'bad.html')], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /steps\[0\]\.title/);
  assert.ok(!fs.existsSync(path.join(tmp, 'bad.html')));
  assert.equal(spawnSync(process.execPath, [build, storyPath], { encoding: 'utf8' }).status, 2);
});

test('build.mjs --replay and --inline', () => {
  const rp = path.join(tmp, 'r.html');
  const example = path.join(here, '..', 'assets', 'examples', 'ssrf-attack-chain.story.json');
  assert.equal(spawnSync(process.execPath, [build, example, '--replay', '-o', rp], { encoding: 'utf8' }).status, 0);
  assert.doesNotMatch(fs.readFileSync(rp, 'utf8'), /registerPlugin|gsap\.min/);
  // a story with no events has no replay: refused with a message, nothing written
  const none = spawnSync(process.execPath, [build, storyPath, '--replay', '-o', path.join(tmp, 'none.html')], { encoding: 'utf8' });
  assert.equal(none.status, 1);
  assert.match(none.stderr, /no events, so there is nothing to replay/);
  assert.ok(!fs.existsSync(path.join(tmp, 'none.html')));
  const src = path.join(tmp, 'page.html');
  fs.writeFileSync(src, '<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>');
  const out = path.join(tmp, 'page.inline.html');
  assert.equal(spawnSync(process.execPath, [build, '--inline', src, '-o', out], { encoding: 'utf8' }).status, 0);
  assert.doesNotMatch(fs.readFileSync(out, 'utf8'), /<script[^>]*src=/);
});
