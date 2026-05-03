import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, '../design/monzo.svg');
const iconsDir = join(__dirname, '../src-tauri/icons');

// 创建 icons 目录
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// PNG 尺寸
const pngSizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 }, // 用于生成 ico
];

async function convertSvgToPng() {
  console.log('Reading SVG from:', svgPath);
  const svgBuffer = readFileSync(svgPath);
  
  for (const { name, size } of pngSizes) {
    const outputPath = join(iconsDir, name);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Created: ${name} (${size}x${size})`);
  }
  
  console.log('\nAll icons generated successfully!');
}

convertSvgToPng().catch(console.error);
