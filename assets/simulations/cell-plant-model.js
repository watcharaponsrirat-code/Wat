import * as THREE from '../vendor/three/three.module.js';
import {createCellModelKit,cellTransform} from './cell-model-kit.js';

export function createPlantCellModel({quality='high'}={}){
  const k=createCellModelKit({quality,name:'plant-cell'});
  k.part('wall',[-157,82,36]);k.part('membrane',[148,-37,31]);k.part('cytoplasm',[-117,126,6]);
  k.bowl('wall',158,176,-64,99,-.18,true);
  k.band('wall',158,176,.943,31,35,.22,true);
  k.rim('wall',158,176,35,3,.34,true);
  k.rim('wall',158,176,31,1.3,-.12,true,.96);
  k.bowl('membrane',149,166,-55,86,-.15,true);
  k.band('membrane',149,166,.95,26,31,.12,true);
  k.rim('membrane',149,166,31,1.8,.25,true);
  k.bowl('cytoplasm',141.5,157.7,-45,71,.06,true);
  // Short cellulose fibers make the substantial cut wall readable on orbit.
  for(let i=0;i<(k.high?40:26);i++){
    const a=i/(k.high?40:26)*Math.PI*2,c=Math.cos(a),s=Math.sin(a),r=(Math.abs(c)**4.5+Math.abs(s)**4.5)**(-1/4.5);
    k.tube('wall',[[149.3*c*r,166.3*s*r,31.6],[153*c*r,170.4*s*r,34.3],[157*c*r,174.8*s*r,35.3]],.48,.01,{segments:4});
  }

  // The large central storage sac displaces the nucleus and other organelles
  // toward the cortical cytoplasm, rather than filling the center with icons.
  k.part('vacuole',[20,33,47]);
  const vacuole=new THREE.SphereGeometry(1,k.high?56:32,k.high?36:22),p=vacuole.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),wave=1+.034*Math.sin(y*5.7+x*2.5)+.018*Math.cos(y*8-x*3.2);
    p.setXYZ(i,x*94*wave,y*122*wave,z*40*(1+.045*Math.sin(y*5)));
  }
  vacuole.computeVertexNormals();
  // SphereGeometry duplicates its pole vertices; two unused duplicates have no
  // incident faces after recomputation and need the analytic pole normal.
  const normal=vacuole.attributes.normal;
  for(let i=0;i<normal.count;i++)if(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))<.5){
    const n=new THREE.Vector3(p.getX(i)/94**2,p.getY(i)/122**2,p.getZ(i)/40**2).normalize();normal.setXYZ(i,n.x,n.y,n.z);
  }
  k.add('vacuole',vacuole,k.material('vacuole',.16,{roughness:.31,clearcoat:.3}),cellTransform([13,23,1],[0,0,-.065]));
  // A broad highlight on the rounded tonoplast remains a surface, not a
  // transparent depth-sorted overlay that can hide the surrounding organelles.
  const fold=Array.from({length:12},(_,i)=>{const a=.35+i/11*1.8;return [13+Math.cos(a)*90,23+Math.sin(a)*115,13+Math.sin(a)*4]});
  k.tube('vacuole',fold,1.3,.35,{segments:k.high?48:30});

  k.nucleus([-83,-78,14],34);
  // Keep cortical ER above the rising cytoplasmic bowl so the folded sacs
  // and their ribosomes remain visible beside the peripheral nucleus.
  k.roughER([-78,-78,30],35,3.18,.80);
  k.smoothER([83,-101,0],.80,-.40);
  k.golgi([42,-128,4],.77,.12);
  for(const [x,y,z,s,a] of [[-111,60,6,.96,1.34],[114,89,14,.96,1.42],[111,-20,8,.88,1.18],[-71,137,16,.90,.08],[-100,-132,13,.76,-.12]])k.chloroplast([x,y,z],s,a);
  k.part('chloroplasts',[-113,60,20]);
  for(const [x,y,z,s,a] of [[-120,-1,6,.72,1.35],[115,-113,16,.67,1.0],[16,154,25,.72,-.12]])k.mitochondrion([x,y,z],[s,s,s],a);
  k.part('mitochondria',[-120,-1,16]);
  const free=[];
  for(let i=0;i<(k.high?60:34);i++){
    const a=i*2.399963,x=Math.cos(a)*(125+Math.sin(i*1.7)*9),y=Math.sin(a)*(143+Math.cos(i*2.1)*9);
    if((x< -55&&y< -30)||(x>15&&y< -95)||Math.abs(y)>148)continue;
    free.push([x,y,9+Math.sin(i*2.1)*4,.95+(i%3)*.1]);
  }
  k.beads('ribosomes',free);
  return k.finish();
}
