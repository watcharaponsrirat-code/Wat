import {C,clamp,rad,vessel,particles,plant,earth} from './models3d-kit.js';

export const grade1={
 G1U1L1(k,v){
  const a=v.t*3,b=a*Math.min(v.light/6,1.3);
  plant(k,'control',-130,55+a*2);plant(k,'experiment',130,55+b*2);
  k.sphere('sun',[150,175,-35],24+v.light, C.gold,{emissive:C.gold,glow:.5});
  k.label('a','แสง 6 ชั่วโมง',[-130,-149,45]);k.label('b','แสง '+v.light+' ชั่วโมง',[130,-149,45]);
  k.values={controlGrowth:a,experimentGrowth:b};
 },
 G1U2L1(k,v){
  const rho=v.m/v.vol,side=Math.cbrt(v.vol)*18,surface=25,bottom=-110;
  vessel(k,'tank',0,(surface+115)/220,0x2eafe3,120,-115,220);
  const y=rho<1?surface+side/2-rho*side:rho===1?-30:bottom+side/2;
  k.box('block',[0,y,0],[side,side,side],C.gold,{roughness:.25});
  k.arrow('weight',[160,90,0],[160,90-Math.min(170,v.m*.6),0],C.red);
  k.label('density','ความหนาแน่น '+rho.toFixed(2),[0,155,0],180);
  k.label('state',rho<1?'ลอย':rho===1?'แขวนลอย':'จม',[0,-150,100],100);
  k.values={density:rho,side,waterSurface:surface,cubeY:y,submergedFraction:Math.min(1,rho)};
 },
 G1U2L2(k,v){
  const structures=[{a:[['He',0,0,0]],b:[]},{a:[['O',-28,0,0],['O',28,0,0]],b:[[0,1]]},{a:[['O',0,0,0],['H',-42,32,0],['H',42,32,0]],b:[[0,1],[0,2]]},{a:[['O',-58,0,0],['C',0,0,0],['O',58,0,0]],b:[[0,1],[1,2]]}];
  const structure=structures[v.kind];
  for(let i=0;i<v.count;i++){
   const x=(i%3-1)*175,y=v.count>3?(i<3?80:-65):20,z=(i%2?1:-1)*20;
   for(let j=0;j<structure.a.length;j++){const [a,X,Y,Z]=structure.a[j],p=[x+X,y+Y,z+Z];k.sphere('atom'+i+'-'+j,p,a==='H'?16:a==='He'?33:27,{He:0xa18ce7,O:0xe7556e,H:0xf1f7fa,C:0x4d6374}[a],{roughness:.2,clearcoat:.8});k.label('symbol'+i+'-'+j,a,[p[0],p[1]+2,p[2]+29],32)}
   for(let j=0;j<structure.b.length;j++){const [a,b]=structure.b[j];const A=structure.a[a].slice(1),B=structure.a[b].slice(1);for(const offset of v.kind===1||v.kind===3?[-5,5]:[0])k.rod('bond'+i+'-'+j+'-'+offset,[x+A[0],y+A[1]+offset,z],[x+B[0],y+B[1]+offset,z],offset?3:5,0xa9bdca,{metalness:.6})}
  }
  k.label('legend',['He','O₂','H₂O','CO₂'][v.kind]+' · '+v.count+' อนุภาค',[0,175,0],190);k.values={particles:v.count,atoms:v.count*structure.a.length};
 },
 G1U3L1(k,v){
  const s=v.zoom*.85;
  if(v.cell)k.sphere('membrane',[0,10,0],[140*s,100*s,90*s],0xf1a4b0,{opacity:.2,roughness:.12});
  else{k.box('wall',[0,5,0],[275*s,190*s,170*s],0x70b978,{opacity:.18});k.box('membrane',[0,5,0],[257*s,173*s,155*s],0xa5d28c,{opacity:.17});k.sphere('vacuole',[25*s,25*s,0],[80*s,55*s,48*s],C.blue,{opacity:.4})}
  k.sphere('nucleus',[-55*s,-25*s,28*s],35*s,C.purple,{roughness:.2});k.sphere('nucleolus',[-52*s,-20*s,56*s],10*s,0x613b91);
  if(!v.cell)for(let i=0;i<7;i++){const a=i*Math.PI*2/7;k.sphere('chloroplast'+i,[105*s*Math.cos(a),68*s*Math.sin(a),-45*s],[19*s,9*s,9*s],0x279466,{rotation:[0,0,a]})}
  k.label('name',v.cell?'เซลล์สัตว์':'เซลล์พืช',[0,145*s,0],150);k.label('nuclearLabel','นิวเคลียส',[-80*s,-88*s,70*s],100);k.values={cell:v.cell,zoom:v.zoom};
 },
 G1U3L2(k,v){
  const t=v.t/100,L=v.mode?v.difference:Math.round(v.difference+(5-v.difference)*t/2),R=v.mode?5:v.difference+5-L,shift=(v.difference-5)/45*t*.22;
  const fills=v.mode?[.55+shift,.55-shift]:[.65,.65];
  for(let i=0;i<2;i++){const x=i?110:-110;vessel(k,'side'+i,x,fills[i],C.blue,95,-115,195);particles(k,'solute'+i+'-',i?R:L,[x,-110+195*fills[i]/2,0],[145,195*fills[i]*.8,95],C.purple,4,v.t/10)}
  k.box('membrane',[0,-15,0],[5,210,185],C.purple,{opacity:.23});
  k.arrow('net',v.mode?[110,140,0]:[-110,140,0],v.mode?[-110,140,0]:[110,140,0],C.gold);
  k.label('process',v.mode?'ออสโมซิส: น้ำผ่านเยื่อ':'การแพร่ของอนุภาค',[0,180,0],230);k.values={left:L,right:R,levels:fills};
 },
 G1U4L1(k,v){
  const step=Math.round(v.t);
  if(step<3){
   k.cylinder('stem',[0,-25,0],9,170,C.green);k.sphere('ovary',[0,-75,0],[50,43,40],0x8cba75,{opacity:.5});k.sphere('ovule',[0,-73,25],15,C.gold);
   for(let i=0;i<6;i++){const a=i*Math.PI/3;k.sphere('petal'+i,[55*Math.cos(a),60,55*Math.sin(a)],[45,9,25],0xe99abb,{rotation:[0,-a,0]})}
   k.cylinder('style',[0,55,0],6,110,0xb98bbe);k.sphere('stigma',[0,111,0],[24,8,24],0xda91ae);
   k.sphere('pollen',[-60+step*30,150-step*18,0],10,C.gold);if(step>0)k.tube('pollenTube',[[0,115,0],[8,65,6],[3,0,8],[0,step===2?-65:-5,20]],3,C.purple);
  }else if(step===3){k.sphere('fruit',[0,0,0],[95,90,80],0xf19c5c,{opacity:.55});particles(k,'seed',8,[0,0,25],[80,100,50],C.soil,9)}
  else{plant(k,'seedling',0,115);k.sphere('seed',[0,-72,22],17,C.soil)}
  k.label('stage',['ถ่ายเรณู','หลอดเรณูงอก','ปฏิสนธิ','ผลและเมล็ด','เมล็ดงอก'][step],[0,-155,30],200);k.values={step};
 },
 G1U4L2(k,v){
  const rate=Math.min(v.light,v.water,v.co2);plant(k,'plant',0,230);
  k.sphere('sun',[-175,140,-40],32,C.gold,{emissive:C.gold,glow:v.light/100});
  if(v.light)k.arrow('light',[-140,125,-30],[-30,75,0],C.gold,1+v.light/30);
  if(v.water)k.arrow('water',[-180,-70,20],[-35,-70,20],C.blue,1+v.water/35);
  if(v.co2)k.arrow('co2',[-175,0,30],[-35,30,20],C.purple,1+v.co2/40);
  particles(k,'oxygen',Math.round(rate/5),[155,90,0],[80,150,65],C.blue,6);
  k.label('o2','ออกซิเจน',[160,-25,20],100);k.label('rate','ดัชนีการสร้างอาหาร '+rate,[0,-155,70],230);k.values={rate};
 },
 G1U4L3(k,v){
  plant(k,'plant',0,240);k.rod('xylem',[-12,-100,25],[-12,150,25],6,C.blue);k.rod('phloem',[12,-100,25],[12,150,25],6,C.gold);
  if(v.route){k.sphere('foodDown',[12,70-v.t*1.7,35],12,C.gold);k.sphere('foodUp',[12,70+v.t*.8,35],10,C.gold)}else k.sphere('water',[-12,-100+v.t*2.5,35],12,C.blue);
  k.label('x','ไซเล็ม',[-95,25,45],90);k.label('p','โฟลเอ็ม',[95,25,45],90);k.values={route:v.route,t:v.t};
 },
 G1U5L1(k,v){
  const melt=clamp(v.q/334),vap=clamp((v.q-752)/2260),temp=v.q<334?0:v.q<752?(v.q-334)/4.18:100;
  vessel(k,'beaker',-35,.65*melt*(1-vap),C.blue,85,-110,190);
  if(melt<1)k.box('ice',[-35,-75,0],[100*(1-melt)**(1/3),55*(1-melt)**(1/3),80*(1-melt)**(1/3)],0xb9edff,{opacity:.8,roughness:.07});
  particles(k,'steam',Math.round(vap*35),[-35,140,0],[130,100,95],0xb9cad5,5);
  k.cylinder('hotplate',[-35,-126,0],103,18,0x415c70);k.ring('heater',[-35,-115,0],73,C.red,{rotation:[Math.PI/2,0,0],emissive:C.red,glow:v.q/3012});
  k.cylinder('thermometer',[150,-10,0],10,210,C.white);k.cylinder('mercury',[150,-110+temp,12],5,Math.max(.1,temp*2),C.red);k.sphere('bulb',[150,-113,12],16,C.red);
  k.label('temp',temp.toFixed(1)+' °C',[150,135,0],110);k.values={melt,vapor:vap,temperature:temp};
 },
 G1U5L2(k,v){
  const avg=(v.hot+20)/2,d=(v.hot-20)/2*Math.exp(-v.t*(v.material?.003:.05)),a=avg+d,b=avg-d;
  k.box('hot',[-150,-15,0],[100,150,115],C.red);k.box('cold',[150,-15,0],[100,150,115],C.blue);k.rod('bridge',[-100,0,0],[100,0,0],17,v.material?C.soil:0xadbcca,{metalness:v.material?.05:.85});
  k.arrow('flow',[-80,105,0],[80,105,0],C.gold,Math.max(.8,d/10));k.label('hotT',a.toFixed(1)+' °C',[-150,95,0]);k.label('coldT',b.toFixed(1)+' °C',[150,95,0]);k.label('bridgeType',v.material?'ฉนวน':'ตัวนำความร้อน',[0,-95,80],150);k.values={hot:a,cold:b};
 },
 G1U6L1(k,v){
  for(const [i,x,p] of [[0,-155,v.a],[1,155,v.b]]){k.cylinder('zone'+i,[x,-105,0],86,25,i?C.green:C.blue);particles(k,'air'+i,10+(p-980)/2,[x,5,0],[125,150,105],i?C.green:C.blue,5);k.label('pressure'+i,p+' hPa',[x,140,0])}
  if(v.a!==v.b)k.arrow('wind',v.a>v.b?[-75,30,0]:[75,30,0],v.a>v.b?[75,30,0]:[-75,30,0],C.gold,2+Math.abs(v.a-v.b)/18);
  k.label('windLabel',v.a===v.b?'ไม่มีความต่างความกด':'ลม: ความกดสูง → ต่ำ',[0,-150,30],220);k.values={difference:v.a-v.b};
 },
 G1U6L2(k,v){
  const e=v.absorb/100,surface=100/(1-e/2),back=surface*e/2;
  earth(k,'earth',[0,-15,0],100);k.sphere('atmosphere',[0,-15,0],120,0x9acbe6,{opacity:.12+e*.15,roughness:.1});
  k.sphere('sun',[-225,150,0],28,C.gold,{emissive:C.gold,glow:1});k.arrow('incoming',[-195,125,0],[-80,40,0],C.gold,4);k.arrow('outgoing',[55,75,0],[120,175,0],C.red,4);
  if(back>0)k.arrow('back',[135,90,25],[80,5,25],C.red,1+back/25);
  k.label('atmosphereLabel','บรรยากาศ',[0,150,-40],130);k.label('radiation','แผ่กลับ '+back.toFixed(1)+' หน่วย',[175,-95,30],170);k.values={surface,back};
 }
};
