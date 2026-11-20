// Loads the pure kit files into a Node vm context so tests and no-browser checks can use them.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const KIT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'kit');

export function readManifest() {
  return JSON.parse(fs.readFileSync(path.join(KIT_DIR, 'manifest.json'), 'utf8'));
}

// Manifest entries for a bundle ('scene' | 'replay'), or all when bundle is omitted.
export function manifestFiles(bundle) {
  return readManifest().files.filter((f) => !bundle || f.bundle.includes(bundle));
}

// Runs every pure file (in manifest order) in one context; returns the EXK namespace.
export function loadKit({ bundle } = {}) {
  const sandbox = { console };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of manifestFiles(bundle)) {
    if (!f.pure) continue;
    vm.runInContext(fs.readFileSync(path.join(KIT_DIR, f.file), 'utf8'), ctx, { filename: f.file });
  }
  return sandbox.EXK;
}
