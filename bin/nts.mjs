#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

if (!process.env.PORT) {
  process.env.PORT = '8080';
}

const here = dirname(fileURLToPath(import.meta.url));
const mainPath = join(here, '..', 'apps', 'be', 'dist', 'main.js');

await import(pathToFileURL(mainPath).href);

const url = `http://localhost:${process.env.PORT}`;
console.log(`\n  nts running on ${url}\n`);

if (!process.env.NTS_NO_OPEN) {
  const opener =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open';
  spawn(opener, [url], {
    detached: true,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  }).unref();
}
