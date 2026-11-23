import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/images/clothing');
const items = [
  ['sunflower-bucket-hat', 'hat', '#e1b84f', '#fff1a2', '#785344'],
  ['raincloud-cap', 'hat', '#587591', '#a8c6cf', '#e7e5cf'],
  ['koi-headband', 'hat', '#b84740', '#f7e9d6', '#d89a50'],
  ['disco-crown', 'hat', '#b442a2', '#f5a5dc', '#f7dc83'],
  ['aurora-helmet', 'hat', '#384d78', '#83e2d6', '#c69ee8'],
  ['mint-windbreaker', 'jacket', '#75bda8', '#e5f1d6', '#387d78'],
  ['coral-fishing-vest', 'jacket', '#df715f', '#f4c083', '#885548'],
  ['tidebreaker-raincoat', 'jacket', '#386d93', '#7bc2d0', '#e9c989'],
  ['neon-arcade-jacket', 'jacket', '#603b9a', '#e662d5', '#66e4e2'],
  ['dragon-scale-coat', 'jacket', '#347a65', '#8bc89d', '#edca6e'],
  ['patched-denim', 'pants', '#4d7090', '#98b1c0', '#d8a887'],
  ['tidepool-shorts', 'pants', '#4faea9', '#c1e4cb', '#e4c574'],
  ['moss-overalls', 'pants', '#627d55', '#b5bc79', '#e2c178'],
  ['hologram-trousers', 'pants', '#4a448d', '#a47be6', '#6fe8d8'],
  ['royal-sailor-pants', 'pants', '#334c79', '#f6e3a0', '#d4a64e'],
  ['dock-sandals', 'shoes', '#8b644a', '#d6af77', '#f2e1b1'],
  ['coral-sneakers', 'shoes', '#e28268', '#ffe2b6', '#f8f2e1'],
  ['storm-boots', 'shoes', '#4c6572', '#a4c3ba', '#f1d377'],
  ['comet-skates', 'shoes', '#3a457b', '#a5a8e9', '#f2d283'],
  ['jewel-slippers', 'shoes', '#a64759', '#eb9e9a', '#f1ca74'],
];

function rgba(hex) { return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); }
function canvas(w, h) {
  const png = new PNG({ width: w, height: h });
  const dot = (x, y, color) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    const [r, g, b] = rgba(color);
    png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
  };
  const rect = (x, y, width, height, color) => {
    for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++) dot(xx, yy, color);
  };
  return { png, dot, rect };
}

function hat(id, main, light, trim, index) {
  const { png, dot, rect } = canvas(32, 16);
  rect(8, 0, 8, 8, main);
  rect(9, 1, 6, 1, light);
  for (const x of [0, 16, 24]) rect(x, 8, 8, 3, main);
  rect(8, 8, 8, 2, main);
  rect(8, 9, 8, 1, light);
  rect(11, 8, 2, 2, trim);
  if (id === 'sunflower-bucket-hat') { dot(11, 8, '#785344'); dot(12, 8, '#785344'); }
  if (id === 'raincloud-cap') { rect(10, 8, 4, 1, trim); }
  if (id === 'koi-headband') { rect(9, 8, 2, 1, light); rect(13, 8, 2, 1, light); }
  if (id === 'disco-crown' || id === 'aurora-helmet') for (let x = 8; x < 16; x += 2) dot(x, 8, index % 2 ? light : trim);
  return png;
}

function jacket(id, main, light, trim, arm = false) {
  const w = arm ? 16 : 24;
  const { png, dot, rect } = canvas(w, 16);
  rect(0, 0, w, 16, main);
  const front = arm ? 4 : 4;
  const fw = arm ? 4 : 8;
  rect(front, 4, fw, 2, light);
  if (arm) {
    rect(front, 13, fw, 2, trim);
    if (id.includes('neon') || id.includes('dragon')) rect(front, 8, fw, 1, light);
  } else {
    rect(7, 5, 1, 11, trim);
    rect(5, 10, 2, 2, light);
    rect(9, 10, 2, 2, light);
    if (id.includes('coral') || id.includes('tidebreaker')) {
      rect(4, 12, 3, 1, trim); rect(9, 12, 3, 1, trim);
    }
    if (id.includes('neon') || id.includes('dragon')) {
      for (let y = 7; y < 16; y += 3) { dot(4, y, light); dot(11, y, light); }
    }
  }
  return png;
}

function leg(id, slot, main, light, trim) {
  const { png, dot, rect } = canvas(16, 16);
  if (slot === 'pants') {
    rect(0, 4, 16, 6, main);
    rect(4, 4, 4, 1, trim);
    if (id === 'patched-denim') { rect(4, 7, 2, 2, light); dot(4, 7, trim); }
    else if (id === 'tidepool-shorts') { rect(4, 8, 4, 2, light); dot(5, 6, trim); }
    else if (id === 'moss-overalls') { rect(5, 6, 2, 2, light); rect(4, 8, 4, 1, trim); }
    else if (id === 'hologram-trousers') { rect(4, 5, 1, 5, light); rect(7, 5, 1, 5, trim); }
    else { rect(4, 6, 4, 1, light); dot(6, 5, trim); }
  } else {
    rect(0, 10, 16, 6, main);
    rect(4, 14, 4, 2, trim);
    rect(4, 11, 4, 1, light);
    if (id === 'coral-sneakers') { rect(4, 12, 4, 1, '#f8f2e1'); }
    else if (id === 'storm-boots') { dot(4, 12, trim); dot(5, 13, trim); dot(6, 12, trim); }
    else if (id === 'comet-skates') { rect(4, 13, 4, 1, light); dot(6, 12, trim); }
    else if (id === 'jewel-slippers') { dot(5, 12, trim); dot(6, 11, trim); dot(7, 12, trim); }
  }
  return png;
}

fs.mkdirSync(directory, { recursive: true });
for (const [id, slot, main, light, trim] of items) {
  const parts = slot === 'hat' ? [['head', hat(id, main, light, trim, items.findIndex((item) => item[0] === id))]]
    : slot === 'jacket' ? [['body', jacket(id, main, light, trim)], ['arm', jacket(id, main, light, trim, true)]]
      : [['leg', leg(id, slot, main, light, trim)]];
  for (const [part, image] of parts) fs.writeFileSync(path.join(directory, `${id}-${part}.png`), PNG.sync.write(image));
}
console.log(`Generated ${items.length} Closet outfits (${items.reduce((sum, item) => sum + (item[1] === 'jacket' ? 2 : 1), 0)} textures).`);
