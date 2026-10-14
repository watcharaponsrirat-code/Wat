import * as THREE from '../vendor/three/three.module.js';
import {createPlantGrowthModel} from './plant-growth-model.js';

// Presentation adapter for G1U1L1 only. The original builder remains the sole
// source of calculated growth, labels and experimental light values.
export function createPlantGrowthStudio({host,scene,kit,renderer,key,rim,platform,edge}) {
  const compact=host.clientWidth<520||(navigator.deviceMemory||8)<=4;
  let quality=compact?'low':'high',slowFrames=0,samples=0,totalFrameTime=0;
  const model=createPlantGrowthModel(scene,{quality});
  host.dataset.plantFidelity='true';host.dataset.qualityReason=compact?'device-budget':'initial';
  const fixtures=new THREE.Group();fixtures.name='bean-laboratory-lights';scene.add(fixtures);
  const geometries=new Set(),materials=new Set();
  function mesh(geometry,material,parent=fixtures){geometries.add(geometry);materials.add(material);const m=new THREE.Mesh(geometry,material);parent.add(m);return m}
  const housing=new THREE.MeshStandardMaterial({color:0x4a6262,metalness:.62,roughness:.34});
  const trim=new THREE.MeshStandardMaterial({color:0xa3b5ad,metalness:.65,roughness:.27});
  const lamps=[];
  for(const [id,x] of [['control',-130],['experiment',130]]){
    const lamp=new THREE.Group();lamp.name=id+'-light-fixture';lamp.position.set(x,197,-15);fixtures.add(lamp);
    const body=mesh(new THREE.CylinderGeometry(28,34,12,48),housing,lamp);body.castShadow=true;
    const ring=mesh(new THREE.TorusGeometry(31,2,8,48),trim,lamp);ring.rotation.x=Math.PI/2;ring.position.y=-5;
    const lensMaterial=new THREE.MeshStandardMaterial({color:0xffeab0,emissive:0xffd06b,emissiveIntensity:1,roughness:.42});
    const lens=mesh(new THREE.CylinderGeometry(29,29,2,48),lensMaterial,lamp);lens.position.y=-7;
    const cord=mesh(new THREE.CylinderGeometry(1.1,1.1,32,8),housing,lamp);cord.position.y=22;
    const rays=new THREE.Group();lamp.add(rays);
    const rayMaterial=new THREE.MeshBasicMaterial({color:0xffdd82,transparent:true,opacity:.7,depthWrite:false});
    for(const [rx,rz] of [[-15,0],[15,0],[0,14]]){
      const shaft=mesh(new THREE.CylinderGeometry(.65,.65,36,6),rayMaterial,rays);shaft.position.set(rx,-37,rz);
      const tip=mesh(new THREE.ConeGeometry(3,9,8),rayMaterial,rays);tip.rotation.z=Math.PI;tip.position.set(rx,-59,rz);
    }
    lamps.push({id,lensMaterial,rays,rayMaterial});
  }
  // Neutral studio illumination is shared by both groups. Visible lamp arrows
  // communicate the existing hours control, without changing growth or shading
  // a plant as though extra experimental conditions had been introduced.
  scene.environmentIntensity=.38;renderer.toneMappingExposure=.95;
  key.intensity=2.5;key.position.set(-190,380,260);key.shadow.normalBias=.35;
  rim.color.setHex(0xc5e6de);rim.intensity=1.65;
  platform.position.y=-138;platform.scale.set(.88,1,.88);platform.material.color.setHex(0x203b39);platform.material.roughness=.86;platform.material.metalness=.08;
  edge.position.y=-130;edge.scale.set(.88,.88,.88);edge.material.color.setHex(0x557c6a);

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
      const sun=kit.items.get(r.id+'Sun'),hours=sun?(sun.s.x-21)/.45:6;
      lamps[i].rays.visible=kit.active.has(r.id+'Light-shaft');lamps[i].rayMaterial.opacity=.35+hours/12*.45;
      lamps[i].lensMaterial.emissiveIntensity=hours/12*1.8;
    });
  }
  function paint(camera){
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
  function dispose(){model.dispose();scene.remove(fixtures);geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());overlay.remove();svg.remove();delete host.dataset.plantFidelity}
  return {update,tick,paint,size,frameTime,resize,dispose,get meshCount(){let count=model.meshCount;fixtures.traverseVisible(object=>{if(object.isMesh)count++});return count}};
}
