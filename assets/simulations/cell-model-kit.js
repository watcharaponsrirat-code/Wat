import * as THREE from '../vendor/three/three.module.js';
import {CELL_ORGANELLES} from './cell-data.js';

// Presentation geometry only: positions and detail never change lesson data.
const FALLBACK={membrane:0xdd8b77,cytoplasm:0xf1cba0,nucleus:0x9b80ca,nucleolus:0xcc5c92,mitochondria:0xd88a42,golgi:0xdb9b48,'rough-er':0x72a3b8,'smooth-er':0xa5b792,ribosomes:0x48526b,lysosomes:0xd09c63,vesicles:0xb5c4cc,centrioles:0xcda253,wall:0x9aad58,vacuole:0x88c8d9,chloroplasts:0x6aa14d};
const IDENTITY=new THREE.Matrix4();
export const cellTransform=(position=[0,0,0],rotation=[0,0,0],scale=[1,1,1])=>new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));

export function createCellModelKit({quality='high',name='cell'}={}){
  const high=quality!=='low',group=new THREE.Group();group.name=name;
  const geometries=new Set(),materials=new Set(),instances=new Set(),parts=new Map(),queued=new Map(),materialCache=new Map(),geometryCache=new Map();
  let disposed=false,finished=false;
  const keep=g=>(geometries.add(g),g);
  const color=id=>CELL_ORGANELLES[id]?.color??FALLBACK[id]??0xaaaaaa;
  const tint=(id,amount=0)=>new THREE.Color(color(id)).lerp(new THREE.Color(amount<0?0x172631:0xffffff),Math.abs(amount));
  function material(id,shade=0,{roughness=.47,metalness=0,clearcoat=.1,opacity=1}={}){
    const key=[id,shade,roughness,metalness,clearcoat,opacity].join(':');
    if(!materialCache.has(key)){
      const value=new THREE.MeshPhysicalMaterial({color:tint(id,shade),roughness,metalness,clearcoat,clearcoatRoughness:.5,side:THREE.DoubleSide,transparent:opacity<1,opacity,depthWrite:opacity===1});
      materials.add(value);materialCache.set(key,value);
    }
    return materialCache.get(key);
  }
  function part(id,anchor){
    if(!parts.has(id))parts.set(id,{id,objects:[],anchor:new THREE.Vector3()});
    const value=parts.get(id);if(anchor)value.anchor.set(...anchor);return value;
  }
  function decorate(mesh,id){
    mesh.name=`${name}-${id}`;mesh.userData.cellOrganelle=id;
    mesh.castShadow=true;mesh.receiveShadow=false;group.add(mesh);part(id).objects.push(mesh);return mesh;
  }
  function add(id,geometry,mat=material(id),matrix=IDENTITY){
    if(finished)throw Error('Cell geometry is already finalized');
    keep(geometry);part(id);const key=id+':'+mat.uuid;
    if(!queued.has(key))queued.set(key,{id,material:mat,items:[]});
    queued.get(key).items.push({geometry,matrix:matrix.clone()});
  }
  function cached(key,make){if(!geometryCache.has(key))geometryCache.set(key,keep(make()));return geometryCache.get(key)}
  const sphere=()=>cached('sphere',()=>new THREE.SphereGeometry(1,high?22:14,high?15:10));
  const bead=()=>cached('bead',()=>new THREE.SphereGeometry(1,high?10:7,high?7:5));
  function ellipsoid(id,position,scale,shade=0,rotation=[0,0,0]){add(id,sphere(),material(id,shade),cellTransform(position,rotation,scale))}
  function beads(id,positions,shade=0){
    if(!positions.length)return;
    const mesh=new THREE.InstancedMesh(bead(),material(id,shade),positions.length),dummy=new THREE.Object3D();
    positions.forEach((p,i)=>{dummy.position.set(p[0],p[1],p[2]);dummy.scale.setScalar(p[3]??1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();instances.add(mesh);decorate(mesh,id);
  }
  function tube(id,points,radius,shade=0,{closed=false,matrix=IDENTITY,segments}={}){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');
    const g=new THREE.TubeGeometry(curve,segments??Math.max(8,points.length*(high?5:3)),radius,high?7:5,closed);
    add(id,g,material(id,shade),matrix);
  }
  // A folded flattened sac. Its width is in the XY plane and thickness in Z.
  function sac(id,points,width,thickness,shade=0,matrix=IDENTITY){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments=high?36:23,sides=high?10:8;
    const p=[],indices=[];
    for(let i=0;i<=segments;i++){
      const u=i/segments,c=curve.getPoint(u),t=curve.getTangent(u),length=Math.hypot(t.x,t.y)||1;
      const taper=.12+.88*Math.sin(Math.PI*u)**.28;
      for(let j=0;j<=sides;j++){
        const a=j/sides*Math.PI*2,q=width*taper*Math.cos(a);
        p.push(c.x-t.y/length*q,c.y+t.x/length*q,c.z+thickness*taper*Math.sin(a));
        if(i<segments&&j<sides){const n=i*(sides+1)+j,b=n+sides+1;indices.push(n,n+1,b,n+1,b+1,b)}
      }
    }
    // Small closed end caps keep the sacks solid when orbited.
    for(const [ring,flip] of [[0,false],[segments,true]]){
      const c=curve.getPoint(ring/segments),center=p.length/3;p.push(c.x,c.y,c.z);
      for(let j=0;j<sides;j++){const a=ring*(sides+1)+j;indices.push(center,flip?a+1:a,flip?a:a+1)}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();add(id,g,material(id,shade),matrix);
  }
  const boundary=(angle,plant=false)=>{
    const c=Math.cos(angle),s=Math.sin(angle),r=plant?(Math.abs(c)**4.5+Math.abs(s)**4.5)**(-1/4.5):1+.035*Math.sin(3*angle)+.025*Math.cos(5*angle);
    return [c*r,s*r];
  };
  function bowl(id,rx,ry,depth,rise,shade=0,plant=false){
    const segments=high?96:56,rings=high?20:13,p=[0,0,depth],indices=[];
    for(let i=1;i<=rings;i++)for(let j=0;j<=segments;j++){
      const r=i/rings,[x,y]=boundary(j/segments*Math.PI*2,plant);p.push(rx*x*r,ry*y*r,depth+rise*r**3);
      const a=1+(i-1)*(segments+1)+j;
      if(j<segments){if(i===1)indices.push(0,a,a+1);else{const b=a-segments-1;indices.push(b,a,a+1,b,a+1,b+1)}}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();add(id,g,material(id,shade));
  }
  function rim(id,rx,ry,z,radius,shade=0,plant=false,scale=1){
    const points=Array.from({length:high?96:56},(_,i)=>{const [x,y]=boundary(i/(high?96:56)*Math.PI*2,plant);return [x*rx*scale,y*ry*scale,z]});
    tube(id,points,radius,shade,{closed:true,segments:high?160:96});
  }
  function band(id,rx,ry,inner,zInner,zOuter,shade=0,plant=false){
    const count=high?96:56,p=[],indices=[];
    for(let i=0;i<=count;i++){
      const [x,y]=boundary(i/count*Math.PI*2,plant);p.push(x*rx*inner,y*ry*inner,zInner,x*rx,y*ry,zOuter);
      if(i<count){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();add(id,g,material(id,shade));
  }
  function shell(id,position,scale,shade=0,matrix=IDENTITY){
    // Sphere is cut across its front (+Z), exposing the inner bowl.
    const g=new THREE.SphereGeometry(1,high?32:20,high?20:13,0,Math.PI*2,Math.acos(.27),Math.PI-Math.acos(.27));
    g.rotateX(Math.PI/2); // Native north pole +Y becomes +Z.
    add(id,g,material(id,shade),matrix.clone().multiply(cellTransform(position,[0,0,0],scale)));
  }
  function nucleus(position,radius){
    const [x,y,z]=position;part('nucleus',[x-radius*.35,y+radius*.46,z+radius*.37]);part('nucleolus',[x+radius*.15,y-radius*.12,z+radius*.6]);
    shell('nucleus',position,[radius,radius*.93,radius*.8],-.14);
    shell('nucleus',[x,y,z+.8],[radius*.94,radius*.874,radius*.75],.12);
    ellipsoid('nucleus',[x,y,z-radius*.08],[radius*.86,radius*.80,radius*.46],-.30);
    const loop=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return [x+Math.cos(a)*radius*.964,y+Math.sin(a)*radius*.896,z+radius*.216]});
    tube('nucleus',loop,1.5,.38,{closed:true,segments:high?80:48});
    for(let i=0;i<4;i++){
      const points=Array.from({length:17},(_,j)=>{
        const a=-1.1+j/16*2.2,dx=-radius*.31+Math.sin(a*1.8+i)*radius*.20+i*radius*.12,dy=Math.cos(a+i*.45)*radius*.43;
        const surface=-radius*.08+radius*.46*Math.sqrt(Math.max(0,1-(dx/(radius*.86))**2-(dy/(radius*.80))**2));
        return [x+dx,y+dy,z+surface+.8+Math.sin(j*.7+i)*.18];
      });
      tube('nucleus',points,.85,.13);
    }
    ellipsoid('nucleolus',[x+radius*.15,y-radius*.12,z+radius*.27],[radius*.30,radius*.28,radius*.30],-.06);
    const nodules=Array.from({length:high?13:9},(_,i)=>{const a=i*2.399963,r=radius*.18;return [x+radius*.15+Math.cos(a)*r,y-radius*.12+Math.sin(a)*r,z+radius*.48+Math.cos(i*1.7)*radius*.035,radius*.055]});
    beads('nucleolus',nodules,.14);
  }
  function mitochondrion(position,scale=[1,1,1],angle=0){
    const matrix=cellTransform(position,[0,0,angle],scale),id='mitochondria';
    const path=Array.from({length:8},(_,i)=>{const u=i/7;return [-24+48*u,5*Math.sin(Math.PI*u),0]});
    sac(id,path,11,8,-.08,matrix);
    sac(id,path.map(p=>[p[0]*.93,p[1],p[2]+5.1]),8.5,2.2,.32,matrix);
    const edge=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return [24*Math.cos(a),5+8.6*Math.sin(a),6.4]});
    tube(id,edge,1.15,.06,{closed:true,matrix,segments:high?70:42});
    for(let i=0;i<7;i++){
      const xx=-17+i*5.5,yy=5*Math.sin((xx+24)/48*Math.PI),sign=i%2?1:-1;
      const points=[[xx-1,yy-sign*7,6.5],[xx+1,yy-sign*4,8.2],[xx-1,yy,8.5],[xx+1,yy+sign*5,7.4]];
      tube(id,points,1.15,-.21,{matrix,segments:high?17:11});
    }
  }
  function golgi(position,scale=1,angle=0){
    const matrix=cellTransform(position,[0,0,angle],[scale,scale,scale]);part('golgi',[position[0],position[1]+8*scale,position[2]+15*scale]);
    for(let i=0;i<6;i++){
      const span=34-i*.9,points=Array.from({length:9},(_,j)=>{const u=j/8;return [-span+2*span*u,9*Math.sin(Math.PI*u)-i*6.2+Math.sin(u*6.28+i)*1.5,i*2.4]});
      sac('golgi',points,3.6,1.9,(i-2)*.055,matrix);
    }
    for(const [x,y,z,s] of [[-38,-3,8,3.8],[-37,-16,13,3.2],[37,-22,13,4.2],[34,-33,15,3.3],[42,-9,8,2.5]])add('golgi',sphere(),material('golgi',.16),matrix.clone().multiply(cellTransform([x,y,z],[0,0,0],[s,s*.8,s*.75])));
  }
  function roughER(position,radius=48,angle=0,scale=1){
    const matrix=cellTransform(position,[0,0,angle],[scale,scale,scale]),dots=[];
    part('rough-er',[position[0]+(radius+12)*scale*Math.cos(angle),position[1]+(radius+12)*scale*Math.sin(angle),position[2]+11]);
    for(let layer=0;layer<5;layer++){
      const r=radius+layer*6.7,points=Array.from({length:13},(_,i)=>{const a=-1.28+i/12*2.63;return [Math.cos(a)*r,Math.sin(a)*r,layer*1.4+Math.sin(a*4+layer)*1.2]});
      sac('rough-er',points,2.8,1.6,(layer-2)*.045,matrix);
      const number=high?27:18;
      for(let i=0;i<number;i++){
        const a=-1.2+i/(number-1)*2.45,ribR=r+Math.sin(i*2.1+layer)*1.2,p=new THREE.Vector3(Math.cos(a)*ribR,Math.sin(a)*ribR,layer*1.4+2.2+Math.sin(a*4+layer)*1.2).applyMatrix4(matrix);
        dots.push([p.x,p.y,p.z,(i%3===0?1.15:.9)*scale]);
      }
    }
    beads('ribosomes',dots,-.10);
    // Attach the ribosome hotspot to an exposed bead on the outer ER fold.
    part('ribosomes',dots[Math.floor(dots.length-(high?27:18)/2)].slice(0,3));
  }
  function smoothER(position,scale=1,angle=0){
    const matrix=cellTransform(position,[0,0,angle],[scale,scale,scale]);
    // This junction lies on the actual tube, including its rotation/scale.
    part('smooth-er',new THREE.Vector3(12,2,3).applyMatrix4(matrix).toArray());
    const paths=[
      [[-27,-11,0],[-17,-6,4],[-8,9,3],[2,15,0],[14,10,2],[25,19,4]],
      [[-22,21,1],[-15,12,3],[-8,9,3],[0,-4,0],[10,-13,3],[25,-10,2]],
      [[-19,-23,1],[-9,-16,0],[0,-4,0],[12,2,3],[25,-1,2],[33,8,0]],
      [[-15,12,3],[-24,6,1],[-31,13,0],[-29,25,2]],
      [[12,2,3],[18,11,0],[14,21,2],[21,29,1]],
      [[-9,-16,0],[-4,-27,2],[6,-30,0],[15,-24,1]],
      [[-27,-11,0],[-32,-3,2],[-24,6,1]]
    ];
    for(let i=0;i<paths.length;i++)tube('smooth-er',paths[i],2.5,(i%3-1)*.07,{matrix});
  }
  function chloroplast(position,scale=1,angle=0){
    const matrix=cellTransform(position,[0,0,angle],[scale,scale,scale]),id='chloroplasts';
    sac(id,[[-29,0,0],[-15,2,0],[0,3,0],[15,2,0],[29,0,0]],14,8,-.18,matrix);
    sac(id,[[-26,0,5],[-13,2,5],[0,3,5],[13,2,5],[26,0,5]],11.5,2.4,.32,matrix);
    const loop=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2;return [28*Math.cos(a),2+11.8*Math.sin(a),6]});
    tube(id,loop,1.1,.04,{closed:true,matrix,segments:high?72:42});
    for(let stack=0;stack<5;stack++){
      const x=-18+stack*9,y=2+(stack%2?3:-2);
      for(let layer=0;layer<4;layer++)add(id,new THREE.CylinderGeometry(4.1,4.1,1.15,high?14:9,1),material(id,layer%2?-.32:-.12),matrix.clone().multiply(cellTransform([x,y,7+layer*1.25],[Math.PI/2,0,0])));
      if(stack<4)tube(id,[[x+2,y,8.5],[x+5,y+3,8.3],[x+7,2+((stack+1)%2?3:-2),8.5]],.75,-.23,{matrix,segments:8});
    }
  }
  function merge(items){
    const positions=[],normals=[],indices=[],v=new THREE.Vector3(),n=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
    for(const {geometry,matrix} of items){
      const p=geometry.attributes.position,normal=geometry.attributes.normal,offset=positions.length/3;normalMatrix.getNormalMatrix(matrix);
      for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);positions.push(v.x,v.y,v.z);n.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();normals.push(n.x,n.y,n.z)}
      if(geometry.index)for(const value of geometry.index.array)indices.push(value+offset);else for(let i=0;i<p.count;i++)indices.push(i+offset);
    }
    const g=keep(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function finish(){
    if(!finished){
      for(const {id,material:mat,items} of queued.values())decorate(new THREE.Mesh(merge(items),mat),id);
      queued.clear();group.updateMatrixWorld(true);
      // Pin every marker to its real triangulated surface, once at creation.
      // A guessed Z above a narrow tube can point at empty space on rotation.
      const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,0,-1);
      for(const entry of parts.values()){
        ray.set(new THREE.Vector3(entry.anchor.x,entry.anchor.y,500),down);
        const surface=ray.intersectObjects(entry.objects,true)[0];
        if(!surface)throw Error(`Missing cell label surface: ${name}/${entry.id}`);
        entry.anchor.copy(surface.point);
      }
      finished=true;
    }
    return {group,organelles:[...parts.values()],dispose(){if(disposed)return;disposed=true;group.removeFromParent();instances.forEach(mesh=>mesh.dispose());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}};
  }
  return {high,group,part,color,tint,material,add,keep,sphere,bead,ellipsoid,beads,tube,sac,bowl,rim,band,shell,nucleus,mitochondrion,golgi,roughER,smoothER,chloroplast,finish};
}
