import * as THREE from '../vendor/three/three.module.js';

// Presentation only. The experiment's existing builder supplies both growth
// values; this renderer never derives growth from light or elapsed time.
export function createPlantGrowthModel(parent, {quality = 'high'} = {}) {
  const group = new THREE.Group();
  group.name = 'bean-growth-detail';
  parent.add(group);
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const keepGeometry = geometry => (geometries.add(geometry), geometry);
  const keepMaterial = material => (materials.add(material), material);
  const high = () => quality !== 'low';
  let disposed = false, firstUpdate = true;

  // Deterministic procedural surface detail: no downloads, photographs, or
  // random experiment state. Both plants share exactly the same resources.
  function texture(kind) {
    const size = 256, canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const noise = fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
      let r, g, b;
      if (kind === 'leaf') {
        const grain = (noise - .5) * 5;
        const cells = Math.sin(x * .73 + Math.sin(y * .16)) * Math.cos(y * .61) * 2;
        r = 114 + grain + cells; g = 155 + grain + cells; b = 72 + grain * .65;
      } else if (kind === 'pot') {
        const wheel = Math.sin(y * 1.4) * 3 + Math.sin(y * .19) * 2;
        const grain = (noise - .5) * 22;
        r = 188 + grain + wheel; g = 112 + grain * .7 + wheel; b = 75 + grain * .5 + wheel;
      } else {
        const grain = noise < .12 ? -20 : noise > .91 ? 18 : (noise - .5) * 28;
        r = 71 + grain; g = 47 + grain * .8; b = 30 + grain * .6;
      }
      pixels.data[i] = r; pixels.data[i + 1] = g; pixels.data[i + 2] = b; pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    textures.add(map);
    return map;
  }
  function fract(value) { return value - Math.floor(value); }

  const leafMap = texture('leaf'), potMap = texture('pot'), soilMap = texture('soil');
  const leafMaterial = keepMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xc4dfaa, map: leafMap,
    roughness: .67, metalness: 0, clearcoat: .06, clearcoatRoughness: .75,
    side: THREE.DoubleSide, vertexColors: true
  }));
  const stemMaterial = keepMaterial(new THREE.MeshStandardMaterial({color: 0x729547, roughness: .73}));
  const veinMaterial = keepMaterial(new THREE.MeshStandardMaterial({color: 0x789447, roughness: .92, envMapIntensity: .3}));
  const fineVeinMaterial = keepMaterial(new THREE.MeshStandardMaterial({color: 0x6d8d3d, roughness: .95, envMapIntensity: .2}));
  const potMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xffffff, map: potMap, bumpMap: potMap, bumpScale: .28, roughness: .88
  }));
  const soilMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xe0c8aa, map: soilMap, bumpMap: soilMap, bumpScale: .48, roughness: 1
  }));
  const grainMaterial = keepMaterial(new THREE.MeshStandardMaterial({color: 0x66513b, roughness: 1}));

  function leafPoint(u, v, lift = 0) {
    const width = 19 * Math.pow(Math.max(0, Math.sin(Math.PI * u)), .74) * (.88 + .12 * u);
    return new THREE.Vector3(
      51 * u,
      4.8 * Math.sin(Math.PI * u) - 2.8 * v * v * Math.sin(Math.PI * u) + 1.7 * u * u + lift,
      width * v
    );
  }
  function leafGeometry(longitudinal, lateral) {
    const positions = [], uvs = [], colors = [], indices = [];
    for (let i = 0; i <= longitudinal; i++) {
      const u = i / longitudinal;
      for (let j = 0; j <= lateral; j++) {
        const v = j / lateral * 2 - 1, p = leafPoint(u, v);
        positions.push(p.x, p.y, p.z); uvs.push(u, j / lateral);
        const shade = .91 + .09 * (1 - Math.abs(v)) - .045 * Math.sin(u * 18 + v * 9);
        colors.push(shade, shade, shade * .97);
        if (i < longitudinal && j < lateral) {
          const a = i * (lateral + 1) + j, b = a + lateral + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    return keepGeometry(geometry);
  }
  function mergeTubes(paths, radius, sides) {
    const positions = [], normals = [], indices = [];
    for (const points of paths) {
      const source = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length * 2, radius, sides, false);
      const offset = positions.length / 3;
      positions.push(...source.attributes.position.array); normals.push(...source.attributes.normal.array);
      for (const index of source.index.array) indices.push(index + offset);
      source.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices); geometry.computeBoundingSphere();
    return keepGeometry(geometry);
  }
  const central = Array.from({length: 13}, (_, i) => leafPoint(.02 + i / 12 * .95, 0, .55));
  const mainVeins = [central], fineVeins = [];
  for (let row = 0; row < 6; row++) {
    const origin = .13 + row * .116;
    for (const side of [-1, 1]) {
      const path = Array.from({length: 6}, (_, i) => {
        const f = i / 5;
        return leafPoint(origin + .15 * f, side * .92 * f, .45);
      });
      mainVeins.push(path);
      for (let branch = 1; branch <= 2; branch++) {
        const start = branch * .25;
        fineVeins.push(Array.from({length: 4}, (_, i) => {
          const f = i / 3;
          return leafPoint(origin + .15 * start + .11 * f, side * (.92 * start + .25 * f), .35);
        }));
      }
    }
  }
  const leafGeometries = {high: leafGeometry(32, 14), low: leafGeometry(18, 8)};
  const veins = mergeTubes(mainVeins, .22, 5);
  const fine = mergeTubes(fineVeins, .095, 3);
  const petiole = keepGeometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(9, 5, 0), new THREE.Vector3(22, 9, 0)
  ]), 12, 1.05, 7, false));
  const profile = [[0, -130], [26, -130], [28, -129.6], [29, -127], [29.3, -124],
    [36.7, -82], [37.2, -79], [40, -79], [41, -77.8], [41.2, -73.5], [40.3, -71.5],
    [38.7, -70.8], [36.5, -71.2], [35.7, -73], [35.8, -78], [28, -124], [0, -124]];
  const potGeometries = {
    high: keepGeometry(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 72)),
    low: keepGeometry(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 36))
  };
  function soilGeometry(segments, rings) {
    const positions = [], uv = [], indices = [];
    for (let ring = 0; ring <= rings; ring++) for (let n = 0; n <= segments; n++) {
      const radius = 35.3 * ring / rings, angle = n / segments * Math.PI * 2;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      const relief = Math.sin(x * .52) * Math.cos(z * .39) * .6 + Math.sin(x * .21 + z * .34) * .35;
      positions.push(x, -74.5 + relief * Math.min(1, radius / 5), z);
      uv.push(x / 35.3 + .5, z / 35.3 + .5);
      if (ring < rings && n < segments) {
        const a = ring * (segments + 1) + n, b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    return keepGeometry(geometry);
  }
  const soils = {high: soilGeometry(64, 9), low: soilGeometry(32, 5)};
  const grainGeometry = keepGeometry(new THREE.DodecahedronGeometry(1, 0));
  const dummy = new THREE.Object3D(), temp = new THREE.Vector3();
  const foliageAngles = [2.7, -.16, 3.52, -.86], foliageSizes = [1, .94, 1.02, .88];

  function mesh(geometry, material, name, owner) {
    const object = new THREE.Mesh(geometry, material);
    object.name = name; object.castShadow = object.receiveShadow = true;
    object.userData.part = name; owner.add(object); return object;
  }
  function instances(geometry, material, count, name, owner) {
    const object = new THREE.InstancedMesh(geometry, material, count);
    object.name = name; object.userData.part = name;
    object.castShadow = object.receiveShadow = true;
    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    owner.add(object); return object;
  }
  function makeStemGeometry(rings = 30, sides = 10) {
    const geometry = new THREE.BufferGeometry(), indices = [];
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((rings + 1) * (sides + 1) * 3), 3));
    for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j, b = a + sides + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    geometry.setIndex(indices); geometry.userData = {rings, sides};
    return keepGeometry(geometry);
  }
  function stemAt(u, height, target = new THREE.Vector3()) {
    return target.set(4 * Math.sin(Math.PI * u), -72 + height * u, -3 * Math.sin(Math.PI * 2 * u));
  }
  function buildPlant(id, x) {
    const plant = new THREE.Group(); plant.name = id + '-detailed-plant'; plant.position.x = x; group.add(plant);
    const pot = mesh(potGeometries[quality], potMaterial, 'terracotta-pot', plant);
    const soil = mesh(soils[quality], soilMaterial, 'textured-soil', plant);
    const grains = instances(grainGeometry, grainMaterial, 96, 'soil-grains', plant);
    for (let i = 0; i < 96; i++) {
      const angle = i * 2.399963229728653, radius = 5 + Math.sqrt((i + .5) / 96) * 29;
      dummy.position.set(Math.cos(angle) * radius, -74 + Math.sin(i * 1.9) * .35, Math.sin(angle) * radius);
      dummy.rotation.set(i * .73, i * .37, i * .19);
      const size = .52 + fract(i * .61803398875) * .75;
      dummy.scale.set(size, size * .52, size * .8); dummy.updateMatrix(); grains.setMatrixAt(i, dummy.matrix);
      grains.setColorAt(i, new THREE.Color().setHSL(.065 + fract(i * .17) * .025, .22, .12 + fract(i * .37) * .13));
    }
    grains.instanceMatrix.needsUpdate = true; grains.instanceColor.needsUpdate = true;
    grains.count = high() ? 96 : 32;
    const stemGeometries = {high: makeStemGeometry(), low: makeStemGeometry(18, 7)};
    const stem = mesh(stemGeometries[quality], stemMaterial, 'tapered-stem', plant);
    const stalks = instances(petiole, stemMaterial, 4, 'leaf-petioles', plant);
    const leaves = instances(leafGeometries[quality], leafMaterial, 4, 'curved-leaves', plant);
    const primaryVeins = instances(veins, veinMaterial, 4, 'raised-leaf-veins', plant);
    const secondaryVeins = instances(fine, fineVeinMaterial, 4, 'fine-leaf-veins', plant);
    secondaryVeins.visible = high(); secondaryVeins.castShadow = false;
    primaryVeins.castShadow = false;
    return {plant, pot, soil, grains, stem, stemGeometries, stalks, leaves, primaryVeins, secondaryVeins, height: 55, target: 55};
  }
  quality = quality === 'low' ? 'low' : 'high';
  const plants = [buildPlant('control', -130), buildPlant('experiment', 130)];
  group.userData.quality = quality;
  function recordGrowth() {
    group.userData.growth = {
      controlGrowth: (plants[0].height - 55) / 2,
      experimentGrowth: (plants[1].height - 55) / 2
    };
  }
  const tangent = new THREE.Vector3(), across = new THREE.Vector3(), forward = new THREE.Vector3();
  function pose(plant) {
    const height = plant.height, geometry = plant.stem.geometry;
    const {rings, sides} = geometry.userData, attribute = geometry.attributes.position;
    for (let i = 0; i <= rings; i++) {
      const u = i / rings, center = stemAt(u, height);
      tangent.set(4 * Math.PI * Math.cos(Math.PI * u), height, -6 * Math.PI * Math.cos(Math.PI * 2 * u)).normalize();
      across.crossVectors(tangent, new THREE.Vector3(0, 0, 1)).normalize();
      forward.crossVectors(across, tangent).normalize();
      const radius = 3.2 - 1.95 * u;
      for (let j = 0; j <= sides; j++) {
        const angle = j / sides * Math.PI * 2;
        temp.copy(center).addScaledVector(across, Math.cos(angle) * radius).addScaledVector(forward, Math.sin(angle) * radius);
        attribute.setXYZ(i * (sides + 1) + j, temp.x, temp.y, temp.z);
      }
    }
    attribute.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    for (let i = 0; i < 4; i++) {
      // Retain four leaf nodes through the entire experiment; only their
      // attachment follows the original stem-height visualization.
      const u = Math.min(.96, .25 + i * .17 + 8 / height), angle = foliageAngles[i];
      stemAt(u, height, dummy.position);
      dummy.rotation.set(0, angle, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      plant.stalks.setMatrixAt(i, dummy.matrix);
      dummy.position.add(new THREE.Vector3(22 * Math.cos(angle), 9, -22 * Math.sin(angle)));
      dummy.rotation.x = .5 + i * .025; dummy.rotation.z = .08 + i * .04; dummy.scale.setScalar(foliageSizes[i]); dummy.updateMatrix();
      plant.leaves.setMatrixAt(i, dummy.matrix);
      plant.primaryVeins.setMatrixAt(i, dummy.matrix);
      plant.secondaryVeins.setMatrixAt(i, dummy.matrix);
    }
    for (const object of [plant.stalks, plant.leaves, plant.primaryVeins, plant.secondaryVeins]) {
      object.instanceMatrix.needsUpdate = true; object.computeBoundingSphere();
    }
    plant.plant.userData.visualHeight = height;
  }
  plants.forEach(pose);
  recordGrowth();

  return {
    group,
    get meshCount() { let count = 0; group.traverse(object => {if (object.isMesh && object.visible) count++;}); return count; },
    update({controlGrowth, experimentGrowth}) {
      if (disposed) return;
      [controlGrowth, experimentGrowth].forEach((growth, i) => {
        // Identical endpoint mapping to the original model, including its
        // initial height. No independent animation clock changes the result.
        plants[i].target = 55 + 2 * growth;
        plants[i].plant.userData.growth = growth;
        if (firstUpdate) { plants[i].height = plants[i].target; pose(plants[i]); }
      });
      firstUpdate = false;
      recordGrowth();
    },
    tick(dt, instant = false) {
      if (disposed) return false;
      let moving = false;
      for (const plant of plants) {
        const difference = plant.target - plant.height;
        if (Math.abs(difference) < .001) {
          if (difference) {plant.height = plant.target; pose(plant);}
          continue;
        }
        plant.height = instant ? plant.target : plant.height + difference * (1 - Math.exp(-Math.max(0, dt) * 10));
        if (Math.abs(plant.target - plant.height) < .015) plant.height = plant.target;
        pose(plant); moving ||= plant.height !== plant.target;
      }
      recordGrowth();
      return moving;
    },
    setQuality(next) {
      if (disposed) return;
      next = next === 'low' ? 'low' : 'high';
      if (next === quality) return;
      quality = next;
      for (const plant of plants) {
        plant.pot.geometry = potGeometries[quality]; plant.soil.geometry = soils[quality];
        plant.stem.geometry = plant.stemGeometries[quality]; plant.leaves.geometry = leafGeometries[quality];
        plant.grains.count = high() ? 96 : 32; plant.secondaryVeins.visible = high();
        pose(plant);
      }
      group.userData.quality = quality;
    },
    dispose() {
      if (disposed) return;
      disposed = true; parent.remove(group);
      group.traverse(object => {if (object.isInstancedMesh) object.dispose();});
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      textures.forEach(map => map.dispose());
    }
  };
}
