import * as THREE from '../vendor/three/three.module.js';
import {createCellModelKit,cellTransform} from './cell-model-kit.js';

export function createAnimalCellModel({quality='high'}={}){
  const k=createCellModelKit({quality,name:'animal-cell'});
  k.part('membrane',[144,40,31]);k.part('cytoplasm',[-88,66,-9]);
  k.bowl('membrane',152,146,-56,88,-.17);
  k.band('membrane',152,146,.94,26,32,.07);
  k.rim('membrane',152,146,32,2.5,.24);
  k.rim('membrane',152,146,27,1.4,-.09,false,.94);
  k.bowl('cytoplasm',152*.94,146*.94,-43,69,.19);

  k.nucleus([-27,-4,-2],43);
  k.roughER([-30,-5,-14],47,.12,.94);
  k.smoothER([65,-60,-6],.95,.25);
  k.golgi([43,83,3],.86,-.22);
  const mitochondria=[[-91,57,3,1.0,-.55],[96,32,2,.94,1.04],[-79,-79,6,1.02,.38],[25,-111,13,.87,-.15],[-10,112,13,.75,.25]];
  for(const [x,y,z,s,a] of mitochondria)k.mitochondrion([x,y,z],[s,s,s],a);
  k.part('mitochondria',[-90,59,16]);

  k.part('lysosomes',[-111,-20,19]);
  for(const [x,y,z,s] of [[-111,-20,6,13],[-93,104,22,9],[83,-100,16,9]]){
    k.ellipsoid('lysosomes',[x,y,z],[s,s*.92,s*.82],-.06);
    const dots=Array.from({length:k.high?12:8},(_,i)=>{const a=i*2.4,r=s*.58;return [x+Math.cos(a)*r,y+Math.sin(a)*r,z+s*.64+Math.sin(i*2.1),s*.1]});
    k.beads('lysosomes',dots,.23);
  }
  k.part('vesicles',[111,-44,20]);
  for(const [x,y,z,s] of [[111,-44,8,12],[-122,25,16,8],[47,121,21,7],[110,74,17,8],[-39,-112,3,7]]){
    k.ellipsoid('vesicles',[x,y,z],[s,s*.93,s*.85],.17);
    k.ellipsoid('vesicles',[x-2,y+2,z+s*.7],[s*.45,s*.42,s*.18],.48);
  }

  // Two perpendicular barrels, each made of nine microtubule triplets.
  k.part('centrioles',[72,-12,23]);
  for(const [position,rotation] of [[[71,-8,6],[.22,-.45,.28]],[[83,-23,9],[1.35,.2,-.62]]]){
    const matrix=cellTransform(position,rotation),microtube=new THREE.CylinderGeometry(.85,.85,26,k.high?8:6,1,true);
    for(let triplet=0;triplet<9;triplet++)for(let member=0;member<3;member++){
      const a=triplet/9*Math.PI*2,offset=(member-1)*1.58,x=Math.cos(a)*6.1-Math.sin(a)*offset,z=Math.sin(a)*6.1+Math.cos(a)*offset;
      k.add('centrioles',microtube,k.material('centrioles',member===1?.14:-.04),matrix.clone().multiply(cellTransform([x,0,z])));
    }
    for(const y of [-10,10]){
      const loop=Array.from({length:28},(_,i)=>{const a=i/28*Math.PI*2;return [Math.cos(a)*5.3,y,Math.sin(a)*5.3]});
      k.tube('centrioles',loop,.55,-.18,{closed:true,matrix,segments:36});
    }
  }
  const free=[];
  for(let i=0;i<(k.high?65:39);i++){
    const a=i*2.399963,r=88+Math.sin(i*3.7)*27,x=Math.cos(a)*r,y=Math.sin(a)*r;
    if((x>40&&y>45)||(x>40&&y<0&&y>-95)||Math.hypot(x+80,y+78)<30)continue;
    free.push([x,y,-24+24*(r/143)**3,1.1+(i%3)*.12]);
  }
  k.beads('ribosomes',free,-.03);
  return k.finish();
}
