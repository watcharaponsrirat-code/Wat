import {C,rad,vessel,particles,plant,earth,bar,tree,animal} from './models3d-kit.js';

export const grade3={
 G3U1L1(k,v){
  const cost=15+v.braces*(v.design?12:7),strength=20+v.braces*(v.design?14:6);
  for(const x of [-220,220])k.box('pier'+x,[x,-70,0],[50,120,145],0xa3bab9);
  k.box('deck',[0,-5,0],[480,15,135],0x8faaa9);
  for(const z of [-65,65])for(let i=0;i<v.braces;i++){
   const x=-220+i*440/v.braces,w=440/v.braces;
   if(v.design){k.rod('trussA'+z+i,[x,7,z],[x+w/2,100,z],5,C.blue);k.rod('trussB'+z+i,[x+w/2,100,z],[x+w,7,z],5,C.blue)}else k.rod('beam'+z+i,[x,24,z],[x+w,24,z],6,C.blue);
  }
  k.box('river',[0,-127,0],[530,9,220],C.blue,{opacity:.6});k.label('budget',cost>v.budget?'ต้นทุนเกินงบ':'ต้นทุนอยู่ในงบ',[0,175,0],190);k.values={cost,strength,budget:v.budget};
 },
 G3U2L1(k,v){
  const a=['AA','Aa','aa'][v.p1],b=['AA','Aa','aa'][v.p2],offs=[];
  for(let row=0;row<2;row++)for(let col=0;col<2;col++){
   const id=row*2+col,g=[a[row],b[col]].sort().join('');offs.push(g);const x=(col-.5)*165,z=(row-.5)*125;
   k.box('cell'+id,[x,-70,z],[145,15,105],g==='aa'?0xcdb7e5:0x91c7a4);
   for(let j=0;j<2;j++){const X=x+(j?25:-25),color=g[j]==='A'?C.green:C.purple;k.rod('chromA'+id+j,[X-12,0,z-4],[X+12,55,z+4],6,color);k.rod('chromB'+id+j,[X+12,0,z-4],[X-12,55,z+4],6,color)}
   k.label('genotype'+id,g+' · 25%',[x,85,z],115);
  }
  k.label('parents',a+' × '+b,[0,170,0],180);k.values={offspring:offs,AA:offs.filter(g=>g==='AA').length*25,Aa:offs.filter(g=>g==='Aa').length*25,aa:offs.filter(g=>g==='aa').length*25};
 },
 G3U3L1(k,v){
  const time=v.t*.05,points=[];for(let i=0;i<=120;i++){const x=i*500/120;points.push([-250+x,25+v.amp*90*Math.sin(2*Math.PI*(v.freq*x/250-v.freq*time)),0])}
  k.tube('rope',points,4,C.blue,{segments:200});k.rod('axis',[-260,25,-5],[260,25,-5],1.2,0xa9bfc9);
  const y=25+v.amp*90*Math.sin(2*Math.PI*(v.freq-v.freq*time));k.sphere('particle',[0,y,0],11,C.gold,{roughness:.22});k.rod('guide',[0,-80,0],[0,135,0],.7,C.gold);
  k.label('particleLabel','อนุภาคสั่นขึ้น–ลง',[0,-140,40],210);k.values={wavelength:2/v.freq,period:1/v.freq,particleY:y,time};
 },
 G3U3L2(k,v){
  const [n1,n2]=[[1,1.33],[1,1.5],[1.5,1]][v.pair],a=rad(v.angle),sin=n1/n2*Math.sin(a),tir=sin>1,b=tir?0:Math.asin(sin);
  k.box('medium',[0,-77,0],[440,145,150],v.pair===1?0xafd5dc:C.blue,{opacity:.2,roughness:.05});k.rod('normal',[0,-155,0],[0,175,0],1,0x8dabbc);
  k.arrow('incident',[-155*Math.sin(a),155*Math.cos(a),10],[0,0,10],C.gold,3);k.arrow('reflection',[0,0,10],[155*Math.sin(a),155*Math.cos(a),10],C.red,3);
  if(!tir)k.arrow('refraction',[0,0,10],[155*Math.sin(b),-155*Math.cos(b),10],C.blue,3);
  k.label('n1','n₁ = '+n1,[-170,145,0],110);k.label('n2','n₂ = '+n2,[-170,-100,90],110);k.label('state',tir?'สะท้อนกลับหมด':'สะท้อนและหักเห',[0,215,0],220);k.values={n1,n2,totalInternalReflection:tir,refraction:tir?null:b*180/Math.PI};
 },
 G3U4L1(k,v){
  const a=rad(v.angle),f=(1-Math.cos(a))/2,x=175*Math.cos(a),z=-175*Math.sin(a);
  earth(k,'earth',[0,0,0],56);k.ring('orbit',[0,0,0],175,0x8aaabe,{rotation:[Math.PI/2,0,0]});
  k.litSphere('moon',[x,0,z],24,0xdedbcf,[1,0,0]);k.sphere('sun',[280,35,0],32,C.gold,{emissive:C.gold,glow:1.4});
  for(let i=-1;i<=1;i++)k.arrow('sunlight'+i,[250,85+i*40,-55],[170,85+i*40,-55],C.gold,1.4);
  k.label('earthLabel','โลก',[0,85,0],75);k.label('moonLabel','ดวงจันทร์',[x,48,z],100);k.label('phase','สว่างจากโลก '+(f*100).toFixed(1)+'%',[0,-150,80],220);
  k.values={angle:v.angle,illuminatedFraction:f,moonPosition:[x,0,z]};
 },
 G3U5L1(k,v){
  const gas=v.t/10,reading=100-(v.closed?gas:0);
  vessel(k,'flask',0,.6-v.t*.001,C.purple,90,-100,190);if(!v.closed)k.cylinder('lid',[0,95,0],95,12,C.ink);
  particles(k,'gas',Math.round(gas*3),[0,v.closed?145:60,0],[125,v.closed?100:45,110],0xaea1ce,5,v.t);
  k.box('scale',[0,-120,0],[235,28,195],0xa7c1c8,{metalness:.45});k.label('reading',reading.toFixed(1)+' g',[0,-147,125],120);k.label('system',v.closed?'ระบบเปิด':'ระบบปิด',[0,225,0],150);k.values={reading,escaped:v.closed?gas:0};
 },
 G3U5L2(k,v){
  const def=v.force*[1,.13,.4,.22][v.mat],broken=v.mat===1&&v.force>65,color=[C.blue,C.purple,0x9cafbd,C.green][v.mat];
  for(const x of [-200,200])k.box('support'+x,[x,-82,0],[50,80,110],0xb2c6ce);
  if(broken){k.rod('brokenL',[-200,-35,0],[-25,-80,0],12,color);k.rod('brokenR',[25,-80,0],[200,-35,0],12,color)}else k.tube('beam',[[-200,-35,0],[-100,-35-def*.35,0],[0,-35-def*.5,0],[100,-35-def*.35,0],[200,-35,0]],12,color);
  if(v.force)k.arrow('load',[0,165,0],[0,10,0],C.red,2+v.force/20);
  k.label('state',broken?'แตกเมื่อเกินขีดจำกัด':'โก่งตัวตามแรง',[0,210,0],230);k.values={deflection:def,broken};
 },
 G3U6L1(k,v){
  const req=v.kind?v.r/2:2*v.r,I=v.on?v.voltage/req:0,branch=v.kind?I/2:I,P=branch*branch*v.r;
  k.box('board',[0,-115,0],[520,15,290],0x344e60,{roughness:.8});
  const wire=(id,pts,col=C.blue)=>{for(let i=1;i<pts.length;i++)k.rod(id+i,pts[i-1],pts[i],4,col)};
  wire('loop',[[-210,-10,0],[-240,-10,-35],[-240,-92,-100],[210,-92,-100],[210,-92,100],[25,-92,100]],C.red);wire('return',[[-25,-92,100],[-210,-92,100],[-210,-92,0]],C.blue);
  k.cylinder('battery',[-210,-58,0],23,75,C.green);k.cylinder('batteryCap',[-210,-16,0],12,8,C.ink);
  const bulbs=v.kind?[[60,-100],[60,35]]:[[-60,-100],[120,-100]];
  if(v.kind)wire('branch',[[-160,-92,-100],[-160,-92,35],[210,-92,35]],C.red);
  for(let i=0;i<2;i++){const [x,z]=bulbs[i];k.cylinder('socket'+i,[x,-82,z],24,20,0x829cae,{metalness:.7});k.sphere('bulb'+i,[x,-42,z],[27,35,27],I?0xffd76c:0xd3e1e7,{opacity:.72,roughness:.08,emissive:I?C.gold:0,glow:Math.min(2,P/3)});k.tube('filament'+i,[[x-9,-56,z],[x-4,-38,z],[x+4,-38,z],[x+9,-56,z]],1.5,I?C.gold:C.ink);k.label('bulbLabel'+i,'หลอด '+(i+1),[x,15,z],85)}
  k.box('switchBase',[0,-95,100],[75,12,45],C.white);k.rod('switch',[-25,-84,100],v.on?[25,-84,100]:[18,-45,100],5,C.green);
  k.rod('switchContactL',[-25,-92,100],[-25,-84,100],5,C.ink);k.rod('switchContactR',[25,-92,100],[25,-84,100],5,C.ink);
  k.label('circuit',v.kind?'วงจรขนาน':'วงจรอนุกรม',[0,135,0],180);k.values={current:I,power:P,resistance:req,on:v.on};
 },
 G3U6L2(k,v){
  const energy=v.power*v.hours/1000;
  k.box('meter',[0,10,0],[175,215,85],0xd7e7e9,{roughness:.25});k.box('screen',[0,55,48],[145,66,7],0x234b60);k.label('reading',energy.toFixed(2)+' kWh',[0,55,55],135);
  k.cylinder('dial',[0,-40,50],37,7,C.blue,{rotation:[Math.PI/2,0,0],metalness:.55});const a=energy*Math.PI/4;k.rod('needle',[0,-40,57],[27*Math.cos(a),-40+27*Math.sin(a),57],2,C.gold);
  k.tube('cable',[[-55,-100,-10],[-85,-125,0],[-165,-110,0],[-185,-55,0]],4,C.ink);k.cylinder('appliance',[-185,-15,0],30,70,C.gold,{emissive:C.gold,glow:v.power/2000});
  k.label('cost', (energy*4).toFixed(2)+' บาท',[0,-155,60],160);k.values={energy,cost:energy*4};
 },
 G3U7L1(k,v){
  const e1=v.energy*v.eff/100,e2=e1*v.eff/100,e3=e2*v.eff/100,values=[v.energy,e1,e2,e3];
  plant(k,'grass',-215,65);animal(k,'grasshopper',[-70,-30,0],'grasshopper',.85);animal(k,'frog',[75,-30,0],'frog',.9);animal(k,'snake',[220,-30,0],'snake',.9);
  for(let i=0;i<4;i++){const x=-215+i*145;k.label('energy'+i,values[i].toFixed(i===3?2:1)+' หน่วย',[x,80,0],115);if(i<3)k.arrow('transfer'+i,[x+42,0,15],[x+100,0,15],C.gold,2);k.box('energyColumn'+i,[x,-115+Math.max(3,values[i]/1000*120)/2,-55],[65,Math.max(3,values[i]/1000*120),35],C.green)}
  k.label('loss','พลังงานส่วนหนึ่งใช้ดำรงชีวิตและเป็นความร้อน',[0,175,0],350);k.values={energy:values};
 },
 G3U7L2(k,v){
  for(const x of [-170,170]){k.box('forest'+x,[x,-120,0],[190,22,245],0x75a479);for(let i=0;i<5;i++)tree(k,'tree'+x+i,x+(i%3-1)*48,-65+Math.floor(i/3)*120)}
  k.box('road',[0,-123,0],[110,12,285],0x708491);for(let i=0;i<6;i++)k.box('stripe'+i,[0,-115,-125+i*48],[4,1,24],C.white);
  if(v.corridor)k.box('corridor',[0,-105,0],[165,15,72],0x87bb82);
  const x=v.corridor?-170+v.t*3.4:-170+Math.min(v.t,20);
  animal(k,'animal',[x,-73,20],'mouse',.75);k.label('label',v.corridor?'เชื่อมต่อถิ่นอาศัย':'ผืนป่าถูกแยก',[0,200,0],230);k.values={accessiblePatches:v.corridor?2:1,animalX:x};
 }
};
