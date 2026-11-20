// Build-time checks of a custom scene file (--pattern custom --scene <file.js>): which scenes it registers,
// that the story names one of them, and a warning for numbers typed into the text of HUD helper calls.
import fs from 'node:fs';
import { loadKit } from './load-kit.mjs';

const REGISTER = /\bEXK\s*\.\s*scenes\s*(?:\.\s*([A-Za-z_$][\w$]*)|\[\s*(['"])([^'"]+)\2\s*\])\s*=/g;
const HUD_CALL = /\bhud\s*\.\s*(banner|measure|legend|panel|caption)\s*\(/g;
const STRING = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;

export function registeredScenes(js) {
  const names = [];
  for (const m of js.matchAll(REGISTER)) if (!names.includes(m[1] ?? m[3])) names.push(m[1] ?? m[3]);
  return names;
}

// The text of the balanced call starting at the "(" before index i, string-aware; null when unbalanced.
function callArgs(js, open) {
  let depth = 0, q = null;
  for (let i = open; i < js.length; i++) {
    const c = js[i];
    if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') q = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return { text: js.slice(open, i + 1), start: open };
  }
  return null;
}

// Warnings (strings) for a digit typed into a string literal, or a numeric `value:`, inside a HUD helper call.
// A string equal to a figure key is a key, not text; a string that starts with "<" is markup, not text.
export function lintHudNumbers(js, file, figureKeys = []) {
  const out = [], keys = new Set(figureKeys);
  const lineOf = (i) => js.slice(0, i).split('\n').length;
  for (const m of js.matchAll(HUD_CALL)) {
    const call = callArgs(js, m.index + m[0].length - 1);
    if (!call) continue;
    for (const s of call.text.matchAll(STRING)) {
      const body = s[0].slice(1, -1);
      if (keys.has(body) || /^\s*</.test(body)) continue;      // a figure key, or an SVG fragment (a legend swatch)
      const literal = s[0][0] === '`' ? body.replace(/\$\{[^}]*\}/g, '') : body;
      if (/\d/.test(literal)) out.push(`${file}:${lineOf(call.start + s.index)}: hud.${m[1]} text ${s[0]} has a number typed into it; read it with ctx.figure(key) or ctx.count(n, of) instead`);
    }
    for (const v of call.text.matchAll(/\bvalue\s*:\s*-?\d/g)) {
      out.push(`${file}:${lineOf(call.start + v.index)}: hud.${m[1]} value is a number typed into the scene; read it with ctx.figure(key) or ctx.count(n, of) instead`);
    }
  }
  return out;
}

// -> { name, warnings }; throws a clear error when the file does not register the scene the story needs.
export function checkScene({ file, story }) {
  const js = fs.readFileSync(file, 'utf8');
  const names = registeredScenes(js);
  const EXK = loadKit();
  const stubs = Object.fromEntries(names.map((n) => [n, { build() {}, step() {} }]));
  let found;
  try { found = EXK.patterns.custom.resolveScene(story, stubs); } catch (e) { throw new Error(`${file}: ${e.message}`); }
  const keys = Object.keys(story.figures ?? {});
  return { name: found.name, warnings: lintHudNumbers(js, file, keys) };
}
