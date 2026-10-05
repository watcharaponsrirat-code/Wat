import assert from 'node:assert/strict';

export async function checkSimulationsInBrowser(page){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('../index.html',import.meta.url).href);
  const ids=await page.evaluate(()=>window.__SLH_QA__.lessonIds);
  let controls=0;
  for(const id of ids){
    await page.evaluate(id=>window.__SLH_QA__.open(id,'lab'),id);
    assert.equal(await page.locator('.simPanel').count(),1);
    assert.equal(await page.locator('textarea,[data-lab-check]').count(),0);
    const inputs=await page.locator('[data-sim-control]').evaluateAll(els=>els.map(e=>({key:e.dataset.simControl,select:e.tagName==='SELECT',max:e.tagName==='SELECT'?e.options.length-1:Number(e.max)})));
    for(const input of inputs){
      const locator=page.locator('[data-sim-control="'+input.key+'"]');
      if(input.select)await locator.selectOption(String(input.max));
      else {await locator.fill(String(input.max));await locator.dispatchEvent('input')}
      const actual=await page.evaluate(({id,key})=>window.__SLH_QA__.snapshot(id).simulation[id].values[key],{id,key:input.key});
      assert.equal(actual,input.max);controls++;
    }
    for(const width of [1366,390,320]){
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,id+' viewport '+width);
    }
    await page.locator('[data-sim-reset]').click();
    const before=await page.evaluate(id=>window.__SLH_QA__.snapshot(id).simulation[id].values,id);
    if(inputs.some(c=>c.key==='t')){
      await page.locator('[data-sim-play]').click();
      await page.waitForFunction(id=>window.__SLH_QA__.snapshot(id).simulation[id].values.t>0,id);
      if(await page.locator('[data-sim-play]').getAttribute('aria-pressed')==='true')await page.locator('[data-sim-play]').click({force:true});
      assert.equal(await page.locator('[data-sim-play]').getAttribute('aria-pressed'),'false');
      await page.locator('[data-sim-reset]').click();
    }
    assert.deepEqual(await page.evaluate(id=>window.__SLH_QA__.snapshot(id).simulation[id].values,id),before);
    assert.equal(await page.evaluate(id=>window.__SLH_QA__.snapshot(id).xp,id),0);
  }
  // A running timer must be cleaned up when leaving the simulation.
  const id='G3U3L1';await page.evaluate(id=>window.__SLH_QA__.open(id,'lab'),id);
  await page.locator('[data-sim-play]').click();
  await page.waitForFunction(()=>window.__SLH_QA__.snapshot('G3U3L1').simulation.G3U3L1.values.t>0);
  await page.locator('[data-stage="g1"]').first().click();
  const saved=await page.evaluate(id=>JSON.stringify(window.__SLH_QA__.snapshot(id).simulation[id]),id);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(id=>JSON.stringify(window.__SLH_QA__.snapshot(id).simulation[id]),id),saved);
  await page.reload();await page.evaluate(id=>window.__SLH_QA__.open(id,'lab'),id);
  assert.equal(await page.evaluate(id=>JSON.stringify(window.__SLH_QA__.snapshot(id).simulation[id]),id),saved);
  assert.deepEqual(errors,[]);
  return {lessons:ids.length,controls,widths:[1366,390,320],errors};
}
