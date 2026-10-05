/* Original lesson models. Formula models use stated assumptions; qualitative models
   illustrate relationships, not predictions or measurements of real organisms. */
(() => {
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const n=(v,d=1)=>Number(v.toFixed(d)).toLocaleString('th-TH');
  const text=(x,y,s,size=18,color='#23415d')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" text-anchor="middle">${esc(s)}</text>`;
  const rect=(x,y,w,h,color='#d7edf8',r=12)=>`<rect x="${x}" y="${y}" width="${Math.max(0,w)}" height="${Math.max(0,h)}" rx="${r}" fill="${color}"/>`;
  const circle=(x,y,r,color='#3ab9df')=>`<circle cx="${x}" cy="${y}" r="${Math.max(0,r)}" fill="${color}"/>`;
  const line=(x,y,X,Y,color='#318ba9',width=4)=>`<line x1="${x}" y1="${y}" x2="${X}" y2="${Y}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  const path=(d,color='#288bb1',width=4,fill='none')=>`<path d="${d}" fill="${fill}" stroke="${color}" stroke-width="${width}"/>`;
  const arrow=(x,y,X,Y,color='#2a91c0')=>line(x,y,X,Y,color)+`<path d="M -10 -6 L 0 0 L -10 6" fill="none" stroke="${color}" stroke-width="3" transform="translate(${X} ${Y}) rotate(${Math.atan2(Y-y,X-x)*180/Math.PI})"/>`;
  const dots=(count,x,y,w,h,color='#269ad0',phase=0)=>Array.from({length:Math.max(0,Math.round(count))},(_,i)=>circle(x+((i*47+phase*19)%97)/97*w,y+((i*31+phase*11)%89)/89*h,4,color)).join('');
  const vessel=(x,label,level,color='#8bdaef')=>rect(x,70,150,185,'#dce8ef')+rect(x+6,76,138,173,'#fff')+rect(x+6,249-clamp(level)*170,138,clamp(level)*170,color,0)+text(x+75,282,label);
  const bars=(labels,values,max=100,colors=['#38afd3','#f6af43','#7d80da'])=>labels.map((s,i)=>{const x=75+i*(450/labels.length),w=Math.min(100,360/labels.length),h=clamp(values[i]/max)*175;return rect(x,240-h,w,h,colors[i%colors.length])+text(x+w/2,270,s,16)+text(x+w/2,225-h,n(values[i]),17)}).join('')+line(50,242,560,242,'#8295a4',2);
  const chain=(labels,active=0)=>labels.map((s,i)=>{const x=15+i*590/labels.length,w=570/labels.length-10;return rect(x,110,w,80,i===active?'#bcecc9':'#e3eff5')+text(x+w/2,155,s,Math.min(19,95/Math.max(4,s.length)*3))+(i<labels.length-1?arrow(x+w+2,150,x+w+15,150):'')}).join('');
  const plant=(x,h=120,leaf=1)=>rect(x-40,240,80,40,'#b87d55')+line(x,240,x,240-h,'#45a86d',8)+path(`M ${x} ${240-h/2} Q ${x-75} ${170-h/2} ${x-55} ${220-h/2} Q ${x-15} ${245-h/2} ${x} ${240-h/2}`,'#43a572',2,'#6ed087')+(leaf?path(`M ${x} ${250-h} Q ${x+80} ${170-h} ${x+45} ${240-h} Z`,'#43a572',2,'#6ed087'):'');
  const range=(key,label,min,max,value,unit='',step=1)=>({key,label,min,max,value,unit,step});
  const select=(key,label,options,value=0)=>({key,label,options,value});
  const timeline=(max=100,label='เวลาจำลอง',unit='%')=>range('t',label,0,max,0,unit);
  const result=(svg,summary,metrics=[])=>({svg,summary,metrics});
  window.SIM={esc,clamp,n,text,rect,circle,line,path,arrow,dots,vessel,bars,chain,plant,range,select,timeline,result};
  window.SLH_SIMULATIONS={};
  window.defineSimulation=(id,title,topics,hint,assumption,controls,model)=>{
    if(window.SLH_SIMULATIONS[id]||!window.SLH_DATA.packs[id])throw Error('Invalid simulation '+id);
    const sections=topics.map(i=>window.SLH_DATA.packs[id][i-1]);
    if(sections.some(s=>!s))throw Error('Invalid simulation topic '+id);
    window.SLH_SIMULATIONS[id]={id,title,topics:sections.map(s=>({code:s.code,title:s.title})),hint,assumption,controls,model};
  };
})();
