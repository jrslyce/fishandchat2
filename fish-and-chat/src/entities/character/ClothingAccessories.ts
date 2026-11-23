import * as THREE from 'three';
import type { ClothingSlot } from '../../game/data';
import { PlayerObject } from './PlayerObject';

type Anchor = 'head' | 'body' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
type Attachment = { anchor: Anchor; group: THREE.Group };

const material = (color: string, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness: metalness ? 0.3 : 0.82, metalness });

function box(parent: THREE.Group, color: string, size: [number, number, number], at: [number, number, number], bevel = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color, bevel));
  mesh.position.set(...at);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent: THREE.Group, color: string, top: number, bottom: number, height: number, at: [number, number, number], sides = 12): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, sides), material(color));
  mesh.position.set(...at);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function sphere(parent: THREE.Group, color: string, radius: number, at: [number, number, number]): void {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 7), material(color));
  mesh.position.set(...at);
  mesh.castShadow = true;
  parent.add(mesh);
}

/** Small, readable forms layered over the pixel skin. Coordinates are in the character's 32-unit rig. */
export function buildClothingAccessories(itemId: string): Attachment[] {
  const head = new THREE.Group();
  const body = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const arms = [leftArm, rightArm];
  const legs = [leftLeg, rightLeg];

  switch (itemId) {
    case 'sunflower-bucket-hat':
      cylinder(head, '#d9ad4d', 5.4, 6.2, 0.85, [0, 8.1, 0], 16);
      cylinder(head, '#e8c364', 4.1, 4.65, 2.6, [0, 9.65, 0], 14);
      sphere(head, '#795438', 0.78, [0, 10.1, -4.65]);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        sphere(head, '#f6da67', 0.65, [Math.sin(a) * 1.3, 10.1 + Math.cos(a) * 1.3, -4.7]);
      }
      break;
    case 'raincloud-cap':
      cylinder(head, '#607c94', 4.7, 4.8, 2.1, [0, 8.15, 0], 14);
      box(head, '#7697ab', [8.6, 0.7, 3.6], [0, 7.55, -4.25]);
      for (const x of [-1.5, 0, 1.5]) sphere(head, '#c6dce0', 0.92, [x, 8.8 + (x === 0 ? 0.45 : 0), -4.5]);
      break;
    case 'koi-headband':
      cylinder(head, '#b64742', 5, 5, 1.05, [0, 7.7, 0], 14);
      sphere(head, '#f1e6d2', 1.25, [0, 8.5, -4.85]);
      sphere(head, '#c85a43', 0.5, [-0.65, 8.55, -5.9]);
      box(head, '#e4b071', [2.2, 0.65, 1.1], [1.55, 8.5, -5]);
      break;
    case 'disco-crown':
      cylinder(head, '#bd5da7', 4.9, 4.9, 1.3, [0, 8, 0], 12);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const x = Math.sin(a) * 4.3, z = Math.cos(a) * 4.3;
        box(head, i % 2 ? '#ffe48f' : '#f0a4e5', [1.3, 2.5, 1.3], [x, 9.65, z]);
      }
      sphere(head, '#fff0bb', 1.15, [0, 9.1, -4.9]);
      break;
    case 'aurora-helmet':
      cylinder(head, '#405277', 5.2, 5.1, 2.8, [0, 8.5, 0], 14);
      box(head, '#8ad7ce', [9.2, 2.7, 1.2], [0, 6.2, -4.8]);
      box(head, '#c0a5e3', [8.5, 0.65, 1.4], [0, 4.6, -4.9]);
      for (const x of [-3.5, 3.5]) sphere(head, '#d8e5c1', 0.5, [x, 8.2, -4]);
      break;
    case 'mint-windbreaker':
    case 'coral-fishing-vest':
    case 'tidebreaker-raincoat':
    case 'neon-arcade-jacket':
    case 'dragon-scale-coat': {
      const main = itemId === 'mint-windbreaker' ? '#78bca7' : itemId === 'coral-fishing-vest' ? '#d57461' : itemId === 'tidebreaker-raincoat' ? '#3e7297' : itemId === 'neon-arcade-jacket' ? '#63439b' : '#387a65';
      const light = itemId === 'mint-windbreaker' ? '#e2f0d4' : itemId === 'coral-fishing-vest' ? '#f2bc80' : itemId === 'tidebreaker-raincoat' ? '#8acbd3' : itemId === 'neon-arcade-jacket' ? '#e66ed7' : '#e4c66b';
      const coat = itemId === 'tidebreaker-raincoat' || itemId === 'dragon-scale-coat';
      box(body, main, [coat ? 9.8 : 9.1, coat ? 12 : 8.2, 5.4], [0, coat ? -7.2 : -5.25, 0]);
      for (const arm of arms) box(arm, main, [4.8, 8.4, 4.8], [0, -7, 0]);
      box(body, light, [0.75, coat ? 10.5 : 7, 0.45], [0, coat ? -7.5 : -5, -2.9]);
      if (itemId === 'coral-fishing-vest') {
        for (const x of [-2.7, 2.7]) box(body, light, [2.4, 2.3, 1.15], [x, -7.5, -3.1]);
      } else if (itemId === 'neon-arcade-jacket') {
        for (const x of [-3.6, 3.6]) box(body, '#83ded6', [0.7, 7.5, 0.5], [x, -5, -2.9]);
        for (const arm of arms) box(arm, light, [4.9, 1.1, 4.9], [0, -7.5, 0]);
      } else if (itemId === 'dragon-scale-coat') {
        for (const y of [-3.5, -6, -8.5]) for (const x of [-2.7, 2.7]) sphere(body, '#80bb8d', 0.9, [x, y, -3]);
        for (const arm of arms) box(arm, light, [5.8, 1.1, 5.8], [0, -2.2, 0]);
      } else if (itemId === 'tidebreaker-raincoat') {
        cylinder(head, main, 5.15, 5.15, 1.25, [0, 7.7, 0], 12);
        box(head, light, [8.5, 0.75, 2.1], [0, 7.5, -4.1]);
      } else {
        for (const arm of arms) box(arm, light, [4.9, 0.75, 4.9], [0, -10.1, 0]);
      }
      break;
    }
    case 'patched-denim':
      for (const leg of legs) {
        box(leg, '#7293a8', [3.9, 2.8, 0.45], [0, -4.9, -2.25]);
        box(leg, '#d4ab86', [1.7, 1.25, 0.5], [-0.65, -5.15, -2.55]);
      }
      break;
    case 'tidepool-shorts':
      for (const leg of legs) {
        box(leg, '#57aaa2', [4.6, 4.1, 4.5], [0, -3.9, 0]);
        box(leg, '#c1e0c1', [4.8, 0.65, 4.8], [0, -6.1, 0]);
        sphere(leg, '#ecd27b', 0.6, [0.7, -4.2, -2.5]);
      }
      break;
    case 'moss-overalls':
      box(body, '#66805c', [7.3, 4.4, 1.3], [0, -8.2, -2.9]);
      for (const x of [-2.6, 2.6]) box(body, '#b7bb7a', [1, 5, 0.65], [x, -3.6, -2.9]);
      box(body, '#b7bb7a', [2.6, 1.3, 0.5], [0, -8, -3.65]);
      break;
    case 'hologram-trousers':
    case 'royal-sailor-pants':
      for (const leg of legs) {
        const holo = itemId === 'hologram-trousers';
        box(leg, holo ? '#9d82dc' : '#e5cb82', [0.7, 9.8, 0.6], [-2, -6, -2.1]);
        box(leg, holo ? '#78e2dc' : '#d7a950', [0.7, 9.8, 0.6], [2, -6, -2.1]);
        if (holo) for (const y of [-3, -6, -9]) sphere(leg, '#b6a9ed', 0.45, [0, y, -2.5]);
      }
      break;
    case 'dock-sandals':
    case 'coral-sneakers':
    case 'storm-boots':
    case 'comet-skates':
    case 'jewel-slippers': {
      const main = itemId === 'dock-sandals' ? '#916a4b' : itemId === 'coral-sneakers' ? '#de806c' : itemId === 'storm-boots' ? '#526c79' : itemId === 'comet-skates' ? '#49548a' : '#ae4e62';
      const light = itemId === 'dock-sandals' ? '#d5ad79' : itemId === 'coral-sneakers' ? '#fff0df' : itemId === 'storm-boots' ? '#e9d57d' : itemId === 'comet-skates' ? '#aab5ed' : '#f0cc76';
      for (const leg of legs) {
        if (itemId === 'storm-boots') box(leg, main, [5.1, 5.1, 5], [0, -8.5, 0]);
        box(leg, main, [5.2, itemId === 'dock-sandals' ? 1.4 : 2.4, 6.6], [0, -10.95, -0.85]);
        box(leg, light, [5.4, 0.7, 6.8], [0, -12.05, -0.85]);
        if (itemId === 'dock-sandals') for (const y of [-10.2, -11.3]) box(leg, light, [4.5, 0.45, 0.65], [0, y, -3.6]);
        else if (itemId === 'coral-sneakers') for (const y of [-10.2, -10.9]) box(leg, light, [2.6, 0.35, 0.5], [0, y, -4.1]);
        else if (itemId === 'storm-boots') box(leg, light, [4.8, 0.8, 0.5], [0, -8.1, -2.8]);
        else if (itemId === 'comet-skates') box(leg, '#e9d68c', [5.7, 0.45, 8], [0, -12.55, -1.3]);
        else sphere(leg, '#f5d978', 0.75, [0, -10.2, -4.1]);
      }
      break;
    }
    case 'basic-shirt':
      box(body, '#d7c8a9', [7.4, 0.6, 0.4], [0, -0.9, -2.55]);
      box(body, '#d7c8a9', [1.1, 1.8, 0.4], [0, -1.5, -2.55]);
      box(body, '#9aafad', [2.2, 1.8, 0.4], [2.1, -5.2, -2.55]);
      for (const arm of arms) box(arm, '#d7c8a9', [4.5, 0.7, 4.5], [0, -10.2, 0]);
      break;
    case 'basic-pants':
      for (const leg of legs) box(leg, '#798b86', [4.5, 0.65, 4.6], [0, -9.9, 0]);
      break;
    case 'basic-shoes':
      for (const leg of legs) {
        box(leg, '#453e35', [4.8, 1.8, 5.9], [0, -11, -0.55]);
        box(leg, '#c7ad87', [4.9, 0.5, 6.1], [0, -12, -0.55]);
      }
      break;
    case 'red-beanie':
    case 'bear-ear-beanie': {
      const red = itemId === 'red-beanie';
      cylinder(head, red ? '#a62935' : '#855d43', 4.7, 4.8, 3, [0, 8.5, 0], 12);
      cylinder(head, red ? '#e64a50' : '#b18a67', 5, 5, 1.1, [0, 7.25, 0], 12);
      if (red) sphere(head, '#e9a56f', 1.1, [0, 10.3, 0]);
      else for (const x of [-3.15, 3.15]) sphere(head, '#855d43', 1.65, [x, 10.3, 0]);
      break;
    }
    case 'straw-hat':
      cylinder(head, '#d6ae60', 7.9, 7.9, 0.65, [0, 8.8, 0], 20);
      cylinder(head, '#f0d687', 3.85, 4.3, 3.25, [0, 10.7, 0], 14);
      cylinder(head, '#65442e', 4.28, 4.28, 0.62, [0, 9.65, 0], 14);
      break;
    case 'cowboy-hat':
      cylinder(head, '#70503b', 7.5, 7.1, 0.75, [0, 7.7, 0], 14);
      cylinder(head, '#825b3d', 3.3, 4.1, 4.1, [0, 9.8, 0], 12);
      cylinder(head, '#d6ac72', 4.1, 4.1, 0.5, [0, 8.5, 0], 12);
      break;
    case 'party-hat':
    case 'cosmic-wizard-hat': {
      const cosmic = itemId === 'cosmic-wizard-hat';
      cylinder(head, cosmic ? '#322957' : '#b93c8c', cosmic ? 0.5 : 0, 4.6, cosmic ? 9 : 7, [0, cosmic ? 11.6 : 11, 0], 12);
      cylinder(head, cosmic ? '#dcb754' : '#f5c64f', 5.15, 5.15, 0.65, [0, 7.8, 0], 14);
      sphere(head, '#ffe6a0', cosmic ? 0.7 : 0.9, [0, cosmic ? 16.5 : 14.7, 0]);
      if (cosmic) for (const x of [-2, 2]) sphere(head, '#c5b0ff', 0.45, [x, 10.7, -3.45]);
      break;
    }
    case 'captain-hat':
      cylinder(head, '#20283a', 5.2, 5.2, 2.3, [0, 8.5, 0], 12);
      box(head, '#1b2435', [10.5, 1.2, 7], [0, 7.45, -1.5]);
      box(head, '#e0bd65', [8.5, 0.45, 0.5], [0, 8.2, -4.95]);
      sphere(head, '#efd781', 0.75, [0, 9.3, -4.96]);
      break;
    case 'royal-crown':
      cylinder(head, '#dda834', 4.7, 4.7, 2.3, [0, 8.5, 0], 12);
      for (let i = 0; i < 7; i++) {
        const a = i * Math.PI * 2 / 7;
        const x = Math.sin(a) * 4.15, z = Math.cos(a) * 4.15;
        cylinder(head, '#ffdd67', 0, 0.9, 2.3, [x, 10.2, z], 6);
      }
      sphere(head, '#de3562', 0.85, [0, 8.6, -4.7]);
      break;
    case 'diver-mask':
      cylinder(head, '#9c6b3d', 5.3, 5.3, 1.2, [0, 8, 0], 12);
      box(head, '#6d91a1', [8.3, 5.3, 1], [0, 3.85, -4.8]);
      box(head, '#ddb96c', [9, 6, 0.55], [0, 3.85, -5.3]);
      box(head, '#4ea7bc', [6.5, 3.5, 0.65], [0, 3.85, -5.67]);
      cylinder(head, '#caa562', 1.2, 1.2, 1.7, [0, 9.3, 0], 8);
      break;
    case 'pirate-bandana':
      cylinder(head, '#ae3e40', 5, 5, 1.4, [0, 7.7, 0], 12);
      box(head, '#e8c896', [8, 0.45, 0.5], [0, 7.6, -4.6]);
      sphere(head, '#e7b778', 0.8, [4.8, 7.4, 1]);
      break;
    case 'anglerfish-cowl':
      cylinder(head, '#355d62', 5, 5.4, 3, [0, 8, 0], 12);
      sphere(head, '#81d8c4', 0.85, [-2.5, 8.6, -3.4]);
      sphere(head, '#81d8c4', 0.85, [2.5, 8.6, -3.4]);
      cylinder(head, '#496f69', 0.24, 0.24, 3.9, [0, 11.4, -2], 7);
      sphere(head, '#f6e288', 1.3, [0, 13.7, -2]);
      break;
    case 'rain-slicker':
      box(body, '#edbb42', [9.1, 9.6, 5.8], [0, -6.3, 0]);
      cylinder(head, '#e5ae36', 5.25, 5.25, 1.7, [0, 7.8, 0], 12);
      box(head, '#f6cf60', [8.5, 1.1, 3], [0, 7.8, -4.2]);
      for (const arm of arms) box(arm, '#efbe43', [4.9, 8, 5], [0, -7, 0]);
      for (const x of [-0.8, 0.8]) sphere(body, '#744e2f', 0.4, [x, -3.5, -3.1]);
      break;
    case 'flannel-jacket':
    case 'lumberjack-puffer':
    case 'abyssal-trench-coat': {
      const puffer = itemId === 'lumberjack-puffer', trench = itemId === 'abyssal-trench-coat';
      const color = trench ? '#2b4557' : puffer ? '#a44935' : '#a54840';
      box(body, color, [puffer ? 10.5 : 9.2, trench ? 12.4 : 8.4, puffer ? 6.2 : 5.2], [0, trench ? -7.2 : -5.3, 0]);
      for (const arm of arms) box(arm, color, [5, 8.6, 5], [0, -7.2, 0]);
      for (const x of [-2.5, 2.5]) box(body, trench ? '#bb9a69' : '#edc89b', [0.55, 7.1, 0.35], [x, -5, -2.8]);
      if (puffer) for (const y of [-3, -6.2, -9.4]) box(body, '#c16b49', [9.5, 0.5, 0.45], [0, y, -3.15]);
      break;
    }
    case 'cableknit-sweater':
      box(body, '#d5aa7d', [9.1, 8, 5], [0, -5.5, 0]);
      for (const arm of arms) box(arm, '#d5aa7d', [4.8, 8, 4.7], [0, -7.1, 0]);
      for (const x of [-2.2, 0, 2.2]) box(body, '#efcfaa', [0.65, 7, 0.32], [x, -5.2, -2.65]);
      break;
    case 'royal-cloak':
    case 'nebula-robe': {
      const cosmic = itemId === 'nebula-robe';
      box(body, cosmic ? '#453070' : '#79384f', [10.2, 13.3, 5.8], [0, -8.2, 0.3]);
      for (const arm of arms) box(arm, cosmic ? '#5a4084' : '#853e52', [5, 9.6, 5], [0, -7.4, 0]);
      box(body, cosmic ? '#e1b95d' : '#efcf83', [0.8, 12, 0.48], [0, -8, -2.9]);
      for (const x of [-3.8, 3.8]) box(body, cosmic ? '#9981d5' : '#e8b958', [0.55, 12, 0.45], [x, -8, -2.9]);
      break;
    }
    case 'buccaneer-vest':
      for (const x of [-2.5, 2.5]) box(body, '#6d4332', [3.2, 7.9, 1], [x, -5.3, -2.8]);
      box(body, '#d7aa6c', [0.65, 6.8, 0.4], [0, -5, -3.35]);
      break;
    case 'overalls':
    case 'yellow-waders':
      box(body, itemId === 'overalls' ? '#4a6e8a' : '#d1aa3f', [7, 5, 1.1], [0, -8.4, -2.9]);
      for (const x of [-2.65, 2.65]) box(body, itemId === 'overalls' ? '#6489a3' : '#e0bd53', [1.15, 6, 0.6], [x, -3.4, -2.9]);
      break;
    case 'cargo-pants':
    case 'camo-cargo-pants':
      for (const leg of legs) {
        box(leg, itemId === 'cargo-pants' ? '#7f8055' : '#687458', [4.8, 3.2, 1.5], [0, -4.7, -2]);
        box(leg, '#4d5c43', [4.6, 0.6, 1.6], [0, -6, -2]);
      }
      break;
    case 'striped-sailor-pants':
      for (const leg of legs) for (const y of [-2, -5, -8]) box(leg, '#e4cfaa', [4.6, 0.7, 4.6], [0, y, 0]);
      break;
    case 'rubber-boots':
    case 'diver-boots':
    case 'golden-boots':
    case 'stellar-boots':
    case 'sneakers': {
      const color = itemId === 'rubber-boots' ? '#5b7461' : itemId === 'diver-boots' ? '#4d5961' : itemId === 'golden-boots' ? '#e9b944' : itemId === 'stellar-boots' ? '#433c84' : '#f0e3cf';
      const trim = itemId === 'golden-boots' ? '#fff2a1' : itemId === 'stellar-boots' ? '#b8a2f5' : itemId === 'sneakers' ? '#dc7764' : '#a9b6a3';
      for (const leg of legs) {
        if (itemId !== 'sneakers') box(leg, color, [4.9, 4.7, 5], [0, -8.7, 0]);
        box(leg, color, [5.2, 2.2, 6.5], [0, -11, -0.9]);
        box(leg, trim, [5.5, 0.75, 7], [0, -12.1, -0.9]);
        box(leg, trim, [4.7, 0.6, 0.4], [0, -8.2, -2.6]);
      }
      break;
    }
  }

  return ([['head', head], ['body', body], ['leftArm', leftArm], ['rightArm', rightArm], ['leftLeg', leftLeg], ['rightLeg', rightLeg]] as const)
    .filter(([, group]) => group.children.length > 0)
    .map(([anchor, group]) => {
      group.rotation.y = Math.PI; // authored details face the rig's front (+Z)
      return { anchor, group };
    });
}

export function setOutfitAccessories(player: PlayerObject, current: Attachment[], equipped: Record<ClothingSlot, string | null>): Attachment[] {
  for (const { group } of current) {
    group.removeFromParent();
    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    });
  }
  const next = Object.values(equipped).filter((id): id is string => Boolean(id)).flatMap(buildClothingAccessories);
  for (const { anchor, group } of next) player.skin[anchor].add(group);
  return next;
}
