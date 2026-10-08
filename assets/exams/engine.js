// Authored final assessments. Rows: topic, thinking skill, stem, key, distractors, rationale.
(() => {
  'use strict';
  const bank={},blueprints={};
  const version=3;
  const enrichment=new Set(['G3U3L1S6','G3U3L2S7']);
  const labels={understand:'ความเข้าใจ',apply:'ประยุกต์',analyze:'วิเคราะห์หลักฐาน'};
  window.defineFinalExam=(id,source)=>{
    if(bank[id])throw Error('Duplicate final exam '+id);
    const sections=window.SLH_DATA.packs[id];
    const rows=source.trim().split('\n').map(line=>line.trim().split('|'));
    if(rows.some(row=>row.length!==8))throw Error('Final item must have eight fields: '+id);
    const questions=rows.map(([topic,skill,q,correct,a,b,c,why],i)=>{
      const section=sections[Number(topic)-1],type={U:'understand',A:'apply',R:'analyze'}[skill];
      const opts=[correct,a,b,c];
      if(!section||!type||!q||!why||opts.some(o=>!o)||new Set(opts).size!==4)throw Error('Invalid final item '+id+'/'+(i+1));
      if(enrichment.has(section.code))throw Error('Optional topic in final exam '+id+'/'+(i+1));
      return Object.freeze({id:id+'-F'+String(i+1).padStart(2,'0'),version,type,code:section.code,q,correct,opts:Object.freeze(opts),why});
    });
    if(questions.length!==20||new Set(questions.map(q=>q.q)).size!==20)throw Error('Final exam must contain 20 distinct items: '+id);
    for(const s of sections.filter(s=>!enrichment.has(s.code)))if(!questions.some(q=>q.code===s.code))throw Error('Uncovered core topic '+s.code);
    bank[id]=Object.freeze(questions);
    blueprints[id]=Object.freeze({count:20,topics:Object.freeze(Object.fromEntries(sections.map(s=>[s.code,questions.filter(q=>q.code===s.code).length]))),skills:Object.freeze(Object.fromEntries(Object.keys(labels).map(t=>[t,questions.filter(q=>q.type===t).length])))});
  };
  window.SLH_FINAL_EXAMS={version,labels,bank,blueprints,
    build(id,shuffle){
      if(!bank[id])throw Error('Missing authored final exam '+id);
      const keyPositions=shuffle(Array.from({length:20},(_,i)=>i%4));
      const qs=shuffle([...bank[id]]).map((q,i)=>{
        const opts=shuffle(q.opts.filter(o=>o!==q.correct));
        opts.splice(keyPositions[i],0,q.correct);
        return {...q,opts};
      });
      return {version,blueprint:blueprints[id],qs,answers:{},idx:0,started:Date.now()};
    }
  };
})();
