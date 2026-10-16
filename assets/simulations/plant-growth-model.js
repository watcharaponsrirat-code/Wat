import * as THREE from '../vendor/three/three.module.js';
import {createBeanLeafMaster} from './plant-growth-botany.js';
import {createLeafSurfaceMaps} from './plant-growth-leaf-surface.js';

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
      if (kind === 'pot') {
        const wheel = Math.sin(y * .47) * 1.2 + Math.sin(y * .13) * .7;
        const grain = (noise - .5) * 8 + 3*Math.sin(x*.037+y*.014);
        r = 176 + grain + wheel; g = 86 + grain * .7 + wheel; b = 48 + grain * .5 + wheel;
      } else {
        const grain = noise < .1 ? -14 : noise > .94 ? 12 : (noise - .5) * 20;
        r = 64 + grain; g = 41 + grain * .8; b = 26 + grain * .6;
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

  const {map:leafMap,normalMap,roughnessMap}=createLeafSurfaceMaps();
  for(const map of [leafMap,normalMap,roughnessMap])textures.add(map);
  const potMap = texture('pot'), soilMap = texture('soil');
  const leafMaterial = keepMaterial(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: leafMap, normalMap, roughnessMap, normalScale:new THREE.Vector2(1,1),
    roughness: 1, metalness: 0, clearcoat: .2, clearcoatRoughness: .36, ior:1.42, specularIntensity:.7,
    sheen:.16,sheenColor:0xa9c868,sheenRoughness:.65,
    vertexColors: true
  }));
  const stemMaterial = keepMaterial(new THREE.MeshStandardMaterial({color: 0x91ad40, roughness: .46, vertexColors:true}));
  const veinMaterial = keepMaterial(new THREE.MeshStandardMaterial({color: 0xb2c363, roughness: .65, envMapIntensity: .2}));
  const potMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xffffff, map: potMap, bumpMap: potMap, bumpScale: .07, roughness: .75
  }));
  const soilMaterial = keepMaterial(new THREE.MeshStandardMaterial({
    color: 0xffffff, map: soilMap, bumpMap: soilMap, bumpScale: .32, roughness: 1
  }));
  const grainMaterial = keepMaterial(new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 1}));

  const leafMaster=createBeanLeafMaster(keepGeometry);
  const leafGeometries=leafMaster.leaves,veins=leafMaster.ribs;
  const petioleCurve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,0,0),new THREE.Vector3(8,7,0),new THREE.Vector3(18,12.5,0),new THREE.Vector3(25,14,0)
  ]);
  const petiole=keepGeometry(new THREE.TubeGeometry(petioleCurve,16,1.8,8,false));
  // Taper the stalk into the blade; the final few units tuck beneath its base
  // instead of ending in an exposed constant-width tube opening.
  const stalkPosition=petiole.attributes.position;
  for(let ring=0;ring<=16;ring++){
    const u=ring/16,center=petioleCurve.getPointAt(u),radiusScale=1-.76*u;
    for(let side=0;side<=8;side++){
      const index=ring*9+side;
      stalkPosition.setXYZ(index,center.x+(stalkPosition.getX(index)-center.x)*radiusScale,
        center.y+(stalkPosition.getY(index)-center.y)*radiusScale,
        center.z+(stalkPosition.getZ(index)-center.z)*radiusScale);
    }
  }
  petiole.computeVertexNormals();petiole.computeBoundingSphere();
  const stalkColors=[];
  for(let ring=0;ring<=16;ring++)for(let side=0;side<=8;side++){
    const shade=.87+.13*Math.cos(side/8*Math.PI*2)**2;
    stalkColors.push(shade,shade,.92*shade);
  }
  petiole.setAttribute('color',new THREE.Float32BufferAttribute(stalkColors,3));
  const profile = [[0, -130], [25.5, -130], [27.7, -129.7], [28.8, -128.3], [29.3, -124],
    [36.5, -88], [37.2, -83.2], [40.5, -83.2], [42.3, -82.1], [43, -80.5],
    [43.1, -74.2], [42.6, -72.1], [41.3, -71], [38.2, -70.8], [36.5, -71.5],
    [35.7, -73.2], [35.8, -78], [28, -124], [0, -124]];
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
  const foliageAngles = [2.87,-.22,3.48,-.52],foliageSizes = [1.01,1,.96,.92];
  const foliageRoll=[.76,.88,.9,.72],foliageLift=[-.12,.08,.52,.62];
  const bladeWidth=[1.05,.94,1.04,.97],bladeCurve=[1,.86,1.13,.94];

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
  function makeStemGeometry(rings = 64, sides = 12) {
    const geometry = new THREE.BufferGeometry(), indices = [];
    const vertices=(rings+1)*(sides+1),colors=[];
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((vertices+2)*3),3));
    for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){
      const shade=.85+.11*Math.cos(j/sides*Math.PI*4)**2+.04*i/rings;
      colors.push(shade,shade,.87*shade);
    }
    colors.push(.85,.85,.74,1,1,.87);
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j, b = a + sides + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    for(let j=0;j<sides;j++){
      indices.push(vertices,j,j+1);
      const top=rings*(sides+1)+j;indices.push(vertices+1,top+1,top);
    }
    geometry.setIndex(indices); geometry.userData = {rings, sides};
    return keepGeometry(geometry);
  }
  function stemAt(u, height, target = new THREE.Vector3()) {
    return target.set(5*Math.sin(Math.PI*u)+1.6*Math.sin(Math.PI*2*u), -72 + height * u, -3 * Math.sin(Math.PI * 2 * u));
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
      const size = .7 + fract(i * .61803398875) * 1.1;
      dummy.scale.set(size, size * .52, size * .8); dummy.updateMatrix(); grains.setMatrixAt(i, dummy.matrix);
      grains.setColorAt(i, new THREE.Color().setHSL(.065 + fract(i * .17) * .025, .31, .12 + fract(i * .37) * .13));
    }
    grains.instanceMatrix.needsUpdate = true; grains.instanceColor.needsUpdate = true;
    grains.count = high() ? 96 : 32;
    const stemGeometries = {high: makeStemGeometry(), low: makeStemGeometry(32, 8)};
    const stem = mesh(stemGeometries[quality], stemMaterial, 'tapered-stem', plant);
    const stalks = instances(petiole, stemMaterial, 4, 'leaf-petioles', plant);
    const leaves = instances(leafGeometries[quality], leafMaterial, 4, 'curved-leaves', plant);
    const primaryVeins = instances(veins[quality], veinMaterial, 4, 'raised-leaf-veins', plant);
    leafMaster.individualize(leaves);leafMaster.individualize(primaryVeins);
    // Stable leaf-to-leaf pigment and three-axis blade proportions give each
    // blade its own silhouette. Both groups use identical botanical variation.
    for(let i=0;i<4;i++)leaves.setColorAt(i,new THREE.Color().setRGB([.94,1,.97,1][i],[.98,.96,1,.99][i],[.91,.98,.94,.9][i]));
    leaves.instanceColor.needsUpdate=true;
    // Thin botanical surfaces otherwise self-shadow into stippled artifacts at
    // mobile shadow resolutions. They still cast their silhouette onto the soil.
    leaves.receiveShadow=false;primaryVeins.receiveShadow=false;
    primaryVeins.castShadow = false;
    return {plant, pot, soil, grains, stem, stemGeometries, stalks, leaves, primaryVeins, height: 55, target: 55};
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
      tangent.set(5*Math.PI*Math.cos(Math.PI*u)+3.2*Math.PI*Math.cos(Math.PI*2*u), height, -6 * Math.PI * Math.cos(Math.PI * 2 * u)).normalize();
      across.crossVectors(tangent, new THREE.Vector3(0, 0, 1)).normalize();
      forward.crossVectors(across, tangent).normalize();
      // Node collars are integrated into the stem surface, so each petiole has
      // a botanical attachment without four extra meshes or draw calls.
      let collar = 0;
      for (let node = 0; node < 4; node++) {
        const nodeU = Math.min(.96, .25 + node * .17 + 8 / height);
        const distance = (u - nodeU) * height / 2.8;
        collar += .75 * Math.exp(-distance * distance);
      }
      const apex=THREE.MathUtils.smoothstep(u,.96,1);
      const radius = (4.3 - 2.7 * u + collar)*(1-.88*apex);
      for (let j = 0; j <= sides; j++) {
        const angle = j / sides * Math.PI * 2;
        temp.copy(center).addScaledVector(across, Math.cos(angle) * radius).addScaledVector(forward, Math.sin(angle) * radius);
        attribute.setXYZ(i * (sides + 1) + j, temp.x, temp.y, temp.z);
      }
    }
    const cap=(rings+1)*(sides+1);
    attribute.setXYZ(cap,0,-72,0);attribute.setXYZ(cap+1,0,-72+height,0);
    attribute.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    for (let i = 0; i < 4; i++) {
      // Retain four leaf nodes through the entire experiment; only their
      // attachment follows the original stem-height visualization.
      const u = Math.min(.96, .25 + i * .17 + 8 / height), angle = foliageAngles[i];
      stemAt(u, height, dummy.position);
      dummy.rotation.set(0, angle, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      plant.stalks.setMatrixAt(i, dummy.matrix);
      dummy.position.add(new THREE.Vector3(22 * Math.cos(angle), 13, -22 * Math.sin(angle)));
      dummy.rotation.x=foliageRoll[i];dummy.rotation.z=foliageLift[i];
      dummy.scale.set(foliageSizes[i],foliageSizes[i]*bladeCurve[i],foliageSizes[i]*bladeWidth[i]);dummy.updateMatrix();
      plant.leaves.setMatrixAt(i, dummy.matrix);
      plant.primaryVeins.setMatrixAt(i, dummy.matrix);
    }
    for (const object of [plant.stalks, plant.leaves, plant.primaryVeins]) {
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
        plant.primaryVeins.geometry=veins[quality];
        plant.grains.count = high() ? 96 : 32;
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
