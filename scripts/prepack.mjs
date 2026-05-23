#!/usr/bin/env node
// Materialize node_modules/@nts/dtos as a real directory (not a workspace
// symlink) so `bundleDependencies` actually ships its files in the tarball.
// Run via the `prepack` lifecycle hook; `postpack` restores the symlink.

import { cpSync, lstatSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'node_modules', '@nts', 'dtos');
const source = join(root, 'dtos');

try {
  const stat = lstatSync(target);
  if (stat.isSymbolicLink() || stat.isDirectory()) {
    rmSync(target, { recursive: true, force: true });
  }
} catch {
  // missing — fine, we'll create it
}

mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true, dereference: true });

// Drop nested workspace artifacts we don't want shipped.
rmSync(join(target, 'node_modules'), { recursive: true, force: true });
rmSync(join(target, 'src'), { recursive: true, force: true });

console.log(`prepack: vendored @nts/dtos at ${target}`);
