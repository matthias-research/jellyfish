import {copyFile, mkdir, readdir, rm} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'dist');
if (dirname(output) !== resolve(root)) throw Error('Invalid build directory');
await rm(output, {recursive:true, force:true});
await mkdir(output, {recursive:true});
// Publish only browser runtime files, never the repository or original installation.
const files = ['index.html', 'styles.css', 'assets/bitmap-LOGOU-1044.png'];
for (const [directory, extension] of [['src','.js'], ['data','.dat']]) {
  for (const entry of await readdir(resolve(root, directory), {withFileTypes:true})) {
    if (entry.isFile() && entry.name.endsWith(extension)) files.push(`${directory}/${entry.name}`);
  }
}
for (const file of files) {
  const destination = resolve(output, file);
  await mkdir(dirname(destination), {recursive:true});
  await copyFile(resolve(root, file), destination);
}
console.log(`Built ${files.length} browser files in dist/`);
