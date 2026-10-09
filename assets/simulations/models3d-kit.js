import * as T from '../vendor/three/three.module.js';

export const C={blue:0x2d9bdb,red:0xe96075,green:0x46a881,gold:0xefb643,purple:0x9769c9,ink:0x38596e,white:0xeaf4f6,soil:0x927052,glass:0xa5dae8};
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const rad=v=>v*Math.PI/180;
const V=a=>new T.Vector3(...a);

// Retained scene graph: changing a slider updates existing meshes instead of
// destroying and recreating the WebGL scene. Shared primitives stay on the GPU.
export class ModelKit {
  constructor(group){
    this.group=group;this.items=new Map();this.active=new Set();this.labels=true;
    this.geometries={sphere:new T.SphereGeometry(1,40,28),box:new T.BoxGeometry(1,1,1),cylinder:new T.CylinderGeometry(1,1,1,40),cone:new T.ConeGeometry(1,1,40),torus:new T.TorusGeometry(1,.035,12,80)};
    this.shapeSignatures=new Map();this.pending=false;this.fresh=true;this.values={};
  }
  begin(){this.active.clear();this.values={}}
  mesh(key,type,pos,size,color=C.blue,opts={}){
    this.active.add(key);let item=this.items.get(key);
    if(item&&item.type!==type){this.remove(key);item=null}
    if(!item){
      const material=new T.MeshPhysicalMaterial({color,roughness:.32,metalness:.08,clearcoat:.3,clearcoatRoughness:.3,side:T.DoubleSide});
      const mesh=new T.Mesh(this.geometries[type],material);mesh.castShadow=true;mesh.receiveShadow=true;
      mesh.name=key;this.group.add(mesh);item={mesh,type,p:V(pos),s:V(size),q:new T.Quaternion(),color:new T.Color(color),opacity:1};this.items.set(key,item);
      mesh.position.copy(item.p);mesh.scale.copy(item.s);
    }
    item.mesh.visible=true;item.p.set(...pos);item.s.set(...size);item.color.set(color);
    item.opacity=opts.opacity??1;
    Object.assign(item.mesh.material,{transparent:item.opacity<1,depthWrite:item.opacity>=1,roughness:opts.roughness??.32,metalness:opts.metalness??.08,clearcoat:opts.clearcoat??.3});
    item.mesh.material.emissive.set(opts.emissive??0);item.mesh.material.emissiveIntensity=opts.glow??0;
    item.mesh.castShadow=item.opacity>=1&&opts.shadow!==false;
    item.q.setFromEuler(new T.Euler(...(opts.rotation||[0,0,0])));
    if(opts.quaternion)item.q.copy(opts.quaternion);
    this.pending=true;return item.mesh;
  }
  // Extruded, rounded silhouettes retain organ identity from front and oblique views.
  shape(k,points,depth,pos,color,opts={}){
    const type='shape:'+k,signature=JSON.stringify([points,depth]);
    if(this.shapeSignatures.get(k)!==signature){
      const shape=new T.Shape(),mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
      shape.moveTo(...mid(points[points.length-1],points[0]));
      points.forEach((p,i)=>shape.quadraticCurveTo(...p,...mid(p,points[(i+1)%points.length])));shape.closePath();
      const geometry=new T.ExtrudeGeometry(shape,{depth,steps:1,curveSegments:8,bevelEnabled:true,bevelThickness:2,bevelSize:2,bevelSegments:2});geometry.translate(0,0,-depth/2);
      this.geometries[type]?.dispose();this.geometries[type]=geometry;this.shapeSignatures.set(k,signature);
      if(this.items.has(k))this.items.get(k).mesh.geometry=geometry;
    }
    return this.mesh(k,type,pos,opts.scale||[1,1,1],color,opts);
  }
  sphere(k,p,r,c,o){return this.mesh(k,'sphere',p,Array.isArray(r)?r:[r,r,r],c,o)}
  litSphere(key,p,r,color,light=[1,0,0]){
    this.active.add(key);let item=this.items.get(key);
    if(!item){
      const material=new T.ShaderMaterial({uniforms:{baseColor:{value:new T.Color(color)},sunDirection:{value:V(light).normalize()}},vertexShader:'varying vec3 worldNormal; void main(){worldNormal=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 baseColor; uniform vec3 sunDirection; varying vec3 worldNormal; void main(){float light=max(0.0,dot(normalize(worldNormal),sunDirection));gl_FragColor=vec4(baseColor*(0.025+0.975*light),1.0);\n #include <tonemapping_fragment>\n #include <colorspace_fragment>\n}'});
      const mesh=new T.Mesh(this.geometries.sphere,material);mesh.name=key;this.group.add(mesh);item={mesh,type:'litSphere',p:V(p),s:new T.Vector3(r,r,r),q:new T.Quaternion(),color:new T.Color(color),opacity:1};this.items.set(key,item);mesh.position.copy(item.p);mesh.scale.copy(item.s);
    }
    item.mesh.visible=true;item.p.set(...p);item.s.setScalar(r);item.mesh.material.uniforms.sunDirection.value.set(...light).normalize();this.pending=true;return item.mesh;
  }
  box(k,p,s,c,o){return this.mesh(k,'box',p,s,c,o)}
  cylinder(k,p,r,h,c,o){return this.mesh(k,'cylinder',p,[r,h,r],c,o)}
  ring(k,p,r,c,o){return this.mesh(k,'torus',p,[r,r,r],c,o)}
  rod(k,a,b,r,c,o={}){
    const start=V(a),end=V(b),delta=end.clone().sub(start),length=delta.length();
    if(length<.01)return;
    const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
    return this.mesh(k,'cylinder',start.add(end).multiplyScalar(.5).toArray(),[r,length,r],c,{...o,quaternion:q});
  }
  arrow(k,a,b,c=C.gold,r=3){
    const av=V(a),bv=V(b),d=bv.clone().sub(av);if(d.length()<.1)return;
    const tip=Math.min(18,d.length()*.3),unit=d.clone().normalize(),end=bv.clone().addScaledVector(unit,-tip);
    this.rod(k+'-shaft',a,end.toArray(),r,c);
    this.mesh(k+'-tip','cone',bv.clone().addScaledVector(unit,-tip/2).toArray(),[r*3,tip,r*3],c,{quaternion:new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),unit)});
  }
  tube(k,points,r,c,options={}){
    this.active.add(k);let item=this.items.get(k);const signature=JSON.stringify([points,r]);
    if(!item||item.signature!==signature){
      const curve=new T.CatmullRomCurve3(points.map(V),false,'centripetal');
      const geometry=new T.TubeGeometry(curve,options.segments||80,r,12,false);
      if(!item){
        const mesh=new T.Mesh(geometry,new T.MeshPhysicalMaterial({color:c,roughness:.35,clearcoat:.4}));mesh.name=k;mesh.castShadow=true;mesh.receiveShadow=true;this.group.add(mesh);
        item={mesh,type:'tube',signature,owned:true};this.items.set(k,item);
      }else{
        const old=item.mesh.geometry.attributes.position, next=geometry.attributes.position;
        if(old.count===next.count){item.from=old.array.slice();item.to=next.array.slice();item.progress=0;item.normal=geometry.attributes.normal.array.slice();geometry.dispose()}
        else{item.mesh.geometry.dispose();item.mesh.geometry=geometry}
        item.signature=signature;
      }
    }
    item.mesh.visible=true;item.mesh.material.color.set(c);this.pending=true;return item.mesh;
  }
  label(k,text,p,width=110){
    this.active.add(k);let item=this.items.get(k);
    if(!item||item.text!==text){
      if(item)this.remove(k);
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='500 56px Tahoma,sans-serif';
      canvas.width=Math.min(1600,Math.max(110,Math.ceil(ctx.measureText(text).width)+44));canvas.height=96;
      ctx.fillStyle='rgba(247,253,255,.96)';ctx.beginPath();ctx.roundRect(2,2,canvas.width-4,92,18);ctx.fill();ctx.strokeStyle='rgba(104,163,185,.4)';ctx.lineWidth=3;ctx.stroke();
      ctx.font='500 56px Tahoma,sans-serif';ctx.fillStyle='#234e63';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,51,canvas.width-32);
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      const mesh=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false,transparent:true,toneMapped:false}));mesh.name=k;mesh.renderOrder=20;mesh.userData.labelAspect=canvas.width/96;mesh.scale.set(width,width/mesh.userData.labelAspect,1);this.group.add(mesh);
      item={mesh,type:'label',text,anchor:V(p)};this.items.set(k,item);
    }
    item.anchor.set(...p);item.mesh.position.set(...p);item.mesh.visible=this.labels;
  }
  end(){for(const [key,item] of this.items)if(!this.active.has(key))item.mesh.visible=false;if(this.fresh){this.tick(1,true);this.fresh=false}}
  tick(dt,instant=false){
    const alpha=instant?1:1-Math.exp(-dt*16);let moving=false;
    for(const item of this.items.values()){
      const {mesh}=item;if(!mesh.visible)continue;
      if(item.type==='label')continue;
      if(item.type==='tube'){
        if(item.to){item.progress=Math.min(1,item.progress+dt*5);const t=instant?1:1-(1-item.progress)**3;const a=mesh.geometry.attributes.position.array;for(let i=0;i<a.length;i++)a[i]=item.from[i]+(item.to[i]-item.from[i])*t;mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();if(t===1){item.to=null;item.from=null}else moving=true}
        continue;
      }
      mesh.position.lerp(item.p,alpha);mesh.scale.lerp(item.s,alpha);mesh.quaternion.slerp(item.q,alpha);mesh.material.color?.lerp(item.color,alpha);mesh.material.opacity+=(item.opacity-mesh.material.opacity)*alpha;
      const color=mesh.material.color;const colorDelta=color?Math.abs(color.r-item.color.r)+Math.abs(color.g-item.color.g)+Math.abs(color.b-item.color.b):0;
      if(mesh.position.distanceToSquared(item.p)>.001||mesh.scale.distanceToSquared(item.s)>.001||mesh.quaternion.angleTo(item.q)>.0005||Math.abs(mesh.material.opacity-item.opacity)>.001||colorDelta>.002)moving=true;
    }
    this.pending=moving;return moving;
  }
  setLabels(value){this.labels=value;for(const [key,item] of this.items)if(item.type==='label')item.mesh.visible=value&&this.active.has(key)}
  remove(key){const item=this.items.get(key);if(!item)return;if(item.leader){item.leader.removeFromParent();item.leader.geometry.dispose();item.leader.material.dispose()}item.mesh.removeFromParent();if(item.owned)item.mesh.geometry.dispose();item.mesh.material.map?.dispose();item.mesh.material.dispose();this.items.delete(key)}
  dispose(){for(const key of [...this.items.keys()])this.remove(key);for(const geometry of Object.values(this.geometries))geometry.dispose()}
}

export function vessel(k,id,x,fill=.65,color=C.blue,r=68,bottom=-115,h=190){
  k.cylinder(id+'-base',[x,bottom,0],r,8,C.white,{metalness:.35});
  k.cylinder(id+'-glass',[x,bottom+h/2,0],r,h,C.glass,{opacity:.12,roughness:.08,shadow:false});
  k.ring(id+'-rim',[x,bottom+h,0],r,C.glass,{rotation:[Math.PI/2,0,0]});
  if(fill>.001)k.cylinder(id+'-water',[x,bottom+h*fill/2+4,0],r-4,h*fill,color,{opacity:.32,roughness:.1,shadow:false});
  for(let i=1;i<5;i++)k.rod(id+'-mark'+i,[x+r-14,bottom+i*h/5,r*.35],[x+r,bottom+i*h/5,r*.35],1.2,C.ink);
}
export function particles(k,id,count,center,size,color,r=4,phase=0){
  for(let i=0;i<Math.round(count);i++){
    const a=((i*47)%101)/101,b=((i*29)%97)/97,c=((i*67)%89)/89;
    k.sphere(id+i,[center[0]+(a-.5)*size[0]+Math.sin(phase+i)*2,center[1]+(b-.5)*size[1],center[2]+(c-.5)*size[2]],r,color);
  }
}
export function plant(k,id,x,height=190,z=0){
  k.cylinder(id+'-pot',[x,-103,z],40,55,0xc48962,{roughness:.7});k.cylinder(id+'-soil',[x,-74,z],37,5,C.soil,{roughness:1});
  k.tube(id+'-stem',[[x,-72,z],[x+4,-72+height*.5,z-5],[x,-72+height,z]],4,C.green);
  for(let i=0;i<4;i++){
    const side=i%2?1:-1,y=-55+height*(.25+i*.17);
    k.rod(id+'-branch'+i,[x,y,z],[x+side*30,y+16,z+(i%2?12:-12)],2,C.green);
    k.sphere(id+'-leaf'+i,[x+side*37,y+18,z+(i%2?12:-12)],[27,5,13],i%2?0x3e9e68:0x73ba72,{rotation:[0,side*.5,side*.4],roughness:.65});
  }
}
export function earth(k,id,p,r=65){
  k.sphere(id,p,r,0x286fa3,{roughness:.55});
  const patches=[[.3,.65,.72],[-.5,.4,.75],[.55,-.32,.75],[-.75,-.3,-.4],[.2,.5,-.8]];
  patches.forEach((a,i)=>k.sphere(id+'-land'+i,[p[0]+a[0]*r,p[1]+a[1]*r,p[2]+a[2]*r],[r*.24,r*.17,r*.09],0x69a875,{rotation:[a[1],a[0],.3*i]}));
}
export function bar(k,id,x,value,max,color,label){const h=clamp(value/max)*180;k.box(id,[x,-115+h/2,0],[62,Math.max(.2,h),58],color);k.label(id+'-label',label,[x,-140,50],90)}
export function tree(k,id,x,z=0){k.cylinder(id+'-trunk',[x,-65,z],7,100,C.soil);k.mesh(id+'-crown','cone',[x,-5,z],[45,115,45],C.green,{roughness:.85})}
export function animal(k,id,p,type='mouse',scale=1){
  const [x,y,z]=p,s=scale,col=type==='frog'?C.green:type==='grasshopper'?0x80a84c:0x9e8268;
  const pt=(a,b,c=0)=>[x+a*s,y+b*s,z+c*s];
  if(type==='snake'){
    k.tube(id+'-body',[pt(-40,0),pt(-24,5,14),pt(-2,0,-10),pt(22,6,7),pt(35,9)],5*s,0x6a9b55);
    k.sphere(id+'-head',pt(39,10),[10*s,7*s,8*s],0x79ab63);
    for(const side of [-1,1])k.sphere(id+'-eye'+side,pt(44,13,side*5),1.5*s,C.ink);
    k.rod(id+'-tongue',pt(48,9),pt(57,9),.7*s,C.red);return;
  }
  if(type==='grasshopper'){
    k.sphere(id+'-abdomen',pt(-7,0),[23*s,7*s,8*s],col);k.sphere(id+'-thorax',pt(10,2),[11*s,9*s,9*s],0x63963f);k.sphere(id+'-head',pt(24,6),9*s,col);
    for(const side of [-1,1]){
      k.sphere(id+'-eye'+side,pt(28,10,side*6),2*s,C.ink);
      k.rod(id+'-antenna'+side,pt(27,13,side*3),pt(39,30,side*8),.7*s,C.ink);
      k.tube(id+'-hindleg'+side,[pt(-10,-1,side*6),pt(-20,18,side*15),pt(-36,-15,side*20)],2.8*s,col);
      for(let leg=0;leg<2;leg++)k.tube(id+'-leg'+side+leg,[pt(5+leg*12,-2,side*6),pt(leg*15,-9,side*15),pt(7+leg*15,-16,side*20)],1.4*s,col);
      k.sphere(id+'-wing'+side,pt(-7,5,side*4),[21*s,2*s,5*s],0xb3c887,{rotation:[0,side*.12,-.1]});
    }return;
  }
  if(type==='frog'){
    k.sphere(id+'-body',pt(-4,0),[22*s,12*s,16*s],col);k.sphere(id+'-head',pt(17,6),[15*s,9*s,17*s],0x76b65e);
    for(const side of [-1,1]){
      k.sphere(id+'-eyeBump'+side,pt(20,14,side*10),5*s,0x76b65e);k.sphere(id+'-eye'+side,pt(23,16,side*11),2*s,C.ink);
      k.sphere(id+'-thigh'+side,pt(-18,-2,side*17),[12*s,8*s,10*s],C.green);
      k.tube(id+'-hindleg'+side,[pt(-18,-3,side*17),pt(-29,-11,side*22),pt(-7,-14,side*24)],3*s,C.green);
      k.tube(id+'-foreleg'+side,[pt(14,0,side*12),pt(21,-10,side*19),pt(30,-13,side*20)],2.5*s,C.green);
      for(let toe=0;toe<3;toe++)k.rod(id+'-toe'+side+toe,pt(30,-13,side*20),pt(37,-14,side*(16+toe*4)),.9*s,C.green);
    }return;
  }
  k.sphere(id+'-body',pt(0,0),[24*s,14*s,13*s],col);k.sphere(id+'-head',pt(24,6),13*s,col);
  for(const side of [-1,1]){k.sphere(id+'-eye'+side,pt(31,11,side*8),2*s,0x203747);k.rod(id+'-leg'+side,pt(0,0,side*8),pt(-13,-16,side*18),3*s,col);k.sphere(id+'-ear'+side,pt(21,19,side*8),7*s,0xd4aa9b)}
  k.tube(id+'-tail',[pt(-21,1),pt(-38,-5,5),pt(-52,1,10)],1.6*s,0xc3a294);
}
