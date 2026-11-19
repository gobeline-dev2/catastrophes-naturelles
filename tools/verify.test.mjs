import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { createModel, tsunamiState } from '../scenes.js';
import { plateModes } from '../tectonics.js';
import { slides } from '../content.js';

test('All presentation scenes produce finite 3D geometry throughout their animation',()=>{
  for(const concept of ['comic'])for(let index=0;index<slides.length;index++){
    const model=createModel(index,concept);
    for(const p of [0,.13,.25,.38,.5,.65,.78,.9,1]){
      model.update(p);model.group.updateMatrixWorld(true);
      model.group.traverse(o=>{
        assert.ok(o.matrixWorld.elements.every(Number.isFinite),`Transform in scene ${index}`);
        if(o.geometry){
          assert.ok(o.geometry.attributes.position.array.every(Number.isFinite),`Vertices in scene ${index}`);
          if(Number.isFinite(o.geometry.drawRange.count))assert.ok(o.geometry.drawRange.count>=0&&o.geometry.drawRange.count<=o.geometry.index.count);
        }
      });
    }
    model.dispose();
  }
});

function mount(reduced=false){
  const dom=new JSDOM(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),{runScripts:'outside-only'});
  const {window}=dom;
  let pending=null,now=0;
  window.matchMedia=()=>({matches:reduced});
  window.requestAnimationFrame=callback=>{pending=callback;return 1;};
  window.cancelAnimationFrame=()=>{pending=null;};
  Object.defineProperty(window.performance,'now',{value:()=>now});
  class Viewer{constructor(){this.lost=false;window.viewer=this;}select(i,mode){this.selected=i;this.mode=mode;}draw(p){this.progress=p;}}
  window.slides=slides;window.NatureRenderer=Viewer;window.plateModes=plateModes;
  const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  window.eval(source);
  return {window,$:id=>window.document.getElementById(id),advance(time){now=time;const cb=pending;pending=null;cb?.(time);},hasPending:()=>pending!==null,close:()=>window.close()};
}
test('Presentation navigation, notes, pause, resume and replay work together',()=>{
  const app=mount();const {$}=app;
  assert.equal($('previous').disabled,true);assert.equal($('animate').hidden,true);
  $('next').click();assert.match($('slide-title').textContent,/trembler/);assert.match($('script').textContent,/séisme/);
  $('animate').click();app.advance(4000);assert.equal($('pause').hidden,false);assert.ok(app.hasPending());
  $('pause').click();assert.equal(app.hasPending(),false);assert.equal($('pause').textContent,'▶ Reprendre');
  $('pause').click();app.advance(34000);assert.equal($('pause').hidden,true);assert.equal($('animate').disabled,false);
  $('animate').click();app.advance(37000);$('next').click();assert.equal(app.hasPending(),false);assert.match($('script').textContent,/tsunami/);
  for(let i=0;i<2;i++)$('next').click();assert.equal($('next').disabled,false);assert.equal($('animate').hidden,false);
  assert.equal(app.window.document.querySelectorAll('.chapter').length,6);assert.match($('script').textContent,/tornade/);assert.equal($('step-count').textContent,'Étape 5 / 5');
  app.window.document.body.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal($('step-count').textContent,'Quiz');
  app.window.document.querySelector('.brand').click();assert.match($('step-count').textContent,/1 \/ 5/);app.close();
});
test('Reduced motion uses four static steps without requesting animation frames',()=>{
  const app=mount(true);app.$('next').click();const states=new Set();
  for(let i=0;i<4;i++){app.$('animate').click();states.add(app.$('plate-name').textContent);assert.equal(app.hasPending(),false);}
  assert.equal(states.size,4);app.close();
});
test('Context loss stops playback and recovery restores the controls',()=>{
  const app=mount();app.$('next').click();app.$('animate').click();
  app.$('scene').dispatchEvent(new app.window.CustomEvent('renderer-unavailable'));
  assert.equal(app.hasPending(),false);assert.equal(app.$('webgl-error').hidden,false);
  app.$('scene').dispatchEvent(new app.window.CustomEvent('renderer-available'));
  assert.equal(app.$('webgl-error').hidden,true);assert.equal(app.$('animate').disabled,false);app.close();
});

test('The beach water retreats visibly, then inundates the sand',()=>{
  const initial=tsunamiState(0),withdrawn=tsunamiState(.4),arrival=tsunamiState(.67),inundated=tsunamiState(1);
  assert.ok(initial.shore-withdrawn.shore>2,'More than two scene units of sand are exposed');
  assert.ok(arrival.waveHeight>1.3,'Incoming wave is clearly taller than beach props');
  assert.ok(inundated.shore>2.8,'Water reaches beyond the parasol and the beach ball');
  for(const concept of ['comic']){
    const model=createModel(2,concept);const water=model.group.getObjectByName('tsunami-water');
    const bounds=p=>{model.update(p);water.geometry.computeBoundingBox();return water.geometry.boundingBox.clone();};
    assert.ok(bounds(0).max.x-bounds(.4).max.x>2);
    assert.ok(bounds(1).max.x>2.8);model.dispose();
  }
});
test('The comic style is fixed and beach step controls still work',()=>{
  const app=mount();app.$('next').click();app.$('next').click();
  const steps=app.window.document.querySelectorAll('.stage-button');
  steps[1].click();assert.match(app.$('scene-status').textContent,/se retire/);
  assert.equal(app.window.document.body.dataset.concept,'comic');assert.equal(app.window.document.querySelector('#concept-options'),null);
  steps[3].click();assert.match(app.$('scene-status').textContent,/inonde/);
  app.$('scrub').value=670;app.$('scrub').dispatchEvent(new app.window.Event('input'));
  assert.match(app.$('scene-status').textContent,/vague arrive/);assert.equal(app.hasPending(),true);app.close();
});
test('All four plate boundaries animate with finite geometry and distinct relative motion',()=>{
  for(const mode of Object.keys(plateModes)){
    const m=createModel(1,'comic',mode);
    const a=m.group.getObjectByName('plate-a'),b=m.group.getObjectByName('plate-b');
    m.update(0);const distance=b.position.x-a.position.x;
    m.update(1);
    if(mode==='divergence')assert.ok(b.position.x-a.position.x>distance+.8);
    if(mode==='collision')assert.ok(b.position.x-a.position.x<distance-.4);
    if(mode==='sliding')assert.ok(b.position.z-a.position.z>1);
    if(mode==='subduction'){const geo=m.group.getObjectByName('descending-plate').geometry;geo.computeBoundingBox();assert.ok(geo.boundingBox.min.y<-1.6);}
    for(const p of [0,.15,.35,.52,.6,.85,1]){m.update(p);m.group.updateMatrixWorld(true);m.group.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.geometry)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});}
    m.dispose();
  }
});
test('One playback visits all plate movements, supports pause, scrub and replay',()=>{
  const app=mount();const {$}=app;
  assert.equal($('plate-sequence').hidden,true);$('next').click();
  assert.equal(app.window.document.querySelector('#plate-picker'),null);
  assert.equal($('plate-sequence').hidden,false);
  $('animate').click();
  const modes=Object.keys(plateModes);
  for(let i=0;i<4;i++){
    app.advance(i*8000);
    assert.equal(app.window.viewer.mode,modes[i]);
    assert.match($('plate-name').textContent,new RegExp(plateModes[modes[i]].term));
    assert.equal(app.window.viewer.progress,0);
    app.advance(i*8000+7500);assert.equal(app.window.viewer.progress,1);
  }
  app.advance(32000);assert.equal(app.hasPending(),false);assert.equal($('animate').disabled,false);
  $('animate').click();assert.equal(app.window.viewer.mode,'subduction');assert.equal(app.window.viewer.progress,0);
  app.advance(41000);assert.equal(app.window.viewer.mode,'divergence');
  $('pause').click();assert.equal(app.hasPending(),false);$('pause').click();
  app.advance(49000);assert.equal(app.window.viewer.mode,'sliding');
  $('scrub').value=250;$('scrub').dispatchEvent(new app.window.Event('input'));
  assert.equal(app.hasPending(),true);assert.equal(app.window.viewer.mode,'divergence');assert.equal(app.window.viewer.progress,0);
  $('scrub').value=1000;$('scrub').dispatchEvent(new app.window.Event('input'));
  assert.equal(app.window.viewer.mode,'collision');assert.equal(app.window.viewer.progress,1);
  $('next').click();assert.equal($('plate-sequence').hidden,true);
  $('previous').click();assert.equal(app.window.viewer.mode,'subduction');assert.equal(app.window.viewer.progress,0);app.close();
});

test('The Quiz tab has three questions plus a bonus, independent feedback and reset',()=>{
  const app=mount();const {$}=app;const doc=app.window.document;
  for(let i=1;i<slides.length;i++)$('next').click();assert.equal($('quiz').hidden,true);
  $('next').click();assert.equal($('quiz').hidden,false);assert.equal(doc.querySelector('.presentation').hidden,true);assert.equal($('next').disabled,true);
  const cards=doc.querySelectorAll('.quiz-card');assert.equal(cards.length,4);
  assert.match(cards[0].textContent,/Quel phénomène fait trembler le sol/);assert.match(cards[3].textContent,/Bonus : Qu’est-ce qu’une tornade/);
  const correct=[1,0,1,2];
  cards.forEach((card,i)=>{const buttons=card.querySelectorAll('button');assert.equal(buttons.length,3);buttons[(correct[i]+1)%3].click();assert.equal(card.querySelector('.quiz-feedback').textContent,'Essaie encore !');buttons[correct[i]].click();assert.match(card.querySelector('.quiz-feedback').textContent,/Bravo/);});
  $('previous').click();assert.equal($('quiz').hidden,true);assert.equal(doc.querySelector('.presentation').hidden,false);
  $('next').click();assert.match(cards[0].querySelector('.quiz-feedback').textContent,/Bravo/);
  $('quiz-reset').click();doc.querySelectorAll('.quiz-feedback').forEach(el=>assert.equal(el.textContent,''));
  doc.querySelector('.chapters').children[1].click();$('animate').click();assert.ok(app.hasPending());
  doc.querySelector('.chapters').lastElementChild.click();assert.equal(app.hasPending(),false);assert.equal($('quiz').hidden,false);app.close();
});

test('Pause freezes the scene and resume excludes time spent paused',()=>{
  const app=mount();const {$}=app;$('next').click();$('animate').click();
  app.advance(5000);const before=app.window.viewer.progress;const mode=app.window.viewer.mode;
  $('pause').click();assert.equal($('pause').textContent,'▶ Reprendre');
  app.advance(65000);assert.equal(app.window.viewer.progress,before);assert.equal(app.hasPending(),false);
  $('pause').click();app.advance(65000);assert.equal(app.window.viewer.progress,before);assert.equal(app.window.viewer.mode,mode);
  app.advance(66000);assert.ok(app.window.viewer.progress>before);assert.equal($('pause').textContent,'⏸ Pause');app.close();
});

test('Selecting a position starts playback there, including after a pause',()=>{
  const app=mount();const {$}=app;$('next').click();
  app.window.document.querySelectorAll('.stage-button')[2].click();
  assert.equal(app.window.viewer.mode,'sliding');assert.equal(app.window.viewer.progress,0);assert.ok(app.hasPending());
  app.advance(2000);assert.ok(app.window.viewer.progress>0);
  $('pause').click();$('scrub').value=300;$('scrub').dispatchEvent(new app.window.Event('input'));
  assert.ok(app.hasPending());assert.equal($('pause').textContent,'⏸ Pause');assert.equal($('scrub').value,'300');
  app.advance(3000);assert.ok(Number($('scrub').value)>300);
  $('scrub').value=1000;$('scrub').dispatchEvent(new app.window.Event('input'));assert.equal(app.hasPending(),false);
  $('next').click();assert.equal(app.hasPending(),false);app.close();
  const reduced=mount(true);reduced.$('next').click();reduced.$('scrub').value=500;reduced.$('scrub').dispatchEvent(new reduced.window.Event('input'));assert.equal(reduced.hasPending(),false);reduced.close();
});

test('Fullscreen fallback keeps playback and can be exited with Escape',async()=>{
  const app=mount();const {$}=app;$('next').click();$('animate').click();app.advance(2000);
  $('fullscreen').click();await Promise.resolve();assert.equal($('animation-panel').classList.contains('expanded'),true);assert.ok(app.hasPending());
  $('pause').click();assert.equal(app.hasPending(),false);
  app.window.document.body.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal($('animation-panel').classList.contains('expanded'),false);assert.equal($('fullscreen').getAttribute('aria-pressed'),'false');
  $('pause').click();assert.ok(app.hasPending());app.close();
});
