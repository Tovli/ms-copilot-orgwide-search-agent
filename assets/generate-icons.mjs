// Original geometric document/search mark. No third-party artwork or font.
// Run `node assets/generate-icons.mjs` to reproduce the checked-in PNG assets.
import { PNG } from 'pngjs';
import { mkdir, writeFile } from 'node:fs/promises';

function mark(x, y) {
  // Coordinates in a 32 x 32 design space; document plus magnifying glass.
  const doc = x >= 6 && x <= 21 && y >= 4 && y <= 26;
  const inner = x > 8 && x < 19 && y > 6 && y < 24;
  const lines = x >= 10 && x <= 17 && ((y >= 9 && y <= 10.5) || (y >= 13 && y <= 14.5));
  const radius = Math.hypot(x - 21, y - 21);
  const ring = radius >= 4 && radius <= 6;
  const handle = x >= 24 && x <= 29 && Math.abs(y - x) < 1.4;
  return (doc && !inner) || lines || ring || handle;
}

function make(size, outline) {
  const png = new PNG({ width: size, height: size });
  const samples = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let coverage = 0;
    for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
      coverage += mark((x + (sx + 0.5) / samples) * 32 / size, (y + (sy + 0.5) / samples) * 32 / size) ? 1 : 0;
    }
    coverage /= samples * samples;
    const index = (y * size + x) * 4;
    const background = [23, 78, 166];
    for (let channel = 0; channel < 3; channel++) {
      png.data[index + channel] = outline ? 255 : Math.round(background[channel] * (1 - coverage) + 255 * coverage);
    }
    png.data[index + 3] = outline ? Math.round(coverage * 255) : 255;
  }
  return PNG.sync.write(png);
}
await mkdir('appPackage', { recursive: true });
await writeFile('appPackage/color.png', make(192, false));
await writeFile('appPackage/outline.png', make(32, true));
