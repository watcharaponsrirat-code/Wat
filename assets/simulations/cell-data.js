// Labels for the interactive cutaway only; existing lesson text stays intact.
// Biology references: OpenStax Biology 2e, sections 4.3 and 4.4:
// https://openstax.org/books/biology-2e/pages/4-3-eukaryotic-cells
// https://openstax.org/books/biology-2e/pages/4-4-the-endomembrane-system-and-proteins
export const CELL_ORGANELLES = Object.freeze({
  membrane: {name:'เยื่อหุ้มเซลล์',color:0x6ed4db,description:'เยื่อเลือกผ่านที่ห่อหุ้มเซลล์และควบคุมการเคลื่อนที่ของสารเข้าและออกจากเซลล์'},
  cytoplasm: {name:'ไซโทพลาซึม',color:0x72b6ad,description:'บริเวณภายในเยื่อหุ้มเซลล์ที่อยู่นอกนิวเคลียส มีไซโทซอลและออร์แกเนลล์ เป็นที่เกิดปฏิกิริยาหลายชนิด'},
  nucleus: {name:'นิวเคลียส',color:0xa572ed,description:'มีเยื่อหุ้มนิวเคลียสล้อมรอบ เก็บ DNA และควบคุมการทำงานของเซลล์ผ่านการแสดงออกของยีน'},
  nucleolus: {name:'นิวคลีโอลัส',color:0x7e42c9,description:'บริเวณภายในนิวเคลียสที่สร้าง rRNA และประกอบหน่วยย่อยของไรโบโซม ไม่มีเยื่อหุ้มแยก'},
  mitochondria: {name:'ไมโทคอนเดรีย',color:0xf3a255,description:'สร้าง ATP ผ่านการหายใจระดับเซลล์ เยื่อหุ้มชั้นในพับเป็นคริสตี พบได้ทั้งในเซลล์พืชและเซลล์สัตว์'},
  golgi: {name:'กอลจิบอดี',color:0xee95af,description:'ถุงเยื่อแบนซ้อนกัน ทำหน้าที่ดัดแปลง คัดแยก และบรรจุโปรตีนหรือลิพิดลงในเวสิเคิล'},
  'rough-er': {name:'ร่างแหเอนโดพลาซึมชนิดหยาบ',color:0x809fe9,description:'ร่างแหเยื่อที่มีไรโบโซมเกาะ ช่วยสร้างและปรับแต่งโปรตีนสำหรับเยื่อหุ้มหรือการส่งออกจากเซลล์'},
  'smooth-er': {name:'ร่างแหเอนโดพลาซึมชนิดเรียบ',color:0x47c7bb,description:'ร่างแหท่อเยื่อที่ไม่มีไรโบโซมเกาะ ช่วยสังเคราะห์ลิพิด และมีหน้าที่อื่นตามชนิดของเซลล์'},
  ribosomes: {name:'ไรโบโซม',color:0xffd77b,description:'โครงสร้างขนาดเล็กที่สังเคราะห์โปรตีน พบทั้งแบบอิสระในไซโทซอลและแบบเกาะร่างแหเอนโดพลาซึม'},
  lysosomes: {name:'ไลโซโซม',color:0xe76693,description:'ถุงเยื่อที่มีเอนไซม์สำหรับย่อยสารและส่วนประกอบที่เสื่อมสภาพภายในเซลล์'},
  vesicles: {name:'เวสิเคิล',color:0x9ddedc,description:'ถุงเยื่อขนาดเล็กที่เก็บหรือขนส่งสารระหว่างส่วนต่าง ๆ ของเซลล์'},
  centrioles: {name:'เซนทริโอล',color:0xfbd063,description:'โครงสร้างทรงกระบอกคู่ในเซนโตรโซม แต่ละอันมีไมโครทูบูลเก้าชุด ชุดละสามท่อ เซนโตรโซมช่วยจัดระเบียบไมโครทูบูล'},
  wall: {name:'ผนังเซลล์',color:0x91c750,description:'ชั้นแข็งแรงอยู่นอกเยื่อหุ้มเซลล์พืช มีเซลลูโลสเป็นองค์ประกอบสำคัญ ช่วยค้ำจุนและรักษารูปร่าง'},
  vacuole: {name:'แวคิวโอลกลางขนาดใหญ่',color:0x55c9da,description:'ช่องขนาดใหญ่ที่มีเยื่อโทโนพลาสต์ล้อมรอบ เก็บน้ำและสารต่าง ๆ และช่วยรักษาแรงดันเต่งของเซลล์พืช'},
  chloroplasts: {name:'คลอโรพลาสต์',color:0x66b84b,description:'ออร์แกเนลล์สังเคราะห์ด้วยแสง มีคลอโรฟิลล์ในเยื่อไทลาคอยด์ ซึ่งบางส่วนซ้อนกันเป็นกรานา'}
});

export const CELL_TYPES = Object.freeze({
  plant: {name:'เซลล์พืชจากใบ',ids:['wall','membrane','cytoplasm','nucleus','nucleolus','vacuole','chloroplasts','mitochondria','golgi','rough-er','smooth-er','ribosomes']},
  animal: {name:'เซลล์สัตว์',ids:['membrane','cytoplasm','nucleus','nucleolus','mitochondria','golgi','rough-er','smooth-er','ribosomes','lysosomes','vesicles','centrioles']}
});
