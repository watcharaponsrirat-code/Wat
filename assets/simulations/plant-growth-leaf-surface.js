import * as THREE from '../vendor/three/three.module.js';

// One shared, deterministic botanical surface for both experimental groups.
// Geometry supplies the large folds; these filtered maps resolve the vascular
// relief without separate, subpixel tubes or changes to experiment state.
export function createLeafSurfaceMaps() {
  const size = 512, count = size * size;
  const albedo = new Uint8Array(count * 4), normals = new Uint8Array(count * 4);
  const roughness = new Uint8Array(count * 4), relief = new Float32Array(count);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const smooth = (low, high, value) => {
    const t = clamp((value - low) / (high - low), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // DataTexture rows run from UV v=0 upwards; unlike a CanvasTexture, they
  // require no vertical flip. The geometry uses the same u/[-1,1] coordinates.
  for (let y = 0; y < size; y++) {
    const v = 2 * y / (size - 1) - 1, s = Math.abs(v);
    const branchOffset = .20 * (.75 * s + .25 * s * s);
    const vascularFade = 1 - smooth(.78, 1, s);
    const edge = s ** 4, central = Math.exp(-.5 * (v / .028) ** 2);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1), pixel = y * size + x, channel = pixel * 4;
      const lengthFade = smooth(.015, .065, u) * (1 - smooth(.88, 1, u));
      let secondary = 0;
      for (let branch = 0; branch < 6; branch++) {
        const center = .09 + .13 * branch + branchOffset;
        // A continuous, rounded ridge about .7 world units wide. The peak is
        // only .12 units high; broad filtered slopes remain stable on mobile.
        const distance = (u - center) / .0048;
        secondary += Math.exp(-.5 * distance * distance);
      }
      secondary *= vascularFade * lengthFade;

      // Fine cross veins join adjacent secondary ribs. Their coherent arcs
      // form a quiet reticulate network instead of random high frequency noise.
      const cell = (u - .09 - branchOffset) / .13;
      const sector = Math.floor(cell), q = cell - sector;
      let tertiary = 0;
      if (sector >= 0 && sector < 5) {
        const curve = .07 * Math.sin(Math.PI * q);
        for (let row = 0; row < 3; row++) {
          const station = .25 + row * .22 + curve;
          const distance = (s - station) / .012;
          tertiary += Math.exp(-.5 * distance * distance);
        }
        tertiary *= lengthFade * vascularFade;
      }

      const veins = Math.min(1, .7 * secondary + .7 * central + .16 * tertiary);
      const pigment = 5 * Math.sin(u * 5.6 + v * 1.8) + 3 * Math.sin(u * 11.2 - v * 3);
      const shoulder = Math.sin(Math.PI * u);
      albedo[channel] = clamp(Math.round(40 + pigment + edge * 11 + veins * 13), 0, 255);
      albedo[channel + 1] = clamp(Math.round(96 + pigment * 1.2 + shoulder * 11 + edge * 8 + veins * 13), 0, 255);
      albedo[channel + 2] = clamp(Math.round(16 + pigment * .28 + edge * 2 + veins * 4), 0, 255);
      albedo[channel + 3] = 255;

      relief[pixel] = .12 * secondary + .08 * central * lengthFade + .018 * tertiary;
      // Absolute perceptual roughness; the material's roughness factor is 1.
      // Ribs are slightly less glossy than the intervening waxy lamina.
      const value = Math.round(255 * (.405 + .055 * veins + .012 * shoulder));
      roughness[channel] = roughness[channel + 1] = roughness[channel + 2] = value;
      roughness[channel + 3] = 255;
    }
  }

  // Derivatives are measured in blade dimensions, not texels. This keeps the
  // normal strength independent of texture resolution and avoids a foil look.
  const du = 70 / (size - 1), dv = 40 / (size - 1);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const left = Math.max(0, x - 1), right = Math.min(size - 1, x + 1);
    const below = Math.max(0, y - 1), above = Math.min(size - 1, y + 1);
    const dx = (relief[y * size + right] - relief[y * size + left]) / ((right - left) * du);
    const dy = (relief[above * size + x] - relief[below * size + x]) / ((above - below) * dv);
    const length = Math.hypot(dx, dy, 1), channel = (y * size + x) * 4;
    normals[channel] = Math.round((.5 - .5 * dx / length) * 255);
    normals[channel + 1] = Math.round((.5 - .5 * dy / length) * 255);
    normals[channel + 2] = Math.round((.5 + .5 / length) * 255);
    normals[channel + 3] = 255;
  }

  function make(data, name, colorSpace) {
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.name = name;
    texture.colorSpace = colorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  return {
    map: make(albedo, 'bean-leaf-pigment', THREE.SRGBColorSpace),
    normalMap: make(normals, 'bean-leaf-vascular-normal', THREE.NoColorSpace),
    roughnessMap: make(roughness, 'bean-leaf-waxy-roughness', THREE.NoColorSpace)
  };
}
