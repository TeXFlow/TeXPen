import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

async function debugImage() {
  const imagePath = path.resolve(__dirname, '../public/test.png');
  console.log(`Analyzing image: ${imagePath}`);

  const img = await loadImage(imagePath);
  console.log(`Image dimensions: ${img.width}x${img.height}`);

  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;

  // Sample some pixels to understand the format
  console.log('\nSampling pixels:');
  const samples = [
    { name: 'top-left', x: 0, y: 0 },
    { name: 'top-right', x: img.width - 1, y: 0 },
    { name: 'center', x: Math.floor(img.width / 2), y: Math.floor(img.height / 2) },
    { name: 'bottom-left', x: 0, y: img.height - 1 },
    { name: 'bottom-right', x: img.width - 1, y: img.height - 1 },
  ];

  for (const sample of samples) {
    const idx = (sample.y * img.width + sample.x) * 4;
    console.log(`${sample.name} (${sample.x}, ${sample.y}): R=${data[idx]}, G=${data[idx + 1]}, B=${data[idx + 2]}, A=${data[idx + 3]}`);
  }

  // Count different pixel types
  let transparentCount = 0;
  let whiteCount = 0;
  let blackCount = 0;
  let otherCount = 0;
  let lowAlphaCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 50) {
      lowAlphaCount++;
    }
    if (a === 0) {
      transparentCount++;
    } else if (r > 240 && g > 240 && b > 240) {
      whiteCount++;
    } else if (r < 15 && g < 15 && b < 15) {
      blackCount++;
    } else {
      otherCount++;
    }
  }

  const totalPixels = img.width * img.height;
  console.log(`\nPixel distribution (out of ${totalPixels} total):`);
  console.log(`  Transparent (alpha=0): ${transparentCount} (${(transparentCount / totalPixels * 100).toFixed(2)}%)`);
  console.log(`  Low alpha (alpha<50): ${lowAlphaCount} (${(lowAlphaCount / totalPixels * 100).toFixed(2)}%)`);
  console.log(`  White-ish: ${whiteCount} (${(whiteCount / totalPixels * 100).toFixed(2)}%)`);
  console.log(`  Black-ish: ${blackCount} (${(blackCount / totalPixels * 100).toFixed(2)}%)`);
  console.log(`  Other colors: ${otherCount} (${(otherCount / totalPixels * 100).toFixed(2)}%)`);

  // Save a copy so we can verify the canvas is working
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.resolve(__dirname, '../debug_raw.png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`\nSaved raw canvas output to: ${outputPath}`);
}

debugImage();
