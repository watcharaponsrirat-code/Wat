import * as THREE from '../vendor/three/three.module.js';
import {createPlantGrowthModel} from './plant-growth-model.js';

// Presentation adapter for G1U1L1 only. The original builder remains the sole
// source of calculated growth, labels and experimental light values.
export function createPlantGrowthStudio({host,scene,kit,renderer,key,rim,platform,edge}) {
  const compact=host.clientWidth<520||(navigator.deviceMemory||8)<=4;
  let quality=compact?'low':'high',slowFrames=0,samples=0,totalFrameTime=0,disposed=false;
  const model=createPlantGrowthModel(scene,{quality});
  host.dataset.plantFidelity='true';host.dataset.qualityReason=compact?'device-budget':'initial';
  const fixtures=new THREE.Group();fixtures.name='bean-laboratory-lights';scene.add(fixtures);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  function mesh(geometry,material,parent=fixtures){geometries.add(geometry);materials.add(material);const m=new THREE.Mesh(geometry,material);parent.add(m);return m}
  const housing=new THREE.MeshStandardMaterial({color:0x596463,metalness:.74,roughness:.28});
  const trim=new THREE.MeshStandardMaterial({color:0xc39b61,metalness:.78,roughness:.28});
  const haloCanvas=document.createElement('canvas');haloCanvas.width=haloCanvas.height=128;
  const haloContext=haloCanvas.getContext('2d'),glow=haloContext.createRadialGradient(64,64,8,64,64,64);
  glow.addColorStop(0,'rgba(255,250,213,1)');glow.addColorStop(.22,'rgba(255,224,138,.65)');glow.addColorStop(.55,'rgba(255,194,77,.16)');glow.addColorStop(1,'rgba(255,186,70,0)');
  haloContext.fillStyle=glow;haloContext.fillRect(0,0,128,128);const haloMap=new THREE.CanvasTexture(haloCanvas);textures.add(haloMap);
  const beamGeometry=new THREE.CylinderGeometry(29,98,286,32,1,true);geometries.add(beamGeometry);
  const lightTargets=[];
  const lamps=[];
  for(const [id,x] of [['control',-130],['experiment',130]]){
    const lamp=new THREE.Group();lamp.name=id+'-light-fixture';lamp.position.set(x,165,-15);fixtures.add(lamp);
    const body=mesh(new THREE.CylinderGeometry(27,34,12,48),housing,lamp);body.castShadow=true;
    const ring=mesh(new THREE.TorusGeometry(31,2,8,48),trim,lamp);ring.rotation.x=Math.PI/2;ring.position.y=-5;
    const lensMaterial=new THREE.MeshBasicMaterial({color:0xffedb6,toneMapped:false});
    const lens=mesh(new THREE.CylinderGeometry(29,29,2,48),lensMaterial,lamp);lens.position.y=-7;
    const luminousRim=mesh(new THREE.TorusGeometry(29.5,1.4,6,48),lensMaterial,lamp);luminousRim.rotation.x=Math.PI/2;luminousRim.position.y=-7.5;
    const cord=mesh(new THREE.CylinderGeometry(1.1,1.1,18,8),housing,lamp);cord.position.y=15;
    const beamMaterial=new THREE.ShaderMaterial({
      uniforms:{strength:{value:.5}},transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,blending:THREE.AdditiveBlending,
      vertexShader:'varying vec2 beamUv; varying vec3 beamNormal; varying vec3 beamView; void main(){beamUv=uv;beamNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);beamView=-p.xyz;gl_Position=projectionMatrix*p;}',
      fragmentShader:'uniform float strength;varying vec2 beamUv;varying vec3 beamNormal;varying vec3 beamView;void main(){float facing=pow(abs(dot(normalize(beamNormal),normalize(beamView))),1.7);float fade=pow(beamUv.y,.7)*smoothstep(0.,.16,beamUv.y);float rays=.64+.24*pow(abs(sin(beamUv.x*37.7+beamUv.y*.8)),8.)+.12*pow(abs(sin(beamUv.x*81.68)),12.);gl_FragColor=vec4(1.,.71,.30,strength*.31*facing*fade*rays);}'
    });
    const beam=mesh(beamGeometry,beamMaterial,lamp);beam.position.y=-151;beam.renderOrder=2;
    const haloMaterial=new THREE.SpriteMaterial({map:haloMap,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});materials.add(haloMaterial);
    const halo=new THREE.Sprite(haloMaterial);halo.position.set(0,-8,2);halo.scale.set(110,38,1);lamp.add(halo);
    const target=new THREE.Object3D();target.name=id+'-light-target';target.position.set(x,-75,0);scene.add(target);lightTargets.push(target);
    const spot=new THREE.SpotLight(0xffdc94,120000,440,.48,.85,2);spot.position.set(x,157,-15);spot.target=target;fixtures.add(spot);
    lamps.push({id,lensMaterial,beam,beamMaterial,haloMaterial,spot});
  }
  // Inspection fill keeps both plants legible even at zero experimental light.
  // Lamp brightness is decorative; calculated growth still comes only from kit.
  scene.environmentIntensity=.36;renderer.toneMappingExposure=1.06;
  const fill=scene.children.find(o=>o.isHemisphereLight);if(fill){fill.intensity=.8;fill.color.setHex(0xd2e4ff);fill.groundColor.setHex(0x494335)}
  key.intensity=2.3;key.color.setHex(0xffe5b5);key.position.set(-155,330,180);key.shadow.normalBias=.55;key.shadow.bias=-.00015;key.shadow.radius=2;
  Object.assign(key.shadow.camera,{left:-300,right:300,top:300,bottom:-300});key.shadow.camera.updateProjectionMatrix();
  rim.color.setHex(0xd9edc0);rim.intensity=2.3;rim.position.set(80,220,-230);
  const tableCanvas=document.createElement('canvas');tableCanvas.width=tableCanvas.height=512;
  const tableContext=tableCanvas.getContext('2d'),pixels=tableContext.createImageData(512,512);
  const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)};
  function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),u),THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v)}
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const i=(y*512+x)*4,cloud=noise(x*.019,y*.019)*.55+noise(x*.057,y*.057)*.3+noise(x*.16,y*.16)*.15;
    const patina=Math.max(0,cloud-.48)*85,grain=(hash(x,y)-.5)*4;
    const brushing=Math.sin(Math.hypot(x-256,y-256)*2.2)*.9;
    pixels.data[i]=53+patina+grain+brushing;pixels.data[i+1]=62+patina*.65+grain+brushing;pixels.data[i+2]=66+patina*.28+grain+brushing;pixels.data[i+3]=255;
  }
  tableContext.putImageData(pixels,0,0);const tableMap=new THREE.CanvasTexture(tableCanvas);tableMap.colorSpace=THREE.SRGBColorSpace;textures.add(tableMap);
  platform.position.y=-137;platform.scale.set(1,1,1);platform.material.color.setHex(0xffffff);platform.material.map=tableMap;platform.material.roughness=.32;platform.material.metalness=.68;platform.material.envMapIntensity=.7;platform.material.needsUpdate=true;
  edge.position.y=-129.5;edge.scale.set(1,1,1);edge.material.color.setHex(0xd3ad6b);
  const pedestal=mesh(new THREE.CylinderGeometry(238,225,19,96),new THREE.MeshStandardMaterial({color:0x3c332b,roughness:.42,metalness:.58}));pedestal.position.y=-151.5;pedestal.receiveShadow=true;
  for(const y of [-140,-158]){const band=mesh(new THREE.TorusGeometry(y===-140?241:228,1.8,8,96),trim);band.rotation.x=Math.PI/2;band.position.y=y}

  // Two shared radial decals provide stable contact at every quality level,
  // without extra shadow maps or a screen-space postprocessing pass.
  const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=128;
  const contactContext=contactCanvas.getContext('2d'),contactGradient=contactContext.createRadialGradient(64,64,20,64,64,64);
  contactGradient.addColorStop(0,'rgba(13,17,20,.65)');contactGradient.addColorStop(.35,'rgba(13,17,20,.32)');contactGradient.addColorStop(1,'rgba(13,17,20,0)');
  contactContext.fillStyle=contactGradient;contactContext.fillRect(0,0,128,128);
  const contactMap=new THREE.CanvasTexture(contactCanvas);textures.add(contactMap);
  const contactGeometry=new THREE.PlaneGeometry(116,116),contactMaterial=new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,toneMapped:false});
  for(const x of [-130,130]){const contact=mesh(contactGeometry,contactMaterial);contact.name='pot-contact-shadow';contact.rotation.x=-Math.PI/2;contact.position.set(x,-129.8,0);contact.renderOrder=1}

  // A conservative envelope includes the maximum original growth, every leaf,
  // the complete pedestal and lamp housings. It never depends on light values.
  const framingPoints=[];
  for(let i=0;i<48;i++)for(const y of [-161,-128]){const angle=i*Math.PI/24;framingPoints.push(new THREE.Vector3(Math.cos(angle)*246,y,Math.sin(angle)*246))}
  for(const x of [-130,130]){
    for(const dx of [-92,92])for(const y of [-130,106])for(const z of [-70,70])framingPoints.push(new THREE.Vector3(x+dx,y,z));
    for(const dx of [-35,35])for(const y of [157,190])for(const z of [-49,19])framingPoints.push(new THREE.Vector3(x+dx,y,z));
  }

  const overlay=document.createElement('div');overlay.className='plantReadouts';
  const condition=document.createElement('div');condition.className='plantCondition';overlay.append(condition);
  const cards=document.createElement('div');cards.className='plantGroups';overlay.append(cards);
  const readouts=['control','experiment'].map(id=>{
    const card=document.createElement('div');card.className='plantGroup';card.dataset.group=id;
    const title=document.createElement('strong'),light=document.createElement('span'),value=document.createElement('b');
    card.append(title,light,value);cards.append(card);return {id,card,title,light,value};
  });
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('plantLeaders');svg.setAttribute('aria-hidden','true');
  const lines=readouts.map(({id})=>{const p=document.createElementNS(svg.namespaceURI,'path');p.dataset.group=id;svg.append(p);return p});
  host.append(svg,overlay);
  function setQuality(next,reason){
    quality=next;host.dataset.quality=quality;if(reason)host.dataset.qualityReason=reason;
    model.setQuality(quality);renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality==='low'?1.15:1.75));
    const shadowSize=quality==='low'?512:1024;
    if(key.shadow.mapSize.x!==shadowSize){key.shadow.mapSize.set(shadowSize,shadowSize);key.shadow.map?.dispose();key.shadow.map=null;key.shadow.needsUpdate=true}
  }
  setQuality(quality);
  function size(){return {width:host.clientWidth,height:Math.max(150,host.clientHeight-142)}}
  function update(){
    model.update(kit.values);
    // Retain original labels/rulers in the source builder and replace only the
    // low-detail plants and suns in this mounted scene.
    for(const [name,item] of kit.items){
      if(item.type==='label'||/^(control|experiment)(-|Sun$|Light-)/.test(name)){item.mesh.visible=false;if(item.leader)item.leader.visible=false}
      else if(/Ruler|Tick/.test(name)){item.color.setHex(0x8ca99b);item.mesh.material.color.copy(item.color);item.mesh.material.roughness=1}
    }
    condition.textContent=kit.items.get('same')?.text||'';
    const metrics=host.closest('.simPanel').querySelectorAll('.simMetrics strong');
    readouts.forEach((r,i)=>{
      r.title.textContent=kit.items.get(r.id+'Group')?.text||'';
      r.light.textContent=kit.items.get(r.id+'LightLabel')?.text||'';
      r.value.textContent=metrics[i]?.textContent||'';
      // The original sun's target size encodes the original hours value.
      const sun=kit.items.get(r.id+'Sun'),hours=THREE.MathUtils.clamp(sun?(sun.s.x-21)/.45:6,0,12);
      const lamp=lamps[i],strength=kit.active.has(r.id+'Light-shaft')?hours/12:0;
      lamp.beam.visible=strength>0;lamp.beamMaterial.uniforms.strength.value=strength;
      lamp.haloMaterial.opacity=strength*.95;lamp.spot.intensity=strength*120000;
      lamp.lensMaterial.color.setHex(strength>0?0xffedb6:0x6d736c).multiplyScalar(strength>0?.6+strength*.4:1);
    });
  }
  const frameProjection=new THREE.Vector3(),frameBounds={left:0,right:0,top:0,bottom:0};
  function paint(camera){
    frameBounds.left=frameBounds.bottom=Infinity;frameBounds.right=frameBounds.top=-Infinity;
    for(const point of framingPoints){
      frameProjection.copy(point).project(camera);
      frameBounds.left=Math.min(frameBounds.left,frameProjection.x);frameBounds.right=Math.max(frameBounds.right,frameProjection.x);
      frameBounds.bottom=Math.min(frameBounds.bottom,frameProjection.y);frameBounds.top=Math.max(frameBounds.top,frameProjection.y);
    }
    host.dataset.frameBounds=JSON.stringify(frameBounds);
    // HTML type stays sharp at every DPR. Dedicated top/bottom bands never
    // cover the actual canvas; connector lines keep group identity while orbiting.
    const enabled=kit.labels;overlay.hidden=!enabled;svg.style.display=enabled?'':'none';
    host.dataset.labelCount=enabled?'5':'0';host.dataset.labelOverlap='false';host.dataset.labelOverflow='false';
    if(!enabled)return;
    const {width,height}=size(),base=host.getBoundingClientRect();
    const anchors=[-130,130].map(x=>new THREE.Vector3(x,-105,22).project(camera));
    readouts[0].card.style.order=anchors[0].x<=anchors[1].x?'0':'1';readouts[1].card.style.order=anchors[0].x<=anchors[1].x?'1':'0';
    svg.setAttribute('viewBox',`0 0 ${width} ${host.clientHeight}`);
    readouts.forEach((r,i)=>{
      const box=r.card.getBoundingClientRect(),p=anchors[i],x=(p.x+1)*width/2,y=(1-p.y)*height/2+42;
      const endX=box.left-base.left+box.width/2,endY=box.top-base.top;
      lines[i].setAttribute('d',`M ${x} ${y} L ${x} ${Math.max(y,endY-12)} L ${endX} ${endY-4}`);
      lines[i].style.display=p.z>1||p.z< -1||x<0||x>width||y<42||y>height+42?'none':'';
    });
    const rects=[condition,...readouts.map(r=>r.card)].map(e=>e.getBoundingClientRect());
    host.dataset.labelOverflow=String(rects.some(r=>r.left<base.left||r.right>base.right+1||r.top<base.top||r.bottom>base.bottom+1));
    host.dataset.labelOverlap=String(rects.some((a,i)=>rects.slice(i+1).some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)));
  }
  function tick(dt,instant){const moving=model.tick(dt,instant);host.dataset.visualGrowth=JSON.stringify(model.group.userData.growth||{});return moving}
  function frameTime(milliseconds){
    if(quality==='low'||milliseconds<8||milliseconds>180)return;
    samples++;totalFrameTime+=milliseconds;if(milliseconds>38)slowFrames++;
    if(samples>=45){
      host.dataset.frameMs=String(Math.round(totalFrameTime/samples));
      if(slowFrames>25){setQuality('low','frame-budget');const s=size();renderer.setSize(s.width,s.height,false)}
      samples=0;totalFrameTime=0;slowFrames=0;
    }
  }
  function resize(){if(host.clientWidth<520&&quality!=='low')setQuality('low','viewport-budget')}
  function dispose(){
    if(disposed)return;disposed=true;
    model.dispose();scene.remove(fixtures,...lightTargets);
    if(platform.material.map===tableMap){platform.material.map=null;platform.material.needsUpdate=true}
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
    overlay.remove();svg.remove();delete host.dataset.plantFidelity;
  }
  return {update,tick,paint,size,frameTime,resize,dispose,framingPoints,get meshCount(){let count=model.meshCount;fixtures.traverseVisible(object=>{if(object.isMesh)count++});return count}};
}
