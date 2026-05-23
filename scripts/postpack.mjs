#!/usr/bin/env node
// Restore the workspace symlink that `prepack` replaced with a real copy.

import { rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'node_modules', '@nts', 'dtos');

rmSync(target, { recursive: true, force: true });
symlinkSync('../../dtos', target, 'dir');

console.log(`postpack: restored @nts/dtos workspace symlink`);
