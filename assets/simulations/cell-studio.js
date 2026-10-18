import * as THREE from '../vendor/three/three.module.js';
import {createAnimalCellModel} from './cell-animal-model.js';
import {createPlantCellModel} from './cell-plant-model.js';
import {CELL_ORGANELLES, CELL_TYPES} from './cell-data.js';

// Presentation and interaction only. The lesson builder still owns its values.
export function createCellStudio({host,scene,kit,renderer,canvas,camera,requestRender}) {
  const panel=host.closest('.simPanel'),studio=host.closest('.simStudio');
  const quality=host.clientWidth<600||(navigator.deviceMemory||8)<=4?'low':'high';
  const cache=new Map(),hotspots=new Map(),listButtons=new Map(),highlighted=new Map();
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),world=new THREE.Vector3();
  const cameraWorld=new THREE.Vector3(),direction=new THREE.Vector3(),projected=new THREE.Vector3();
  let active=null,type='',selected='',hovered='',labels=kit.labels!==false,mode='3d',disposed=false;
  let gesture=null,lastCamera=null,layoutDirty=true,suppressHoverUntil=0;
  const pointers=new Set(),listeners=[];
  panel.dataset.cellStudio='true';host.dataset.cellStudio='true';host.dataset.cellSelected='';

  const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node};
  const cssColor=value=>typeof value==='number'?`#${value.toString(16).padStart(6,'0')}`:value||'#b7d8d4';
  const on=(target,event,callback,options)=>{target.addEventListener(event,callback,options);listeners.push(()=>target.removeEventListener(event,callback,options))};
  const header=element('div','cellModelHeader');
  const heading=element('div','cellModelHeading');
  const eyebrow=element('span','cellModelEyebrow','CELL EXPLORER');
  const title=element('strong','cellModelTitle');
  heading.append(eyebrow,title);
  const modelNote=element('span','cellModelNote','แบบจำลองตัดเปิด');
  const switcher=element('div','cellTypeSwitch');switcher.setAttribute('role','group');switcher.setAttribute('aria-label','ชนิดของเซลล์');
  for(const [id,name] of [['plant','พืช'],['animal','สัตว์']]){const button=element('button','',name);button.type='button';button.dataset.cellTypeSwitch=id;button.setAttribute('aria-label',`แสดงเซลล์${name}`);button.setAttribute('aria-pressed','false');switcher.append(button)}
  header.append(heading,modelNote,switcher);
  const overlay=element('div','cellHotspots');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('cellLeaders');svg.setAttribute('aria-hidden','true');
  const hint=element('span','cellCanvasHint','หมุนดูรอบด้าน · แตะส่วนประกอบเพื่อสำรวจ');
  host.append(header,svg,overlay,hint);

  const inspector=element('section','cellInspector');inspector.setAttribute('aria-label','สำรวจส่วนประกอบของเซลล์');
  const info=element('div','cellSelectionInfo');info.setAttribute('aria-live','polite');info.setAttribute('aria-atomic','true');
  const infoCode=element('span','cellSelectionCode','+');infoCode.setAttribute('aria-hidden','true');
  const infoBody=element('div','cellSelectionBody');
  const infoEyebrow=element('span','cellSelectionEyebrow','เริ่มสำรวจ');
  const infoTitle=element('h3','cellSelectionTitle','เลือกส่วนประกอบของเซลล์');
  const infoText=element('p','cellSelectionText','แตะหมายเลขบนแบบจำลอง หรือเลือกชื่อด้านล่าง เพื่อดูตำแหน่งและหน้าที่');
  infoBody.append(infoEyebrow,infoTitle,infoText);info.append(infoCode,infoBody);
  const clear=element('button','cellClear','ล้างการเลือก');clear.type='button';clear.dataset.cellClear='';clear.hidden=true;
  const infoRow=element('div','cellSelectionRow');infoRow.append(info,clear);
  const listHead=element('div','cellListHead');
  const listTitle=element('h3','','ส่วนประกอบของเซลล์'),count=element('span','cellListCount');listHead.append(listTitle,count);
  const list=element('div','cellOrganelleList');list.setAttribute('role','group');list.setAttribute('aria-label','เลือกส่วนประกอบเพื่ออ่านหน้าที่');
  inspector.append(infoRow,listHead,list);studio.append(inspector);
  on(clear,'click',()=>resetSelection());
  on(switcher,'click',event=>{const button=event.target.closest('[data-cell-type-switch]'),control=panel.querySelector('[data-sim-control="cell"]');if(!button||!control)return;control.value=button.dataset.cellTypeSwitch==='animal'?'1':'0';control.dispatchEvent(new Event('change',{bubbles:true}))});

  function hideOriginal(){
    for(const item of kit.items.values()){if(item.mesh)item.mesh.visible=false;if(item.leader)item.leader.visible=false}
  }
  function idOf(object){for(let node=object;node&&node!==active?.group.parent;node=node.parent)if(node.userData?.cellOrganelle)return node.userData.cellOrganelle;return ''}
  function visible(object){for(let node=object;node;node=node.parent)if(!node.visible)return false;return true}
  function opaque(object){
    const materials=Array.isArray(object.material)?object.material:[object.material];
    return materials.some(material=>material&&material.visible!==false&&(!material.transparent||material.opacity>=.78));
  }
  function restoreHighlight(){
    for(const [mesh,saved] of highlighted){mesh.material=saved.original;for(const material of saved.clones)material.dispose()}
    highlighted.clear();
  }
  function applyHighlight(){
    restoreHighlight();
    if(!active)return;
    for(const entry of active.organelles){
      if(entry.id!==selected&&entry.id!==hovered)continue;
      const color=new THREE.Color(CELL_ORGANELLES[entry.id]?.color||'#f8ce78');
      const seen=new Set();
      for(const root of entry.objects)root.traverse(object=>{
        if(!object.isMesh||seen.has(object)||highlighted.has(object))return;seen.add(object);
        const original=object.material,source=Array.isArray(original)?original:[original];
        const clones=source.map(material=>{
          const clone=material.clone();
          if(clone.emissive){clone.emissive.copy(color);clone.emissiveIntensity=entry.id===selected ? .42 : .22}
          else if(clone.color)clone.color.lerp(color,entry.id===selected ? .28 : .15);
          return clone;
        });
        highlighted.set(object,{original,clones});object.material=Array.isArray(original)?clones:clones[0];
      });
    }
  }
  function updateSelectionInfo(){
    const definition=CELL_ORGANELLES[selected],index=active?.organelles.findIndex(entry=>entry.id===selected)??-1;
    host.dataset.cellSelected=selected;clear.hidden=!selected;
    info.classList.toggle('has-selection',Boolean(definition));
    infoCode.textContent=definition?String(index+1).padStart(2,'0'):'+';
    infoCode.style.setProperty('--cell-color',cssColor(definition?.color));
    infoEyebrow.textContent=definition?'กำลังสำรวจ':'เริ่มสำรวจ';
    infoTitle.textContent=definition?.name||'เลือกส่วนประกอบของเซลล์';
    infoText.textContent=definition?.description||'แตะหมายเลขบนแบบจำลอง หรือเลือกชื่อด้านล่าง เพื่อดูตำแหน่งและหน้าที่';
    for(const [id,button] of listButtons)button.setAttribute('aria-pressed',String(id===selected));
    for(const [id,{button}] of hotspots){button.classList.toggle('is-selected',id===selected);button.setAttribute('aria-pressed',String(id===selected))}
    layoutDirty=true;
  }
  function clearHover(){hovered='';canvas.classList.remove('cellCanSelect')}
  function select(id){
    if(disposed||!active?.organelles.some(entry=>entry.id===id))return;
    selected=id;clearHover();applyHighlight();updateSelectionInfo();requestRender?.();
  }
  function resetSelection(){
    if(disposed)return;selected='';clearHover();restoreHighlight();updateSelectionInfo();requestRender?.();
  }
  function rebuildUI(){
    hotspots.clear();listButtons.clear();overlay.replaceChildren();svg.replaceChildren();list.replaceChildren();
    active.organelles.forEach((entry,index)=>{
      const definition=CELL_ORGANELLES[entry.id];if(!definition)return;
      const code=String(index+1).padStart(2,'0');
      const button=element('button','cellHotspot');button.type='button';button.dataset.cellHotspot=entry.id;
      button.setAttribute('aria-label',`${code} ${definition.name}`);button.setAttribute('aria-pressed','false');button.style.setProperty('--cell-color',cssColor(definition.color));
      const number=element('span','cellHotspotNumber',code),name=element('span','cellHotspotName',definition.name);number.setAttribute('aria-hidden','true');button.append(number,name);
      // Delegation avoids retaining detached button listeners on model switches.
      overlay.append(button);
      const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.dataset.cellLeader=entry.id;svg.append(line);
      const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('r','3');dot.dataset.cellAnchor=entry.id;svg.append(dot);
      hotspots.set(entry.id,{button,line,dot,entry});
      const item=element('button','cellOrganelleButton');item.type='button';item.dataset.cellOrganelle=entry.id;item.setAttribute('aria-pressed','false');item.style.setProperty('--cell-color',cssColor(definition.color));
      const itemCode=element('span','cellOrganelleCode',code);itemCode.setAttribute('aria-hidden','true');item.append(itemCode,element('span','cellOrganelleName',definition.name));
      list.append(item);listButtons.set(entry.id,item);
    });
    title.textContent=CELL_TYPES[type]?.name||(type==='plant'?'เซลล์พืช':'เซลล์สัตว์');
    for(const button of switcher.children)button.setAttribute('aria-pressed',String(button.dataset.cellTypeSwitch===type));
    count.textContent=`${active.organelles.length} ส่วนประกอบ`;
    updateSelectionInfo();
  }
  on(overlay,'click',event=>{const button=event.target.closest('[data-cell-hotspot]');if(button)select(button.dataset.cellHotspot)});
  on(list,'click',event=>{const button=event.target.closest('[data-cell-organelle]');if(button)select(button.dataset.cellOrganelle)});

  function update(values=kit.values){
    if(disposed)return;hideOriginal();
    const next=Number(values.cell)===1?'animal':'plant';
    if(next!==type){
      restoreHighlight();selected='';clearHover();if(active)active.group.visible=false;
      if(!cache.has(next)){
        const model=(next==='animal'?createAnimalCellModel:createPlantCellModel)({quality});
        model.group.name=model.group.name||`cell-${next}-detail`;scene.add(model.group);cache.set(next,model);
      }
      type=next;active=cache.get(type);active.group.visible=mode==='3d';rebuildUI();
    }
    // Preserve the existing slider's exact 1:2 visual enlargement ratio.
    const zoom=Number(values.zoom);active.group.scale.setScalar(Number.isFinite(zoom)?THREE.MathUtils.clamp(zoom,1,2):1);
    active.group.updateMatrixWorld(true);
    host.dataset.cellType=type;host.dataset.cellOrganelleCount=String(active.organelles.length);host.dataset.cellQuality=quality;
    layoutDirty=true;requestRender?.();
  }
  function pick(clientX,clientY){
    if(!active||mode!=='3d')return '';
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return '';
    pointer.set((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);
    if(Math.abs(pointer.x)>1||Math.abs(pointer.y)>1)return '';
    camera.updateMatrixWorld();active.group.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObject(active.group,true).filter(hit=>visible(hit.object)&&CELL_ORGANELLES[idOf(hit.object)]);
    // A translucent envelope must not intercept the organelles visible inside it.
    const solid=hits.find(hit=>opaque(hit.object));return idOf((solid||hits[0])?.object);
  }
  on(canvas,'pointerdown',event=>{
    pointers.add(event.pointerId);
    if(!gesture)gesture={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,multi:false};
    if(pointers.size>1)gesture.multi=true;
    if(hovered){clearHover();applyHighlight();requestRender?.()}
  },true);
  on(canvas,'pointermove',event=>{
    if(gesture){if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>6)gesture.moved=true;return}
    if(event.pointerType!=='mouse'||event.buttons||performance.now()<suppressHoverUntil)return;
    const next=pick(event.clientX,event.clientY);if(next===hovered)return;
    hovered=next;canvas.classList.toggle('cellCanSelect',Boolean(next));applyHighlight();requestRender?.();
  });
  on(canvas,'pointerup',event=>{
    const current=gesture;pointers.delete(event.pointerId);
    if(current?.moved||current?.multi)suppressHoverUntil=performance.now()+250;
    if(current&&current.id===event.pointerId&&!current.moved&&!current.multi&&Math.hypot(event.clientX-current.x,event.clientY-current.y)<=6){const id=pick(event.clientX,event.clientY);if(id)select(id)}
    if(!pointers.size)gesture=null;
  },true);
  const cancelPointer=event=>{pointers.delete(event.pointerId);if(gesture)gesture.multi=true;if(!pointers.size)gesture=null};
  on(canvas,'pointercancel',cancelPointer,true);on(canvas,'lostpointercapture',cancelPointer,true);
  on(canvas,'pointerleave',()=>{if(!gesture&&hovered){clearHover();applyHighlight();requestRender?.()}});

  function occluded(entry,anchor){
    cameraWorld.setFromMatrixPosition(camera.matrixWorld);direction.subVectors(anchor,cameraWorld);const distance=direction.length();
    raycaster.set(cameraWorld,direction.normalize());raycaster.far=Math.max(0,distance-4*active.group.scale.x);
    const blocked=raycaster.intersectObject(active.group,true).some(hit=>visible(hit.object)&&idOf(hit.object)!==entry.id&&opaque(hit.object));
    raycaster.far=Infinity;return blocked;
  }
  function paint(viewCamera=camera){
    if(disposed)return;hideOriginal();
    if(!active||mode!=='3d')return;
    active.group.updateMatrixWorld(true);viewCamera.updateMatrixWorld();
    const width=host.clientWidth,height=host.clientHeight;
    const signature=[...viewCamera.matrixWorld.elements,...viewCamera.projectionMatrix.elements,width,height,active.group.scale.x,labels,selected].join(',');
    if(!layoutDirty&&signature===lastCamera)return;lastCamera=signature;layoutDirty=false;
    overlay.hidden=!labels;svg.style.display=labels?'':'none';
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const placed=[],shown=[];
    const entries=[...active.organelles].sort((a,b)=>Number(b.id===selected)-Number(a.id===selected));
    for(const entry of entries){
      const hotspot=hotspots.get(entry.id);if(!hotspot)continue;
      const {button,line,dot}=hotspot;button.hidden=true;line.style.display='none';dot.style.display='none';
      if(!labels||width<1||height<1)continue;
      world.copy(entry.anchor);active.group.localToWorld(world);projected.copy(world).project(viewCamera);
      const anchorX=(projected.x+1)*width/2,anchorY=(1-projected.y)*height/2;
      if(projected.z< -1||projected.z>1||anchorX<8||anchorX>width-8||anchorY<84||anchorY>height-36||occluded(entry,world))continue;
      const isSelected=entry.id===selected,w=isSelected?Math.min(220,width-32):44;
      button.style.width=`${w}px`;button.style.visibility='hidden';button.hidden=false;
      const h=Math.max(44,button.offsetHeight);let best=null;
      const offsets=isSelected?[[w/2+22,0],[-w/2-22,0],[0,-h/2-28],[0,h/2+28]]:[[28,-28],[-28,-28],[28,28],[-28,28],[0,-52],[52,0],[-52,0],[0,52],[74,-42],[-74,-42]];
      for(const [dx,dy] of offsets){
        const x=THREE.MathUtils.clamp(anchorX+dx-w/2,8,Math.max(8,width-w-8)),y=THREE.MathUtils.clamp(anchorY+dy-h/2,84,Math.max(84,height-h-36));
        const rect={x,y,w,h};
        if(placed.some(other=>x<other.x+other.w+5&&x+w+5>other.x&&y<other.y+other.h+5&&y+h+5>other.y))continue;
        const score=(x+w/2-anchorX)**2+(y+h/2-anchorY)**2;if(!best||score<best.score)best={...rect,score};
      }
      if(!best){button.hidden=true;continue}
      button.style.transform=`translate(${best.x.toFixed(1)}px,${best.y.toFixed(1)}px)`;button.style.visibility='';
      const endX=THREE.MathUtils.clamp(anchorX,best.x+6,best.x+w-6),endY=THREE.MathUtils.clamp(anchorY,best.y+6,best.y+h-6);
      line.setAttribute('d',`M ${anchorX.toFixed(1)} ${anchorY.toFixed(1)} L ${endX.toFixed(1)} ${endY.toFixed(1)}`);line.style.display='';line.classList.toggle('is-selected',isSelected);
      dot.setAttribute('cx',anchorX.toFixed(1));dot.setAttribute('cy',anchorY.toFixed(1));dot.style.display='';
      placed.push(best);shown.push({id:entry.id,x:best.x,y:best.y,w,h,anchorX,anchorY});
    }
    host.dataset.cellHotspotIds=JSON.stringify(shown.map(entry=>entry.id));host.dataset.cellProjectedHotspots=JSON.stringify(shown);
    host.dataset.cellHotspotCount=String(shown.length);host.dataset.labelCount=String(shown.length);host.dataset.labelOverlap='false';host.dataset.labelOverflow='false';
  }
  function setLabels(value){labels=Boolean(value);layoutDirty=true;overlay.hidden=!labels;svg.style.display=labels?'':'none';requestRender?.()}
  function setMode(value){
    mode=value;inspector.hidden=value!=='3d';header.hidden=value!=='3d';hint.hidden=value!=='3d';overlay.hidden=value!=='3d'||!labels;svg.style.display=value==='3d'&&labels?'':'none';
    if(active)active.group.visible=value==='3d';layoutDirty=true;
    if(value!=='3d'){clearHover();pointers.clear();gesture=null;applyHighlight()}
    requestRender?.();
  }
  function dispose(){
    if(disposed)return;disposed=true;restoreHighlight();listeners.forEach(remove=>remove());pointers.clear();gesture=null;
    for(const model of cache.values()){scene.remove(model.group);model.dispose()}cache.clear();
    header.remove();svg.remove();overlay.remove();hint.remove();inspector.remove();canvas.classList.remove('cellCanSelect');
    delete panel.dataset.cellStudio;
    for(const key of ['cellStudio','cellType','cellSelected','cellOrganelleCount','cellQuality','cellHotspotIds','cellProjectedHotspots','cellHotspotCount'])delete host.dataset[key];
  }
  return {update,paint,setLabels,setMode,resetSelection,dispose,get meshCount(){let count=0;active?.group.traverseVisible(object=>{if(object.isMesh)count++});return count}};
}
