import {C,clamp,vessel,particles,plant,bar,tree} from './models3d-kit.js';

export const grade2={
 G2U1L1(k,v){
  k.rod('x',[-220,-110,0],[230,-110,0],2,C.ink);k.rod('y',[-220,-110,0],[-220,190,0],2,C.ink);
  for(let i=1;i<=v.count;i++)k.sphere('point'+i,[-220+i*50,-110+(i*2+(i%2?.3:-.3))*12,0],7,C.gold);
  k.rod('fit',[-220,-110,0],[180,-110+v.slope*96,0],3,C.blue);
  k.label('data','จุดข้อมูล',[-140,210,0]);k.label('xAxis','x',[245,-110,0],50);k.label('yAxis','y',[-220,215,0],50);k.label('model','แบบจำลอง: y = '+v.slope+'x',[70,-150,0],210);k.values={slope:v.slope,count:v.count};
 },
 G2U2L1(k,v){
  const cap=20+.5*v.temp,dissolved=Math.min(cap,v.solute),solid=v.solute-dissolved;
  vessel(k,'beaker',0,.7,C.blue,95,-115,220);particles(k,'dissolved',dissolved,[0,-25,0],[140,100,100],C.purple,4);
  if(solid>0)k.cylinder('sediment',[0,-110+solid*.35,0],87,solid*.7,0xa28bbb,{roughness:.9});
  k.cylinder('plate',[0,-130,0],112,18,0x425f73);k.ring('heat',[0,-119,0],90,C.red,{rotation:[Math.PI/2,0,0],emissive:C.red,glow:v.temp/70});
  k.label('soluteLabel','ตัวละลาย',[0,55,100],125);if(solid>0)k.label('sedimentLabel','ส่วนที่ยังไม่ละลาย',[-155,-83,0],160);k.label('temp',v.temp+' °C',[160,45,0]);k.label('state',solid?'มีตะกอน':dissolved===cap?'อิ่มตัว':'ยังไม่อิ่มตัว',[0,150,0],160);k.values={capacity:cap,dissolved,solid};
 },
 G2U2L2(k,v){
  const pct=v.m/(v.m+v.water)*100,level=.35+(v.m+v.water)/700;
  vessel(k,'solution',0,level,0x268ec7,105,-115,230);particles(k,'solute',v.m,[0,-105+230*level/2,0],[155,230*level*.8,110],C.purple,4);
  k.label('solutionLabel','สารละลาย',[0,20,105],130);k.label('concentration',pct.toFixed(2)+'% โดยมวล',[0,175,0],200);k.label('mass','มวลรวม '+(v.m+v.water)+' กรัม',[0,-155,70],210);k.values={concentration:pct,totalMass:v.m+v.water};
 },
 G2U3L1(k,v){
  const outline=[[-8,68],[-44,96],[-88,71],[-95,26],[-77,-34],[-24,-107],[10,-126],[61,-72],[92,-15],[90,46],[64,86],[24,94]];
  k.shape('heartWall',outline,56,[0,0,-22],0xbb657d,{opacity:.3});
  const chambers=[[-44,41,19],[-38,-39,21],[41,41,19],[37,-44,21]],cols=[C.blue,C.blue,C.red,C.red];
  chambers.forEach((p,i)=>{k.sphere('chamber'+i,p,[31,i%2?45:26,21],cols[i],{roughness:.65});k.label('chamberLabel'+i,['บนขวา','ล่างขวา','บนซ้าย','ล่างซ้าย'][i],[i<2?-86:87,p[1],62],75)});
  k.rod('septum',[0,57,41],[0,-78,41],3,0xf0b8c1);
  const pts=[[-197,-115,0],chambers[0],chambers[1],[0,177,-5],chambers[2],chambers[3],[197,-115,0],[-197,-115,0]];
  k.tube('venous',[pts[0],[-195,89,-10],[-104,102,8],pts[1]],6,C.blue);
  k.arrow('rightValve',[-44,16,49],[-40,-11,49],C.blue,3);
  k.tube('pulmonaryOut',[pts[2],[-110,-14,4],[-123,152,-5],[-56,181,-5]],6,C.blue);
  k.tube('pulmonaryBack',[[56,181,-5],[126,150,-5],[114,71,0],pts[4]],6,C.red);
  k.arrow('leftValve',[41,16,49],[38,-11,49],C.red,3);
  k.tube('aorta',[pts[5],[80,-49,-15],[132,34,-15],[199,11,-15],pts[6]],7,C.red);
  k.box('bodyTissue',[0,-151,0],[340,25,70],0xb594ad,{roughness:.8});
  k.tube('bodyCapillaries',[pts[6],[131,-135,15],[57,-146,22],[-50,-146,22],[-130,-135,15],pts[7]],5,0xaa819e);
  k.sphere('lungL',[-36,181,-12],[32,36,18],0xe1a4b3);k.sphere('lungR',[36,181,-12],[29,36,18],0xe1a4b3);
  k.rod('lungAirway',[0,233,0],[0,192,0],5,C.white);k.rod('lungBranchL',[0,194,0],[-26,173,0],4,C.white);k.rod('lungBranchR',[0,194,0],[26,173,0],4,C.white);
  for(const [id,a,b,c] of [['v',[-195,0,3],[-195,63,3],C.blue],['p',[-123,89,4],[-123,137,4],C.blue],['r',[126,136,4],[117,94,4],C.red],['a',[199,-32,2],[197,-85,2],C.red]])k.arrow('flow'+id,a,b,c,3);
  const t=Math.round(v.t);k.sphere('bloodMarker',pts[t].map((n,i)=>i===2?n+45:n),12,t<3||t===7?0x6dd8ff:0xffb3a2,{emissive:t<3?C.blue:C.red,glow:.6});
  k.label('lungs','ปอด',[0,253,0],80);k.label('bodyLabel','เนื้อเยื่อร่างกาย',[0,-184,20],160);
  k.label('lowOxygen','O₂ ต่ำ',[-205,152,0],90);k.label('highOxygen','O₂ สูง',[205,152,0],90);
  k.values={step:t,oxygenated:t>=3&&t<7};
 },
 G2U3L2(k,v){
  const a=v.inhale/100,expand=.88+.12*a,diaphragmY=-62-53*a;
  const torso=[[-32,208],[-34,176],[-97,162],[-151,143],[-173,83],[-158,-151],[-106,-158],[106,-158],[158,-151],[173,83],[151,143],[97,162],[34,176],[32,208]];
  k.shape('torso',torso,72,[0,0,-35],0x93c4cf,{opacity:.15,roughness:.75});
  k.tube('bodyOutline',[...torso,torso[0]].map(([x,y])=>[x,y,-3]),2.5,0x8ac5cc);
  k.sphere('head',[0,245,-36],[33,41,28],0xb9d8da,{opacity:.2});k.rod('neck',[0,204,-35],[0,222,-35],25,0xb9d8da,{opacity:.2});
  for(const sign of [-1,1])for(let i=0;i<5;i++){
    const y=116-i*34;k.tube('rib'+sign+i,[[sign*20,y,3],[sign*(83+8*a),y-8,22],[sign*(132+9*a),y-33,1]],1.8,0x9cbfc7);
  }
  const right=[[-29,138],[-57,133],[-91,100],[-112,48],[-123,-29],[-114,-88],[-34,-89],[-26,-56],[-31,-8],[-23,47]];
  const left=[[30,138],[56,130],[91,89],[109,40],[116,-32],[104,-88],[50,-88],[48,-48],[27,-29],[38,7],[25,54]];
  k.shape('rightLung',right,48,[0,0,10],0xe3a1ad,{scale:[expand,expand,1],roughness:.68});
  k.shape('leftLung',left,44,[0,0,10],0xdc8fa4,{scale:[expand,expand,1],roughness:.68});
  k.rod('trachea',[0,204,20],[0,95,20],9,C.white);
  for(let i=0;i<7;i++)k.ring('trachealRing'+i,[0,111+i*13,20],10,0xa4cbd6,{rotation:[Math.PI/2,0,0]});
  for(const sign of [-1,1]){
    k.tube('bronchus'+sign,[[0,98,24],[sign*24,69,36],[sign*50*expand,34*expand,40]],6,C.white);
    for(let i=0;i<3;i++){
      const sy=59-i*32;k.tube('branch'+sign+i,[[sign*34*expand,sy*expand,39],[sign*(62+i*4)*expand,(sy-18)*expand,41],[sign*(84+i*6)*expand,(sy-33)*expand,40]],2.7,C.white);
      k.rod('twig'+sign+i,[sign*(65+i*4)*expand,(sy-18)*expand,42],[sign*(68+i*6)*expand,(sy+1)*expand,42],1.6,C.white);
    }
  }
  k.tube('rightHorizontalFissure',[[-102*expand,28*expand,38],[-67*expand,19*expand,39],[-36*expand,21*expand,38]],1.3,0xb36480);
  k.tube('rightFissure',[[-103*expand,0,38],[-72*expand,-24*expand,39],[-39*expand,-43*expand,38]],1.3,0xb36480);
  k.tube('leftFissure',[[100*expand,3,36],[77*expand,-28*expand,36],[56*expand,-65*expand,35]],1.3,0xb36480);
  // A broad domed sheet, not a rod: the central dome descends on inspiration.
  const diaphragm=[[-135,-120],[-109,-97-19*a],[-61,-71-44*a],[0,diaphragmY],[61,-71-44*a],[109,-97-19*a],[135,-120],[128,-134],[0,diaphragmY-14],[-128,-134]];
  k.shape('diaphragm',diaphragm,66,[0,0,0],0xc398d1,{roughness:.6});
  if(a>0&&a<1)k.arrow('air',[0,247,54],[0,161,54],C.blue,3.5);
  k.label('airLabel',a===0?'สิ้นสุดหายใจออก':a===1?'สิ้นสุดหายใจเข้า':'อากาศเข้า',[155,225,30],175);
  k.label('tracheaLabel','หลอดลม',[-145,194,30],110);
  k.rod('tracheaLeader',[-101,189,30],[-12,171,30],1,C.white);
  k.label('rightLungLabel','ปอดขวา',[-176,8,30],100);k.rod('rightLungLeader',[-143,5,30],[-94,0,36],1,C.white);
  k.label('leftLungLabel','ปอดซ้าย',[175,8,30],100);k.rod('leftLungLeader',[142,5,30],[90,0,36],1,C.white);
  k.label('diaphragmLabel','กะบังลม',[0,-165,40],120);
  k.label('viewLabel','มองจากด้านหน้า',[0,-205,30],170);
  k.values={inhale:a,lungVolumeIndex:(43+22*a)*(65+32*a)*(36+15*a),diaphragmY};
 },
 G2U3L3(k,v){
  const kidney=[[-17,59],[-49,66],[-72,39],[-77,1],[-65,-43],[-30,-64],[2,-48],[10,-24],[-12,-14],[-24,4],[-8,25],[5,43]];
  k.shape('kidney',kidney,28,[-207,5,-35],0xc47a88,{roughness:.7});
  k.tube('ureter',[[-217,-16,-17],[-207,-62,-10],[-209,-105,-10]],4,C.gold);k.label('kidneyLabel','ไต',[-250,112,0],65);
  k.rod('zoomLink',[-212,18,4],[-139,77,6],1,0xbcd2d7);
  k.sphere('capsule',[-102,84,0],42,0xe8bec6,{opacity:.26});
  for(let i=0;i<7;i++)k.ring('glomerulus'+i,[-102+Math.sin(i)*9,84+Math.cos(i)*9,i*3-9],17,C.red,{rotation:[i*.6,i*.3,0]});
  const pts=[[-65,62,0],[-39,47,9],[-59,13,15],[-16,0,0],[-14,-78,0],[20,-108,0],[53,-73,0],[56,22,0],[92,48,16],[122,14,0],[151,0,0],[151,-106,0]];
  k.tube('nephron',pts,8,C.gold);k.tube('arteriole',[[-183,148,-5],[-137,124,0],[-107,93,0]],5,C.red);
  k.tube('peritubular',[[-90,106,-14],[-32,109,-20],[9,65,-20],[15,-61,-18],[76,-72,-18],[89,68,-20],[211,92,-15]],4,0xd87b91);
  k.arrow('bloodIn',[-173,143,9],[-137,121,9],C.red,2.5);k.arrow('filtration',[-98,57,32],[-63,30,30],C.gold,2.5);
  const positions=[[-102,84,34],[-25,0,20],[56,22,20],[151,-106,20]];k.sphere('filtrate',positions[Math.round(v.t)],11,C.blue,{emissive:C.blue,glow:.3});
  k.arrow('reabsorb',[58,5,18],[80,68,-5],C.blue,2+(v.reabsorb-80)/12);k.arrow('urineFlow',[151,-45,15],[151,-99,15],C.gold,2.5);
  k.label('filter','โกลเมอรูลัส',[-103,159,10],145);k.label('tubule','ท่อหน่วยไต',[18,-144,15],150);k.label('return','ดูดกลับสู่เลือด',[107,144,10],160);k.label('urine','ไปท่อรวม',[184,-140,20],120);k.label('zoomTitle','ภาพขยายหน่วยไต',[7,211,10],190);
  k.values={waterReturned:v.reabsorb,waterRemaining:100-v.reabsorb,step:v.t};
 },
 G2U3L4(k,v){
  const t=Math.round(v.t),handX=t===4?-170:-90;
  k.rod('forearm',[-235,-90,0],[handX,-75,0],23,0xd5a88b);k.shape('hand',[[-14,12],[1,14],[13,28],[20,25],[12,11],[36,9],[38,3],[18,0],[36,-1],[37,-7],[16,-8],[30,-10],[29,-16],[9,-15],[-12,-12]],16,[handX+11,-69,9],0xe6b899,{roughness:.8});k.cylinder('hotPot',[-23,-85,0],29,36,0xa4bdc7,{metalness:.7});k.ring('potRim',[-23,-67,0],29,C.white,{rotation:[Math.PI/2,0,0]});k.rod('potHandle',[5,-81,0],[26,-81,0],4,C.ink);k.cylinder('heatSource',[-23,-109,0],32,8,C.red,{emissive:C.red,glow:.35});
  k.cylinder('vertebralColumn',[155,45,-25],17,190,C.white,{opacity:.15});k.cylinder('spine',[155,45,-10],6,190,0xe9b761);for(let i=0;i<7;i++)k.ring('vertebra'+i,[155,-35+i*27,-25],23,0xb9cbd7,{rotation:[Math.PI/2,0,0]});
  const p=[[-90,-55,20],[-100,100,0],[155,125,-15],[30,40,20],[-180,-55,20]];
  k.tube('sensory',[p[0],p[1],p[2]],5,C.blue);k.tube('motor',[p[2],p[3],p[4]],5,C.gold);k.sphere('signal',p[t],12,C.gold,{emissive:C.gold,glow:1});
  k.label('sensoryLabel','ประสาทรับความรู้สึก',[-80,142,15],190);k.label('motorLabel','ประสาทสั่งการ',[20,0,30],150);k.label('heatLabel','ของร้อน',[-25,-127,25],105);k.arrow('sensoryFlow',[-40,114,15],[55,121,15],C.blue,2.5);k.arrow('motorFlow',[86,57,25],[0,10,25],C.gold,2.5);k.label('spineLabel','ไขสันหลัง',[150,185,-20],140);k.label('signalLabel',['ผิวหนัง','ประสาทรับ','ไขสันหลัง','ประสาทสั่ง','กล้ามเนื้อ'][t],[0,-150,30],170);k.values={step:t,withdrawn:t===4};
 },
 G2U3L5(k,v){
  const d=v.day,thickness=d<=5?22-d*3:d<=14?7+(d-5)*2:25;
  const uterus=[[-83,85],[-43,95],[0,88],[43,95],[83,85],[78,35],[57,-19],[25,-73],[22,-113],[-22,-113],[-25,-73],[-57,-19],[-78,35]];
  k.shape('uterusWall',uterus,47,[0,0,-9],0xe3a1b1,{roughness:.65});
  const cavity=[[-58,62],[0,54],[58,62],[39,9],[13,-65],[0,-93],[-13,-65],[-39,9]];
  k.shape('endometrium',cavity,5,[0,0,18],0xc45580,{scale:[.66+thickness/90,1,1],roughness:.8});
  k.tube('uterineCavity',[[-43,52,25],[0,45,25],[43,52,25]],3,0xf6d8df);k.tube('cavityCanal',[[0,45,25],[0,-15,25],[0,-102,25]],3,0xf6d8df);
  for(const sign of [-1,1]){k.tube('tube'+sign,[[sign*66,68,0],[sign*105,114,0],[sign*166,114,0],[sign*183,78,0]],7,0xd99aad);for(let i=0;i<4;i++)k.rod('fimbria'+sign+i,[sign*183,80,0],[sign*(163+i*12),58,5],2.5,0xd99aad);k.sphere('ovary'+sign,[sign*179,36,0],[27,17,18],0xe9bf89)}
  // Show the egg only around ovulation, never as viable throughout the whole cycle.
  if(d<14)k.sphere('follicle',[-179,37,18],4+d*.45,0xffe7ac);
  if(d===14)k.sphere('ovum',[-177,66,13],8,0xffe7ac,{emissive:C.gold,glow:.2});if(d===15)k.sphere('ovum',[-139,105,10],7,0xffe7ac,{emissive:C.gold,glow:.15});
  if(d<=5)for(let i=0;i<3;i++)k.sphere('menstrualFlow'+i,[i%2?6:-6,-126-i*10,12],[3,5,3],0xb95374);
  k.label('ovaryLabel','รังไข่',[-213,-10,15],95);k.label('tubeLabel','ท่อนำไข่',[155,148,10],135);k.label('uterusLabel','มดลูก',[-115,-64,20],95);k.label('liningLabel','เยื่อบุมดลูก',[132,-46,25],145);k.rod('liningLeader',[80,-37,25],[27,-11,25],1,C.white);k.label('cervixLabel','ปากมดลูก',[0,-172,25],125);
  k.label('day','รอบตัวอย่าง · วันที่ '+d,[0,208,0],210);k.values={day:d,liningThickness:thickness};
 },
 G2U4L1(k,v){
  const x=(v.go-v.back)*2;k.box('track',[0,-110,0],[520,12,95],0xc8d6dd);
  for(let i=-5;i<=5;i++)k.rod('mark'+i,[i*45,-102,-40],[i*45,-102,-25],2,C.ink);
  k.arrow('go',[0,35,-35],[v.go*2,35,-35],C.blue);k.arrow('back',[v.go*2,0,25],[x,0,25],C.gold);
  k.sphere('walkerHead',[x,-30,0],13,C.gold);k.cylinder('walkerBody',[x,-65,0],12,45,C.blue);k.rod('legL',[x-5,-80,0],[x-13,-103,0],4,C.ink);k.rod('legR',[x+5,-80,0],[x+13,-103,0],4,C.ink);
  k.label('outwardLabel','เดินไป',[v.go,64,-35],100);if(v.back)k.label('returnLabel','ย้อนกลับ',[v.go*2-v.back,-33,45],110);k.label('origin','เริ่ม 0',[0,-145,65]);k.label('destination','ปลายทาง '+(v.go-v.back)+' ม.',[x,90,0],175);k.values={distance:v.go+v.back,displacement:v.go-v.back};
 },
 G2U4L2(k,v){
  const a=(v.right-v.left)/v.mass,d=.5*a*v.t*v.t,x=170*Math.tanh(d/50);
  k.box('road',[0,-120,0],[550,12,150],0xc5d6dc);k.box('chassis',[x,-62,0],[83,35,62],C.blue);k.box('roof',[x-8,-35,0],[46,24,54],0x8dc9e1);
  for(let i=0;i<4;i++){const X=x+(i<2?-27:27),z=i%2?36:-36;k.cylinder('wheel'+i,[X,-88,z],17,12,C.ink,{rotation:[Math.PI/2,0,0]})}
  if(v.right)k.arrow('right',[x+45,0,0],[x+45+v.right*4,0,0],C.blue);if(v.left)k.arrow('left',[x-45,0,0],[x-45-v.left*4,0,0],C.red);
  k.label('forceL',v.left+' N',[-185,55,0],85);k.label('forceR',v.right+' N',[180,55,0],85);k.label('mass',v.mass+' kg',[x,55,0]);k.values={acceleration:a,displacement:d};
 },
 G2U5L1(k,v){
  const run=Math.sqrt(v.length*v.length-4)*46,slope=Math.atan2(100,Math.max(.001,run)),progress=v.t/100;
  k.box('ramp',[-170+run/2,-65,0],[Math.max(1,v.length*46),9,100],0x8baaac,{rotation:[0,0,slope]});
  k.box('support',[-170+run,-65,0],[12,100,95],0xadc4c5);const x=-170+run*progress,y=-110+100*progress;
  k.box('load',[x,y+25,0],[40,40,40],C.gold,{rotation:[0,0,slope]});k.arrow('pull',[x,y+65,0],[x+60*Math.cos(slope),y+65+60*Math.sin(slope),0],C.red);
  k.label('loadLabel','วัตถุ',[x,y+107,0],85);k.label('height','สูง 2 เมตร',[180,70,0],120);k.label('length','ทางลาด '+v.length+' เมตร',[0,-155,50],190);k.values={force:v.mass*20/v.length,work:v.mass*20};
 },
 G2U5L2(k,v){
  const h=v.height*(1-v.t/100),ep=10*h,ek=10*(v.height-h);
  k.box('landing',[-155,-120,0],[130,12,120],0x9fbbb6);k.rod('ruler',[-210,-110,0],[-210,180,0],2,C.ink);
  k.sphere('falling',[-155,-92+h/20*255,0],18,C.gold,{metalness:.35});bar(k,'potential',65,ep,200,C.blue,'ศักย์');bar(k,'kinetic',175,ek,200,C.gold,'จลน์');
  k.arrow('gravity',[-205,75,20],[-205,14,20],C.red,3);k.label('gravityLabel','แรงโน้มถ่วง',[-207,115,20],130);k.label('height',h.toFixed(1)+' เมตร',[-155,210,0]);k.values={height:h,potential:ep,kinetic:ek,speed:Math.sqrt(2*ek)};
 },
 G2U6L1(k,v){
  vessel(k,'source',-145,.8*(1-v.t/100),C.purple,68);vessel(k,'receiver',145,.8*v.t/100,C.blue,68);
  k.tube('condenser',[[-145,85,0],[-145,160,0],[-70,175,0],[70,140,0],[145,105,0],[145,75,0]],10,C.glass);
  k.rod('coolingJacket',[-75,174,0],[75,138,0],20,C.blue,{opacity:.25});k.label('condenserLabel','เครื่องควบแน่น',[0,226,0],165);k.arrow('vaporFlow',[-122,188,15],[-64,188,15],C.gold,2.5);k.arrow('waterIn',[65,89,-5],[65,133,-5],C.blue,2);k.arrow('waterOut',[-66,177,-5],[-66,208,-5],C.blue,2);particles(k,'salt',10,[-145,-95,0],[75,15,70],C.purple,5);
  if(v.t)k.sphere('drop',[145,75-(v.t%20)*5,0],7,C.blue);
  k.cylinder('heater',[-145,-130,0],78,15,C.ink);k.label('sourceLabel','เกลือยังอยู่',[-145,-156,65],135);k.label('receiverLabel','น้ำกลั่น',[145,-156,65],110);k.values={sourceWater:100-v.t,distilled:v.t,salt:10};
 },
 G2U7L1(k,v){
  const moving=v.flow>v.grain*8,x=-205+(moving?v.t*4.1:0);
  k.box('riverBed',[0,-107,0],[540,32,190],0xc5ab87,{roughness:1});k.box('river',[0,-55,0],[530,70,180],C.blue,{opacity:.28,roughness:.1});
  for(let i=0;i<9;i++)k.sphere('rock'+i,[-240+i*58,-80,(i%3-1)*60],[12,8,10],C.soil);
  k.sphere('grain',[x,-73,10],v.grain*2+4,C.soil);if(v.flow)k.arrow('flow',[-200,60,0],[-200+v.flow*4,60,0],C.blue,4);
  k.label('grainLabel','เม็ดตะกอน',[x,-24,25],120);k.label('state',moving?'กำลังพัดพาตะกอน':'ตะกอนตกสะสม',[0,140,0],210);k.values={moving,position:x};
 },
 G2U7L2(k,v){
  const retain=[15,40,65][v.soil],drained=(100-retain)*(1-Math.exp(-v.t*[.08,.04,.015][v.soil]));
  k.box('soil',[0,20,0],[220,130,150],[0xcab280,0x9c7957,0x826552][v.soil],{opacity:.67,roughness:1});
  const size=[12,8,4][v.soil];particles(k,'grains',40,[0,20,0],[190,100,110],C.soil,size);
  particles(k,'retained',Math.round((100-drained)/3),[0,20,0],[175,105,115],C.blue,4);
  vessel(k,'collector',175,drained/100,C.blue,50,-125,130);if(drained>0)k.arrow('drain',[60,-50,0],[145,-70,0],C.blue);
  k.label('collectorLabel','น้ำที่ซึมผ่าน',[180,36,20],145);k.label('soilLabel',['ดินทราย','ดินร่วน','ดินเหนียว'][v.soil],[0,140,0],150);k.values={drained,retained:100-drained};
 },
 G2U7L3(k,v){
  const soak=v.rain*(1-v.paved/100)*.8,run=v.rain-soak,flood=Math.max(0,run-v.drain);
  k.box('ground',[0,-117,0],[520,25,260],0x79aa7b);if(v.paved)k.box('paved',[-260+2.6*v.paved,-100,0],[5.2*v.paved,7,255],0x7e94a1);
  k.box('house',[140,-50,-50],[60,95,65],0xe1b27b);k.mesh('roof','cone',[140,10,-50],[52,40,52],0xbc6e5f,{rotation:[0,Math.PI/4,0]});
  if(flood)k.box('flood',[0,-101+flood*.45,0],[518,flood*.9,258],C.blue,{opacity:.35,roughness:.08});particles(k,'rain',v.rain/3,[0,130,0],[470,100,240],C.blue,3);
  k.rod('drainPipe',[220,-85,70],[275,-85,70],14,C.ink);k.label('drainLabel','ทางระบายน้ำ',[213,-130,80],145);if(v.paved)k.label('pavedLabel','พื้นทึบน้ำ',[-153,-85,150],135);if(soak)k.arrow('infiltration',[-45,-68,80],[-45,-143,80],C.blue,2.5);k.label('floodLabel','น้ำสะสม '+flood.toFixed(1),[0,215,0],190);k.values={soak,runoff:run,flood};
 },
 G2U8L1(k,v){
  const solar=.6*v.sun,wind=60*(v.wind/100)**3,total=solar+wind+v.backup;
  k.box('solarPanel',[-160,-15,0],[115,8,95],0x2b679e,{rotation:[-.45,0,0],roughness:.18,metalness:.35});k.rod('panelLeg',[-160,-110,0],[-160,-20,0],6,C.ink);
  const panelPoint=(x,z)=>[-160+x,-15+4.5*Math.cos(.45)+z*Math.sin(.45),-4.5*Math.sin(.45)+z*Math.cos(.45)];
  for(let i=0;i<5;i++)k.rod('solarLine'+i,panelPoint(-53+i*26.5,-43),panelPoint(-53+i*26.5,43),.7,0xa3d0e7);
  for(let i=0;i<4;i++)k.rod('solarRow'+i,panelPoint(-53,-43+i*28.7),panelPoint(53,-43+i*28.7),.7,0xa3d0e7);
  k.cylinder('tower',[0,-10,0],8,210,C.white);k.sphere('hub',[0,105,12],13,C.white);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3+v.wind*.08;k.rod('blade'+i,[0,105,12],[65*Math.cos(a),105+65*Math.sin(a),12],6,C.white)}
  k.box('backup',[175,-55,0],[70,115,75],C.green);bar(k,'output',260,total,160,C.gold,'รวม');
  k.label('solarLabel','แผงแสงอาทิตย์ '+solar.toFixed(1),[-160,-150,55],115);k.label('windLabel','กังหันลม '+wind.toFixed(1),[0,-150,55],110);k.label('backupLabel','สำรอง '+v.backup,[165,-150,55],115);k.values={solar,wind,total};
 }
};
