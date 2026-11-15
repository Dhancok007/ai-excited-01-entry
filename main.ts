// The Dive entry: submit the prepared kingfisher image as the competition's single image.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const outputFile = join(outputDirectory, 'entry.png');

await mkdir(outputDirectory, { recursive: true });
await copyFile(join(scriptDirectory, 'entry.png'), outputFile);
console.log(`Wrote ${outputFile}`);
