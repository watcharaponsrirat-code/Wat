import * as THREE from '../vendor/three/three.module.js';

// One reusable botanical master, in the existing plant's local coordinates.
// Shape morphs describe individual blades, never experimental growth or height.
export function createBeanLeafMaster(keepGeometry) {
  function surface(u,v,variant=0) {
    const arch=Math.sin(Math.PI*u),side=Math.abs(v);
    const width=1.05-.98*u+26.4*Math.pow(Math.max(0,arch),.86)*(1.13-.43*u);
    const vascularPhase=(u-.20*(.75*side+.25*side*side)-.09)*Math.PI/.13;
    const lamina=.42*Math.sin(vascularPhase)**2*arch*Math.sin(Math.PI*side);
    let x=66*u;
    let y=11.5*arch-7.2*v*v*arch+1.8*Math.sin(u*Math.PI*2)*v+2*u-6*u*u+lamina;
    let z=width*v*(1+.08*v*Math.sin(u*Math.PI*2));
    y+=.7*Math.sin(u*5.6*Math.PI+v)*side**4*arch;
    if(variant===1){y+=3.4*arch*v*v+1.8*v*arch*u-2.8*u**3;z*=1-.1*arch*(.5+.5*side)}
    if(variant===2){x+=1.4*v*arch;y+=2.2*arch*v+2.6*Math.sin(Math.PI*2*u);z*=1+.14*v*arch}
    return new THREE.Vector3(x,y,z);
  }
  function blade(longitudinal,lateral,variant) {
    const positions=[],uvs=[],colors=[],indices=[],sheet=(longitudinal+1)*(lateral+1);
    for(let skin=0;skin<2;skin++)for(let i=0;i<=longitudinal;i++)for(let j=0;j<=lateral;j++){
      const u=i/longitudinal,v=2*j/lateral-1,p=surface(u,v,variant);
      if(skin)p.y-=.06+.32*Math.sin(Math.PI*u)*(1-v*v);
      positions.push(p.x,p.y,p.z);uvs.push(u,j/lateral);
      const shade=.94+.06*(1-Math.abs(v));
      colors.push(shade*(skin?.86:1),shade*(skin?.93:1),shade*(skin?.72:.94));
      if(i<longitudinal&&j<lateral){
        const a=skin*sheet+i*(lateral+1)+j,b=a+lateral+1;
        if(skin)indices.push(a,b,a+1,a+1,b,b+1);else indices.push(a,a+1,b,a+1,b+1,b);
      }
    }
    const edge=(a,b)=>indices.push(a,b,a+sheet,b,b+sheet,a+sheet);
    for(let i=0;i<longitudinal;i++){const a=i*(lateral+1),b=a+lateral+1;edge(a,b);edge(b+lateral,a+lateral)}
    for(let j=0;j<lateral;j++){edge(j+1,j);const a=longitudinal*(lateral+1)+j;edge(a,a+1)}
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(positions.length),3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
  }
  function midrib(segments,sides,variant){
    const path=new THREE.CatmullRomCurve3(Array.from({length:29},(_,i)=>{
      // Keep the narrowing rib seated in the lamina through its entire length.
      const u=i/28,p=surface(u*.98,0,variant);p.y+=.23*(1-.78*u);return p;
    }));
    const geometry=new THREE.TubeGeometry(path,segments,.46,sides,false),p=geometry.attributes.position;
    for(let i=0;i<=segments;i++){
      const u=i/segments,center=path.getPointAt(u),taper=1-.78*u;
      for(let j=0;j<=sides;j++){
        const n=i*(sides+1)+j;
        p.setXYZ(n,center.x+(p.getX(n)-center.x)*taper,center.y+(p.getY(n)-center.y)*taper,center.z+(p.getZ(n)-center.z)*taper);
      }
    }
    geometry.computeVertexNormals();return geometry;
  }
  function withShapes(factory){
    const master=factory(0);master.morphTargetsRelative=true;
    master.morphAttributes.position=[];master.morphAttributes.normal=[];
    for(const variant of [1,2]){
      const shape=factory(variant);
      for(const key of ['position','normal']){
        const base=master.attributes[key].array,values=shape.attributes[key].array,delta=new Float32Array(base.length);
        for(let i=0;i<delta.length;i++)delta[i]=values[i]-base[i];
        const attribute=new THREE.Float32BufferAttribute(delta,3);attribute.name=variant===1?'curl':'asymmetry';
        master.morphAttributes[key].push(attribute);
      }
      shape.dispose();
    }
    master.computeBoundingBox();master.computeBoundingSphere();return keepGeometry(master);
  }
  const leaves={high:withShapes(v=>blade(56,20,v)),low:withShapes(v=>blade(32,12,v))};
  const ribs={high:withShapes(v=>midrib(48,6,v)),low:withShapes(v=>midrib(28,5,v))};
  const weights=[[.78,.12],[.12,.72],[.42,.10],[.20,.48]];
  function individualize(mesh){
    const shape={morphTargetInfluences:[0,0]};
    for(let i=0;i<mesh.count;i++){
      shape.morphTargetInfluences=weights[i];mesh.setMorphAt(i,shape);
    }
    mesh.morphTexture.needsUpdate=true;
  }
  return {leaves,ribs,individualize};
}
