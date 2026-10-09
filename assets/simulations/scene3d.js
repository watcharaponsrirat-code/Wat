import * as THREE from '../vendor/three/three.module.js';
import {OrbitControls} from '../vendor/three/OrbitControls.js';
import {RoomEnvironment} from '../vendor/three/RoomEnvironment.js';
import {ModelKit} from './models3d-kit.js';
import {models3d} from './models3d.js';

export function mountScene(host,spec,initialValues){
  const build=models3d[spec.id];if(!build)throw Error('Missing native model: '+spec.id);
  const radius=({G1U1L1:285,G1U2L1:250,G1U2L2:315,G1U3L1:315,G1U4L1:250,G2U2L1:250,G2U2L2:250,G2U3L2:315,G2U3L5:300,G3U5L1:255,G3U6L2:275})[spec.id]||335;
  const panel=host.closest('.simPanel'),canvas=document.createElement('canvas');
  canvas.setAttribute('aria-label',spec.title+' — หมุนสำรวจสามมิติ');canvas.setAttribute('role','img');canvas.tabIndex=0;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'default'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.setClearColor(0x0c263b,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.append(canvas);
  const scene=new THREE.Scene(),group=new THREE.Group();scene.add(group);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);
  scene.environment=environment.texture;scene.environmentIntensity=.55;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe7f5ff,0x6a7e8b,1.5));
  const key=new THREE.DirectionalLight(0xfff4dd,3);key.position.set(-240,450,300);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-420,right:420,top:420,bottom:-420,near:1,far:1400});key.shadow.bias=-.0003;key.shadow.normalBias=1;key.shadow.radius=3;scene.add(key);
  const rim=new THREE.DirectionalLight(0x87cfff,2.3);rim.position.set(250,90,-300);scene.add(rim);
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(radius+5,radius+15,14,96),new THREE.MeshStandardMaterial({color:0x24475a,roughness:.65,metalness:.2}));platform.position.y=-172;platform.receiveShadow=true;scene.add(platform);
  const edge=new THREE.Mesh(new THREE.TorusGeometry(radius+2,1.6,8,96),new THREE.MeshBasicMaterial({color:0x51b8c1}));edge.rotation.x=Math.PI/2;edge.position.y=-163;scene.add(edge);
  const frontal=/^G2U3L[1-5]$/.test(spec.id)||['G1U3L1','G3U2L1'].includes(spec.id);
  if(frontal){platform.visible=false;edge.visible=false}
  const camera=new THREE.PerspectiveCamera(40,1,1,5000),orbit=new OrbitControls(camera,canvas),kit=new ModelKit(group);
  orbit.enablePan=false;orbit.enableDamping=true;orbit.dampingFactor=.12;orbit.rotateSpeed=.65;orbit.zoomSpeed=.8;
  orbit.minAzimuthAngle=-Infinity;orbit.maxAzimuthAngle=Infinity;orbit.minPolarAngle=.06;orbit.maxPolarAngle=Math.PI-.06;
  orbit.enableRotate=!matchMedia('(pointer:coarse)').matches;orbit.enableZoom=orbit.enableRotate;orbit.autoRotateSpeed=.65;
  orbit.target.set(0,20,0);canvas.style.touchAction=orbit.enableRotate?'none':'pan-y';
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  let disposed=false,mode='3d',frame=0,lastTime=0,zoomFactor=1,tween=null,updating=false,inView=true,revision=0;
  const fitDistance=()=>{
    const aspect=Math.max(.2,host.clientWidth/Math.max(1,host.clientHeight)),half=Math.atan(Math.tan(THREE.MathUtils.degToRad(20))*Math.min(1,aspect));
    return radius/Math.sin(half);
  };
  const spherical=()=>new THREE.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
  function paint(){
    if(disposed||mode!=='3d'||document.hidden||!inView)return;
    // Keep callouts legible and separated in screen space, including a narrow phone.
    const width=host.clientWidth,height=host.clientHeight,placed=[],visible=[];
    camera.updateMatrixWorld();
    for(const item of kit.items.values())if(item.type==='label'){
      if(!item.mesh.visible){if(item.leader)item.leader.visible=false;continue}
      item.mesh.position.copy(item.anchor);
      const projected=item.anchor.clone().project(camera),aspect=item.mesh.userData.labelAspect;
      const pixels=Math.max(12,Math.min(width<450?18:22,width*.58/aspect));
      visible.push({item,projected,w:pixels*aspect,h:pixels,x:(projected.x+1)*width/2,y:(1-projected.y)*height/2});
    }
    visible.sort((a,b)=>a.y-b.y);
    for(const label of visible){
      const {item,projected,w,h,x,y}=label;let best=null;
      for(let row=0;row<18;row++)for(const sign of row?[1,-1]:[1])for(const dx of [0,-w*.65-12,w*.65+12]){
        const px=Math.max(w/2+5,Math.min(width-w/2-5,x+dx)),py=Math.max(h/2+5,Math.min(height-h/2-5,y+row*(h+7)*sign));
        const rect={x:px-w/2,y:py-h/2,w,h};
        if(placed.some(r=>rect.x<r.x+r.w+5&&rect.x+w+5>r.x&&rect.y<r.y+r.h+4&&rect.y+h+4>r.y))continue;
        const score=(px-x)**2+(py-y)**2;
        if(!best||score<best.score)best={...rect,px,py,score};
      }
      best||={x:x-w/2,y:y-h/2,w,h,px:x,py:y,score:0};placed.push(best);
      item.mesh.position.set(best.px/width*2-1,1-best.py/height*2,projected.z).unproject(camera);
      const depth=-item.mesh.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const scale=2*depth*Math.tan(THREE.MathUtils.degToRad(20))/Math.max(1,height)*h;
      item.mesh.scale.set(scale*item.mesh.userData.labelAspect,scale,1);
      if(!item.leader){
        const geo=new THREE.BufferGeometry().setFromPoints([item.anchor,item.anchor]);
        item.leader=new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xb5d5de,transparent:true,opacity:.65,depthTest:false}));item.leader.renderOrder=19;scene.add(item.leader);
      }
      item.leader.visible=best.score>100;
      if(item.leader.visible){const arr=item.leader.geometry.attributes.position;arr.setXYZ(0,...item.anchor.toArray());arr.setXYZ(1,...item.mesh.position.toArray());arr.needsUpdate=true;item.leader.geometry.computeBoundingSphere()}
    }
    host.dataset.labelCount=String(placed.length);
    host.dataset.labelOverlap=String(placed.some((a,i)=>placed.slice(i+1).some(b=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y)));
    host.dataset.labelOverflow=String(placed.some(r=>r.x<0||r.y<0||r.x+r.w>width+1||r.y+r.h>height+1));
    renderer.render(scene,camera);const s=spherical();
    host.dataset.cameraDistance=String(s.radius);host.dataset.azimuth=String(s.theta);host.dataset.polar=String(s.phi);
  }
  function schedule(){if(!disposed&&!frame&&mode==='3d'&&!document.hidden&&inView)frame=requestAnimationFrame(tick)}
  function tick(time){
    frame=0;if(disposed||mode!=='3d'||document.hidden||!inView)return;
    const dt=Math.min(.05,Math.max(.001,(time-(lastTime||time-16))/1000));lastTime=time;
    updating=true;
    if(tween){
      const progress=reduced.matches?1:Math.min(1,(time-tween.start)/260),ease=1-(1-progress)**3;
      const s=new THREE.Spherical(tween.from.radius+(tween.to.radius-tween.from.radius)*ease,tween.from.phi+(tween.to.phi-tween.from.phi)*ease,tween.from.theta+(tween.to.theta-tween.from.theta)*ease);
      camera.position.setFromSpherical(s).add(orbit.target);if(progress===1)tween=null;
    }
    const cameraMoving=orbit.update(dt),modelMoving=kit.tick(dt,reduced.matches);updating=false;paint();
    host.dataset.animating=String(Boolean(tween||cameraMoving||modelMoving||orbit.autoRotate));
    if(tween||cameraMoving||modelMoving||orbit.autoRotate)schedule();
  }
  function settledControls(){const damping=orbit.enableDamping;orbit.enableDamping=false;orbit.update();orbit.enableDamping=damping}
  function moveTo(to,instant=false){
    settledControls();
    if(instant||reduced.matches){camera.position.setFromSpherical(to).add(orbit.target);orbit.update();tween=null;paint()}
    else {tween={from:spherical(),to,start:performance.now()};host.dataset.animating='true'}schedule();
  }
  function resetCamera(instant=false){zoomFactor=1;orbit.autoRotate=false;panel.querySelector('[data-sim-camera="auto"]')?.setAttribute('aria-pressed','false');moveTo(new THREE.Spherical(fitDistance(),frontal?1.5:1.12,frontal?.04:.42),instant)}
  function resize(){
    if(disposed||!host.clientWidth||!host.clientHeight)return;
    renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();
    const fit=fitDistance();orbit.minDistance=fit*.42;orbit.maxDistance=fit*2.4;
    if(camera.position.length()){const s=spherical();s.radius=fit*zoomFactor;moveTo(s,true)}schedule();
  }
  function update(values){
    if(disposed)return;kit.begin();build(kit,values);kit.end();
    host.dataset.revision=String(++revision);host.dataset.meshes=String([...kit.items.values()].filter(i=>i.mesh.visible&&i.type!=='label').length);
    host.dataset.model=spec.id;host.dataset.renderer='native';host.dataset.modelState=JSON.stringify(kit.values);schedule();
    host.dataset.animating='true';
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
  const visibilityObserver=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;if(inView){lastTime=0;schedule()}else{cancelAnimationFrame(frame);frame=0}},{rootMargin:'100px'});visibilityObserver.observe(host);
  function action(event){
    const button=event.currentTarget;
    if(button.dataset.simView){mode=button.dataset.simView;panel.dataset.simView=mode;host.hidden=mode!=='3d';panel.querySelectorAll('[data-sim-view]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.simView===mode)));cancelAnimationFrame(frame);frame=0;lastTime=0;if(mode==='3d'){inView=true;resize();schedule()}return}
    const command=button.dataset.simCamera,s=tween?tween.to.clone():spherical();
    if(command==='reset'){resetCamera();return}
    if(command==='left'||command==='right'){s.theta+=(command==='left'?-1:1)*Math.PI/12;moveTo(s)}
    if(command==='in'||command==='out'){zoomFactor=THREE.MathUtils.clamp(zoomFactor*(command==='in'?.85:1/.85),.42,2.4);s.radius=fitDistance()*zoomFactor;moveTo(s)}
    if(command==='front')moveTo(new THREE.Spherical(fitDistance()*zoomFactor,Math.PI/2,0));
    if(command==='top')moveTo(new THREE.Spherical(fitDistance()*zoomFactor,.06,0));
    if(command==='auto'){tween=null;orbit.autoRotate=!orbit.autoRotate;button.setAttribute('aria-pressed',String(orbit.autoRotate));schedule()}
    if(command==='labels'){kit.setLabels(!kit.labels);button.setAttribute('aria-pressed',String(kit.labels));schedule()}
    if(command==='drag'){orbit.enableRotate=!orbit.enableRotate;orbit.enableZoom=orbit.enableRotate;canvas.style.touchAction=orbit.enableRotate?'none':'pan-y';button.setAttribute('aria-pressed',String(orbit.enableRotate))}
  }
  const buttons=panel.querySelectorAll('[data-sim-camera],[data-sim-view]');buttons.forEach(button=>button.addEventListener('click',action));
  panel.querySelector('[data-sim-camera="drag"]').setAttribute('aria-pressed',String(orbit.enableRotate));
  function changed(){if(!updating)schedule()}
  function start(){tween=null;orbit.autoRotate=false;panel.querySelector('[data-sim-camera="auto"]').setAttribute('aria-pressed','false');schedule()}
  function end(){zoomFactor=THREE.MathUtils.clamp(spherical().radius/fitDistance(),.42,2.4);schedule()}
  orbit.addEventListener('change',changed);orbit.addEventListener('start',start);orbit.addEventListener('end',end);
  function visibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0}else{lastTime=0;schedule()}}document.addEventListener('visibilitychange',visibility);
  function keydown(event){const commands={ArrowLeft:'left',ArrowRight:'right','+':'in','=':'in','-':'out',Home:'reset'};if(commands[event.key]){event.preventDefault();panel.querySelector('[data-sim-camera="'+commands[event.key]+'"]').click()}}
  canvas.addEventListener('keydown',keydown);
  function lost(event){event.preventDefault();mode='2d';panel.dataset.simView='2d';host.hidden=true;cancelAnimationFrame(frame);frame=0;panel.querySelector('[data-sim-view="3d"]').disabled=true;panel.querySelectorAll('[data-sim-view]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.simView==='2d')));panel.querySelector('[data-sim-status]').textContent='แสดงแผนภาพ 2D — เปิดบทเรียนใหม่เพื่อกลับมุมมอง 3D'}
  canvas.addEventListener('webglcontextlost',lost);
  try{panel.dataset.simView='3d';update(initialValues);resize();resetCamera(true);paint()}catch(error){dispose();throw error}
  panel.querySelector('[data-sim-status]').textContent='หมุนได้รอบ 360° · ลากเพื่อสำรวจ · ซูมด้วยสองนิ้วหรือปุ่ม';
  function dispose(){
    disposed=true;cancelAnimationFrame(frame);frame=0;resizeObserver.disconnect();visibilityObserver.disconnect();orbit.dispose();
    buttons.forEach(button=>button.removeEventListener('click',action));canvas.removeEventListener('keydown',keydown);canvas.removeEventListener('webglcontextlost',lost);document.removeEventListener('visibilitychange',visibility);
    kit.dispose();platform.geometry.dispose();platform.material.dispose();edge.geometry.dispose();edge.material.dispose();key.shadow.map?.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();
  }
  return{update,dispose};
}
