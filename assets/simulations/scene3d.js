import * as THREE from '../vendor/three/three.module.js';
import {OrbitControls} from '../vendor/three/OrbitControls.js';
import {SVGLoader} from '../vendor/three/SVGLoader.js';

// The lesson's original model remains the source of positions, colors and values.
// Depth is illustrative; the 2D reference remains available for exact diagrams.
export function mountScene(host, initialSVG, title) {
  const panel = host.closest('.simPanel');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', title + ' — แบบจำลองสามมิติ');
  canvas.setAttribute('role', 'img');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true}); }
  catch { throw new Error('WebGL unavailable'); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0xeaf5fa, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.append(canvas);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7097a6, 1.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-250, 400, 500); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7ad8ff, 1.6);
  rim.position.set(350, 20, -80); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enablePan = false; orbit.enableDamping = false;
  orbit.enableZoom = false; // Page scrolling stays available; use explicit zoom buttons.
  orbit.minDistance = 280; orbit.maxDistance = 1500;
  orbit.minAzimuthAngle = -Math.PI / 2.8; orbit.maxAzimuthAngle = Math.PI / 2.8;
  orbit.minPolarAngle = Math.PI / 5; orbit.maxPolarAngle = Math.PI * .79;
  orbit.enableRotate = !matchMedia('(pointer: coarse)').matches;
  canvas.style.touchAction = orbit.enableRotate ? 'none' : 'pan-y';
  const stage = new THREE.Group(); scene.add(stage);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(650, 12, 155), new THREE.MeshStandardMaterial({color:0xd4e9ef,roughness:.65}));
  platform.position.set(0,-181,0); scene.add(platform);
  const grid = new THREE.GridHelper(650, 20, 0x8bb7c6, 0xc7e1e8);
  grid.position.y = -188; scene.add(grid);
  let disposed = false, mode = '3d', revision = 0, zoomFactor = 1;
  const fitDistance = () => Math.max(640 / (host.clientWidth / host.clientHeight),380) / (2*Math.tan(THREE.MathUtils.degToRad(19)));
  const draw = () => { if (!disposed && mode === '3d') {renderer.render(scene,camera);host.dataset.cameraDistance=String(camera.position.length());} };
  const disposeGroup = group => {
    group.traverse(item => {
      item.geometry?.dispose();
      const materials = item.material ? (Array.isArray(item.material) ? item.material : [item.material]) : [];
      for (const material of materials) { material.map?.dispose(); material.dispose(); }
    });
    group.clear();
  };
  const resetCamera = () => {
    const distance = fitDistance(); zoomFactor=1;
    camera.position.set(.14,.12,1).normalize().multiplyScalar(distance);
    orbit.target.set(0,0,0); orbit.update(); draw();
  };
  const material = color => new THREE.MeshStandardMaterial({color,roughness:.38,metalness:.08,side:THREE.DoubleSide});
  function update(svg) {
    if (disposed) return;
    disposeGroup(stage);
    const parsed = new SVGLoader().parse('<svg xmlns="http://www.w3.org/2000/svg">'+svg+'</svg>');
    let layer = 0;
    for (const path of parsed.paths) {
      const style = path.userData.style, node = path.userData.node;
      const z = layer++ * .35;
      if (style.fill && style.fill !== 'none' && Number(style.fillOpacity) !== 0) {
        for (const shape of SVGLoader.createShapes(path)) {
          const flat = new THREE.ShapeGeometry(shape,20);
          flat.computeBoundingBox();
          const box = flat.boundingBox, width = box.max.x-box.min.x, height = box.max.y-box.min.y;
          if (width <= 0 || height <= 0) { flat.dispose(); continue; }
          let mesh;
          if (node.nodeName === 'circle' || node.nodeName === 'ellipse') {
            mesh = new THREE.Mesh(new THREE.SphereGeometry(1,24,16),material(path.color));
            mesh.scale.set(width/2,height/2,Math.min(width,height)*.32);
            mesh.position.set((box.min.x+box.max.x)/2-300,160-(box.min.y+box.max.y)/2,z+8);
          } else if (node.nodeName === 'rect' && node.getAttribute('fill') === '#b87d55') {
            mesh = new THREE.Mesh(new THREE.CylinderGeometry(width*.5,width*.36,height,32),material(path.color));
            mesh.position.set((box.min.x+box.max.x)/2-300,160-(box.min.y+box.max.y)/2,z);
          } else {
            const depth = Math.min(24,Math.max(4,Math.min(width,height)*.25));
            const geometry = new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:16,steps:1});
            mesh = new THREE.Mesh(geometry,material(path.color));
            mesh.scale.y = -1; mesh.position.set(-300,160,z-depth/2);
          }
          flat.dispose(); stage.add(mesh);
        }
      }
      if (style.stroke && style.stroke !== 'none' && Number(style.strokeOpacity) !== 0) {
        for (const sub of path.subPaths) {
          const points = sub.getPoints(24);
          const distinct=points.filter((p,i)=>!i||p.distanceToSquared(points[i-1])>.0001);
          if(distinct.length<2)continue;
          const curve=new THREE.CurvePath();
          for(let i=1;i<distinct.length;i++)curve.add(new THREE.LineCurve3(new THREE.Vector3(distinct[i-1].x-300,160-distinct[i-1].y,z+15),new THREE.Vector3(distinct[i].x-300,160-distinct[i].y,z+15)));
          const geometry=new THREE.TubeGeometry(curve,Math.max(2,distinct.length*2),Math.max(.6,Number(style.strokeWidth||1)/2),8,false);
          stage.add(new THREE.Mesh(geometry,material(style.stroke)));
        }
      }
    }
    // A separate transparent texture preserves all Thai labels and SVG transforms.
    const labels = document.createElementNS('http://www.w3.org/2000/svg','svg');
    labels.setAttribute('xmlns','http://www.w3.org/2000/svg');
    labels.setAttribute('viewBox','0 0 600 320'); labels.setAttribute('width','1200'); labels.setAttribute('height','640');
    labels.setAttribute('style','font-family:Tahoma,sans-serif');
    labels.innerHTML = svg;
    labels.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon').forEach(el=>el.remove());
    const blob = new Blob([new XMLSerializer().serializeToString(labels)],{type:'image/svg+xml'});
    const url = URL.createObjectURL(blob), img = new Image(), current = ++revision;
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (disposed || current !== revision) return;
      const texture = new THREE.Texture(img); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
      const label = new THREE.Mesh(new THREE.PlaneGeometry(600,320),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,side:THREE.DoubleSide}));
      label.position.z = 0; label.renderOrder = 10; stage.add(label); draw();
    };
    img.onerror = () => URL.revokeObjectURL(url); img.src = url;
    host.dataset.revision = String(revision);
    host.dataset.meshes = String(stage.children.length);
    draw();
  }
  function resize() {
    if (disposed || !host.clientWidth) return;
    renderer.setSize(host.clientWidth,host.clientHeight,false);
    // Recompute from the requested zoom, not a previously clamped camera distance.
    // Transient narrow layouts must not accumulate zoom when the viewport recovers.
    if(camera.position.length())camera.position.normalize().multiplyScalar(fitDistance()*zoomFactor);
    camera.aspect=host.clientWidth/host.clientHeight; camera.updateProjectionMatrix(); orbit.update(); draw();
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const buttons = panel.querySelectorAll('[data-sim-camera],[data-sim-view]');
  function action(event) {
    const button=event.currentTarget;
    if (button.dataset.simView) {
      mode=button.dataset.simView; panel.dataset.simView=mode;
      panel.querySelectorAll('[data-sim-view]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.simView===mode)));
      host.hidden=mode!=='3d'; resize(); draw(); return;
    }
    const command=button.dataset.simCamera;
    if (command==='reset') resetCamera();
    if (command==='in'||command==='out') { zoomFactor=THREE.MathUtils.clamp(zoomFactor*(command==='in'?.85:1.18),.5,2);camera.position.normalize().multiplyScalar(fitDistance()*zoomFactor); orbit.update(); }
    if (command==='left'||command==='right') { const angle=command==='left'?-.18:.18; camera.position.applyAxisAngle(new THREE.Vector3(0,1,0),angle); orbit.update(); }
    if (command==='drag') { orbit.enableRotate=!orbit.enableRotate; canvas.style.touchAction=orbit.enableRotate?'none':'pan-y'; button.setAttribute('aria-pressed',String(orbit.enableRotate)); }
    draw();
  }
  buttons.forEach(button=>button.addEventListener('click',action));
  panel.querySelector('[data-sim-camera="drag"]').setAttribute('aria-pressed',String(orbit.enableRotate));
  orbit.addEventListener('change',draw);
  const onLost = event => { event.preventDefault(); mode='2d'; panel.dataset.simView='2d'; host.hidden=true; panel.querySelector('[data-sim-view="3d"]').disabled=true;panel.querySelectorAll('[data-sim-view]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.simView==='2d'))); panel.querySelector('[data-sim-status]').textContent='แสดงแผนภาพ 2D — กรุณาเปิดบทเรียนใหม่เพื่อใช้ 3D'; };
  canvas.addEventListener('webglcontextlost',onLost);
  try { update(initialSVG); resize(); resetCamera(); }
  catch(error) { dispose(); throw error; }
  panel.dataset.simView='3d';
  panel.querySelector('[data-sim-status]').textContent='แบบจำลอง 3D • หมุนและซูมเพื่อสำรวจ';
  function dispose() {
    disposed=true; revision++; resizeObserver.disconnect(); orbit.dispose();
    buttons.forEach(button=>button.removeEventListener('click',action));
    canvas.removeEventListener('webglcontextlost',onLost);
    disposeGroup(scene); renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
  }
  return {update,dispose};
}
