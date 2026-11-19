import { slides } from './content.js';
import { NatureRenderer } from './scenes.js';
import { plateModes } from './tectonics.js';

const $=id=>document.getElementById(id);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const plateOrder=Object.keys(plateModes);
const duration=()=>current===1?32000:16000;
const plateSnapshots=[.21,.46,.71,.96];
let current=0,animation=null,startTime=0,elapsed=0,paused=false,stage=-1,viewer=null,plateMode='subduction',progress=0;
const activeSlide=()=>slides[current];
try { viewer=new NatureRenderer($('scene'),$('scene-labels')); }
catch(error) { $('webgl-error').hidden=false;$('scene').hidden=true;console.error('Initialisation WebGL impossible',error); }
function draw(p=0){
  progress=clamp(p);
  const s=activeSlide();
  let localProgress=progress,nextStage,status;
  if(current===1){
    const segment=Math.min(3,Math.floor(progress*4));
    const mode=plateOrder[segment];
    // Each movement has a one-second still introduction and a one-second final hold.
    localProgress=clamp((progress*4-segment-.125)/.75);
    if(mode!==plateMode){plateMode=mode;viewer?.select(1,mode);}
    const info=plateModes[mode];
    $('plate-name').textContent=String(segment+1)+' / 4 · '+info.term;
    $('plate-description').textContent=info.name;
    $('scene-label').textContent=info.label;
    $('scene').setAttribute('aria-label',info.lead);
    nextStage=segment;
    const phase=Math.min(3,[0,.2,.5,.7].filter(t=>localProgress>=t).length-1);
    status=info.status[phase];
  }else{
    const thresholds=s.stageTimes||[0,.25,.5,.75];
    nextStage=Math.min(s.status.length-1,thresholds.filter(t=>progress>=t).length-1);
    status=s.status[nextStage];
  }
  viewer?.draw(localProgress);
  $('scrub').value=Math.round(progress*1000);$('time-value').textContent=Math.round(progress*100)+' %';
  if($('scene-status').textContent!==status)$('scene-status').textContent=status;
  if(stage!==nextStage){stage=nextStage;document.querySelectorAll('.stage-button').forEach((button,i)=>button.setAttribute('aria-pressed',i===stage));}
}
function stop(){if(animation!==null)cancelAnimationFrame(animation);animation=null;paused=false;elapsed=0;stage=-1;$('pause').hidden=true;$('animate').disabled=!viewer||viewer.lost;}
function render(index){
  stop();current=clamp(index,0,slides.length-1);const s=activeSlide();
  $('slide-title').textContent=s.title;$('lead').textContent=s.lead;
  $('scene-label').textContent=s.label;$('scene').setAttribute('aria-label',s.lead);
  $('script').textContent=s.script;
  $('quiz').hidden=current!==slides.length-1;
  $('quiz-feedback').textContent='';
  document.querySelectorAll('[data-answer]').forEach(button=>button.setAttribute('aria-pressed','false'));
  $('step-count').textContent=`Étape ${current+1} / ${slides.length}`;$('duration').textContent=s.duration;
  $('previous').disabled=current===0;$('next').disabled=current===slides.length-1;$('next').textContent='Suivant →';
  $('animate').hidden=current===0;$('animate').textContent=reducedMotion.matches?'Voir les étapes →':'▶ Lancer l’animation';
  document.querySelectorAll('.chapter').forEach((el,i)=>{el.classList.toggle('active',i===current);if(i===current)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  $('timeline').hidden=current===0;
  const shortLabels=current===1?plateOrder.map(mode=>plateModes[mode].term):s.stageLabels||['Au début','Ça bouge','Le phénomène','À la fin'];
  $('stage-buttons').replaceChildren(...shortLabels.map((text,i)=>{const b=document.createElement('button');b.type='button';b.className='stage-button';b.textContent=text;b.setAttribute('aria-label',s.status[i]||text);b.addEventListener('click',()=>{stop();draw((current===1?plateSnapshots:s.snapshots||[0,.38,.66,1])[i]);});return b;}));
  $('plate-sequence').hidden=current!==1;
  plateMode='subduction';
  viewer?.select(current,plateMode);draw();
}
function tick(now){elapsed=now-startTime;draw(clamp(elapsed/duration()));if(elapsed<duration()){animation=requestAnimationFrame(tick);}else{animation=null;$('pause').hidden=true;$('animate').disabled=!viewer||viewer.lost;$('animate').textContent='↻ Revoir l’animation';}}
document.querySelector('.chapters').replaceChildren(...slides.map((s,i)=>{const b=document.createElement('button');b.type='button';b.className='chapter';b.innerHTML=`<span class="chapter-number">${String(i+1).padStart(2,'0')}</span>${s.nav}`;b.addEventListener('click',()=>render(i));return b;}));
$('animate').addEventListener('click',()=>{if(reducedMotion.matches){const next=stage>=3?0:stage+1;draw((current===1?plateSnapshots:activeSlide().snapshots||[0,.38,.66,1])[next]);return;}stop();draw(0);$('animate').disabled=true;$('pause').hidden=false;$('pause').textContent='Pause';startTime=performance.now();animation=requestAnimationFrame(tick);});
$('scrub').addEventListener('input',()=>{stop();draw(Number($('scrub').value)/1000);});
$('pause').addEventListener('click',()=>{if(paused){paused=false;startTime=performance.now()-elapsed;animation=requestAnimationFrame(tick);$('pause').textContent='Pause';}else{paused=true;cancelAnimationFrame(animation);animation=null;$('pause').textContent='Reprendre';}});
$('previous').addEventListener('click',()=>render(current-1));$('next').addEventListener('click',()=>render(current+1));
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();render(0);});
document.addEventListener('keydown',e=>{if(e.target.closest('button,summary,a,input,textarea,select'))return;if(e.key==='ArrowRight'){e.preventDefault();render(current+1);}if(e.key==='ArrowLeft'){e.preventDefault();render(current-1);}});
$('scene').addEventListener('renderer-unavailable',()=>{stop();$('webgl-error').hidden=false;});
$('scene').addEventListener('renderer-available',()=>{$('webgl-error').hidden=true;$('animate').disabled=false;});
document.querySelectorAll('[data-answer]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-answer]').forEach(choice=>choice.setAttribute('aria-pressed',choice===button));
  $('quiz-feedback').textContent=button.dataset.answer==='B'?'Bravo ! Un séisme est un tremblement de terre.':'Essaie encore !';
}));
render(0);
