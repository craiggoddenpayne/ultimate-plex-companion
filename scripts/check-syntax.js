import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ignored = new Set(['node_modules','dist','.git']);
const files = [];
function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes:true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) visit(path);
    else if (entry.name.endsWith('.js')) files.push(path);
  }
}
visit('.');
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio:'inherit' });
console.log(`Checked ${files.length} JavaScript files.`);
