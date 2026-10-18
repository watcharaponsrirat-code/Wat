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
  const setText=(node,value)=>{if(node.textContent!==value)node.textContent=value};
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
  const hint=element('span','cellCanvasHint','เลือกหมายเลขเพื่อดูเส้นชี้ · ลากเพื่อหมุน');
  const targetName=element('div','cellTargetName');targetName.hidden=true;targetName.setAttribute('aria-hidden','true');
  host.append(header,svg,overlay,hint,targetName);

  const inspector=element('section','cellInspector');inspector.setAttribute('aria-label','สำรวจส่วนประกอบของเซลล์');
  const info=element('div','cellSelectionInfo');info.setAttribute('aria-live','polite');info.setAttribute('aria-atomic','true');
  const infoCode=element('span','cellSelectionCode','+');infoCode.setAttribute('aria-hidden','true');
  const infoBody=element('div','cellSelectionBody');
  const infoEyebrow=element('span','cellSelectionEyebrow','เริ่มสำรวจ');
  const infoTitle=element('h3','cellSelectionTitle','เลือกส่วนประกอบของเซลล์');
  const infoText=element('p','cellSelectionText','แตะหมายเลขบนแบบจำลอง หรือเลือกชื่อด้านล่าง เพื่อดูตำแหน่งและหน้าที่');
  const visibilityHint=element('p','cellSelectionVisibility');visibilityHint.hidden=true;
  infoBody.append(infoEyebrow,infoTitle,infoText,visibilityHint);info.append(infoCode,infoBody);
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
      button.title=`${code} ${definition.name}`;
      const number=element('span','cellHotspotNumber',code),name=element('span','cellHotspotName',definition.name);number.setAttribute('aria-hidden','true');button.append(number,name);
      // Delegation avoids retaining detached button listeners on model switches.
      overlay.append(button);
      const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.dataset.cellLeader=entry.id;svg.append(line);
      const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');dot.setAttribute('r','3');dot.dataset.cellAnchor=entry.id;svg.append(dot);
      hotspots.set(entry.id,{button,line,dot,entry,index});
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
  // Preview a rail target without changing the selected organelle or its slot.
  on(overlay,'pointerover',event=>{const button=event.target.closest('[data-cell-hotspot]');if(button&&event.pointerType==='mouse'){hovered=button.dataset.cellHotspot;applyHighlight();requestRender?.()}});
  on(overlay,'pointerleave',()=>{if(hovered){clearHover();applyHighlight();requestRender?.()}});

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

  function surfaceVisible(entry,anchor,viewCamera){
    cameraWorld.setFromMatrixPosition(viewCamera.matrixWorld);direction.subVectors(anchor,cameraWorld);
    raycaster.set(cameraWorld,direction.normalize());raycaster.far=Infinity;
    const first=raycaster.intersectObject(active.group,true).find(hit=>visible(hit.object)&&opaque(hit.object));
    // Both identity AND distance must match: a nearer copy of the same
    // organelle, or the reverse of its shell, must not validate a hidden tip.
    return first&&idOf(first.object)===entry.id&&first.point.distanceTo(anchor)<.08*active.group.scale.x;
  }
  function paint(viewCamera=camera){
    if(disposed)return;hideOriginal();
    if(!active||mode!=='3d')return;
    active.group.updateMatrixWorld(true);viewCamera.updateMatrixWorld();
    const width=host.clientWidth,height=host.clientHeight;
    const signature=[...viewCamera.matrixWorld.elements,...viewCamera.projectionMatrix.elements,width,height,active.group.scale.x,labels,selected,hovered].join(',');
    if(!layoutDirty&&signature===lastCamera)return;lastCamera=signature;layoutDirty=false;
    overlay.hidden=!labels;svg.style.display=labels?'':'none';
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const shown=[],focus=selected||hovered;
    // Persistent numbered rails. Camera motion changes only the target point,
    // never the button's side, row, size or order (including during selection).
    const margin=width<600?4:20,top=96,bottom=height-80,rows=Math.ceil(active.organelles.length/2);
    const slots=active.organelles.map((entry,index)=>({x:index<rows?margin:width-margin-44,y:top+(index%rows)*Math.max(44,(bottom-top)/(rows-1))}));
    for(const entry of active.organelles){
      const hotspot=hotspots.get(entry.id);if(!hotspot)continue;
      const {button,line,dot,index}=hotspot;button.hidden=!labels;line.style.display='none';dot.style.display='none';
      if(!labels||width<1||height<1)continue;
      const left=index<rows,w=44,h=44,{x,y}=slots[index];
      button.style.width='44px';button.style.height='44px';button.style.transform=`translate(${x}px,${y}px)`;
      world.copy(entry.anchor);active.group.localToWorld(world);projected.copy(world).project(viewCamera);
      const anchorX=(projected.x+1)*width/2,anchorY=(1-projected.y)*height/2;
      const onscreen=projected.z>=-1&&projected.z<=1&&anchorX>=3&&anchorX<=width-3&&anchorY>=84&&anchorY<=height-30;
      const coveredByLabel=slots.some(slot=>anchorX>slot.x-3&&anchorX<slot.x+47&&anchorY>slot.y-3&&anchorY<slot.y+47);
      const state=!onscreen?'offscreen':!coveredByLabel&&surfaceVisible(entry,world,viewCamera)?'visible':'occluded';
      if(button.dataset.cellVisibility!==state)button.dataset.cellVisibility=state;
      button.classList.toggle('is-previewed',entry.id===focus);
      if(state==='visible'&&entry.id===focus){
        const endX=left?x+w-7:x+7,endY=y+h/2;
        line.setAttribute('d',`M ${anchorX} ${anchorY} L ${endX} ${endY}`);line.style.display='';line.classList.add('is-selected');
        dot.setAttribute('cx',String(anchorX));dot.setAttribute('cy',String(anchorY));dot.style.display='';
      }
      shown.push({id:entry.id,x,y,w,h,anchorX,anchorY,state});
    }
    const selection=shown.find(entry=>entry.id===selected);
    const focused=shown.find(entry=>entry.id===focus);
    targetName.hidden=!focused;
    setText(targetName,focused?`${String(hotspots.get(focus).index+1).padStart(2,'0')} · ${CELL_ORGANELLES[focus].name}`:'');
    setText(hint,focused?.state==='occluded'?'จุดชี้ถูกบัง · หมุนกลับด้านตัดเปิด':focused?.state==='offscreen'?'จุดชี้อยู่นอกกรอบ · ซูมออกเพื่อดูตำแหน่ง':'เลือกหมายเลขเพื่อดูเส้นชี้ · ลากเพื่อหมุน');
    visibilityHint.hidden=!selection||selection.state==='visible';
    setText(visibilityHint,!selection||selection.state==='visible'?'':selection.state==='offscreen'?'ส่วนที่เลือกอยู่นอกกรอบ ลองซูมออกหรือกลับมุมมองด้านหน้า':'จุดชี้ของส่วนนี้ถูกบังจากมุมปัจจุบัน ลองหมุนกลับด้านตัดเปิด');
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
    header.remove();svg.remove();overlay.remove();hint.remove();targetName.remove();inspector.remove();canvas.classList.remove('cellCanSelect');
    delete panel.dataset.cellStudio;
    for(const key of ['cellStudio','cellType','cellSelected','cellOrganelleCount','cellQuality','cellHotspotIds','cellProjectedHotspots','cellHotspotCount'])delete host.dataset[key];
  }
  return {update,paint,setLabels,setMode,resetSelection,dispose,get meshCount(){let count=0;active?.group.traverseVisible(object=>{if(object.isMesh)count++});return count}};
}
