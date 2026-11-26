import { slides } from './content.js';
import { NatureRenderer } from './scenes.js?v=no-characters-6';
import { plateModes } from './tectonics.js?v=webgl-2';

const $=id=>document.getElementById(id);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const plateOrder=Object.keys(plateModes);
const plateMovementMs=8000,platePauseMs=10000;
const plateSegmentMs=plateMovementMs+platePauseMs;
const plateDuration=plateOrder.length*plateMovementMs+(plateOrder.length-1)*platePauseMs;
const plateStarts=plateOrder.map((_,i)=>i*plateSegmentMs/plateDuration);
const duration=()=>current===1?plateDuration:16000;
const plateSnapshots=plateOrder.map((_,i)=>(i*plateSegmentMs+7000)/plateDuration);
let current=0,animation=null,startTime=0,elapsed=0,paused=false,stage=-1,viewer=null,plateMode='subduction',progress=0;
const activeSlide=()=>slides[current];
try { viewer=new NatureRenderer($('scene'),$('scene-labels')); }
catch(error) { $('webgl-error').hidden=false;$('scene').hidden=true;console.error('Initialisation WebGL impossible',error); }
function draw(p=0){
  progress=clamp(p);
  const s=activeSlide();
  let localProgress=progress,nextStage,status;
  if(current===1){
    const time=progress*plateDuration;
    const segment=Math.min(plateOrder.length-1,Math.floor(time/plateSegmentMs));
    const segmentTime=time-segment*plateSegmentMs;
    const mode=plateOrder[segment];
    // Each movement has a one-second still introduction and a one-second final hold.
    localProgress=clamp((segmentTime-1000)/6000);
    if(mode!==plateMode){plateMode=mode;viewer?.select(1,mode);}
    const info=plateModes[mode];
    setCoverTitle($('plate-name'),String(segment+1)+' / 4 · '+info.term);
    $('plate-description').textContent=info.name;
    $('scene-label').textContent=info.label;
    $('scene').setAttribute('aria-label',info.lead);
    nextStage=segment;
    const phase=Math.min(3,[0,.2,.5,.7].filter(t=>localProgress>=t).length-1);
    status=info.status[phase];
    if(segment<plateOrder.length-1&&segmentTime>=plateMovementMs){
      const remaining=Math.ceil((plateSegmentMs-segmentTime)/1000);
      status='Pause · '+plateModes[plateOrder[segment+1]].term+' dans '+remaining+' s';
    }
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
function playFrom(position=0){
  if(current===slides.length)return;
  stop();draw(position);
  if(reducedMotion.matches||!viewer||viewer.lost||activeSlide().static||progress>=1)return;
  elapsed=progress*duration();startTime=performance.now()-elapsed;
  $('animate').disabled=true;$('pause').hidden=false;$('pause').textContent='⏸ Pause';
  animation=requestAnimationFrame(tick);
}
function setCoverTitle(element,label){
  if(element.classList.contains('cover-title')&&element.getAttribute('aria-label')===label)return;
  element.classList.add('cover-title');element.setAttribute('aria-label',label);
  element.replaceChildren(...label.split(' ').flatMap((word,i)=>{
    const span=document.createElement('span');span.className='cover-word';span.dataset.word=word;span.setAttribute('aria-hidden','true');span.textContent=word;
    return i?[document.createTextNode(' '),span]:[span];
  }));
}
function render(index){
  stop();current=clamp(index,0,slides.length);
  const isQuiz=current===slides.length;
  document.querySelector('.presentation').hidden=isQuiz;document.querySelector('.speaker').hidden=isQuiz||!!activeSlide()?.hideExplanations;$('quiz').hidden=!isQuiz;
  $('previous').disabled=current===0;$('next').disabled=isQuiz;$('next').hidden=isQuiz;$('next').textContent=current===slides.length-1?'Quiz →':'Suivant →';
  document.querySelectorAll('.chapter').forEach((el,i)=>{el.classList.toggle('active',i===current);if(i===current)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  if(isQuiz)return;
  const s=activeSlide();
  setCoverTitle($('slide-title'),s.title);$('lead').textContent=s.lead;
  $('scene-label').textContent=s.label;$('scene').setAttribute('aria-label',s.lead);
  $('script').textContent=s.script;
  $('fullscreen').hidden=!!s.static;
  $('animate').hidden=!!s.static;$('animate').textContent=reducedMotion.matches?'Voir les étapes →':'▶ Lancer l’animation';
  document.querySelectorAll('.chapter').forEach((el,i)=>{el.classList.toggle('active',i===current);if(i===current)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  $('timeline').hidden=!!s.static;
  const shortLabels=current===1?plateOrder.map(mode=>plateModes[mode].term):s.stageLabels||['Au début','Ça bouge','Le phénomène','À la fin'];
  $('stage-buttons').replaceChildren(...shortLabels.map((text,i)=>{const b=document.createElement('button');b.type='button';b.className='stage-button';b.textContent=text;b.setAttribute('aria-label',current===1?text:s.status[i]||text);b.addEventListener('click',()=>playFrom((current===1?(reducedMotion.matches?plateSnapshots:plateStarts):s.snapshots||[0,.38,.66,1])[i]));return b;}));
  $('plate-sequence').hidden=current!==1;
  plateMode='subduction';
  viewer?.select(s.sceneIndex??current,plateMode);draw();
}
function tick(now){elapsed=now-startTime;draw(clamp(elapsed/duration()));if(elapsed<duration()){animation=requestAnimationFrame(tick);}else{animation=null;$('pause').hidden=true;$('animate').disabled=!viewer||viewer.lost;$('animate').textContent='↻ Revoir l’animation';}}
document.querySelector('.chapters').replaceChildren(...[...slides,{nav:"Quiz"}].map((s,i)=>{const b=document.createElement('button');b.type='button';b.className='chapter';b.innerHTML=`<span class="chapter-number">${String(i+1).padStart(2,'0')}</span>${s.nav}`;b.addEventListener('click',()=>render(i));return b;}));
$('animate').addEventListener('click',()=>{if(reducedMotion.matches){const next=stage>=3?0:stage+1;draw((current===1?plateSnapshots:activeSlide().snapshots||[0,.38,.66,1])[next]);return;}playFrom(0);});
$('scrub').addEventListener('input',()=>playFrom(Number($('scrub').value)/1000));
$('pause').addEventListener('click',()=>{if(paused){paused=false;startTime=performance.now()-elapsed;animation=requestAnimationFrame(tick);$('pause').textContent='⏸ Pause';}else{paused=true;cancelAnimationFrame(animation);animation=null;$('pause').textContent='▶ Reprendre';}});
$('previous').addEventListener('click',()=>render(current-1));$('next').addEventListener('click',()=>render(current+1));
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();render(0);});
document.addEventListener('keydown',e=>{if(document.fullscreenElement||document.body.classList.contains('animation-expanded')||e.target.closest('button,summary,a,input,textarea,select'))return;if(e.key==='ArrowRight'){e.preventDefault();render(current+1);}if(e.key==='ArrowLeft'){e.preventDefault();render(current-1);}});
$('scene').addEventListener('renderer-unavailable',()=>{stop();$('webgl-error').hidden=false;});
$('scene').addEventListener('renderer-available',()=>{$('webgl-error').hidden=true;$('animate').disabled=false;});
const quizQuestions=[
  {question:'Quel phénomène fait trembler le sol ?',answers:['une tornade','un séisme','un tsunami'],correct:1,explanation:'Un séisme est un tremblement de terre.'},
  {question:'Comment appelle-t-on le magma quand il sort du volcan ?',answers:['la lave','la pluie','le vent'],correct:0,explanation:'À la surface, le magma s’appelle la lave.'},
  {question:'Qu’est-ce qu’un tsunami ?',answers:['de la lave qui sort','de grandes vagues','de l’air qui tourne'],correct:1,explanation:'Un tsunami est une série de grandes vagues qui peuvent inonder la côte.'},
  {question:'Qu’est-ce qu’une tornade ?',answers:['une montagne','une grande vague','une colonne d’air qui tourne très vite'],correct:2,explanation:'Une tornade relie un nuage d’orage au sol.'}
];
function resetQuiz(){
  $('quiz-questions').replaceChildren(...quizQuestions.map((q,i)=>{
    const card=document.createElement('section');card.className='quiz-card';card.dataset.question=i;
    const title=document.createElement('h2');title.id='quiz-question-'+i;setCoverTitle(title,(i===3?'Bonus : ':String(i+1)+'. ')+q.question);
    const choices=document.createElement('div');choices.className='quiz-answers';choices.setAttribute('role','group');choices.setAttribute('aria-labelledby',title.id);
    const feedback=document.createElement('p');feedback.className='quiz-feedback';feedback.setAttribute('role','status');
    q.answers.forEach((answer,j)=>{
      const button=document.createElement('button');button.type='button';button.className='button';button.dataset.answer='ABC'[j];button.setAttribute('aria-pressed','false');button.textContent='Réponse '+'ABC'[j]+' : '+answer;
      button.addEventListener('click',()=>{
        choices.querySelectorAll('button').forEach(choice=>choice.setAttribute('aria-pressed',choice===button));
        feedback.textContent=j===q.correct?'Bravo ! '+q.explanation:'Essaie encore !';
      });choices.append(button);
    });card.append(title,choices,feedback);return card;
  }));
}
$('quiz-reset').addEventListener('click',resetQuiz);
resetQuiz();
setCoverTitle($('quiz-title'),$('quiz-title').textContent);
render(0);

const panel=$('animation-panel');
function syncFullscreen(){
  const expanded=document.fullscreenElement===panel||panel.classList.contains('expanded');
  $('fullscreen').textContent=expanded?'Quitter le plein écran':'⛶ Plein écran';
  $('fullscreen').setAttribute('aria-pressed',expanded);
  document.body.classList.toggle('animation-expanded',expanded);
  viewer?.resize?.();
}
$('fullscreen').addEventListener('click',async()=>{
  if(document.fullscreenElement===panel){await document.exitFullscreen();}
  else if(panel.classList.contains('expanded')){panel.classList.remove('expanded');}
  else {try{if(!panel.requestFullscreen)throw new Error('unsupported');await panel.requestFullscreen();}catch{panel.classList.add('expanded');}}
  syncFullscreen();
});
document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel.classList.contains('expanded')){panel.classList.remove('expanded');syncFullscreen();}});
