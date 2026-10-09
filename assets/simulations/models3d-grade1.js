import {C,clamp,rad,vessel,particles,plant,earth} from './models3d-kit.js';

// Context, leader lines and flow arrows are part of each model so its meaning
// remains recognizable when the learner changes a control or rotates the scene.
const leader=(k,id,a,b)=>k.rod(id,a,b,1,0xb9d4df,{shadow:false});
const ellipse=(x,y,z,rx,ry)=>Array.from({length:41},(_,i)=>{const a=i*Math.PI/20;return [x+rx*Math.cos(a),y+ry*Math.sin(a),z]});
const blend=(a,b,t)=>{const out=[16,8,0].map(shift=>Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t));return (out[0]<<16)|(out[1]<<8)|out[2]};

export const grade1={
 G1U1L1(k,v){
  const a=v.t*3,b=a*Math.min(v.light/6,1.3);
  plant(k,'control',-130,55+a*2);plant(k,'experiment',130,55+b*2);
  for(const [id,x,hours,growth] of [['control',-130,6,a],['experiment',130,v.light,b]]){
   k.sphere(id+'Sun',[x,175,-40],21+hours*.45,C.gold,{emissive:C.gold,glow:hours/12});
   if(hours)k.arrow(id+'Light',[x,150,-30],[x,110,-15],C.gold,1.5);
   k.rod(id+'Ruler',[x-64,-74,0],[x-64,112,0],1.2,C.white);
   for(let i=0;i<5;i++)k.rod(id+'Tick'+i,[x-64,-74+i*42,0],[x-54,-74+i*42,0],1,C.white);
   k.label(id+'Group',id==='control'?'กลุ่มเปรียบเทียบ':'กลุ่มทดลอง',[x,-122,62],140);
   k.label(id+'LightLabel','แสง '+hours+' ชม./วัน',[x,-158,62],125);
  }
  k.label('same','น้ำ · ดิน · พันธุ์เหมือนกัน',[0,228,0],230);
  k.values={controlGrowth:a,experimentGrowth:b};
 },
 G1U2L1(k,v){
  const rho=v.m/v.vol,side=Math.cbrt(v.vol)*18,surface=25,bottom=-110;
  vessel(k,'tank',0,(surface+115)/220,0x2eafe3,120,-115,220);
  const y=rho<1?surface+side/2-rho*side:rho===1?-30:bottom+side/2;
  k.box('block',[0,y,0],[side,side,side],C.gold,{roughness:.25});
  k.arrow('weight',[157,88,0],[157,88-Math.min(130,v.m*.45),0],C.red);
  k.label('weightLabel','น้ำหนัก',[184,-84,20],85);
  leader(k,'waterLeader',[-185,27,25],[-111,surface,25]);
  k.label('waterLabel','ผิวน้ำ',[-190,58,25],90);
  k.label('density','วัตถุ: '+rho.toFixed(2)+' g/cm³',[0,157,0],215);
  k.label('state',rho<1?'ลอย':rho===1?'แขวนลอย':'จม',[0,-153,110],100);
  k.values={density:rho,side,waterSurface:surface,cubeY:y,submergedFraction:Math.min(1,rho)};
 },
 G1U2L2(k,v){
  const structures=[{a:[['He',0,0,0]],b:[]},{a:[['O',-28,0,0],['O',28,0,0]],b:[[0,1]]},{a:[['O',0,0,0],['H',-42,32,0],['H',42,32,0]],b:[[0,1],[0,2]]},{a:[['O',-58,0,0],['C',0,0,0],['O',58,0,0]],b:[[0,1],[1,2]]}];
  const structure=structures[v.kind];
  for(let i=0;i<v.count;i++){
   const columns=Math.min(v.count,3),x=(i%3-(columns-1)/2)*175,y=v.count>3?(i<3?80:-65):20,z=(i%2?1:-1)*20;
   for(let j=0;j<structure.a.length;j++){const [a,X,Y,Z]=structure.a[j],p=[x+X,y+Y,z+Z];k.sphere('atom'+i+'-'+j,p,a==='H'?16:a==='He'?33:27,{He:0xa18ce7,O:0xe7556e,H:0xf1f7fa,C:0x4d6374}[a],{roughness:.2,clearcoat:.8});k.label('symbol'+i+'-'+j,a,[p[0],p[1]+2,p[2]+29],32)}
   for(let j=0;j<structure.b.length;j++){const [a,b]=structure.b[j];const A=structure.a[a].slice(1),B=structure.a[b].slice(1);for(const offset of v.kind===1||v.kind===3?[-5,5]:[0])k.rod('bond'+i+'-'+j+'-'+offset,[x+A[0],y+A[1]+offset,z],[x+B[0],y+B[1]+offset,z],offset?3:5,0xa9bdca,{metalness:.6})}
  }
  k.label('legend',['He · อะตอมเดี่ยว','O₂ · โมเลกุลธาตุ','H₂O · โมเลกุลสารประกอบ','CO₂ · โมเลกุลสารประกอบ'][v.kind],[0,179,0],255);
  k.label('count',v.count+' อนุภาค · '+(v.count*structure.a.length)+' อะตอม',[0,-148,0],215);
  k.values={particles:v.count,atoms:v.count*structure.a.length};
 },
 G1U3L1(k,v){
  const s=v.zoom*.85;
  if(v.cell){
   k.sphere('membrane',[0,10,0],[140*s,100*s,78*s],0xf1a4b0,{opacity:.17,roughness:.12});
   k.tube('membraneEdge',ellipse(0,10*s,32*s,130*s,92*s),2*s,0xe4a4b5);
   k.sphere('cytoplasm',[0,10*s,-15*s],[128*s,88*s,48*s],0xefbbc8,{opacity:.15});
   k.sphere('smallVacuole',[65*s,26*s,23*s],[18*s,15*s,13*s],C.blue,{opacity:.65});
  }else{
   k.box('wall',[0,5*s,0],[275*s,190*s,135*s],0x70b978,{opacity:.1});
   k.box('membrane',[0,5*s,0],[257*s,173*s,125*s],0xa5d28c,{opacity:.13});
   for(const z of [-67,67])k.tube('wallEdge'+z,[[-137*s,-90*s,z*s],[137*s,-90*s,z*s],[137*s,100*s,z*s],[-137*s,100*s,z*s],[-137*s,-90*s,z*s]],3*s,0x75b97e);
   for(const x of [-137,137])for(const y of [-90,100])k.rod('wallDepth'+x+y,[x*s,y*s,-67*s],[x*s,y*s,67*s],3*s,0x75b97e);
   k.sphere('vacuole',[24*s,17*s,-8*s],[82*s,60*s,45*s],C.blue,{opacity:.38});
  }
  k.sphere('nucleus',[-65*s,-25*s,29*s],28*s,C.purple,{roughness:.2});k.sphere('nucleolus',[-64*s,-21*s,52*s],8*s,0x613b91);
  if(!v.cell)for(let i=0;i<6;i++){const a=i*Math.PI/3;k.sphere('chloroplast'+i,[107*s*Math.cos(a),5*s+74*s*Math.sin(a),24*s],[17*s,8*s,8*s],0x279466,{rotation:[0,0,a]});for(let j=-1;j<=1;j++)k.rod('chloroplastStack'+i+j,[107*s*Math.cos(a)-4*s,5*s+74*s*Math.sin(a)+j*3*s,31*s],[107*s*Math.cos(a)+4*s,5*s+74*s*Math.sin(a)+j*3*s,31*s],.8*s,0x93d39b)}
  k.label('name',v.cell?'เซลล์สัตว์ · มองผ่านเยื่อหุ้ม':'เซลล์พืชจากใบ · มองผ่านผนัง',[0,143*s,0],260);
  leader(k,'nuclearLeader',[-82*s,-45*s,54*s],[-111*s,-111*s,64*s]);k.label('nuclearLabel','นิวเคลียส',[-111*s,-131*s,64*s],100);
  leader(k,'membraneLeader',[127*s,30*s,39*s],[177*s,60*s,45*s]);k.label('membraneLabel',v.cell?'เยื่อหุ้มเซลล์':'ผนังเซลล์',[177*s,84*s,45*s],110);
  if(!v.cell){leader(k,'vacuoleLeader',[64*s,8*s,33*s],[177*s,-14*s,45*s]);k.label('vacuoleLabel','แวคิวโอลใหญ่',[177*s,-40*s,45*s],120);leader(k,'chloroplastLeader',[53*s,-59*s,27*s],[84*s,-105*s,45*s]);k.label('chloroplastLabel','คลอโรพลาสต์',[91*s,-131*s,45*s],120)}
  else{k.label('cytoplasmLabel','ไซโทพลาซึม',[116*s,-112*s,45*s],130);leader(k,'cytoplasmLeader',[80*s,-33*s,30*s],[116*s,-90*s,45*s])}
  k.values={cell:v.cell,zoom:v.zoom};
 },
 G1U3L2(k,v){
  const t=v.t/100,L=v.mode?v.difference:Math.round(v.difference+(5-v.difference)*t/2),R=v.mode?5:v.difference+5-L,shift=(v.difference-5)/45*t*.22;
  const fills=v.mode?[.55+shift,.55-shift]:[.65,.65];
  k.box('tankBase',[0,-116,0],[416,8,170],C.white);
  for(const x of [-205,205])k.box('tankEnd'+x,[x,-15,0],[7,205,170],C.glass,{opacity:.23});
  for(const z of [-82,82]){k.box('tankWall'+z,[0,-15,z],[416,205,4],C.glass,{opacity:.1});k.rod('rim'+z,[-208,87,z],[208,87,z],2.2,C.glass)}
  for(let i=0;i<2;i++){const x=i?103:-103,h=195*fills[i];k.box('water'+i,[x,-111+h/2,0],[198,h,154],C.blue,{opacity:.23,shadow:false});particles(k,'solute'+i+'-',i?R:L,[x,-108+h/2,0],[168,h*.8,115],C.purple,5,v.t/10);particles(k,'waterMolecules'+i+'-',14,[x,-108+h/2,0],[180,h*.85,130],0x80d9f5,2.3,v.t/17)}
  k.box('membrane',[0,-15,0],[4,205,165],C.purple,{opacity:v.mode?.32:.1});
  for(let j=0;j<7;j++)k.rod('membraneStripe'+j,[0,-110+j*30,-80],[0,-110+j*30,80],1,C.purple);
  k.arrow('exchangeLeft',[-58,114,12],[58,114,12],v.mode?C.blue:C.purple,1.5);k.arrow('exchangeRight',[58,91,22],[-58,91,22],v.mode?C.blue:C.purple,1.5);
  if(v.mode||t<1)k.arrow('net',v.mode?[103,162,0]:[-103,162,0],v.mode?[-103,162,0]:[103,162,0],C.gold,3);
  k.label('process',v.mode?'ออสโมซิส · น้ำเคลื่อนสุทธิไปซ้าย':t<1?'การแพร่ · ตัวละลายเคลื่อนสุทธิไปขวา':'สมดุล · ยังเคลื่อนที่ทั้งสองทิศ',[0,213,0],310);
  k.label('left','ซ้าย: '+L+' อนุภาค',[-135,-147,95],130);k.label('right','ขวา: '+R+' อนุภาค',[135,-147,95],130);
  leader(k,'membraneLeader',[0,-40,84],[0,-108,112]);k.label('membraneLabel',v.mode?'เยื่อเลือกผ่าน':'แนวแบ่งสองฝั่ง',[0,-178,100],130);
  k.values={left:L,right:R,levels:fills};
 },
 G1U4L1(k,v){
  const step=Math.round(v.t);
  if(step<3){
   k.rod('stem',[0,-128,0],[0,-63,0],8,C.green);
   for(let i=0;i<5;i++){const a=i*Math.PI*2/5;k.sphere('sepal'+i,[27*Math.cos(a),-53,27*Math.sin(a)],[30,6,12],C.green,{rotation:[0,-a,.3]})}
   // Rear and side petals leave the pistil and its cutaway ovary visible.
   for(const [i,x,y,z,a] of [[0,-61,17,-24,-.5],[1,61,17,-24,.5],[2,-34,36,-50,-.22],[3,34,36,-50,.22]])k.sphere('petal'+i,[x,y,z],[37,65,12],0xe99abb,{rotation:[0,0,a]});
   k.sphere('ovary',[0,-45,0],[38,33,27],0x8cba75,{opacity:.3});k.tube('ovaryOutline',ellipse(0,-45,22,36,32),2,0x82b675);
   k.sphere('ovule',[5,-44,23],[12,15,9],C.gold);k.sphere('eggCell',[5,-44,31],5,0xe98170);
   k.rod('style',[0,-17,0],[0,98,0],7,0xdba4bd,{opacity:.4});k.sphere('stigma',[0,100,0],[22,8,14],0xda91ae);
   for(const [i,x] of [[0,-60],[1,60]]){k.rod('filament'+i,[x*.4,-30,-4],[x,68,-4],2.7,C.green);k.sphere('anther'+i,[x,71,-4],[17,7,8],C.gold)}
   k.sphere('pollen',step===0?[-45,133,8]:[0,111,6],7,C.gold);
   if(step===0)k.arrow('pollination',[-35,135,10],[-3,115,10],C.gold,1.5);
   if(step>0)k.tube('pollenTube',[[0,107,10],[4,68,10],[2,15,15],[5,step===2?-43:4,26]],2.8,C.purple);
   k.label('stigmaLabel','ยอดเกสรเพศเมีย',[132,123,25],150);leader(k,'stigmaLeader',[22,100,7],[118,104,25]);
   k.label('ovaryLabel','รังไข่',[127,-30,40],85);leader(k,'ovaryLeader',[35,-38,24],[107,-30,40]);
   k.label('ovuleLabel','ออวุล',[-115,-76,40],85);leader(k,'ovuleLeader',[5,-44,32],[-94,-70,40]);
   k.label('antherLabel','อับเรณู',[-131,73,15],90);leader(k,'antherLeader',[-64,72,4],[-107,73,15]);
  }else if(step===3){
   k.sphere('fruit',[0,0,0],[90,90,74],0xf19c5c,{opacity:.38});k.tube('fruitOutline',ellipse(0,0,65,78,80),2.8,0xe48d43);k.rod('fruitStalk',[0,81,0],[7,120,0],6,C.green);particles(k,'seed',8,[0,0,44],[90,105,24],C.soil,8);
   k.label('fruitLabel','รังไข่ → ผล',[0,155,0],170);k.label('seedLabel','ออวุล → เมล็ด',[148,-40,45],170);leader(k,'seedLeader',[20,-12,52],[131,-30,45]);
  }else{
   plant(k,'seedling',0,115);k.sphere('seed',[0,-72,32],[17,11,12],C.soil);for(const side of [-1,1])k.tube('root'+side,[[0,-74,30],[side*12,-90,33],[side*27,-109,35]],2.5,C.white);k.label('seedlingLabel','ต้นอ่อน',[116,52,25],100);leader(k,'seedlingLeader',[22,29,10],[99,45,25]);
  }
  k.label('stage',['1 · ถ่ายเรณู','2 · หลอดเรณูงอก','3 · ปฏิสนธิในออวุล','4 · ผลและเมล็ด','5 · เมล็ดงอก'][step],[0,-153,45],220);k.values={step};
 },
 G1U4L2(k,v){
  const rate=Math.min(v.light,v.water,v.co2);plant(k,'plant',0,230);
  k.sphere('sun',[-175,160,-40],26,C.gold,{emissive:C.gold,glow:v.light/100});
  if(v.light)k.arrow('light',[-143,145,-25],[-40,112,0],C.gold,1+v.light/30);
  if(v.water)k.arrow('water',[-160,-87,34],[-32,-87,34],C.blue,1+v.water/35);
  if(v.co2)k.arrow('co2',[-164,30,20],[-41,60,15],C.purple,1+v.co2/40);
  if(rate){k.arrow('oxygenOut',[43,98,10],[153,112,10],C.blue,2);k.sphere('sugar',[34,48,27],8+rate*.045,C.gold);k.arrow('foodToStem',[36,39,27],[10,-15,27],C.gold,2)}
  particles(k,'oxygen',Math.round(rate/5),[177,80,-8],[70,95,55],C.blue,5);
  k.label('lightLabel','แสง',[-172,208,-15],70);k.label('co2Label','CO₂ เข้าทางใบ',[-179,-9,32],150);k.label('waterLabel','น้ำจากราก',[-157,-128,40],130);
  k.label('o2','ออกซิเจนออกจากใบ',[170,159,20],190);k.label('food','ใบสร้างน้ำตาล',[158,-25,32],150);
  k.label('rate','ดัชนีการสร้างอาหาร '+rate,[0,-174,70],230);k.values={rate};
 },
 G1U4L3(k,v){
  plant(k,'plant',0,240);
  for(const side of [-1,1])k.tube('root'+side,[[0,-70,28],[side*15,-89,29],[side*35,-111,35]],2.6,0xddc899);
  k.rod('xylem',[-19,-104,35],[-19,153,35],4,C.blue);
  // Upward and downward phloem paths are separate tubes, sharing a source leaf.
  k.rod('phloemUp',[17,70,38],[17,153,38],3,C.gold);k.rod('phloemDown',[29,70,38],[29,-104,38],3,C.gold);
  k.sphere('sourceLeaf',[55,73,15],[31,6,14],0x8bbf63,{rotation:[0,0,.25]});k.tube('sourceBranch',[[55,73,23],[37,73,33],[17,70,38]],2,C.gold);
  if(v.route){k.sphere('foodDown',[29,70-v.t*1.7,42],8,C.gold);k.sphere('foodUp',[17,70+v.t*.8,42],8,C.gold);k.arrow('flowDown',[69,25,38],[69,-46,38],C.gold,2);k.arrow('flowUp',[60,104,32],[60,146,32],C.gold,2)}else{k.sphere('water',[-19,-100+v.t*2.5,42],9,C.blue);k.arrow('flowUp',[-60,-45,35],[-60,90,35],C.blue,2)}
  k.label('x','ไซเล็ม · น้ำขึ้น',[-131,26,45],160);leader(k,'xLeader',[-100,3,45],[-20,3,42]);
  k.label('p','โฟลเอ็ม · น้ำตาล',[143,-30,45],170);leader(k,'pLeader',[122,-52,45],[29,-52,42]);
  k.label('leafLabel','ใบแหล่งสร้าง',[145,92,30],145);leader(k,'leafLeader',[120,78,30],[62,74,23]);
  k.label('rootLabel','ราก: ดูดน้ำ / ใช้และสะสมอาหาร',[0,-155,52],295);k.values={route:v.route,t:v.t};
 },
 G1U5L1(k,v){
  const melt=clamp(v.q/334),vap=clamp((v.q-752)/2260),temp=v.q<334?0:v.q<752?(v.q-334)/4.18:100;
  vessel(k,'beaker',-35,.65*melt*(1-vap),C.blue,85,-110,190);
  if(melt<1)k.box('ice',[-47,-75,-10],[90*(1-melt)**(1/3),55*(1-melt)**(1/3),70*(1-melt)**(1/3)],0xb9edff,{opacity:.8,roughness:.07});
  particles(k,'steam',Math.round(vap*35),[-55,144,-10],[115,105,80],0xb9cad5,4);
  if(vap>0)k.arrow('vaporUp',[-90,95,-10],[-90,172,-10],0xa4dbe9,2);
  k.cylinder('hotplate',[-35,-129,0],103,25,0x415c70);k.ring('heater',[-35,-115,0],73,C.red,{rotation:[Math.PI/2,0,0],emissive:C.red,glow:v.q/3012});
  // The thermometer bulb sits inside the vessel instead of floating beside it.
  k.cylinder('thermometer',[17,12,42],6,214,C.white,{opacity:.42});k.cylinder('liquidColumn',[17,-88+temp,47],2.5,Math.max(.1,temp*2),C.red);k.sphere('bulb',[17,-91,44],9,C.red);
  for(let i=0;i<=5;i++)k.rod('tempMark'+i,[20,-88+i*40,48],[28,-88+i*40,48],1,C.ink);
  leader(k,'temperatureLeader',[27,85,48],[142,103,48]);k.label('temp',temp.toFixed(1)+' °C',[167,130,40],110);
  k.label('phase',v.q===0?'น้ำแข็ง':v.q<334?'น้ำแข็ง + น้ำ':v.q<752?'น้ำเหลว':v.q===3012?'ไอน้ำ':'น้ำ + ไอน้ำ',[165,-25,40],155);
  k.label('heat','พลังงานเข้า '+v.q+' J',[-35,-168,110],225);k.values={melt,vapor:vap,temperature:temp};
 },
 G1U5L2(k,v){
  const avg=(v.hot+20)/2,d=(v.hot-20)/2*Math.exp(-v.t*(v.material?.003:.05)),a=avg+d,b=avg-d;
  k.box('hot',[-150,-15,0],[100,150,115],blend(C.blue,C.red,(a-20)/80));k.box('cold',[150,-15,0],[100,150,115],blend(C.blue,C.red,(b-20)/80));k.rod('bridge',[-100,0,0],[100,0,0],17,v.material?C.soil:0xadbcca,{metalness:v.material?.05:.85});
  k.arrow('flow',[-80,123,0],[80,123,0],C.gold,Math.max(.8,d/10));k.label('heatLabel','ความร้อน: ร้อน → เย็น',[0,168,0],230);
  k.label('hotT',a.toFixed(1)+' °C',[-150,91,45]);k.label('coldT',b.toFixed(1)+' °C',[150,91,45]);
  k.label('bridgeType',v.material?'ตัวเชื่อม: ฉนวน':'ตัวเชื่อม: ตัวนำดี',[0,-93,75],190);leader(k,'bridgeLeader',[0,-64,73],[0,-17,17]);
  k.label('equilibrium','อุณหภูมิเข้าใกล้ '+avg.toFixed(1)+' °C',[0,-152,65],240);k.values={hot:a,cold:b};
 },
 G1U6L1(k,v){
  k.box('ground',[0,-125,0],[530,20,205],0x739675);
  for(const [i,x,p] of [[0,-155,v.a],[1,155,v.b]]){
   k.box('airRegion'+i,[x,-10,0],[150,210,160],i?C.green:C.blue,{opacity:.065,shadow:false});
   particles(k,'air'+i,10+(p-980)/2,[x,5,0],[125,150,105],i?C.green:C.blue,5);
   k.label('pressure'+i,(i?'B: ':'A: ')+p+' hPa',[x,153,0],155);
   k.label('region'+i,v.a===v.b?'ความกดเท่ากัน':(i?v.b>v.a:v.a>v.b)?'ความกดสูง':'ความกดต่ำ',[x,-149,90],140);
  }
  if(v.a!==v.b){const dir=v.a>v.b?1:-1;for(let i=0;i<3;i++)k.arrow('wind'+i,[-dir*75,-35+i*45,40],[dir*75,-35+i*45,40],C.gold,2+Math.abs(v.a-v.b)/25);k.rod('flagPole',[0,-113,-57],[0,-40,-57],2,C.white);k.box('windFlag',[dir*16,-50,-57],[32,16,3],C.gold)}
  k.label('windLabel',v.a===v.b?'ไม่มีลมจากความต่างความกด':'ลมผิวพื้น: จากความกดสูงไปต่ำ',[0,211,0],300);k.values={difference:v.a-v.b};
 },
 G1U6L2(k,v){
  const e=v.absorb/100,surface=100/(1-e/2),back=surface*e/2;
  earth(k,'earth',[0,-28,0],92);k.sphere('atmosphere',[0,-28,0],119,0x9acbe6,{opacity:.1+e*.13,roughness:.1,shadow:false});
  k.sphere('sun',[-227,154,0],26,C.gold,{emissive:C.gold,glow:1});k.arrow('incoming',[-205,132,12],[-60,35,66],C.gold,3.5);
  k.arrow('surfaceRadiation',[32,57,57],[60,101,63],C.red,3.5);
  k.arrow('escaping',[68,110,64],[117,187,64],C.red,3);
  if(back>0){k.arrow('back',[106,81,45],[64,21,78],C.red,1+back/25);k.arrow('atmosphereOut',[112,90,43],[186,135,43],C.red,1+back/25)}
  k.label('sunlightLabel','แสงอาทิตย์เข้า',[-198,210,10],165);
  k.label('outgoingLabel','รังสีความร้อนออก',[137,230,60],190);
  k.label('atmosphereLabel','บรรยากาศ',[-167,-50,43],130);leader(k,'atmosphereLeader',[-128,-34,43],[-108,10,43]);
  k.label('radiation','แผ่กลับลงผิว '+back.toFixed(1),[171,-46,78],200);leader(k,'backLeader',[139,-25,78],[88,48,65]);
  k.label('earthLabel','พื้นผิวโลก',[0,-154,73],130);k.values={surface,back};
 }
};
