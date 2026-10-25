import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../assets/vendor/three/three.module.js';
import {createLeafSurfaceMaps} from '../assets/simulations/plant-growth-leaf-surface.js';

// Captured from every byte of the original, uncached generator before editing.
// These protect pigment, normals and roughness, including their alpha channels.
const expected = {
  map: {
    sha256: '8b22737818580be17bd62f6b1d2e21e26c84baae866068e990aeaec90942767d',
    name: 'bean-leaf-pigment', colorSpace: THREE.SRGBColorSpace
  },
  normalMap: {
    sha256: 'b049b1484ef8fa25cd524f2a026c3ba278e97fe4846816e8842e3413ba2659d5',
    name: 'bean-leaf-vascular-normal', colorSpace: THREE.NoColorSpace
  },
  roughnessMap: {
    sha256: '1bb3dfc9d1c33a89c539c820052c15f9d93c141998af7a36df216f004dfbd19e',
    name: 'bean-leaf-waxy-roughness', colorSpace: THREE.NoColorSpace
  }
};
const keys = Object.keys(expected);
const digest = data => createHash('sha256').update(data).digest('hex');
const dispose = maps => Object.values(maps).forEach(texture => texture.dispose());

function assertOriginalMaps(maps) {
  assert.deepEqual(Object.keys(maps), keys);
  for (const key of keys) {
    const texture = maps[key];
    assert(texture instanceof THREE.DataTexture, key);
    assert(texture.image.data instanceof Uint8Array, key);
    assert.equal(texture.image.data.byteLength, 512 * 512 * 4, key);
    assert.equal(digest(texture.image.data), expected[key].sha256, key);
    assert.deepEqual({
      width: texture.image.width, height: texture.image.height,
      name: texture.name, colorSpace: texture.colorSpace,
      format: texture.format, type: texture.type,
      wrapS: texture.wrapS, wrapT: texture.wrapT,
      magFilter: texture.magFilter, minFilter: texture.minFilter,
      generateMipmaps: texture.generateMipmaps, anisotropy: texture.anisotropy,
      flipY: texture.flipY, unpackAlignment: texture.unpackAlignment,
      version: texture.version
    }, {
      width: 512, height: 512,
      name: expected[key].name, colorSpace: expected[key].colorSpace,
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
      magFilter: THREE.LinearFilter, minFilter: THREE.LinearMipmapLinearFilter,
      generateMipmaps: true, anisotropy: 4,
      flipY: false, unpackAlignment: 1, version: 1
    }, key);
  }
}

test('first and repeated calls preserve every original pixel and texture setting', () => {
  const first = createLeafSurfaceMaps(), second = createLeafSurfaceMaps();
  try {
    assertOriginalMaps(first);
    assertOriginalMaps(second);
  } finally {
    dispose(first);
    dispose(second);
  }
});

test('each caller owns distinct textures, sources and pixel buffers', () => {
  const first = createLeafSurfaceMaps(), second = createLeafSurfaceMaps();
  try {
    assert.notEqual(first, second);
    const allTextures = [...Object.values(first), ...Object.values(second)];
    for (let i = 0; i < allTextures.length; i++) {
      for (let j = i + 1; j < allTextures.length; j++) {
        assert.notEqual(allTextures[i], allTextures[j]);
        assert.notEqual(allTextures[i].source, allTextures[j].source);
        assert.notEqual(allTextures[i].image, allTextures[j].image);
        assert.notEqual(allTextures[i].image.data, allTextures[j].image.data);
        assert.notEqual(allTextures[i].image.data.buffer, allTextures[j].image.data.buffer);
      }
    }
  } finally {
    dispose(first);
    dispose(second);
  }
});

test('caller mutations cannot change existing maps or the source for later calls', () => {
  const first = createLeafSurfaceMaps(), second = createLeafSurfaceMaps();
  let third;
  try {
    for (const key of keys) {
      first[key].image.data.fill(0);
      first[key].name = 'caller-owned';
      first[key].wrapS = THREE.RepeatWrapping;
      first[key].needsUpdate = true;
    }
    third = createLeafSurfaceMaps();
    assertOriginalMaps(second);
    assertOriginalMaps(third);
  } finally {
    dispose(first);
    dispose(second);
    if (third) dispose(third);
  }
});

test('disposing one set leaves another usable and later scenes get fresh maps', () => {
  const first = createLeafSurfaceMaps(), second = createLeafSurfaceMaps();
  const firstEvents = [], secondEvents = [];
  for (const key of keys) {
    first[key].addEventListener('dispose', () => firstEvents.push(key));
    second[key].addEventListener('dispose', () => secondEvents.push(key));
  }
  dispose(first);
  assert.deepEqual(firstEvents, keys);
  assert.deepEqual(secondEvents, []);
  const recreated = createLeafSurfaceMaps();
  try {
    assertOriginalMaps(second);
    assertOriginalMaps(recreated);
    for (const key of keys) {
      assert.notEqual(recreated[key], first[key]);
      assert.notEqual(recreated[key].image.data.buffer, first[key].image.data.buffer);
    }
  } finally {
    dispose(second);
    dispose(recreated);
  }
});

test('expensive procedural generation runs once per module, including after disposal', async () => {
  // A fresh module instance gives this test its own empty lazy cache.
  const fresh = await import('../assets/simulations/plant-growth-leaf-surface.js?cache-generation-test');
  const originalExp = Math.exp;
  let expCalls = 0;
  const created = [];
  Math.exp = value => { expCalls++; return originalExp(value); };
  try {
    created.push(fresh.createLeafSurfaceMaps());
    assert(expCalls > 0, 'first use must generate the procedural pixels');
    expCalls = 0;
    created.push(fresh.createLeafSurfaceMaps());
    assert.equal(expCalls, 0, 'another scene must reuse the computed pixels');
    dispose(created[0]);
    created.push(fresh.createLeafSurfaceMaps());
    assert.equal(expCalls, 0, 'texture disposal must not evict the CPU cache');
    assertOriginalMaps(created[2]);
  } finally {
    Math.exp = originalExp;
    for (const maps of created) dispose(maps);
  }
});
