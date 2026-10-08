// Authored questions use option zero as the key; the UI shuffles a copied array.
(() => {
  'use strict';
  window.SLH_EXERCISE_BANK = {};
  window.defineExercises = (id, rows) => {
    const sections=window.SLH_DATA.packs[id];
    if(!sections||window.SLH_EXERCISE_BANK[id])throw Error('Invalid exercise lesson: '+id);
    window.SLH_EXERCISE_BANK[id]=rows.map(([topic,q,opts,why],i)=>{
      const section=sections[topic-1];
      if(!section||opts.length!==4||new Set(opts).size!==4||!q||!why)throw Error('Invalid exercise: '+id+'/'+i);
      return {id:id+'-A'+String(i+1).padStart(2,'0'),type:'apply',code:section.code,q,correct:opts[0],opts,why};
    });
  };
  // Optional enrichment in the reading is not required in the basic assessment.
  const excluded = new Set(['G3U3L1S6','G3U3L2S7']);
  const descriptions = {
    G2U5L2S2:'พลังงานที่วัตถุมีเนื่องจากตำแหน่งในสนามโน้มถ่วง เมื่อมวลเท่ากันและใช้ระดับอ้างอิงเดียวกัน วัตถุที่อยู่สูงกว่ามีพลังงานชนิดนี้มากกว่า',
    G2U5L2S3:'พลังงานเนื่องจากการเคลื่อนที่ของวัตถุ ขึ้นกับมวลและอัตราเร็ว',
    G2U5L2S4:'ผลรวมของพลังงานจากการเคลื่อนที่และพลังงานจากตำแหน่งของวัตถุ',
    G3U3L1S5:'จำนวนรอบที่สั่นในหนึ่งวินาทีมีหน่วยเฮิรตซ์ ส่วนเวลาที่ใช้สั่นครบหนึ่งรอบมีหน่วยวินาที',
    G3U6L1S2:'อัตราการไหลของประจุไฟฟ้าผ่านหน้าตัดตัวนำ มีหน่วยแอมแปร์',
    G3U6L2S1:'อัตราการใช้พลังงานไฟฟ้าต่อเวลา มีหน่วยวัตต์'
  };
  window.SLH_EXERCISES = {
    version:2,
    basic(id){
      const sections=window.SLH_DATA.packs[id].filter(s=>!excluded.has(s.code)).map(s=>({...s,body:descriptions[s.code]||s.body}));
      const questions=sections.map((section,i)=>({
        id:section.code+'-B',type:'basic',code:section.code,
        q:'คำอธิบายต่อไปนี้ตรงกับหัวข้อใดมากที่สุด: “'+section.body+'”',
        correct:section.title,
        opts:[section.title,...[1,2,3].map(offset=>sections[(i+offset)%sections.length].title)],
        why:section.title+' — '+section.body
      }));
      if(id==='G1U4L3')questions.push({id:id+'-B06',type:'basic',code:sections[4].code,q:'เนื้อเยื่อใดลำเลียงน้ำและธาตุอาหาร และเนื้อเยื่อใดลำเลียงอาหารของพืช ตามลำดับ',correct:'ไซเล็ม และ โฟลเอ็ม',opts:['ไซเล็ม และ โฟลเอ็ม','โฟลเอ็ม และ ไซเล็ม','ไซเล็ม และ ไซเล็ม','โฟลเอ็ม และ โฟลเอ็ม'],why:'ไซเล็มลำเลียงน้ำและธาตุอาหาร ส่วนโฟลเอ็มลำเลียงอาหารจากแหล่งสร้างไปยังแหล่งใช้หรือสะสม ทั้งสองทำงานสัมพันธ์กัน'});
      return questions;
    },
    apply(id){return window.SLH_EXERCISE_BANK[id].map(q=>({...q,opts:[...q.opts]}))}
  };
})();
