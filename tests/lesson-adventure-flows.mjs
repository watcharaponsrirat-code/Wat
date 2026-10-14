import assert from 'node:assert/strict';

// Called by lesson-adventure-browser.mjs --flows. All accounts and storage are disposable.
export async function verifyFlows({before,after,open,settle,state,compareState,snapshot,layout,shot,lessons,normalize,report}) {
 const pages=[before,after],id='G1U1L1';
 let interactionSeed=271828;
 const both=async action=>{const seed=++interactionSeed;for(const p of pages){await p.evaluate(seed=>window.__resetReviewSeed(seed),seed);await action(p);await settle(p)}};
 const click=selector=>both(p=>p.locator(selector).click());
 const storage=p=>p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).sort().map(k=>{let v=localStorage.getItem(k);try{v=JSON.parse(v)}catch{}return[k,v]})));
 const saved=async label=>{assert.deepEqual(normalize(await storage(after)),normalize(await storage(before)),label+': all original saved records');report.exactStates++};
 const compare=async label=>{assert.deepEqual(await snapshot(after),await snapshot(before),label+': original feedback and DOM');await saved(label);report.exactContent++};
 const frame=async label=>{
  for(const size of [[375,812],[390,844],[430,932],[768,1024],[1280,720],[1366,768],[1440,900]]){
   await after.setViewportSize({width:size[0],height:size[1]});await settle(after);const r=await layout(after);
   assert(!r.pageOverflow&&r.ten&&r.touch&&r.clear&&r.wood&&r.world,label+': shared frame '+size[0]);assert.deepEqual(r.overflow,[],label+': text overflow '+size[0]);report.layouts++;
  }
  await after.setViewportSize({width:390,height:844});
 };
 const detail=async(label,selector)=>{for(const [width,height] of [[390,844],[1366,768]]){await after.setViewportSize({width,height});await shot(after,label+'-'+width);await after.locator(selector).first().scrollIntoViewIfNeeded();await after.screenshot({path:`tmp/lesson-adventure-review/${label}-detail-${width}.png`});report.screenshots.push(label+'-detail-'+width+'.png')}await after.setViewportSize({width:390,height:844})};
 // Every model's native value controls and both render modes, without changing formulas.
 for(const lesson of lessons){
  for(const p of pages)await open(p,lesson.id,'lab');
  const controls=await after.locator('[data-sim-control]').evaluateAll(es=>es.map(e=>({key:e.dataset.simControl,select:e.tagName==='SELECT',max:e.tagName==='SELECT'?e.options.length-1:Number(e.max)})));
  for(const c of controls){await both(async p=>{const e=p.locator(`[data-sim-control="${c.key}"]`);if(c.select)await e.selectOption(String(c.max));else{await e.fill(String(c.max));await e.dispatchEvent('input')}});assert.equal((await state(after,lesson.id)).simulation[lesson.id].values[c.key],c.max);await compareState(lesson.id,'Simulation '+c.key);report.simControls++}
  for(const view of ['2d','3d']){await click(`[data-sim-view="${view}"]`);assert.equal(await after.locator('.simPanel').getAttribute('data-sim-view'),view);assert.equal(await after.locator(`[data-sim-view="${view}"]`).last().getAttribute('aria-pressed'),'true');assert.equal(await after.locator('.simViewport').isVisible(),view==='3d')}
  await click('[data-sim-reset]');await compareState(lesson.id,'Simulation reset');
  if(['G1U1L1','G1U2L1','G2U3L1','G3U3L1'].includes(lesson.id)){await detail('simulation-'+lesson.id,'.simStudio');await click('[data-sim-view="2d"]');await detail('simulation-2d-'+lesson.id,'.simDiagram')}
  report.lessons.push(lesson);console.log('Simulation controls and views '+lesson.id);
 }
 report.checks.push('All lesson simulation inputs, reset, and 2D/3D view switches checked against baseline');
 for(const p of pages){await p.evaluate(id=>window.__SLH_QA__.reset(id),id);await p.setViewportSize({width:390,height:844});await open(p,id,'content')}
 // Ten real navigation controls keep their existing routes and status updates.
 for(const stage of ['content','lab','g1','g2','g3','e1','e2','e3','exam','result']){
  await click(`.stageHUD [data-stage="${stage}"]`);assert.equal(await after.locator('.stageDot.active').getAttribute('data-stage'),stage);await saved('Activity navigation '+stage);
 }
 await click('.stageHUD [data-stage="content"]');await click('[data-content-complete]');assert((await state(after,id)).contentDone);await saved('Reading complete');
 await click('[data-action=back]');await click(`[data-lesson="${id}"] button`);assert.equal(await after.locator('.stageDot.active').getAttribute('data-stage'),'lab');await saved('Back and resume');
 await click('.stageHUD [data-stage="g1"]');
 const catalog=await after.evaluate(()=>window.SLH_GAME_CATALOG.G1U1L1);
 for(let gi=0;gi<3;gi++){
  const game=catalog[gi],stage='g'+(gi+1);
  if(game.type==='evidence'){
   const wrong=game.cards.findIndex(c=>!c.correct);await click(`[data-arc-evidence="${wrong}"]`);await click('[data-arc-check]');assert.equal(await after.locator('.is-retry').count(),1);await compare('Game incorrect');await frame('Game incorrect');await detail('game-retry','.arcade-feedback');await click(`[data-arc-evidence="${wrong}"]`);
   for(let i=0;i<game.cards.length;i++)if(game.cards[i].correct)await click(`[data-arc-evidence="${i}"]`);await click('[data-arc-check]');
  }else if(game.type==='memory'){
   const deck=(await state(after,id)).games.g2.state.deck;for(let pair=0;pair<game.pairs.length;pair++)for(let i=0;i<deck.length;i++)if(deck[i].pair===pair)await click(`[data-arc-flip="${i}"]`);
  }else if(game.type==='mission'){
   for(let i=0;i<game.items.length;i++){const opts=(await state(after,id)).games.g3.state.options[i];await click(`[data-arc-answer="${opts.indexOf(game.items[i].answer)}"]`);if(i<game.items.length-1)await click('[data-arc-mission-next]')}
  }
  assert((await state(after,id)).games[stage].done);await compare('Game complete '+stage);await frame('Game complete '+stage);await detail('game-complete-'+stage,'.arcade-win');await click('[data-arc-next]');
 }
 for(const stage of ['e1','e2','e3']){
  const qs=(await state(after,id)).ex[stage].state.qs;
  for(let i=0;i<qs.length;i++){const opts=await after.locator(`[data-ex-q="${i}"]`).evaluateAll(es=>es.map(e=>e.dataset.exO));await both(p=>p.locator(`[data-ex-q="${i}"]`).nth(opts.indexOf(qs[i].correct)).click())}
  await click('[data-ex-check]');assert((await state(after,id)).ex[stage].done);await compare('Exercise complete '+stage);await frame('Exercise complete '+stage);await detail('exercise-complete-'+stage,'.qFeedback');await click('[data-ex-next]');
 }
 // Original O-NET image questions retain zoom and both correct/incorrect feedback.
 const questions=await after.evaluate(()=>window.SLH_ONET.questions);report.onetQuestions=0;
 for(const lesson of [...new Set(questions.map(q=>q.lesson))]){
  for(const p of pages)await open(p,lesson,'e3');
  for(const q of questions.filter(q=>q.lesson===lesson)){
   const img=after.locator(`#onet-image-${q.id} img`);await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode());assert(await img.evaluate(e=>e.naturalWidth>0));
   for(const a of [q.key%4+1,q.key]){await click(`[data-onet-id="${q.id}"][data-onet-answer="${a}"]`);await click(`[data-onet-check="${q.id}"]`);await compare('O-NET '+q.id+' answer '+a)}report.onetQuestions++;
  }
 }
 report.checks.push('Real wrong/success/completed game and exercise feedback; all original O-NET question images and answers');
 // Boundary scores, genuine earned badges, unchanged thresholds and retry shuffle.
 report.examScores=[];let lastOrder;
 for(const score of [11,12,20]){
  for(const p of pages)await open(p,id,'exam');const qs=(await state(after,id)).exam.current.qs;
  if(lastOrder)assert.notEqual(JSON.stringify(qs),lastOrder,'Exam retry reshuffles');lastOrder=JSON.stringify(qs);
  await click('[data-exam-go="19"]');await click('[data-exam-submit]');assert.equal(await after.locator('.examCard').count(),1,'Incomplete exam remains open');
  for(let i=0;i<20;i++){await click(`[data-exam-go="${i}"]`);const answer=i<score?qs[i].correct:qs[i].opts.find(o=>o!==qs[i].correct);const opts=await after.locator('[data-exam-choice]').evaluateAll(es=>es.map(e=>e.dataset.examChoice));await both(p=>p.locator('[data-exam-choice]').nth(opts.indexOf(answer)).click())}
  await click('[data-exam-submit]');const result=(await state(after,id)).exam;assert.equal(result.last,score*5);assert.equal(result.passed,score>=12);await compare('Exam score '+score*5);await frame('Exam score '+score*5);await detail('result-'+score*5,'.resultHero');report.examScores.push(result.last);if(score<20)await click('[data-result-retry]');
 }
 assert.equal(await after.locator('.perfectBadge').count(),1);
 await both(async p=>{await p.reload();await p.locator('#loginUser').fill('M20105');await p.locator('#loginPass').fill('1234');await p.locator('[data-action=login]').click();await p.evaluate(id=>window.__SLH_QA__.reopen(id),id)});assert.equal(await after.locator('.resultHero').count(),1);await saved('Reload login and resume');
 report.checks.push('Continuous G1U1L1 completion; 55% fail, 60% pass, 100% perfect; retry and reload/login resume; full saved storage equals baseline');
 // Non-lesson UI remains outside the global lesson theme.
 const styles=p=>p.evaluate(()=>[...document.querySelectorAll('body,#app,.topbar,.shell,.panel,.gradeCard,.unitCard,.lessonCard')].map(e=>[null,'::before','::after'].map(pseudo=>{const s=getComputedStyle(e,pseudo);return Object.fromEntries([...s].filter(k=>!k.startsWith('--')).map(k=>[k,s.getPropertyValue(k).replaceAll('/before/','/SITE/').replaceAll('/after/','/SITE/')]))})));
 for(const [name,selector] of [['dashboard','[data-action=home]'],['grades','[data-dashboard-grades]'],['units','.gradeCard[data-grade="1"] button'],['lessons','[data-unit="0"]'],['login','[data-action=logout]']]){await click(selector);assert.deepEqual(await styles(after),await styles(before),'Unchanged non-lesson '+name)}
 report.checks.push('Dashboard, grade, unit, lesson selection and login computed styles remain unchanged');
 await open(after,id,'content');await after.locator('.stageHUD [data-stage="lab"]').focus();assert(await after.locator('.stageHUD [data-stage="lab"]').evaluate(e=>parseFloat(getComputedStyle(e).outlineWidth)>=2));await after.keyboard.press('Enter');assert.equal(await after.locator('.stageDot.active').getAttribute('data-stage'),'lab');await after.locator('.stageHUD [data-stage="content"]').focus();await after.keyboard.press('Space');assert.equal(await after.locator('.stageDot.active').getAttribute('data-stage'),'content');
 assert.deepEqual(await after.locator('main').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').map(a=>a.animationName)),[]);report.checks.push('Keyboard focus, Enter/Space navigation and prefers-reduced-motion');
}
