import type { ClothingSlot } from '../game/data';

const swatches: Record<string, [string, string]> = {
  'basic-shirt': ['#c1a482', '#eee0bd'], 'basic-pants': ['#4b5e62', '#9cad9d'], 'basic-shoes': ['#5a503c', '#c6a986'],
  'red-beanie': ['#aa303a', '#ef7c77'], 'straw-hat': ['#c59950', '#f6da88'], 'cowboy-hat': ['#6c4830', '#c09257'],
  'party-hat': ['#af388d', '#f7cf69'], 'flannel-jacket': ['#9a453f', '#e6b08d'], 'rain-slicker': ['#e3aa30', '#fff099'],
  overalls: ['#496a8a', '#8ca9bd'], 'cargo-pants': ['#6d7651', '#acaa79'], 'rubber-boots': ['#526f5f', '#a8be93'],
  sneakers: ['#e7d7bd', '#d87567'], 'captain-hat': ['#263047', '#f5cf77'], 'royal-crown': ['#d8a638', '#f9e696'],
  'diver-mask': ['#ae8052', '#86c9d2'], 'cableknit-sweater': ['#c9a27a', '#f4d3af'], 'royal-cloak': ['#783b53', '#e6c37a'],
  'yellow-waders': ['#d7af3d', '#f2d578'], 'diver-boots': ['#46505d', '#a5b7ae'], 'golden-boots': ['#d2a233', '#fff0a0'],
  'cosmic-wizard-hat': ['#3a2c65', '#baa8ed'], 'nebula-robe': ['#533979', '#c2a8f0'], 'stellar-boots': ['#433b82', '#baaff4'],
  'pirate-bandana': ['#ae443e', '#f0c98c'], 'buccaneer-vest': ['#75503a', '#e4b98a'], 'striped-sailor-pants': ['#344b68', '#f2e2c7'],
  'anglerfish-cowl': ['#365f5c', '#dce68c'], 'abyssal-trench-coat': ['#314b60', '#a5bbb7'], 'bear-ear-beanie': ['#856245', '#d6aa78'],
  'lumberjack-puffer': ['#a14937', '#e7a276'], 'camo-cargo-pants': ['#52694c', '#a7ae7b'],
  'sunflower-bucket-hat': ['#d9ab4c', '#f4d76c'], 'raincloud-cap': ['#5c7993', '#c7dfe0'],
  'koi-headband': ['#b94743', '#f1e2c8'], 'disco-crown': ['#b34b9e', '#f4b7e4'],
  'aurora-helmet': ['#42547e', '#89ddd7'], 'mint-windbreaker': ['#79baa5', '#e4efda'],
  'coral-fishing-vest': ['#d87562', '#f2c484'], 'tidebreaker-raincoat': ['#3d7398', '#8dcad3'],
  'neon-arcade-jacket': ['#623c9a', '#e571d6'], 'dragon-scale-coat': ['#3c7d66', '#e4c66a'],
  'patched-denim': ['#527493', '#d7ab86'], 'tidepool-shorts': ['#53aaa4', '#c4e4c8'],
  'moss-overalls': ['#67805b', '#b5ba7e'], 'hologram-trousers': ['#514c93', '#a489e5'],
  'royal-sailor-pants': ['#354f7c', '#f2d782'], 'dock-sandals': ['#8c674b', '#ddbd88'],
  'coral-sneakers': ['#de836d', '#f5e4d2'], 'storm-boots': ['#4f6b78', '#e5d06f'],
  'comet-skates': ['#465187', '#a5b1e9'], 'jewel-slippers': ['#a84b5d', '#f2cd76'],
};

/** Closet card illustration: a clean vector silhouette, with the pixel skin reserved for the character itself. */
export function clothingArt(id: string, slot: ClothingSlot): string {
  const [main, accent] = swatches[id] ?? ['#6c8274', '#c4d0b8'];
  const outline = '#273c3a';
  let shape = '';
  if (slot === 'hat') {
    if (id === 'straw-hat' || id === 'cowboy-hat' || id === 'sunflower-bucket-hat') shape = `<path d="M31 52h38l-4-25H35z" fill="${main}" stroke="${outline}" stroke-width="2"/><path d="M20 54q30 9 60 0l-3 9q-27 7-54 0z" fill="${accent}" stroke="${outline}" stroke-width="2"/><path d="M34 45h32v6H34z" fill="${accent}"/>`;
    else if (id === 'party-hat' || id === 'cosmic-wizard-hat') shape = `<path d="M49 12L30 62h40z" fill="${main}" stroke="${outline}" stroke-width="2"/><path d="M28 60h44v7H28z" fill="${accent}"/><circle cx="50" cy="13" r="4" fill="${accent}"/>`;
    else if (id === 'royal-crown' || id === 'disco-crown') shape = `<path d="M28 40l8 9 14-20 14 20 8-9-4 28H32z" fill="${main}" stroke="${outline}" stroke-width="2"/><circle cx="50" cy="55" r="4" fill="${id === 'disco-crown' ? '#ffe7a0' : '#dc5664'}"/>`;
    else if (id === 'diver-mask' || id === 'aurora-helmet') shape = `<path d="M28 37q22-16 44 0v33H28z" fill="${main}" stroke="${outline}" stroke-width="2"/><rect x="34" y="45" width="32" height="19" rx="5" fill="${accent}" stroke="${outline}" stroke-width="3"/>`;
    else if (id === 'raincloud-cap') shape = `<path d="M27 49q4-27 23-27t23 27v8H27z" fill="${main}" stroke="${outline}" stroke-width="2"/><path d="M26 57q24 5 53-2l-3 7q-26 5-50 0z" fill="${accent}"/><circle cx="47" cy="37" r="6" fill="${accent}"/><circle cx="55" cy="38" r="5" fill="${accent}"/>`;
    else if (id === 'koi-headband') shape = `<path d="M27 49q23-15 46 0v15H27z" fill="${main}" stroke="${outline}" stroke-width="2"/><path d="M29 50h42" stroke="${accent}" stroke-width="6"/><circle cx="50" cy="49" r="6" fill="${accent}"/><circle cx="47" cy="47" r="2" fill="${main}"/>`;
    else if (id === 'anglerfish-cowl') shape = `<path d="M27 43q23-27 46 0v27H27z" fill="${main}" stroke="${outline}" stroke-width="2"/><path d="M50 26V15" stroke="${outline}" stroke-width="3"/><circle cx="50" cy="13" r="7" fill="${accent}"/><circle cx="40" cy="50" r="3" fill="${accent}"/><circle cx="60" cy="50" r="3" fill="${accent}"/>`;
    else shape = `<path d="M27 49q2-28 23-28t23 28v18H27z" fill="${main}" stroke="${outline}" stroke-width="2"/><path d="M27 58h46v10H27z" fill="${accent}"/><circle cx="50" cy="19" r="5" fill="${accent}"/>`;
    if (id === 'bear-ear-beanie') shape += `<circle cx="31" cy="28" r="8" fill="${main}"/><circle cx="69" cy="28" r="8" fill="${main}"/>`;
    if (id === 'sunflower-bucket-hat') shape += `<circle cx="50" cy="43" r="6" fill="#7d5137"/>${[0,1,2,3,4,5].map((i) => { const a = i * Math.PI / 3; return `<circle cx="${(50 + Math.sin(a) * 10).toFixed(1)}" cy="${(43 + Math.cos(a) * 10).toFixed(1)}" r="4" fill="#f8db65"/>`; }).join('')}`;
    if (id === 'captain-hat') shape += `<path d="M25 54h50v8H25z" fill="${outline}"/><path d="M30 54h40" stroke="${accent}" stroke-width="3"/>`;
    if (id === 'pirate-bandana') shape += `<path d="M27 49h46" stroke="${accent}" stroke-width="4"/>`;
  } else if (slot === 'jacket') {
    shape = `<path d="M31 26l-15 11 8 22 9-5v25h34V54l9 5 8-22-15-11-9 5H40z" fill="${main}" stroke="${outline}" stroke-width="2" stroke-linejoin="round"/><path d="M40 26l10 15 10-15" fill="${accent}"/><path d="M50 40v38" stroke="${accent}" stroke-width="3"/>`;
    if (id === 'rain-slicker') shape += `<path d="M33 29q17-24 34 0" fill="none" stroke="${accent}" stroke-width="8"/><circle cx="54" cy="49" r="2" fill="${outline}"/><circle cx="54" cy="61" r="2" fill="${outline}"/>`;
    if (id === 'flannel-jacket' || id === 'lumberjack-puffer') shape += `<path d="M25 44h50M27 62h46" stroke="${accent}" stroke-width="2"/>`;
    if (id === 'royal-cloak' || id === 'nebula-robe' || id === 'abyssal-trench-coat') shape += `<path d="M33 70l-7 17h48l-7-17" fill="${main}" stroke="${outline}" stroke-width="2"/>`;
    if (id === 'cableknit-sweater') shape += `<path d="M41 45v29m9-29v29m9-29v29" stroke="${accent}" stroke-width="2"/>`;
    if (id === 'buccaneer-vest') shape += `<path d="M32 28l-3 42m39-42 3 42" stroke="${accent}" stroke-width="4"/>`;
    if (id === 'coral-fishing-vest') shape += `<rect x="33" y="53" width="11" height="12" rx="2" fill="${accent}"/><rect x="56" y="53" width="11" height="12" rx="2" fill="${accent}"/>`;
    if (id === 'neon-arcade-jacket' || id === 'dragon-scale-coat') shape += `<path d="M29 41h-9m60 0h-9M34 68h31" stroke="${accent}" stroke-width="3"/>`;
  } else if (slot === 'pants') {
    shape = `<path d="M27 22h46l-3 59H54l-4-30-4 30H30z" fill="${main}" stroke="${outline}" stroke-width="2" stroke-linejoin="round"/><path d="M27 30h46M50 22v25" stroke="${accent}" stroke-width="3"/>`;
    if (id.includes('cargo')) shape += `<rect x="29" y="47" width="14" height="13" rx="2" fill="${accent}"/><rect x="57" y="47" width="14" height="13" rx="2" fill="${accent}"/>`;
    if (id === 'overalls' || id === 'yellow-waders') shape += `<path d="M33 22V11h34v11M38 11v-7m24 7v-7" fill="none" stroke="${main}" stroke-width="7"/>`;
    if (id === 'striped-sailor-pants') shape += `<path d="M30 43h15m10 0h15M31 59h13m12 0h13M31 73h13m12 0h13" stroke="${accent}" stroke-width="4"/>`;
    if (id === 'patched-denim') shape += `<rect x="31" y="48" width="12" height="11" fill="${accent}" stroke="${outline}" stroke-width="1"/>`;
    if (id === 'tidepool-shorts') shape += `<path d="M30 58h15m10 0h15" stroke="${accent}" stroke-width="5"/>`;
    if (id === 'hologram-trousers' || id === 'royal-sailor-pants') shape += `<path d="M31 39v38m38-38v38" stroke="${accent}" stroke-width="4"/>`;
  } else {
    shape = `<path d="M18 30h25v30q0 8 9 8h2v13H16q-7 0-7-7V63h9zM57 30h25v33h9v11q0 7-7 7H46V68h2q9 0 9-8z" fill="${main}" stroke="${outline}" stroke-width="2" stroke-linejoin="round"/><path d="M10 74h43m-7 0h45M18 47h25m14 0h25" stroke="${accent}" stroke-width="4"/>`;
    if (id === 'sneakers') shape += `<path d="M13 60h38m0 0h38" stroke="#fff4d9" stroke-width="2"/>`;
    if (id === 'dock-sandals') shape += `<path d="M12 55h38m0 0h38" stroke="${accent}" stroke-width="3"/>`;
    if (id === 'comet-skates') shape += `<path d="M8 84h45m-8 0h45" stroke="${accent}" stroke-width="3"/>`;
    if (id === 'storm-boots' || id === 'jewel-slippers') shape += `<path d="M24 53l8 8-6 5m45-13 8 8-6 5" fill="none" stroke="${accent}" stroke-width="3"/>`;
  }
  return `<svg class="clothing-art" viewBox="0 0 100 100" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="88" rx="36" ry="5" fill="#183b38" opacity=".16"/>${shape}</svg>`;
}
