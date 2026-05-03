import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../src-tauri/icons');
const iconPath = join(iconsDir, 'icon.png');
const icoPath = join(iconsDir, 'icon.ico');

async function generateIco() {
  console.log('Generating icon.ico...');
  const pngBuffer = readFileSync(iconPath);
  const icoBuffer = await pngToIco(pngBuffer);
  writeFileSync(icoPath, icoBuffer);
  console.log('Created: icon.ico');
}

generateIco().catch(console.error);
