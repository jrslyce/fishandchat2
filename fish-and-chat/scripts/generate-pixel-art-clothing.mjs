import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_CLOTHING_DIR = path.resolve(__dirname, '../public/images/clothing');
const DIST_CLOTHING_DIR = path.resolve(__dirname, '../dist/images/clothing');

/**
 * Convert a hex color string (#rgb, #rgba, #rrggbb, #rrggbbaa) to [r, g, b, a].
 */
function parseHexColor(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b, 255];
  }
  if (h.length === 4) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    const a = parseInt(h[3] + h[3], 16);
    return [r, g, b, a];
  }
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return [r, g, b, 255];
  }
  if (h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = parseInt(h.slice(6, 8), 16);
    return [r, g, b, a];
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

/**
 * Builds a PNG buffer from an ASCII art string and a palette map.
 */
function createPngFromAscii(width, height, asciiRows, palette) {
  const png = new PNG({ width, height });

  // Normalize palette to [r, g, b, a]
  const colorMap = new Map();
  colorMap.set('.', [0, 0, 0, 0]);
  colorMap.set(' ', [0, 0, 0, 0]);

  for (const [key, value] of Object.entries(palette)) {
    if (Array.isArray(value)) {
      colorMap.set(key, value);
    } else {
      colorMap.set(key, parseHexColor(value));
    }
  }

  if (asciiRows.length !== height) {
    throw new Error(`Expected ${height} rows, got ${asciiRows.length}`);
  }

  for (let y = 0; y < height; y++) {
    const row = asciiRows[y];
    if (row.length !== width) {
      throw new Error(`Row ${y} has length ${row.length}, expected ${width}: "${row}"`);
    }
    for (let x = 0; x < width; x++) {
      const char = row[x];
      const color = colorMap.get(char);
      if (!color) {
        throw new Error(`Unknown palette character '${char}' at (${x}, ${y}) in row: "${row}"`);
      }
      const idx = (width * y + x) << 2;
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = color[3];
    }
  }

  return PNG.sync.write(png);
}

// ============================================================================
// 1. Captain's Tricorn Hat: captain-hat-head.png (32x16)
// ============================================================================
const captainHatPalette = {
  N: '#151b2d', // Deep navy base
  D: '#0d121f', // Dark navy shadow
  L: '#202a44', // Navy highlight
  G: '#f59e0b', // Rich gold braid
  Y: '#fde047', // Bright gold highlight
  B: '#b45309', // Dark antique gold
  W: '#f8fafc', // Cockade feather / white accent
  R: '#dc2626', // Cockade red center
};

const captainHatAscii = [
  // Y 0..7 (depth = 8): [0..7 empty] [8..15 top] [16..23 bottom] [24..31 empty]
  '........' + '.GGGGGG.' + 'DDDDDDDD' + '........',
  '........' + 'GLLLLLLG' + 'DDDDDDDD' + '........',
  '........' + 'GLNNNNLG' + 'DDDDDDDD' + '........',
  '........' + 'GLNDDNLG' + 'DDDDDDDD' + '........',
  '........' + 'GLNDDNLG' + 'DDDDDDDD' + '........',
  '........' + 'GLNNNNLG' + 'DDDDDDDD' + '........',
  '........' + 'GLLLLLLG' + 'DDDDDDDD' + '........',
  '........' + '.GGGGGG.' + 'DDDDDDDD' + '........',

  // Y 8..15 (height = 8): [0..7 right] [8..15 front] [16..23 left] [24..31 back]
  'GGGGGGGG' + 'GGLYYLGG' + 'GGGGGGGG' + 'GGGGGGGG',
  'GLLLLLLG' + 'GLWRRWLG' + 'GLLLLLLG' + 'GLNNNNLG',
  'GLNNNNLG' + 'BGYGGYGB' + 'GLNNNNLG' + 'GNNDDNNG',
  'GNNNNNNG' + '..BGGB..' + 'GNNNNNNG' + 'GDDDDDDG',
  'GDDDDDDG' + '........' + 'GDDDDDDG' + 'BBBBBBBB',
  'BBBBBBBB' + '........' + 'BBBBBBBB' + 'DDDDDDDD',
  'DDDDDDDD' + '........' + 'DDDDDDDD' + 'DDDDDDDD',
  'DDDDDDDD' + '........' + 'DDDDDDDD' + 'DDDDDDDD',
];

// ============================================================================
// 2. Royal Gilded Crown: royal-crown-head.png (32x16)
// ============================================================================
const royalCrownPalette = {
  G: '#facc15', // Royal gold base
  Y: '#fef08a', // Gleaming gold highlight
  B: '#b45309', // Deep antique gold
  D: '#78350f', // Dark gold crevice
  R: '#dc2626', // Radiant ruby
  r: '#f87171', // Ruby glint
  E: '#059669', // Emerald jewel
  e: '#34d399', // Emerald glint
};

const royalCrownAscii = [
  // Y 0..7 (depth = 8): [0..7 empty] [8..15 top circlet rim] [16..23 bottom] [24..31 empty]
  '........' + 'YGGGGGGY' + 'BBBBBBBB' + '........',
  '........' + 'Gr....eG' + 'BD....DB' + '........',
  '........' + 'G......G' + 'B......B' + '........',
  '........' + 'G......G' + 'B......B' + '........',
  '........' + 'G......G' + 'B......B' + '........',
  '........' + 'G......G' + 'B......B' + '........',
  '........' + 'Ge....rG' + 'BD....DB' + '........',
  '........' + 'YGGGGGGY' + 'BBBBBBBB' + '........',

  // Y 8..15: [0..7 right] [8..15 front] [16..23 left] [24..31 back]
  '..YY....' + '...YY...' + '....YY..' + '..YY....',
  'Y.GG.Y.Y' + 'Y..GG..Y' + 'Y.Y.GG.Y' + 'Y.GG.Y.Y',
  'eEGGBrRB' + 'eEBrRBeE' + 'BrRBeEGG' + 'eEGGBrRB',
  'BGYGBGYB' + 'BGYGGYGB' + 'BYGBGYGB' + 'BGYGBGYB',
  '........' + '........' + '........' + '........',
  '........' + '........' + '........' + '........',
  '........' + '........' + '........' + '........',
  '........' + '........' + '........' + '........',
];

// ============================================================================
// 3. Deep Diver Helmet: diver-mask-head.png (32x16)
// ============================================================================
const diverHelmetPalette = {
  B: '#b45309', // Vintage brass midtone
  Y: '#facc15', // Polished brass highlight
  H: '#fef08a', // Bright rivet glint
  S: '#78350f', // Deep brass shadow
  D: '#451a03', // Dark seam crevice
  W: '#f0fdfa', // Reflection glint on glass
  C: '#38bdf8', // Luminous cyan glass
  T: '#0891b2', // Deep oceanic teal
  A: '#164e63', // Deepest abyss teal
  O: '#0284c7', // Mid ocean blue
};

const diverHelmetAscii = [
  // Y 0..7 (depth = 8): [0..7 empty] [8..15 top dome] [16..23 neck collar] [24..31 empty]
  '........' + 'SBBBBBBS' + 'SSSSSSSS' + '........',
  '........' + 'BBYHHYBB' + 'SDDDDDDS' + '........',
  '........' + 'BYHDDHBY' + 'SDBBBBDS' + '........',
  '........' + 'BYDSSDYY' + 'SDBYYBDS' + '........',
  '........' + 'BYDSSDYY' + 'SDBYYBDS' + '........',
  '........' + 'BYHDDHBY' + 'SDBBBBDS' + '........',
  '........' + 'BBYHHYBB' + 'SDDDDDDS' + '........',
  '........' + 'SBBBBBBS' + 'SSSSSSSS' + '........',

  // Y 8..15: [0..7 right] [8..15 front] [16..23 left] [24..31 back]
  'SBBYYBBS' + 'SBBYYBBS' + 'SBBYYBBS' + 'SBBYYBBS',
  'BBBBBBBB' + 'BHSBBSHB' + 'BBBBBBBB' + 'BBBBBBBB',
  'BSHBBHSB' + 'BSWWCAAS' + 'BSHBBHSB' + 'BBSHHSSB',
  'BSCWASBB' + 'BSWCCAAS' + 'BBSAWCSS' + 'BBSDDSSB',
  'BSATASBB' + 'BSCTOAAS' + 'BBSATAAS' + 'BBSDDSSB',
  'BSHBBHSB' + 'BSTAASAS' + 'BSHBBHSB' + 'BBSHHSSB',
  'BBBBBBBB' + 'BHSBBSHB' + 'BBBBBBBB' + 'BBBBBBBB',
  'SHSHSHSH' + 'SHSHSHSH' + 'SHSHSHSH' + 'SHSHSHSH',
];

// ============================================================================
// 4. Cableknit Fisherman Sweater: cableknit-sweater-body.png (24x16)
// ============================================================================
const cableknitPalette = {
  W: '#fefbf3', // Loft highlight / stitch crest
  C: '#f4ebd9', // Creamy wool midtone
  S: '#dfcead', // Soft wool shadow
  D: '#bead88', // Deep cable valley shadow
  B: '#9d8c67', // Darkest knit indent
};

const cableknitBodyAscii = [
  // Y 0..3: [0..3 empty] [4..11 shoulder/collar] [12..19 waist bottom] [20..23 empty]
  '....' + 'CCWWWWCC' + 'SDDSSDDD' + '....',
  '....' + 'CWSDDSSW' + 'DDDDDDDD' + '....',
  '....' + 'CWSD..SW' + 'DDDDDDDD' + '....',
  '....' + 'CWSDDSSW' + 'SDDSSDDD' + '....',

  // Y 4..15 (height = 12): [0..3 right] [4..11 front] [12..15 left] [16..23 back]
  'SCWS' + 'CWSDDSSW' + 'SCWS' + 'CWWSSWWC',
  'DSCD' + 'SWCSSCWS' + 'DSCD' + 'SWCSSCWS',
  'SCWS' + 'DCWDDWCD' + 'SCWS' + 'DCWDDWCD',
  'DSCD' + 'SWCSSCWS' + 'DSCD' + 'SWCSSCWS',
  'SCWS' + 'DSWWWWSD' + 'SCWS' + 'DSWWWWSD',
  'DSCD' + 'SWCSSCWS' + 'DSCD' + 'SWCSSCWS',
  'SCWS' + 'DCWDDWCD' + 'SCWS' + 'DCWDDWCD',
  'DSCD' + 'SWCSSCWS' + 'DSCD' + 'SWCSSCWS',
  'SCWS' + 'DSWWWWSD' + 'SCWS' + 'DSWWWWSD',
  'DSCD' + 'SWCSSCWS' + 'DSCD' + 'SWCSSCWS',
  'WSWS' + 'WSWSWSWS' + 'WSWS' + 'WSWSWSWS',
  'SDSD' + 'SDSDSDSD' + 'SDSD' + 'SDSDSDSD',
];

// Cableknit Arm (16x16)
const cableknitArmAscii = [
  // Y 0..3: [0..3 empty] [4..7 shoulder cap] [8..11 cuff underside] [12..15 empty]
  '....' + 'CWWC' + 'SDDS' + '....',
  '....' + 'WCCW' + 'DDDD' + '....',
  '....' + 'WCCW' + 'DDDD' + '....',
  '....' + 'CSSC' + 'SDDS' + '....',

  // Y 4..15: [0..3 side1] [4..7 front] [8..11 side2] [12..15 back]
  'SCWS' + 'SWCS' + 'SCWS' + 'SWCS',
  'DSCD' + 'DCWD' + 'DSCD' + 'DCWD',
  'SCWS' + 'SWCS' + 'SCWS' + 'SWCS',
  'DSCD' + 'DWCD' + 'DSCD' + 'DWCD',
  'SCWS' + 'SCWS' + 'SCWS' + 'SCWS',
  'DSCD' + 'DWCD' + 'DSCD' + 'DWCD',
  'SCWS' + 'SWCS' + 'SCWS' + 'SWCS',
  'DSCD' + 'DCWD' + 'DSCD' + 'DCWD',
  'SCWS' + 'SWCS' + 'SCWS' + 'SWCS',
  'WSWS' + 'WSWS' + 'WSWS' + 'WSWS',
  'WSWS' + 'WSWS' + 'WSWS' + 'WSWS',
  'SDSD' + 'SDSD' + 'SDSD' + 'SDSD',
];

// ============================================================================
// 5. Royal Gilded Cloak / Robe: royal-cloak-body.png (24x16) & arm (16x16)
// ============================================================================
const royalCloakPalette = {
  R: '#991b1b', // Regal crimson velvet midtone
  L: '#b91c1c', // Crimson velvet highlight
  D: '#7f1d1d', // Crimson velvet fold shadow
  K: '#500707', // Deep velvet crevice
  G: '#facc15', // Bright gold embroidery
  Y: '#fef08a', // Gleaming gold highlight
  B: '#b45309', // Deep antique gold
  W: '#f8fafc', // Pure white ermine fur
  E: '#cbd5e1', // Ermine fur soft shadow
  X: '#1e293b', // Black ermine tail fleck
};

const royalCloakBodyAscii = [
  // Y 0..3: [0..3 empty] [4..11 shoulder mantle] [12..19 hem underside] [20..23 empty]
  '....' + 'WWWWWWWW' + 'KKKKKKKK' + '....',
  '....' + 'WEXEEEXW' + 'KDDDDDDK' + '....',
  '....' + 'WEG..GEW' + 'KDBBBBDK' + '....',
  '....' + 'WEGYYGEW' + 'BBBBBBBB' + '....',

  // Y 4..15: [0..3 right] [4..11 front] [12..15 left] [16..23 back mantle]
  'DRLD' + 'WEGYYGEW' + 'DRLD' + 'WEXEEEXW',
  'KDRK' + 'EWBGGBWE' + 'KDRK' + 'DLRRRRLD',
  'DRLD' + 'DGLYYLGD' + 'DRLD' + 'KDRLLRDK',
  'KDRK' + 'KGRBBRGK' + 'KDRK' + 'DRGYYGRD',
  'DRLD' + 'DGLYYLGD' + 'DRLD' + 'KDYGGYDK',
  'KDRK' + 'KGRBBRGK' + 'KDRK' + 'DRGYYGRD',
  'DRLD' + 'DGLYYLGD' + 'DRLD' + 'KDRLLRDK',
  'KDRK' + 'KGRBBRGK' + 'KDRK' + 'DLRRRRLD',
  'DRLD' + 'DGLYYLGD' + 'DRLD' + 'KDRLLRDK',
  'KDRK' + 'KGRBBRGK' + 'KDRK' + 'DLRRRRLD',
  'BGYB' + 'BGYBBYGB' + 'BGYB' + 'BGYBBYGB',
  'YBGY' + 'YBGYBGYB' + 'YBGY' + 'YBGYBGYB',
];

const royalCloakArmAscii = [
  // Y 0..3: [0..3 empty] [4..7 epaulet cap] [8..11 cuff underside] [12..15 empty]
  '....' + 'YGGY' + 'EWWE' + '....',
  '....' + 'GBBG' + 'WEEW' + '....',
  '....' + 'RLLR' + 'WEEW' + '....',
  '....' + 'DRRD' + 'EWWE' + '....',

  // Y 4..15: [0..3 side1] [4..7 front] [8..11 side2] [12..15 back]
  'DRLD' + 'DRLD' + 'DRLD' + 'DRLD',
  'KDRK' + 'KRLK' + 'KDRK' + 'KRLK',
  'DRLD' + 'DGGK' + 'DRLD' + 'DGGK',
  'KDRK' + 'KRLK' + 'KDRK' + 'KRLK',
  'DRLD' + 'DRLD' + 'DRLD' + 'DRLD',
  'KDRK' + 'KRLK' + 'KDRK' + 'KRLK',
  'DRLD' + 'DGGK' + 'DRLD' + 'DGGK',
  'KDRK' + 'KRLK' + 'KDRK' + 'KRLK',
  'BGYB' + 'BGYB' + 'BGYB' + 'BGYB',
  'WEWW' + 'WEWW' + 'WEWW' + 'WEWW',
  'WREW' + 'WXEW' + 'WREW' + 'WXEW',
  'EWWE' + 'EWWE' + 'EWWE' + 'EWWE',
];

// ============================================================================
// 6. Yellow Sea Waders: yellow-waders-leg.png (16x16)
// (Rows 0..10 opaque pants, rows 11..15 transparent)
// ============================================================================
const yellowWadersPalette = {
  Y: '#facc15', // Bright fisherman wader yellow
  L: '#fef08a', // Rubber highlight
  M: '#eab308', // Yellow midtone
  D: '#ca8a04', // Rubber shadow
  S: '#a16207', // Deep crease / seam
  P: '#854d0e', // Heavy reinforced rubber patch
  O: '#713f12', // Patch shadow
  Q: '#58310c', // Heavy stitched border
  B: '#cbd5e1', // Metal snap fastener
};

const yellowWadersAscii = [
  // Y 0..3: [0..3 empty] [4..7 hip top] [8..11 empty] [12..15 empty]
  '....' + 'MYYM' + '....' + '....',
  '....' + 'YLLY' + '....' + '....',
  '....' + 'MYYM' + '....' + '....',
  '....' + 'DMMD' + '....' + '....',

  // Y 4..10: [0..3 right] [4..7 front] [8..11 left] [12..15 back]
  'SMYD' + 'DYLD' + 'SMYD' + 'DMYD',
  'SYLD' + 'SMYS' + 'SYLD' + 'SMYS',
  'SMYD' + 'DYLD' + 'SMYD' + 'DMYD',
  'SMYD' + 'QPPD' + 'SMYD' + 'DMYD',
  'SMBD' + 'QPPD' + 'SMBD' + 'SMYS',
  'SMYD' + 'QOOQ' + 'SMYD' + 'DMYD',
  'SDMS' + 'DMYD' + 'SDMS' + 'SDMS',

  // Y 11..15: 100% transparent for shoes
  '................',
  '................',
  '................',
  '................',
  '................',
];

// ============================================================================
// 7. Diver Boots: diver-boots-leg.png (16x16)
// (Rows 0..10 transparent, rows 11..15 opaque shoes)
// ============================================================================
const diverBootsPalette = {
  L: '#64748b', // Lead highlight
  M: '#475569', // Lead midtone
  D: '#334155', // Lead shadow
  K: '#1e293b', // Dark lead / welt
  B: '#0f172a', // Deepest cleated sole
  G: '#f59e0b', // Brass buckle / toe cap
  Y: '#fef08a', // Brass glint highlight
  A: '#b45309', // Antique brass shadow
};

const diverBootsAscii = [
  // Y 0..10: 100% transparent for pants
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',

  // Y 11..15: [0..3 right] [4..7 front] [8..11 left] [12..15 back]
  'DMMD' + 'DGGD' + 'DMMD' + 'DKKD',
  'MLMD' + 'MYGM' + 'MLMD' + 'DMMD',
  'DMMK' + 'AGYA' + 'DMMK' + 'KDDK',
  'KKKK' + 'KKKK' + 'KKKK' + 'KKKK',
  'BBBB' + 'BBBB' + 'BBBB' + 'BBBB',
];

// ============================================================================
// 8. Golden High-Roller Boots: golden-boots-leg.png (16x16)
// (Rows 0..10 transparent, rows 11..15 opaque shoes)
// ============================================================================
const goldenBootsPalette = {
  W: '#ffffff', // Diamond glint / specular reflection
  H: '#fef08a', // Gleaming gold highlight
  G: '#facc15', // Pure gold polished midtone
  M: '#f59e0b', // Amber gold
  A: '#d97706', // Deep gold shadow
  D: '#92400e', // Dark gold welt
  K: '#78350f', // Deepest gilded sole
};

const goldenBootsAscii = [
  // Y 0..10: 100% transparent for pants
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',

  // Y 11..15: [0..3 right] [4..7 front] [8..11 left] [12..15 back]
  'AHGA' + 'AWWA' + 'AHGA' + 'AGGA',
  'MHGA' + 'MHGM' + 'MHGA' + 'DMHD',
  'AGMD' + 'AGHA' + 'AGMD' + 'DAMD',
  'DAMD' + 'DAMD' + 'DAMD' + 'DAMD',
  'KDDK' + 'KDDK' + 'KDDK' + 'KDDK',
];

// ============================================================================
// 9. Cosmic Wizard Hat: cosmic-wizard-hat-head.png (32x16)
// ============================================================================
const cosmicWizardHatPalette = {
  D: '#0d0824', // Deep midnight void shadow
  N: '#180e38', // Midnight indigo base
  P: '#2d1b69', // Cosmic purple midtone
  L: '#4c2c9e', // Astral violet highlight
  S: '#8b5cf6', // Bright magical violet sheen
  G: '#facc15', // Gold star/moon crest
  Y: '#fef08a', // Shining gold/starlight highlight
  A: '#b45309', // Antique gold shadow
  C: '#67e8f9', // Cyan stardust glint
  W: '#ffffff', // Brilliant starlight glint
};

const cosmicWizardHatAscii = [
  // Y 0..7 (depth = 8): [0..7 empty] [8..15 top apex] [16..23 under-brim] [24..31 empty]
  '........' + '..DDDD..' + 'DDDDDDDD' + '........',
  '........' + '.DPPSSD.' + 'DDNNNNDD' + '........',
  '........' + 'DPGYYGPD' + 'DNNPPNND' + '........',
  '........' + 'DPYYYYPD' + 'DNPLLPND' + '........',
  '........' + 'DPSWWSPD' + 'DNPLLPND' + '........',
  '........' + 'DPGYYGPD' + 'DNNPPNND' + '........',
  '........' + '.DPPSSD.' + 'DDNNNNDD' + '........',
  '........' + '..DDDD..' + 'DDDDDDDD' + '........',

  // Y 8..15 (height = 8): [0..7 right] [8..15 front] [16..23 left] [24..31 back]
  '..DDDD..' + '..PYYP..' + '..DDDD..' + '..DDDD..',
  '.DLPPLD.' + '.LGYGSL.' + '.DLPPLD.' + '.DPNNPD.',
  '.LLPPLL.' + 'LGG..GSL' + '.LLPPLL.' + '.LPNNPL.',
  'DLLPPLSD' + 'LGAYYCSL' + 'DSLPLLD.' + 'DLPNPPLD',
  'DLPPSLLD' + 'DLLGGLLD' + 'DLLSLLLD' + 'DLLNNLLD',
  'AGGGGGGA' + 'AGYWWYGA' + 'AGGGGGGA' + 'AGGGGGGA',
  'GYLYLYLG' + 'GLYYYYLG' + 'GYLYLYLG' + 'GLYYYYLG',
  'ADDAADDA' + 'ADDDDSSA' + 'ADDAADDA' + 'ADDDDSSA',
];

// ============================================================================
// 10. Nebula Robe: nebula-robe-body.png (24x16) & nebula-robe-arm.png (16x16)
// ============================================================================
const nebulaRobePalette = {
  V: '#1e0b36', // Dark velvet shadow
  D: '#110620', // Deep crease void
  M: '#3b156b', // Nebula violet midtone
  P: '#581c87', // Royal purple
  H: '#8b2fc9', // Radiant magenta highlight
  N: '#c084fc', // Luminous nebula cloud
  G: '#facc15', // Astral gold trim
  Y: '#fef08a', // Bright gold / star
  W: '#ffffff', // White stellar core
  C: '#38bdf8', // Glowing cyan stardust
  A: '#b45309', // Antique gold shadow
  L: '#fef9c3', // Pale gold glint
};

const nebulaRobeBodyAscii = [
  // Y 0..3: [0..3 empty] [4..11 collar/shoulders] [12..19 hem underside] [20..23 empty]
  '....' + 'GGYYYYGG' + 'DDDDDDDD' + '....',
  '....' + 'GMPHHPMG' + 'DMMMMMMD' + '....',
  '....' + 'GMP..PMG' + 'DMVVVVMD' + '....',
  '....' + 'GMGYYGMG' + 'DDDDDDDD' + '....',

  // Y 4..15: [0..3 right] [4..11 front] [12..15 left] [16..23 back]
  'DMMD' + 'GMGYYGMG' + 'DMMD' + 'GMPHHPMG',
  'MPHM' + 'MGG..GGM' + 'MPHM' + 'PHM..MHP',
  'PHNP' + 'PGVCCVGP' + 'PHNP' + 'HMW..WMH',
  'MNWM' + 'MGVWWMGM' + 'MNWM' + 'NMPCCPMN',
  'MPHM' + 'PGVYHVGP' + 'MPHM' + 'PNCWWCNP',
  'VMMV' + 'MGGYYGGM' + 'VMMV' + 'MPHNNHPM',
  'AGGA' + 'AGYWWYGA' + 'AGGA' + 'AGGGGGGA',
  'MPHM' + 'MHPHHPHM' + 'MPHM' + 'MHPHHPHM',
  'PHNP' + 'PNMWCMNP' + 'PHNP' + 'PNMWCMNP',
  'MNWM' + 'HPMWWMNP' + 'MNWM' + 'HPMWWMNP',
  'AGGA' + 'AGGGGGGA' + 'AGGA' + 'AGGGGGGA',
  'GYLG' + 'GLYYYYLG' + 'GYLG' + 'GLYYYYLG',
];

const nebulaRobeArmAscii = [
  // Y 0..3: [0..3 empty] [4..7 shoulder cap] [8..11 cuff underside] [12..15 empty]
  '....' + 'GYLG' + 'DDDD' + '....',
  '....' + 'MPHM' + 'DMMD' + '....',
  '....' + 'PHNP' + 'DMMD' + '....',
  '....' + 'DMMD' + 'DDDD' + '....',

  // Y 4..15: [0..3 side1] [4..7 front] [8..11 side2] [12..15 back]
  'DMMD' + 'DMMD' + 'DMMD' + 'DMMD',
  'MPHM' + 'MPHM' + 'MPHM' + 'MPHM',
  'PHNP' + 'PHCP' + 'PHNP' + 'PHNP',
  'HNWH' + 'NWMN' + 'HNWH' + 'HNWH',
  'NCPN' + 'CPNC' + 'NCPN' + 'NCPN',
  'PHNP' + 'PHNP' + 'PHNP' + 'PHNP',
  'MPHM' + 'MWPM' + 'MPHM' + 'MPHM',
  'HPMH' + 'HPMH' + 'HPMH' + 'HPMH',
  'AGGA' + 'AGGA' + 'AGGA' + 'AGGA',
  'GYLG' + 'GYLG' + 'GYLG' + 'GYLG',
  'NCPN' + 'NCPN' + 'NCPN' + 'NCPN',
  'AGGA' + 'AGGA' + 'AGGA' + 'AGGA',
];

// ============================================================================
// 11. Stellar Boots: stellar-boots-leg.png (16x16)
// ============================================================================
const stellarBootsPalette = {
  C: '#38bdf8', // Glowing cyan energy
  K: '#0284c7', // Deep cyan accent
  W: '#e0f2fe', // Glowing cyan-white core
  D: '#090d16', // Deep void black
  S: '#1e1b4b', // Dark astral navy leather
  M: '#312e81', // Indigo leather midtone
  L: '#4338ca', // Astral violet highlight
  B: '#020617', // Void sole
};

const stellarBootsAscii = [
  // Y 0..10: 100% transparent for pants
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',

  // Y 11..15: [0..3 right] [4..7 front] [8..11 left] [12..15 back]
  'SCCS' + 'WCCW' + 'SCCS' + 'SCCS',
  'SMLS' + 'MCCM' + 'SMLS' + 'SMMS',
  'LCKL' + 'CWWK' + 'LCKL' + 'SKKS',
  'DSSD' + 'KCWW' + 'DSSD' + 'DDDD',
  'BCCB' + 'BCCB' + 'BCCB' + 'BBBB',
];

// ============================================================================
// 12. Pirate Bandana: pirate-bandana-head.png (32x16)
// ============================================================================
const pirateBandanaPalette = {
  R: '#dc2626', // Crimson red
  D: '#991b1b', // Deep crimson shadow
  H: '#ef4444', // Bright crimson highlight
  K: '#7f1d1d', // Dark crease shadow
  W: '#f8fafc', // Skull white
  B: '#0f172a', // Skull eye socket black
  G: '#facc15', // Gold earring
  Y: '#fef08a', // Gold glint
  A: '#b45309', // Antique gold shadow
  S: '#451a03', // Leather brow / dark hair edge
};

const pirateBandanaAscii = [
  // Y 0..7 (depth = 8): [0..7 empty] [8..15 top tied cloth] [16..23 underside] [24..31 empty]
  '........' + '..KKKK..' + 'KKKKKKKK' + '........',
  '........' + '.KDRRDK.' + 'KDDDDDDK' + '........',
  '........' + 'KDRHHRDK' + 'KDDDDDDK' + '........',
  '........' + 'KRH..HRK' + 'KDDDDDDK' + '........',
  '........' + 'KRH..HRK' + 'KDDDDDDK' + '........',
  '........' + 'KDRHHRDK' + 'KDDDDDDK' + '........',
  '........' + '.KDRRDK.' + 'KDDDDDDK' + '........',
  '........' + '..KKKK..' + 'KKKKKKKK' + '........',

  // Y 8..15: [0..7 right] [8..15 front] [16..23 left earring] [24..31 back knot/tails]
  'KRRHHRRK' + 'KRRHHRRK' + 'KRRHHRRK' + 'KRRHHRRK',
  'RRDDDDRR' + 'RDWWWWDR' + 'RRDDDDRR' + 'RRD..DRR',
  'RDDRRDDR' + 'RWBWWBWR' + 'RDDRRDDR' + 'R.DKKDR.',
  'KRRRRRRK' + 'RDW..WDR' + 'R..G..RR' + '..KYYK..',
  'KDDDDDDK' + 'RDWWWWDR' + '...YGA..' + '.KR..RK.',
  'KRRRRRRK' + 'KDRRRRDK' + '...AGY..' + 'KR....RK',
  '........' + 'SSSSSSSS' + '....A...' + 'KD....DK',
  '........' + '........' + '........' + '........',
];

// ============================================================================
// 13. Buccaneer Vest: buccaneer-vest-body.png (24x16) & arm (16x16)
// ============================================================================
const buccaneerVestPalette = {
  L: '#78350f', // Leather doublet midtone
  H: '#92400e', // Weathered leather highlight
  D: '#451a03', // Leather shadow
  K: '#290f02', // Deep crevice / dark leather
  W: '#ffffff', // Ruffled poet shirt bright white
  S: '#e2e8f0', // Ruffled shirt shadow
  F: '#94a3b8', // Deep ruffle fold
  G: '#facc15', // Brass buckle / grommet
  Y: '#fef08a', // Brass highlight
  A: '#b45309', // Brass shadow
  B: '#1e293b', // Leather belt black/dark
};

const buccaneerVestBodyAscii = [
  // Y 0..3: [0..3 empty] [4..11 collar/shoulders] [12..19 hem underside] [20..23 empty]
  '....' + 'DDWWWWDD' + 'KKKKKKKK' + '....',
  '....' + 'DLLSSLLD' + 'KDDDDDDK' + '....',
  '....' + 'DLW..WLD' + 'KDDDDDDK' + '....',
  '....' + 'DLWSSWLD' + 'KKKKKKKK' + '....',

  // Y 4..15: [0..3 right] [4..11 front] [12..15 left] [16..23 back]
  'DLLD' + 'DLWSSWLD' + 'DLLD' + 'KDDHHDDK',
  'DHDD' + 'DGWFFWGD' + 'DHDD' + 'DHL..LHD',
  'DLLD' + 'LGWSSWGL' + 'DLLD' + 'DHLDDLHD',
  'DHDD' + 'LGWFFWGL' + 'DHDD' + 'DHLDDLHD',
  'DLLD' + 'DGWSSWGD' + 'DLLD' + 'DHLDDLHD',
  'DHDD' + 'DDWFFWDD' + 'DHDD' + 'DHLDDLHD',
  'BKKD' + 'BGYWWYGB' + 'BKKD' + 'BKKKKKKB',
  'DLLD' + 'DLHDDHLD' + 'DLLD' + 'KDDHHDDK',
  'DHDD' + 'DHD..DHD' + 'DHDD' + 'DDLLLLDD',
  'DLLD' + 'KDD..DDK' + 'DLLD' + 'KDDDDDDK',
  '....' + '........' + '....' + '........',
  '....' + '........' + '....' + '........',
];

const buccaneerVestArmAscii = [
  // Y 0..3: [0..3 empty] [4..7 shoulder cap] [8..11 cuff underside] [12..15 empty]
  '....' + 'WSFW' + 'KKKK' + '....',
  '....' + 'SFFS' + 'KFFK' + '....',
  '....' + 'SFFS' + 'KFFK' + '....',
  '....' + 'WSSW' + 'KKKK' + '....',

  // Y 4..15: [0..3 side1] [4..7 front] [8..11 side2] [12..15 back]
  'WSFW' + 'SFFS' + 'WSFW' + 'SFFS',
  'SWWS' + 'FKKS' + 'SWWS' + 'FKKS',
  'FKKS' + 'SWWS' + 'FKKS' + 'SWWS',
  'SWWS' + 'FKKS' + 'SWWS' + 'FKKS',
  'WSFW' + 'SWWS' + 'WSFW' + 'SWWS',
  'FKKS' + 'FKKS' + 'FKKS' + 'FKKS',
  'SWWS' + 'SWWS' + 'SWWS' + 'SWWS',
  'WSFW' + 'WSFW' + 'WSFW' + 'WSFW',
  'WSSW' + 'WSSW' + 'WSSW' + 'WSSW',
  'DGLD' + 'DGYD' + 'DGLD' + 'DGLD',
  'LLDL' + 'LLAL' + 'LLDL' + 'LLDL',
  'WSSW' + 'WSSW' + 'WSSW' + 'WSSW',
];

// ============================================================================
// 14. Striped Sailor Pants: striped-sailor-pants-leg.png (16x16)
// ============================================================================
const stripedSailorPantsPalette = {
  N: '#1e3a8a', // Navy stripe midtone
  D: '#172554', // Navy stripe shadow
  W: '#f8fafc', // White stripe
  S: '#cbd5e1', // White stripe shadow
  G: '#facc15', // Brass sailor drop-front buttons
  Y: '#fef08a', // Button glint
  A: '#b45309', // Button shadow
};

const stripedSailorPantsAscii = [
  // Y 0..3: [0..3 empty] [4..7 hip top] [8..11 empty] [12..15 empty]
  '....' + 'NWNW' + '....' + '....',
  '....' + 'DSDS' + '....' + '....',
  '....' + 'NWNW' + '....' + '....',
  '....' + 'DSDS' + '....' + '....',

  // Y 4..10: [0..3 right] [4..7 front] [8..11 left] [12..15 back]
  'DNDN' + 'GYGY' + 'DNDN' + 'DNDN',
  'SWSW' + 'AYAY' + 'SWSW' + 'SWSW',
  'NWNW' + 'NWNW' + 'NWNW' + 'NWNW',
  'DSDS' + 'DSDS' + 'DSDS' + 'DSDS',
  'NWNW' + 'NWNW' + 'NWNW' + 'NWNW',
  'DSDS' + 'DSDS' + 'DSDS' + 'DSDS',
  'NWNW' + 'NWNW' + 'NWNW' + 'NWNW',

  // Y 11..15: 100% transparent for shoes
  '................',
  '................',
  '................',
  '................',
  '................',
];

// ============================================================================
// 15. Anglerfish Cowl: anglerfish-cowl-head.png (32x16)
// ============================================================================
const anglerfishCowlPalette = {
  D: '#050b14', // Deep trench abyss black
  B: '#0f172a', // Dark oceanic slate
  M: '#1e293b', // Mid slate
  S: '#334155', // Cowl fold highlight
  K: '#164e63', // Stalk base / dark teal
  T: '#0891b2', // Stalk midtone
  C: '#22d3ee', // Bioluminescent lure cyan
  L: '#67e8f9', // Bright neon cyan
  W: '#cffafe', // Blinding lure bulb center
  Y: '#fef08a', // Bio-phosphor spark
  F: '#e2e8f0', // Needle tooth / fin spine
};

const anglerfishCowlAscii = [
  // Y 0..7 (depth = 8): [0..7 empty] [8..15 top cowl & stalk] [16..23 underside] [24..31 empty]
  '........' + '..BBBB..' + 'DDDDDDDD' + '........',
  '........' + '.BMMMMB.' + 'DDMMMMDD' + '........',
  '........' + 'BM.KK.MB' + 'DMMMMMMD' + '........',
  '........' + 'BM.TT.MB' + 'DMMMMMMD' + '........',
  '........' + 'BM.TT.MB' + 'DMMMMMMD' + '........',
  '........' + 'BM.CC.MB' + 'DMMMMMMD' + '........',
  '........' + '.BCLLCB.' + 'DDMMMMDD' + '........',
  '........' + '..CLLC..' + 'DDDDDDDD' + '........',

  // Y 8..15: [0..7 right] [8..15 front with hanging bulb] [16..23 left] [24..31 back dorsal fin]
  'DMMSSDMD' + '...WW...' + 'DMMSSDMD' + 'DMMSSDMD',
  'MSBBCSBM' + '.SCLLCS.' + 'MBBSCBBM' + 'MBBTTBBM',
  'MBBBBBBM' + 'BBMCCMBB' + 'MBBBBBBM' + 'MBBFFBBM',
  'MSBBCSBM' + 'SMM..MMS' + 'MBBSCBBM' + 'MBBTTBBM',
  'MBBBBBBM' + 'BFF..FFB' + 'MBBBBBBM' + 'MBBFFBBM',
  'MSBBCSBM' + 'SMM..MMS' + 'MBBSCBBM' + 'MBBTTBBM',
  'DMMBBDMD' + 'BMMC..MB' + 'DMMBBDMD' + 'DMMSSDMD',
  'DDDDDDDD' + 'DMMBBDMD' + 'DDDDDDDD' + 'DDDDDDDD',
];

// ============================================================================
// 16. Abyssal Trench Coat: abyssal-trench-coat-body.png (24x16) & arm (16x16)
// ============================================================================
const abyssalTrenchCoatPalette = {
  D: '#060911', // Deepest void black
  B: '#0f172a', // Abyss trench coat slate
  M: '#1e293b', // Mid slate
  S: '#334155', // Highlighted trench fold
  C: '#22d3ee', // Glowing neon cyan conduit
  L: '#67e8f9', // Bright conduit highlight
  W: '#cffafe', // Supercharged neon node
  T: '#0891b2', // Deep conduit shadow
};

const abyssalTrenchCoatBodyAscii = [
  // Y 0..3: [0..3 empty] [4..11 collar/shoulders] [12..19 hem underside] [20..23 empty]
  '....' + 'BMTCCSMB' + 'DDDDDDDD' + '....',
  '....' + 'BMCCMMMB' + 'DMMMMMMD' + '....',
  '....' + 'BMC..MMB' + 'DMMMMMMD' + '....',
  '....' + 'BMTCCSMB' + 'DDDDDDDD' + '....',

  // Y 4..15: [0..3 right] [4..11 front] [12..15 left] [16..23 back]
  'BMDB' + 'BMTCCSMB' + 'BMDB' + 'BMTWWTSB',
  'MSDM' + 'SML..CMS' + 'MSDM' + 'SMSCMMCS',
  'BCTB' + 'BMT..TMB' + 'BCTB' + 'BMTLTLMB',
  'BCTB' + 'BML..TMB' + 'BCTB' + 'BMTCCTMB',
  'BMDB' + 'BMTWWTMB' + 'BMDB' + 'SMSTCTMS',
  'MSDM' + 'SMTCCTMS' + 'MSDM' + 'SMTCCTMS',
  'BCTB' + 'BMTWWTSB' + 'BCTB' + 'BMMMMMMB',
  'BCTB' + 'BMTCCTMB' + 'BCTB' + 'BMTCCMMB',
  'BMDB' + 'BML..TMB' + 'BMDB' + 'BMTCCTMB',
  'BMDB' + 'BMT..TMB' + 'BMDB' + 'BMTLTLMB',
  'BCTB' + 'BCT..TCB' + 'BCTB' + 'BCTTLLTB',
  'DDDD' + 'DD....DD' + 'DDDD' + 'DDDDDDDD',
];

const abyssalTrenchCoatArmAscii = [
  // Y 0..3: [0..3 empty] [4..7 shoulder cap] [8..11 cuff underside] [12..15 empty]
  '....' + 'MTTM' + 'DDDD' + '....',
  '....' + 'TLLT' + 'DMMD' + '....',
  '....' + 'TLLT' + 'DMMD' + '....',
  '....' + 'MTTM' + 'DDDD' + '....',

  // Y 4..15: [0..3 side1] [4..7 front] [8..11 side2] [12..15 back]
  'BCTB' + 'BMMB' + 'BMMB' + 'BMMB',
  'BLCB' + 'MSDM' + 'MSDM' + 'MSDM',
  'BWLB' + 'BMMB' + 'BMMB' + 'BMMB',
  'BLCB' + 'MSDM' + 'MSDM' + 'MSDM',
  'BCTB' + 'BMMB' + 'BMMB' + 'BMMB',
  'BLCB' + 'MSDM' + 'MSDM' + 'MSDM',
  'BCTB' + 'BMMB' + 'BMMB' + 'BMMB',
  'BMDB' + 'MSDM' + 'MSDM' + 'MSDM',
  'BCTB' + 'BCTB' + 'BCTB' + 'BCTB',
  'BLCB' + 'BLCB' + 'BLCB' + 'BLCB',
  'BWLB' + 'BWLB' + 'BWLB' + 'BWLB',
  'BCTB' + 'BCTB' + 'BCTB' + 'BCTB',
];

// ============================================================================
// 17. Bear Ear Beanie: bear-ear-beanie-head.png (32x16)
// ============================================================================
const bearEarBeaniePalette = {
  B: '#78350f', // Rich bear brown wool
  H: '#92400e', // Warm brown highlight
  Y: '#b45309', // Bright knit highlight
  D: '#582506', // Deep brown shadow
  K: '#3d1a04', // Dark crease shadow
  P: '#fed7aa', // Soft tan / peach inner ear
  R: '#fba885', // Warm peach ear blush
  T: '#d97706', // Folded ribbed brim knit accent
};

const bearEarBeanieAscii = [
  // Y 0..7 (depth = 8): [0..7 empty] [8..15 top crown] [16..23 underside] [24..31 empty]
  '........' + '.DKKKKD.' + 'DDDDDDDD' + '........',
  '........' + 'DKBHHBKD' + 'DDBBBBDD' + '........',
  '........' + 'KBD..DBK' + 'DBDDDDBD' + '........',
  '........' + 'KRP..PRK' + 'DBBHHBBD' + '........',
  '........' + 'KBP..PBK' + 'DBBHHBBD' + '........',
  '........' + 'KBD..DBK' + 'DBDDDDBD' + '........',
  '........' + 'DKBHHBKD' + 'DDBBBBDD' + '........',
  '........' + '.DKKKKD.' + 'DDDDDDDD' + '........',

  // Y 8..15: [0..7 right ear] [8..15 front ears & crown] [16..23 left ear] [24..31 back]
  '...DKB..' + 'DKB..BKD' + '..BKD...' + '..DKKD..',
  '..DKRP..' + 'KRPBBBPR' + '..PRKD..' + '.DBHBD..',
  '.DBHYB..' + 'KBDHHYDB' + '..BYHBD.' + 'DBHYYHBD',
  'DBHYYYHD' + 'DBHYYYHD' + 'DBHYYYHD' + 'DBHYYYHD',
  'KBDHHYBD' + 'KBDHHYBD' + 'KBDHHYBD' + 'KBDHHYBD',
  'TTTTTTTT' + 'TTTTTTTT' + 'TTTTTTTT' + 'TTTTTTTT',
  'TYTYTYTY' + 'TYTYTYTY' + 'TYTYTYTY' + 'TYTYTYTY',
  'DKKKKKKD' + 'DKKKKKKD' + 'DKKKKKKD' + 'DKKKKKKD',
];

// ============================================================================
// 18. Lumberjack Puffer: lumberjack-puffer-body.png (24x16) & arm (16x16)
// ============================================================================
const lumberjackPufferPalette = {
  G: '#166534', // Hunter green puffer midtone
  H: '#15803d', // Quilted baffle highlight
  L: '#22c55e', // Baffle crest sheen
  D: '#14532d', // Puffer shadow
  K: '#052e16', // Baffle valley crevice
  Z: '#facc15', // Brass zipper / snap
  Y: '#fef08a', // Zipper pull highlight
  R: '#dc2626', // Buffalo plaid red
  B: '#1e293b', // Buffalo plaid black
  M: '#991b1b', // Buffalo plaid dark red
};

const lumberjackPufferBodyAscii = [
  // Y 0..3: [0..3 empty] [4..11 collar/shoulders] [12..19 hem underside] [20..23 empty]
  '....' + 'DDRRMMDD' + 'KKKKKKKK' + '....',
  '....' + 'DGHLLHGD' + 'KDDDDDDK' + '....',
  '....' + 'DGH..HGD' + 'KDDDDDDK' + '....',
  '....' + 'DGHLLHGD' + 'KKKKKKKK' + '....',

  // Y 4..15: [0..3 right] [4..11 front] [12..15 left] [16..23 back]
  'DGGK' + 'DGRBBRGD' + 'DGGK' + 'DGLLLLGD',
  'KLLK' + 'DHRMMRHD' + 'KLLK' + 'KGGGGGGK',
  'KKKK' + 'DGHYYHGD' + 'KKKK' + 'KKKKKKKK',
  'DHHD' + 'DHGZZGHD' + 'DHHD' + 'DHLLLLHD',
  'GLLG' + 'GLGZZGLG' + 'GLLG' + 'GLLLLLLG',
  'KKKK' + 'KKKZZKKK' + 'KKKK' + 'KKKKKKKK',
  'DHHD' + 'DHGZZGHD' + 'DHHD' + 'DHLLLLHD',
  'GLLG' + 'GLGZZGLG' + 'GLLG' + 'GLLLLLLG',
  'KKKK' + 'KKKZZKKK' + 'KKKK' + 'KKKKKKKK',
  'DHHD' + 'DHGZZGHD' + 'DHHD' + 'DHLLLLHD',
  'GLLG' + 'GLGZZGLG' + 'GLLG' + 'GLLLLLLG',
  'RMBR' + 'RMB..BMR' + 'RMBR' + 'RMBRRMBR',
];

const lumberjackArmPalette = {
  R: '#dc2626', // Bright red
  M: '#991b1b', // Dark red intersection
  B: '#1e293b', // Black check
  K: '#0f172a', // Deepest shadow
  Z: '#facc15', // Brass wrist button
  W: '#f8fafc', // Button glint
};

const lumberjackArmAscii = [
  // Y 0..3: [0..3 empty] [4..7 shoulder cap] [8..11 cuff underside] [12..15 empty]
  '....' + 'RRMM' + 'KKKK' + '....',
  '....' + 'RRMM' + 'KMMK' + '....',
  '....' + 'MMBB' + 'KMMK' + '....',
  '....' + 'MMBB' + 'KKKK' + '....',

  // Y 4..15: [0..3 side1] [4..7 front] [8..11 side2] [12..15 back]
  'RRMM' + 'RRMM' + 'RRMM' + 'RRMM',
  'RRMM' + 'RRMM' + 'RRMM' + 'RRMM',
  'MMBB' + 'MMBB' + 'MMBB' + 'MMBB',
  'MMBB' + 'MMBB' + 'MMBB' + 'MMBB',
  'RRMM' + 'RRMM' + 'RRMM' + 'RRMM',
  'RRMM' + 'RRMM' + 'RRMM' + 'RRMM',
  'MMBB' + 'MMBB' + 'MMBB' + 'MMBB',
  'MMBB' + 'MMBB' + 'MMBB' + 'MMBB',
  'RRMM' + 'RRMM' + 'RRMM' + 'RRMM',
  'RRMM' + 'RRMM' + 'RRMM' + 'RRMM',
  'MBBM' + 'MZWM' + 'MBBM' + 'MBBM',
  'BBBB' + 'BBBB' + 'BBBB' + 'BBBB',
];

// ============================================================================
// 19. Camo Cargo Pants: camo-cargo-pants-leg.png (16x16)
// ============================================================================
const camoCargoPantsPalette = {
  G: '#606c38', // Olive green
  D: '#283618', // Deep army green
  T: '#dda15e', // Camo tan / khaki
  B: '#3a2e1d', // Camo bark brown
  K: '#1b2012', // Darkest shadow seam
  P: '#bc6c25', // Pocket flap shadow
  Z: '#fef08a', // Brass pocket snap button
};

const camoCargoPantsAscii = [
  // Y 0..3: [0..3 empty] [4..7 hip top] [8..11 empty] [12..15 empty]
  '....' + 'GDTT' + '....' + '....',
  '....' + 'BGGD' + '....' + '....',
  '....' + 'TTBG' + '....' + '....',
  '....' + 'DDBG' + '....' + '....',

  // Y 4..10: [0..3 right] [4..7 front] [8..11 left] [12..15 back]
  'GDTT' + 'BGGD' + 'TTBG' + 'DDBG',
  'BGGK' + 'TTBG' + 'DDBG' + 'GDTT',
  'DDBG' + 'GDTT' + 'BGGD' + 'TTBG',
  'DPZP' + 'GZTT' + 'DPZP' + 'BGGK',
  'KTTK' + 'BGGD' + 'KTTK' + 'DDBG',
  'KGGK' + 'DDBG' + 'KGGK' + 'GDTT',
  'DDBG' + 'GDTT' + 'BGGD' + 'TTBG',

  // Y 11..15: 100% transparent for shoes
  '................',
  '................',
  '................',
  '................',
  '................',
];

// ============================================================================
// List of all items to generate
// ============================================================================
const items = [
  {
    name: "Captain's Tricorn Hat",
    file: 'captain-hat-head.png',
    width: 32,
    height: 16,
    ascii: captainHatAscii,
    palette: captainHatPalette,
  },
  {
    name: 'Royal Gilded Crown',
    file: 'royal-crown-head.png',
    width: 32,
    height: 16,
    ascii: royalCrownAscii,
    palette: royalCrownPalette,
  },
  {
    name: 'Deep Diver Helmet',
    file: 'diver-mask-head.png',
    width: 32,
    height: 16,
    ascii: diverHelmetAscii,
    palette: diverHelmetPalette,
  },
  {
    name: 'Cableknit Fisherman Sweater (Body)',
    file: 'cableknit-sweater-body.png',
    width: 24,
    height: 16,
    ascii: cableknitBodyAscii,
    palette: cableknitPalette,
  },
  {
    name: 'Cableknit Fisherman Sweater (Arm)',
    file: 'cableknit-sweater-arm.png',
    width: 16,
    height: 16,
    ascii: cableknitArmAscii,
    palette: cableknitPalette,
  },
  {
    name: 'Royal Gilded Cloak / Robe (Body)',
    file: 'royal-cloak-body.png',
    width: 24,
    height: 16,
    ascii: royalCloakBodyAscii,
    palette: royalCloakPalette,
  },
  {
    name: 'Royal Gilded Cloak / Robe (Arm)',
    file: 'royal-cloak-arm.png',
    width: 16,
    height: 16,
    ascii: royalCloakArmAscii,
    palette: royalCloakPalette,
  },
  {
    name: 'Yellow Sea Waders',
    file: 'yellow-waders-leg.png',
    width: 16,
    height: 16,
    ascii: yellowWadersAscii,
    palette: yellowWadersPalette,
  },
  {
    name: 'Diver Boots',
    file: 'diver-boots-leg.png',
    width: 16,
    height: 16,
    ascii: diverBootsAscii,
    palette: diverBootsPalette,
  },
  {
    name: 'Golden High-Roller Boots',
    file: 'golden-boots-leg.png',
    width: 16,
    height: 16,
    ascii: goldenBootsAscii,
    palette: goldenBootsPalette,
  },
  // --- New Cosmic Set ---
  {
    name: 'Cosmic Wizard Hat',
    file: 'cosmic-wizard-hat-head.png',
    width: 32,
    height: 16,
    ascii: cosmicWizardHatAscii,
    palette: cosmicWizardHatPalette,
  },
  {
    name: 'Nebula Robe (Body)',
    file: 'nebula-robe-body.png',
    width: 24,
    height: 16,
    ascii: nebulaRobeBodyAscii,
    palette: nebulaRobePalette,
  },
  {
    name: 'Nebula Robe (Arm)',
    file: 'nebula-robe-arm.png',
    width: 16,
    height: 16,
    ascii: nebulaRobeArmAscii,
    palette: nebulaRobePalette,
  },
  {
    name: 'Stellar Boots',
    file: 'stellar-boots-leg.png',
    width: 16,
    height: 16,
    ascii: stellarBootsAscii,
    palette: stellarBootsPalette,
  },
  // --- New Pirate Buccaneer Set ---
  {
    name: 'Pirate Bandana',
    file: 'pirate-bandana-head.png',
    width: 32,
    height: 16,
    ascii: pirateBandanaAscii,
    palette: pirateBandanaPalette,
  },
  {
    name: 'Buccaneer Vest (Body)',
    file: 'buccaneer-vest-body.png',
    width: 24,
    height: 16,
    ascii: buccaneerVestBodyAscii,
    palette: buccaneerVestPalette,
  },
  {
    name: 'Buccaneer Vest (Arm)',
    file: 'buccaneer-vest-arm.png',
    width: 16,
    height: 16,
    ascii: buccaneerVestArmAscii,
    palette: buccaneerVestPalette,
  },
  {
    name: 'Striped Sailor Pants',
    file: 'striped-sailor-pants-leg.png',
    width: 16,
    height: 16,
    ascii: stripedSailorPantsAscii,
    palette: stripedSailorPantsPalette,
  },
  // --- New Abyssal Trench Set ---
  {
    name: 'Anglerfish Cowl',
    file: 'anglerfish-cowl-head.png',
    width: 32,
    height: 16,
    ascii: anglerfishCowlAscii,
    palette: anglerfishCowlPalette,
  },
  {
    name: 'Abyssal Trench Coat (Body)',
    file: 'abyssal-trench-coat-body.png',
    width: 24,
    height: 16,
    ascii: abyssalTrenchCoatBodyAscii,
    palette: abyssalTrenchCoatPalette,
  },
  {
    name: 'Abyssal Trench Coat (Arm)',
    file: 'abyssal-trench-coat-arm.png',
    width: 16,
    height: 16,
    ascii: abyssalTrenchCoatArmAscii,
    palette: abyssalTrenchCoatPalette,
  },
  // --- New Cozy Woodland Camp Set ---
  {
    name: 'Bear Ear Beanie',
    file: 'bear-ear-beanie-head.png',
    width: 32,
    height: 16,
    ascii: bearEarBeanieAscii,
    palette: bearEarBeaniePalette,
  },
  {
    name: 'Lumberjack Puffer (Body)',
    file: 'lumberjack-puffer-body.png',
    width: 24,
    height: 16,
    ascii: lumberjackPufferBodyAscii,
    palette: lumberjackPufferPalette,
  },
  {
    name: 'Lumberjack Puffer (Arm)',
    file: 'lumberjack-puffer-arm.png',
    width: 16,
    height: 16,
    ascii: lumberjackArmAscii,
    palette: lumberjackArmPalette,
  },
  {
    name: 'Camo Cargo Pants',
    file: 'camo-cargo-pants-leg.png',
    width: 16,
    height: 16,
    ascii: camoCargoPantsAscii,
    palette: camoCargoPantsPalette,
  },
];

function main() {
  fs.mkdirSync(PUBLIC_CLOTHING_DIR, { recursive: true });
  const hasDist = fs.existsSync(DIST_CLOTHING_DIR);

  console.log(`Generating ${items.length} clothing textures into ${PUBLIC_CLOTHING_DIR}...`);

  for (const item of items) {
    const pngBuffer = createPngFromAscii(item.width, item.height, item.ascii, item.palette);
    const pubPath = path.join(PUBLIC_CLOTHING_DIR, item.file);
    fs.writeFileSync(pubPath, pngBuffer);
    console.log(`✓ Created ${item.file} (${item.width}x${item.height}) - ${item.name}`);

    if (hasDist) {
      const distPath = path.join(DIST_CLOTHING_DIR, item.file);
      fs.writeFileSync(distPath, pngBuffer);
    }
  }

  console.log('All clothing textures successfully generated!');
}

main();
