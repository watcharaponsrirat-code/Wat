import {C,clamp,vessel,particles,plant,bar,tree} from './models3d-kit.js';

export const grade2={
 G2U1L1(k,v){
  k.rod('x',[-220,-110,0],[230,-110,0],2,C.ink);k.rod('y',[-220,-110,0],[-220,190,0],2,C.ink);
  for(let i=1;i<=v.count;i++)k.sphere('point'+i,[-220+i*50,-110+(i*2+(i%2?.3:-.3))*12,0],7,C.gold);
  k.rod('fit',[-220,-110,0],[180,-110+v.slope*96,0],3,C.blue);
  k.label('data','หลักฐาน',[-140,210,0]);k.label('model','แบบจำลอง: y = '+v.slope+'x',[70,-150,0],210);k.values={slope:v.slope,count:v.count};
 },
 G2U2L1(k,v){
  const cap=20+.5*v.temp,dissolved=Math.min(cap,v.solute),solid=v.solute-dissolved;
  vessel(k,'beaker',0,.7,C.blue,95,-115,220);particles(k,'dissolved',dissolved,[0,-25,0],[140,100,100],C.purple,4);
  if(solid>0)k.cylinder('sediment',[0,-110+solid*.35,0],87,solid*.7,0xa28bbb,{roughness:.9});
  k.cylinder('plate',[0,-130,0],112,18,0x425f73);k.ring('heat',[0,-119,0],90,C.red,{rotation:[Math.PI/2,0,0],emissive:C.red,glow:v.temp/70});
  k.label('temp',v.temp+' °C',[160,45,0]);k.label('state',solid?'มีตะกอน':dissolved===cap?'อิ่มตัว':'ยังไม่อิ่มตัว',[0,150,0],160);k.values={capacity:cap,dissolved,solid};
 },
 G2U2L2(k,v){
  const pct=v.m/(v.m+v.water)*100,level=.35+(v.m+v.water)/700;
  vessel(k,'solution',0,level,0x268ec7,105,-115,230);particles(k,'solute',v.m,[0,-105+230*level/2,0],[155,230*level*.8,110],C.purple,4);
  k.label('concentration',pct.toFixed(2)+'% โดยมวล',[0,175,0],200);k.label('mass','มวลรวม '+(v.m+v.water)+' กรัม',[0,-155,70],210);k.values={concentration:pct,totalMass:v.m+v.water};
 },
 G2U3L1(k,v){
  const chambers=[[-48,40,25],[-45,-45,30],[48,40,25],[45,-45,30]],cols=[C.blue,C.blue,C.red,C.red];
  chambers.forEach((p,i)=>{k.sphere('chamber'+i,p,[43,i%2?57:37,42],cols[i],{opacity:.75,roughness:.38});k.label('chamberLabel'+i,['บนขวา','ล่างขวา','บนซ้าย','ล่างซ้าย'][i],[p[0]+(i<2?-40:40),p[1],78],75)});
  k.sphere('lungL',[-48,170,-35],[36,47,22],0xd997b1);k.sphere('lungR',[48,170,-35],[36,47,22],0xd997b1);
  const pts=[[-195,-80,0],[-48,40,25],[-45,-45,30],[0,175,-15],[48,40,25],[45,-45,30],[195,-80,0],[-195,-80,0]];
  k.tube('venous',[pts[0],[-150,80,-20],pts[1],pts[2]],7,C.blue);
  k.tube('pulmonaryOut',[pts[2],[-95,100,-40],pts[3]],7,C.blue);k.tube('pulmonaryBack',[pts[3],[95,115,-20],pts[4],pts[5]],7,C.red);
  k.tube('aorta',[pts[5],[125,100,-35],[195,40,-35],pts[6]],8,C.red);k.tube('body',[pts[6],[100,-115,-20],[-100,-115,-20],pts[7]],7,0x927bad);
  const t=Math.round(v.t);k.sphere('bloodMarker',pts[t],14,t<3||t===7?0x5bc8ef:0xff9a8c,{emissive:t<3?C.blue:C.red,glow:.6});
  k.label('lungs','ปอด',[0,235,-30],90);k.label('bodyLabel','เนื้อเยื่อร่างกาย',[0,-155,30],160);k.values={step:t,oxygenated:t>=3&&t<7};
 },
 G2U3L2(k,v){
  const a=v.inhale/100;k.sphere('thorax',[0,10,0],[145,145,85],0xaacddb,{opacity:.09});
  k.rod('trachea',[0,185,0],[0,75,0],12,C.white);k.tube('bronchusL',[[0,80,0],[-25,65,0],[-70,25,0]],8,C.white);k.tube('bronchusR',[[0,80,0],[25,65,0],[70,25,0]],8,C.white);
  for(const sign of [-1,1]){k.sphere('lung'+sign,[sign*65,0,0],[43+22*a,65+32*a,36+15*a],0xde899c,{roughness:.55,opacity:.82});for(let i=0;i<3;i++)k.rod('branch'+sign+i,[sign*50,30-i*22,20],[sign*(80+i*5),15-i*25,28],3,C.white)}
  k.tube('diaphragm',[[-135,-125,0],[-70,-92-25*a,15],[0,-65-60*a,25],[70,-92-25*a,15],[135,-125,0]],9,C.purple);
  if(a>0)k.arrow('air',[0,205,30],[0,105,30],C.blue,3+a*3);
  k.label('diaphragmLabel','กะบังลม',[0,-163,40],130);k.values={inhale:a,lungVolumeIndex:(43+22*a)*(65+32*a)*(36+15*a),diaphragmY:-65-60*a};
 },
 G2U3L3(k,v){
  k.sphere('capsule',[-145,85,0],50,0xe8bec6,{opacity:.3});
  for(let i=0;i<8;i++)k.ring('glomerulus'+i,[-145+Math.sin(i)*12,85+Math.cos(i)*12,i*3-12],22,C.red,{rotation:[i*.6,i*.3,0]});
  const pts=[[-105,65,0],[-65,50,15],[-95,15,20],[-45,0,0],[-35,-80,0],[0,-110,0],[35,-65,0],[40,25,0],[80,50,20],[115,15,0],[145,0,0],[145,-100,0]];
  k.tube('nephron',pts,10,C.gold);k.tube('vessel',[[-210,85,-30],[-185,120,-30],[-70,110,-35],[10,90,-35],[70,70,-35],[210,70,-35]],6,C.red);
  const positions=[[-145,85,30],[-60,0,20],[40,25,20],[145,-100,20]];k.sphere('filtrate',positions[Math.round(v.t)],15,C.blue,{emissive:C.blue,glow:.3});
  k.arrow('reabsorb',[45,10,20],[45,90,-25],C.blue,2+(v.reabsorb-80)/10);vessel(k,'urine',185,(100-v.reabsorb)/30,C.gold,30,-125,70);
  k.label('filter','ตัวกรอง',[-155,160,0]);k.label('return','ดูดกลับ '+v.reabsorb+'%',[75,145,0],150);k.values={waterReturned:v.reabsorb,waterRemaining:100-v.reabsorb,step:v.t};
 },
 G2U3L4(k,v){
  const t=Math.round(v.t),handX=t===4?-170:-90;
  k.rod('forearm',[-235,-90,0],[handX,-75,0],23,0xd5a88b);k.sphere('hand',[handX+16,-70,0],[25,14,20],0xe6b899);k.sphere('heatSource',[-30,-85,0],23,C.red,{emissive:C.red,glow:.5});
  k.cylinder('spine',[155,45,-25],17,190,C.white);for(let i=0;i<7;i++)k.ring('vertebra'+i,[155,-35+i*27,-25],23,0xb9cbd7,{rotation:[Math.PI/2,0,0]});
  const p=[[-90,-55,20],[-100,100,0],[155,125,-15],[30,40,20],[-180,-55,20]];
  k.tube('sensory',[p[0],p[1],p[2]],5,C.blue);k.tube('motor',[p[2],p[3],p[4]],5,C.gold);k.sphere('signal',p[t],12,C.gold,{emissive:C.gold,glow:1});
  k.label('spineLabel','ไขสันหลัง',[150,185,-20],140);k.label('signalLabel',['ผิวหนัง','ประสาทรับ','ไขสันหลัง','ประสาทสั่ง','กล้ามเนื้อ'][t],[0,-150,30],170);k.values={step:t,withdrawn:t===4};
 },
 G2U3L5(k,v){
  const d=v.day,thickness=d<=5?22-d*3:d<=14?7+(d-5)*2:25;
  k.sphere('uterus',[0,-5,0],[91,100,48],0xeaa4b4,{opacity:.26});k.sphere('lining',[0,-10,15],[52+thickness*.8,68,22],0xc95884,{opacity:.52});k.cylinder('cervix',[0,-113,0],20,50,0xd58da4);
  for(const s of [-1,1]){k.tube('tube'+s,[[s*50,65,0],[s*105,115,0],[s*175,100,0],[s*175,70,0]],9,0xda93ae);k.sphere('ovary'+s,[s*180,47,0],[33,22,24],0xe9ba7e)}
  const x=d<14?-180:-180+(d-14)*10,y=d<14?47:55+Math.sin((d-14)/14*Math.PI)*40;
  k.sphere('ovum',[x,y,28],d<14?5+d*.5:12,0xffe7ac,{emissive:C.gold,glow:.12});
  k.label('day','รอบตัวอย่าง · วันที่ '+d,[0,170,0],210);k.values={day:d,liningThickness:thickness};
 },
 G2U4L1(k,v){
  const x=(v.go-v.back)*2;k.box('track',[0,-110,0],[520,12,95],0xc8d6dd);
  for(let i=-5;i<=5;i++)k.rod('mark'+i,[i*45,-102,-40],[i*45,-102,-25],2,C.ink);
  k.arrow('go',[0,35,-35],[v.go*2,35,-35],C.blue);k.arrow('back',[v.go*2,0,25],[x,0,25],C.gold);
  k.sphere('walkerHead',[x,-30,0],13,C.gold);k.cylinder('walkerBody',[x,-65,0],12,45,C.blue);k.rod('legL',[x-5,-80,0],[x-13,-103,0],4,C.ink);k.rod('legR',[x+5,-80,0],[x+13,-103,0],4,C.ink);
  k.label('origin','เริ่ม 0',[0,-145,65]);k.label('destination','ปลายทาง '+(v.go-v.back)+' ม.',[x,90,0],175);k.values={distance:v.go+v.back,displacement:v.go-v.back};
 },
 G2U4L2(k,v){
  const a=(v.right-v.left)/v.mass,d=.5*a*v.t*v.t,x=170*Math.tanh(d/50);
  k.box('road',[0,-120,0],[550,12,150],0xc5d6dc);k.box('chassis',[x,-62,0],[83,35,62],C.blue);k.box('roof',[x-8,-35,0],[46,24,54],0x8dc9e1);
  for(let i=0;i<4;i++){const X=x+(i<2?-27:27),z=i%2?36:-36;k.cylinder('wheel'+i,[X,-88,z],17,12,C.ink,{rotation:[Math.PI/2,0,0]})}
  if(v.right)k.arrow('right',[x+45,0,0],[x+45+v.right*4,0,0],C.blue);if(v.left)k.arrow('left',[x-45,0,0],[x-45-v.left*4,0,0],C.red);
  k.label('mass',v.mass+' kg',[x,55,0]);k.values={acceleration:a,displacement:d};
 },
 G2U5L1(k,v){
  const run=Math.sqrt(v.length*v.length-4)*46,slope=Math.atan2(100,Math.max(.001,run)),progress=v.t/100;
  k.box('ramp',[-170+run/2,-65,0],[Math.max(1,v.length*46),9,100],0x8baaac,{rotation:[0,0,slope]});
  k.box('support',[-170+run,-65,0],[12,100,95],0xadc4c5);const x=-170+run*progress,y=-110+100*progress;
  k.box('load',[x,y+25,0],[40,40,40],C.gold,{rotation:[0,0,slope]});k.arrow('pull',[x,y+65,0],[x+60*Math.cos(slope),y+65+60*Math.sin(slope),0],C.red);
  k.label('height','สูง 2 เมตร',[180,70,0],120);k.label('length','ทางลาด '+v.length+' เมตร',[0,-155,50],190);k.values={force:v.mass*20/v.length,work:v.mass*20};
 },
 G2U5L2(k,v){
  const h=v.height*(1-v.t/100),ep=10*h,ek=10*(v.height-h);
  k.box('landing',[-155,-120,0],[130,12,120],0x9fbbb6);k.rod('ruler',[-210,-110,0],[-210,180,0],2,C.ink);
  k.sphere('falling',[-155,-92+h/20*255,0],18,C.gold,{metalness:.35});bar(k,'potential',65,ep,200,C.blue,'ศักย์');bar(k,'kinetic',175,ek,200,C.gold,'จลน์');
  k.label('height',h.toFixed(1)+' เมตร',[-155,210,0]);k.values={height:h,potential:ep,kinetic:ek,speed:Math.sqrt(2*ek)};
 },
 G2U6L1(k,v){
  vessel(k,'source',-145,.8*(1-v.t/100),C.purple,68);vessel(k,'receiver',145,.8*v.t/100,C.blue,68);
  k.tube('condenser',[[-145,85,0],[-145,160,0],[-70,175,0],[70,140,0],[145,105,0],[145,75,0]],10,C.glass);
  k.rod('coolingJacket',[-75,174,0],[75,138,0],20,C.blue,{opacity:.25});particles(k,'salt',10,[-145,-95,0],[75,15,70],C.purple,5);
  if(v.t)k.sphere('drop',[145,75-(v.t%20)*5,0],7,C.blue);
  k.cylinder('heater',[-145,-130,0],78,15,C.ink);k.label('sourceLabel','เกลือยังอยู่',[-145,-156,65],135);k.label('receiverLabel','น้ำกลั่น',[145,-156,65],110);k.values={sourceWater:100-v.t,distilled:v.t,salt:10};
 },
 G2U7L1(k,v){
  const moving=v.flow>v.grain*8,x=-205+(moving?v.t*4.1:0);
  k.box('riverBed',[0,-107,0],[540,32,190],0xc5ab87,{roughness:1});k.box('river',[0,-55,0],[530,70,180],C.blue,{opacity:.28,roughness:.1});
  for(let i=0;i<9;i++)k.sphere('rock'+i,[-240+i*58,-80,(i%3-1)*60],[12,8,10],C.soil);
  k.sphere('grain',[x,-73,10],v.grain*2+4,C.soil);if(v.flow)k.arrow('flow',[-200,60,0],[-200+v.flow*4,60,0],C.blue,4);
  k.label('state',moving?'กำลังพัดพาตะกอน':'ตะกอนตกสะสม',[0,140,0],210);k.values={moving,position:x};
 },
 G2U7L2(k,v){
  const retain=[15,40,65][v.soil],drained=(100-retain)*(1-Math.exp(-v.t*[.08,.04,.015][v.soil]));
  k.box('soil',[0,20,0],[220,130,150],[0xcab280,0x9c7957,0x826552][v.soil],{opacity:.67,roughness:1});
  const size=[12,8,4][v.soil];particles(k,'grains',40,[0,20,0],[190,100,110],C.soil,size);
  particles(k,'retained',Math.round((100-drained)/3),[0,20,0],[175,105,115],C.blue,4);
  vessel(k,'collector',175,drained/100,C.blue,50,-125,130);if(drained>0)k.arrow('drain',[60,-50,0],[145,-70,0],C.blue);
  k.label('soilLabel',['ดินทราย','ดินร่วน','ดินเหนียว'][v.soil],[0,140,0],150);k.values={drained,retained:100-drained};
 },
 G2U7L3(k,v){
  const soak=v.rain*(1-v.paved/100)*.8,run=v.rain-soak,flood=Math.max(0,run-v.drain);
  k.box('ground',[0,-117,0],[520,25,260],0x79aa7b);if(v.paved)k.box('paved',[-260+2.6*v.paved,-100,0],[5.2*v.paved,7,255],0x7e94a1);
  k.box('house',[140,-50,-50],[60,95,65],0xe1b27b);k.mesh('roof','cone',[140,10,-50],[52,40,52],0xbc6e5f,{rotation:[0,Math.PI/4,0]});
  if(flood)k.box('flood',[0,-101+flood*.45,0],[518,flood*.9,258],C.blue,{opacity:.35,roughness:.08});particles(k,'rain',v.rain/3,[0,130,0],[470,100,240],C.blue,3);
  k.rod('drainPipe',[220,-85,70],[275,-85,70],14,C.ink);k.label('floodLabel','น้ำสะสม '+flood.toFixed(1),[0,215,0],190);k.values={soak,runoff:run,flood};
 },
 G2U8L1(k,v){
  const solar=.6*v.sun,wind=60*(v.wind/100)**3,total=solar+wind+v.backup;
  k.box('solarPanel',[-160,-15,0],[115,8,95],0x2b679e,{rotation:[-.45,0,0],roughness:.18,metalness:.35});k.rod('panelLeg',[-160,-110,0],[-160,-20,0],6,C.ink);
  for(let i=0;i<4;i++)k.rod('solarLine'+i,[-210+i*30,-10,-37],[-210+i*30,26,38],.8,0xa3d0e7);
  k.cylinder('tower',[0,-10,0],8,210,C.white);k.sphere('hub',[0,105,12],13,C.white);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3+v.wind*.08;k.rod('blade'+i,[0,105,12],[65*Math.cos(a),105+65*Math.sin(a),12],6,C.white)}
  k.box('backup',[175,-55,0],[70,115,75],C.green);bar(k,'output',260,total,160,C.gold,'รวม');
  k.label('solarLabel','แสง '+solar.toFixed(1),[-160,-150,55],115);k.label('windLabel','ลม '+wind.toFixed(1),[0,-150,55],110);k.label('backupLabel','สำรอง '+v.backup,[165,-150,55],115);k.values={solar,wind,total};
 }
};
