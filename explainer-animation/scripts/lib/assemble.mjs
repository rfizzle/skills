// Page assembly: template + vendor + kit + story + extra + boot (KIT-PLAN section 5).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIT_DIR, manifestFiles, readManifest } from './load-kit.mjs';

const SKILL_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ASSETS = path.join(SKILL_DIR, 'assets');
export const VENDOR_DIR = path.join(ASSETS, 'vendor', 'gsap-3.13.0');
export const VENDOR_FILES = ['gsap', 'MotionPathPlugin', 'DrawSVGPlugin'];
const MARKERS = ['title', 'vendor', 'kit', 'story', 'extra', 'boot'];

const read = (p) => fs.readFileSync(p, 'utf8');

// Inline JS must not contain a literal </script; the escaped form is the same string/regex.
const safeJs = (js) => js.replace(/<\/(script)/gi, '<\\/$1');
const script = (js) => `<script>\n${safeJs(js)}\n</script>`;
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jsonLiteral = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function vendorBlock() {
  const licence = read(path.join(VENDOR_DIR, 'LICENSE.txt')).trim().replace(/\*\//g, '* /');
  const parts = [`<!--\n${licence.replace(/--/g, '- -')}\n-->`];
  for (const name of VENDOR_FILES) parts.push(script(read(path.join(VENDOR_DIR, `${name}.min.js`)).trim()));
  parts.push('<script>gsap.registerPlugin(MotionPathPlugin, DrawSVGPlugin);</script>');
  return parts.join('\n');
}

export function kitBlock(bundle) {
  const js = manifestFiles(bundle).map((f) => `/* kit/${f.file} */\n${read(path.join(KIT_DIR, f.file)).trim()}`).join('\n;\n');
  return script(js);
}

// The scene/extra file is the author's; a second timeline would break seek determinism.
export function extraBlock(extraPath) {
  if (!extraPath) return '';
  const js = read(extraPath);
  if (/gsap\s*\.\s*timeline\s*\(/.test(js)) {
    throw new Error(`${extraPath}: contains gsap.timeline(; use ctx.tl, the master timeline (KIT-PLAN 2.4)`);
  }
  return script(js);
}

export function assertOffline(html, label = 'output') {
  const m = /src=["']?\s*https?:|url\(\s*["']?https?:/i.exec(html);
  if (m) {
    const line = html.slice(0, m.index).split('\n').length;
    throw new Error(`${label} would load from the network (${JSON.stringify(m[0])} at line ${line}); the build never writes a page that needs a network`);
  }
}

// opts: {story, style, pattern, replay, extraPath, builtAt}
export function assemble(opts) {
  const { story, style = null, pattern = 'flow', replay = false, extraPath = null, builtAt = new Date().toISOString() } = opts;
  const bundle = replay ? 'replay' : 'scene';
  const template = read(path.join(ASSETS, replay ? 'replay.html' : 'page.html'));
  const build = { style: replay ? null : style, pattern: replay ? null : pattern, replay, builtAt, kitVersion: readManifest().version };
  const parts = {
    title: escHtml(story.meta?.title ?? 'Explainer'),
    vendor: replay ? '' : vendorBlock(),
    kit: kitBlock(bundle),
    story: script(`EXK.STORY = ${jsonLiteral(story)};\nEXK.BUILD = ${jsonLiteral(build)};`),
    extra: extraBlock(extraPath),
    boot: '<script>EXK.boot();</script>',
  };
  for (const m of MARKERS) {
    if (!template.includes(`<!--@${m}-->`) && !(replay && m === 'vendor')) throw new Error(`template is missing the <!--@${m}--> marker`);
  }
  // function replacers: the content contains $ sequences
  let html = template;
  for (const m of MARKERS) html = html.replace(`<!--@${m}-->`, () => parts[m]);
  assertOffline(html);
  return html;
}

const CDN_TAG = /<script\b[^>]*\bsrc=["']https?:\/\/[^"']*?\/(gsap|MotionPathPlugin|DrawSVGPlugin)(?:\.min)?\.js["'][^>]*>\s*<\/script>/gi;

// Replace the CDN tags for the three GSAP files with the vendored copies, inlined.
export function inlinePage(html) {
  let first = true;
  const out = html.replace(CDN_TAG, (_, name) => {
    const key = VENDOR_FILES.find((n) => n.toLowerCase() === name.toLowerCase());
    const prefix = first ? `<!-- ${read(path.join(VENDOR_DIR, 'LICENSE.txt')).split('\n')[0]}: ${'https://gsap.com/standard-license'} -->\n` : '';
    first = false;
    return prefix + script(read(path.join(VENDOR_DIR, `${key}.min.js`)).trim());
  });
  assertOffline(out);
  return out;
}
