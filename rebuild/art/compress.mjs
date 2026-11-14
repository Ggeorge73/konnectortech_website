// Turns Blender's exports in art/out/ into web assets in public/models/:
// Meshopt-compressed geometry and KTX2 (Basis) textures, in two sizes for the Full and Light tiers.
// Usage (from rebuild/art): node compress.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize, resample, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { encodeToKTX2 } from 'ktx2-encoder';

const IN = path.resolve('out');
const OUT = path.resolve('../public/models');
fs.mkdirSync(OUT, { recursive: true });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
};
const KTX = { isUASTC: false, generateMipmap: true, qualityLevel: 200, imageDecoder, enableDebug: false }; // ETC1S: small, fine for soft baked light
const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
const report = [];

async function pngToKtx2(src, dest, size) {
  const png = await sharp(src).resize(size, size).png().toBuffer();
  fs.writeFileSync(dest, await encodeToKTX2(new Uint8Array(png), KTX));
  report.push([path.basename(dest), kb(dest)]);
}

async function glb(name, { textures, oneClip }) {
  const doc = await io.read(path.join(IN, `${name}.glb`));
  if (oneClip) {
    // Blender writes one animation per object. The site plays the transformation as ONE clip, so merge them.
    const [first, ...rest] = doc.getRoot().listAnimations();
    first.setName(oneClip);
    for (const anim of rest) {
      for (const ch of anim.listChannels()) first.addChannel(ch);
      for (const sm of anim.listSamplers()) first.addSampler(sm);
      anim.dispose();
    }
    await doc.transform(resample());
  }
  // Custom attributes (_sys, _glow) must survive: no pruning of attributes, gentle quantization
  await doc.transform(dedup(), weld(), prune({ keepAttributes: true }), quantize({ quantizePosition: 14, quantizeTexcoord: 12 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  if (textures) {
    // The room's bakes ship as separate KTX2 files (dim and lit, two sizes), so each tier downloads only its size.
    for (const tex of doc.getRoot().listTextures()) tex.dispose();
  }
  await io.write(path.join(OUT, `${name}.glb`), doc);
  report.push([`${name}.glb`, kb(path.join(OUT, `${name}.glb`))]);
}

await glb('room', { textures: true });
await glb('room_lines', {});
await glb('sphere', { oneClip: 'Transform' });
// Full tier: KTX2 at 2048 px. Light tier: JPG at 640 px, so phones skip the 256 KB KTX2 decoder.
for (const name of ['room_dim', 'room_lit']) {
  await pngToKtx2(path.join(IN, `${name}.png`), path.join(OUT, `${name}.full.ktx2`), 2048);
  const jpg = path.join(OUT, `${name}.light.jpg`);
  await sharp(path.join(IN, `${name}.png`)).resize(640, 640).jpeg({ quality: 80 }).toFile(jpg);
  report.push([path.basename(jpg), kb(jpg)]);
  fs.rmSync(path.join(OUT, `${name}.light.ktx2`), { force: true });
}

const sum = (tag) => fs.readdirSync(OUT).filter((f) => f.endsWith('.glb') || f.includes(`.${tag}.`)).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.table(Object.fromEntries(report));
console.log(`Full tier 3D assets:  ${(sum('full') / 1024).toFixed(0)} KB (budget 3072 KB)`);
console.log(`Light tier 3D assets: ${(sum('light') / 1024).toFixed(0)} KB (budget 1536 KB)`);
