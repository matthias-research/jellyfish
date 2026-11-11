import {setupLayout} from './layout.js';
import {moveQuality} from './move-quality.js';
import {THEMES,themeName,applyTheme} from './themes.js';
import {checkerDestinations} from './move-options.js';
import {MOTION_DEFAULTS,motionSettings,checkerPosition,animateChecker} from './animation.js';
import {recordedStatistics} from './statistics.js';
import {validateSave} from './save.js';
import * as R from './rules.js';

const $=s=>document.querySelector(s), NS='http://www.w3.org/2000/svg';
let settings={...MOTION_DEFAULTS,opponent:'computer',target:7,level:7,flip:false,confirm:true,playMode:'destinations',theme:'walnut'}, board,match,player=1,dice=[],turns=[],prefix=[],turnStart,selected=null,opening=true,busy=false,ai=null,epoch=0,history=[],hintText='',timeline=[],timelineAt=0;
try{Object.assign(settings,JSON.parse(localStorage.getItem('jellyfish-settings')||'{}'));}catch{}
Object.assign(settings,motionSettings(settings));
let animationState=null,turnPhase='idle',autoplay=null;
let evaluatorReady=false,evaluationKey='',evaluationTimer,playedRankKey='';
let cubeFeedback=null;
let hintOverlay=null,hintTimer,hintCycle=null,currentEvaluation=null;
const hintPositionKey=()=>JSON.stringify([epoch,board,player,dice,prefix,match,settings.level]);
function clearHintArrows(){clearTimeout(hintTimer);if(hintOverlay)hintText='';hintOverlay=null;$('#hint-arrows')?.remove();if(currentEvaluation)paintEvaluation(currentEvaluation.probability,currentEvaluation.status);}
function cancelMotion(){autoplay=null;animationState=null;turnPhase='idle';}
const checkerColor=p=>themeName(settings.theme)==='heritage'?(p===1?'Silver':'Red'):(p===1?'White':'Black');
const name=p=>p===1?'You':settings.opponent==='computer'?'JellyFish':'Player 2';
const rand=()=>{const a=new Uint32Array(1);do{crypto.getRandomValues(a);}while(a[0]>=4294967292);return a[0]%6+1;};
function message(s){$('#status').textContent=s;}
function log(s){history.push(s);renderLog();}
function renderLog(){$('#log').replaceChildren(...history.map(s=>{const li=document.createElement('li');li.textContent=s;return li;}));}
function modal(title,body,buttons=[['OK',()=>{}]]){const d=$('#dialog');if(d.open)d.close();$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#dialog-buttons').replaceChildren(...buttons.map(([title,fn])=>{const b=document.createElement('button');b.textContent=title;b.type='button';b.onclick=()=>{d.close();fn();};return b;}));d.showModal();}
function gameResultText(){const {winner,points}=match.result;return `${name(winner)} ${winner===1?'win':'wins'} ${points} point${points===1?'':'s'}`;}
function showGameResult(){if(!match.result)return;modal('Game finished','<p>'+gameResultText()+'</p>');}
function reset(){epoch++;cubeFeedback=null;cancelMotion();busy=false;board=R.initialBoard();match=R.createMatch(Number(settings.target));player=1;opening=true;dice=[];prefix=[];turns=[];selected=null;history=[];hintText='';log('New '+(settings.target?settings.target+' point match':'money game')+'.');timeline=[];checkpoint();message('Ready');render();}
function startTurn(values){dice=settings.playMode==='jellyfish'?[...values].sort((a,b)=>b-a):values;prefix=[];selected=null;turnStart=R.cloneBoard(board);turns=R.legalTurns(board,player,dice);hintText='';log(name(player)+' rolls '+dice.join('–')+'.');render();if(isComputer()&&!autoplay)computer();}
function isComputer(){return !opening&&settings.opponent==='computer'&&player===-1&&!match.result;}
function available(){return turns.filter(t=>prefix.every((m,i)=>same(m,t.moves[i])));}
const same=(a,b)=>!!b&&a.from===b.from&&a.to===b.to&&a.die===b.die;
function choices(){return available().map(t=>t.moves[prefix.length]).filter(Boolean);}
function destinations(from){return checkerDestinations(available(),prefix.length,from);}
function remainingDice(){const remaining=dice[0]===dice[1]?Array(4).fill(dice[0]):[...dice];for(const m of prefix){const i=remaining.indexOf(m.die);if(i>=0)remaining.splice(i,1);}return remaining;}
function complete(){return dice.length>0&&available().every(t=>t.moves.length===prefix.length);}
function assessCubeAction(action){
  if(opening||autoplay||isComputer()||!evaluatorReady||!R.canDouble(match,player))return;
  const request={epoch,player,action,pending:true};cubeFeedback=request;
  ai.assessCubeDecision(R.cloneBoard(board),player,{...engineContext(),cubeOwner:match.cubeOwner}).then(result=>{
    if(cubeFeedback!==request||epoch!==request.epoch)return;
    request.assessment=moveQuality(0,-(action==='Double'?result.doubleLoss:result.noDoubleLoss));
    request.title=result.source;request.pending=false;updatePlayedRank();
  }).catch(()=>{if(cubeFeedback===request){request.pending=false;request.failed=true;updatePlayedRank();}});
}
function showCubeFeedback(output){
  if(!cubeFeedback||cubeFeedback.epoch!==epoch||cubeFeedback.player!==player||autoplay)return;
  const {action,assessment,pending,failed,title}=cubeFeedback;
  output.title=title||'Pre-roll cube decision assessment';
  if(pending){output.textContent='Evaluating '+action.toLowerCase()+'…';return;}
  if(failed||!assessment){output.textContent='Cube assessment unavailable';return;}
  output.dataset.quality=assessment.quality;output.dataset.loss=assessment.loss.toFixed(3);
  output.textContent=assessment.quality==='ok'?'Good':assessment.label;
  output.title=`${action} · estimated cube loss ${assessment.loss.toFixed(3)}. ${title||''}`;
}
function roll(){if(busy||dice.length||match.result||match.pendingDouble)return;if(opening){let a=rand(),b=rand();while(a===b){log('Opening roll tied at '+a+'. Roll again.');a=rand();b=rand();}player=a>b?1:-1;opening=false;log(name(player)+' wins the opening roll.');startTurn([a,b]);}else{if(!cubeFeedback||cubeFeedback.epoch!==epoch)assessCubeAction('No double');startTurn([rand(),rand()]);}}
async function move(m){return moveSequence([m]);}
async function moveSequence(moves){if(busy||isComputer())return;const token=epoch;busy=true;try{for(const m of moves){if(token!==epoch)return;await animatedMove(m,token);}}catch(e){if(token===epoch){cancelMotion();message('Move error: '+e.message);}}finally{if(token===epoch){busy=false;turnPhase='idle';render();}}}
async function animatedMove(m,token){
  const before=R.cloneBoard(board),movingPlayer=player,flip=settings.flip,duration=settings.animationMs;
  board=R.applyMove(board,player,m);prefix.push(m);selected=null;hintText='';
  if(!duration){render();return;}
  const count=(b,loc,p)=>loc===-1?b.bar[R.playerIndex(p)]:loc===24?b.off[R.playerIndex(p)]:Math.abs(b.points[loc]);
  const from=checkerPosition(m.from,movingPlayer,count(before,m.from,movingPlayer),flip);
  const to=checkerPosition(m.to,movingPlayer,count(board,m.to,movingPlayer),flip);
  const visible=R.cloneBoard(before);
  if(m.from===-1)visible.bar[R.playerIndex(movingPlayer)]--;else visible.points[m.from]-=movingPlayer;
  animationState={board:visible,sprites:[{player:movingPlayer,pose:from}],flip};turnPhase='moving';
  if(m.hit){
    visible.points[m.to]=0;
    const hitFrom=checkerPosition(m.to,-movingPlayer,1,flip),hitTo=checkerPosition(-1,-movingPlayer,board.bar[R.playerIndex(-movingPlayer)],flip);
    animationState.sprites.push({player:-movingPlayer,pose:hitFrom});render();
    if(!await animateChecker(from,to,duration,pose=>updateSprite(0,pose),()=>token===epoch))return;
    if(!await animateChecker(hitFrom,hitTo,duration,pose=>updateSprite(1,pose),()=>token===epoch))return;
  }else{
    render();
    if(!await animateChecker(from,to,duration,pose=>updateSprite(0,pose),()=>token===epoch))return;
  }
  animationState=null;turnPhase='idle';render();
}
function updateSprite(index,pose){if(!animationState)return;animationState.sprites[index].pose=pose;const g=$(`[data-moving-checker="${index}"]`);if(g)g.setAttribute('transform',`translate(${pose.x} ${pose.y}) scale(1 ${pose.scaleY})`);}

let dragStart=null,suppressClick=false;
function point(p){
  if(suppressClick){suppressClick=false;return;}
  if(busy||isComputer()||!dice.length||match.result)return;
  if(settings.playMode==='jellyfish'){
    const remaining=remainingDice(),legal=choices().filter(m=>m.from===p);
    let m=legal.find(m=>m.die===remaining[0]);
    if(!m){m=legal.find(m=>remaining.includes(m.die));if(m)swapDice();}
    if(m)move(m);else message('This checker has no legal move. Choose another checker.');
    return;
  }
  if(selected!==null){const path=destinations(selected).get(p);if(path){moveSequence(path);return;}}
  const options=destinations(p);
  if(options.size===1){moveSequence(options.values().next().value);return;}
  selected=options.size?p:null;render();
}
// Check before checker handlers run: the click making the last move must not
// also submit that move when it bubbles back through the board.
$('#board').addEventListener('click',e=>{
  if(e.target.closest('#swap-dice')||(e.target.closest('[data-die]')&&!complete()))return;
  if(e.detail>1&&dice.length){e.preventDefault();e.stopImmediatePropagation();return;}
  if(e.button!==0||suppressClick||busy||isComputer()||match.pendingDouble!==null||$('#dialog').open)return;
  if(match.result){e.preventDefault();e.stopImmediatePropagation();actions.next();return;}
  if(!dice.length||complete()){
    e.preventDefault();e.stopImmediatePropagation();
    if(!dice.length)roll();else finish();
  }
},true);
function quickPoint(p){if(settings.playMode==='jellyfish')return;if(busy||isComputer())return;const m=choices().find(m=>m.from===p);if(m)move(m);}
function undo(){if(busy||isComputer()||!prefix.length)return;prefix.pop();board=R.cloneBoard(turnStart);for(const m of prefix)board=R.applyMove(board,player,m);selected=null;render();}
function finish(){if(busy||!complete()||match.result)return;cubeFeedback=null;const desc=prefix.map(m=>(m.from===-1?'bar':m.from+1)+'/'+(m.to===24?'off':m.to+1)+(m.hit?'*':'')).join(' ');log(name(player)+': '+(desc||'cannot move')+'.');if(R.winner(board)){match=R.finishGame(match,board);dice=[];log(gameResultText()+'.');checkpoint();render();if(!autoplay)showGameResult();return;}player=-player;dice=[];prefix=[];turns=[];selected=null;checkpoint();render();if(isComputer()&&!autoplay){const token=epoch;setTimeout(()=>{if(token===epoch&&isComputer()&&!dice.length&&!busy)prepareComputer();},450);}}
async function computer(){
  if(!ai){message('Computer evaluator is loading.');return;}
  const token=epoch;busy=true;turnPhase='pause';render();
  try{
    const [best]=await Promise.all([ai.chooseTurn(board,player,dice,engineContext()),new Promise(r=>setTimeout(r,settings.dicePauseMs)).then(()=>{if(token===epoch&&turnPhase==='pause'){turnPhase='thinking';render();}})]);
    if(token!==epoch)return;
    const legal=turns.find(t=>t.moves.length===best.moves.length&&t.moves.every((m,i)=>same(m,best.moves[i])));
    if(!legal)throw Error('Evaluator returned an illegal turn.');
    for(const m of legal.moves){if(token!==epoch)return;await animatedMove(m,token);}
    if(token!==epoch)return;busy=false;turnPhase='idle';finish();
  }catch(e){if(token!==epoch)return;busy=false;cancelMotion();message('Computer error: '+e.message);render();}
}

function canFinishGame(){return evaluatorReady&&!busy&&!autoplay&&!match.result&&match.pendingDouble===null&&(!prefix.length||complete());}
async function finishGame(){
  if(autoplay){autoplay.stop=true;render();return;}
  if(!canFinishGame())return;
  const run={token:++epoch,stop:false};autoplay=run;busy=true;selected=null;clearHintArrows();hintText='';
  const current=()=>autoplay===run&&epoch===run.token;
  const context=()=>({...engineContext(),level:5});
  message('Finishing game automatically…');render();
  try{
    while(current()&&!match.result&&!run.stop){
      if(dice.length&&complete()){busy=false;finish();busy=true;if(match.result)break;}
      if(!dice.length){
        if(!opening&&R.canDouble(match,player)){
          const offer=await ai.cubeAdvice(board,player,context());if(!current())return;
          if(offer.offer){
            const offerer=player;
            // Evaluate both sides before changing the cube, so cancellation leaves no pending offer.
            const response=await ai.cubeAdvice(board,-player,context());if(!current())return;
            match=R.respondDouble(R.offerDouble(match,offerer),response.take);
            log(name(offerer)+' doubles; '+name(-offerer)+(response.take?' takes at '+match.cube+'.':' drops.'));
            if(match.result){log(name(match.result.winner)+' wins '+match.result.points+' point(s).');checkpoint();render();break;}
          }
        }
        let values=[rand(),rand()];
        if(opening){while(values[0]===values[1])values=[rand(),rand()];player=values[0]>values[1]?1:-1;opening=false;log(name(player)+' wins the opening roll.');}
        startTurn(values);
      }
      const best=await ai.chooseTurn(board,player,dice,context());if(!current())return;
      const legal=turns.find(t=>t.moves.length===best?.moves.length&&t.moves.every((m,i)=>same(m,best.moves[i])));
      if(!legal)throw Error('Evaluator returned an illegal turn.');
      for(const move of legal.moves){board=R.applyMove(board,player,move);prefix.push(move);}
      busy=false;finish();busy=true;
      // Yield between turns so the board and Stop button remain responsive.
      if(!match.result)await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(current())message(match.result?'Game finished.':'Automatic play stopped.');
  }catch(error){if(current())message('Finish game failed: '+error.message);}
  finally{if(current()){autoplay=null;busy=false;turnPhase='idle';render();if(match.result)showGameResult();}}
}

function svg(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
function boardMaterials(s){
  const heritage=themeName(settings.theme)==='heritage';
  const defs=svg('defs');
  for(const [id,color] of [['white','var(--white)'],['black','var(--black)']]){
    const gradient=svg('radialGradient',{id:'checker-'+id,cx:'35%',cy:'25%',r:'80%'});
    gradient.append(svg('stop',{offset:'0%', 'stop-color':id==='white'?(heritage?'#ffffff':'#fffef8'):(heritage?'#ff3838':'#59545d')}),svg('stop',{offset:'80%','stop-color':color}),svg('stop',{offset:'100%','stop-color':id==='white'?(heritage?'#747974':'#c8bfa7'):(heritage?'#600000':'#15131a')}));defs.append(gradient);
  }
  for(const [id,colors] of [['mahogany',['#311100','#95501f','#4c1b05']],['recess',['#170b04','#612709','#321004']],['ivory-die',['#fff','#d8dad6','#a2a59f']],['ruby-die',['#ff3434','#d00000','#800000']],['brass',['#d3b46d','#8c6c2c','#e0be72']],['light-die',['#fff','var(--white)','#b9b2a0']],['dark-die',['#615c68','var(--black)','#131117']]]){
    const gradient=svg('linearGradient',{id,x1:'0%',y1:'0%',x2:'100%',y2:'100%'});
    colors.forEach((color,i)=>gradient.append(svg('stop',{offset:(i*50)+'%','stop-color':color})));defs.append(gradient);
  }
  const grain=svg('pattern',{id:'wood-grain',width:180,height:680,patternUnits:'userSpaceOnUse'});
  for(let i=0;i<30;i++){
    const x=i*6;
    grain.append(svg('path',{d:`M${x} 0 C${x+18} 150 ${x-20} 230 ${x+4} 340 S${x-14} 540 ${x} 680`,fill:'none',stroke:'var(--grain)','stroke-width':i%3===0?1.8:.7,opacity:i%3===0?.10:.07}));
  }
  defs.append(grain);s.append(defs);
}
function heritageFrame(s){
  const g=svg('g',{'pointer-events':'none'});
  // Beveled edges surround each playing field; a green seam separates the halves.
  for(const [left,right] of [[24,444],[500,920]]){
    g.append(svg('path',{d:`M${left-13} 17 H${right+13} L${right} 30 H${left} V650 L${left-13} 663 Z`,fill:'#b57539'}));
    g.append(svg('path',{d:`M${right+13} 17 V663 H${left-13} L${left} 650 H${right} V30 Z`,fill:'#301302'}));
    g.append(svg('rect',{x:left-4,y:26,width:right-left+8,height:628,fill:'none',stroke:'#512607','stroke-width':4}));
  }
  g.append(svg('rect',{x:468,y:0,width:8,height:680,fill:'#154411'}));
  for(const y of [158,480]){
    g.append(svg('rect',{x:454,y,width:36,height:40,rx:3,fill:'url(#brass)',stroke:'#65491d'}));
    g.append(svg('path',{d:`M470 ${y+2} V${y+38} M475 ${y+2} V${y+38}`,stroke:'#5c461e',fill:'none'}));
    for(const x of [460,484])for(const dy of [7,33])g.append(svg('circle',{cx:x,cy:y+dy,r:2,fill:'#5a451e',stroke:'#e3cb82','stroke-width':.7}));
  }
  s.append(g);
}
function checker(g,x,y,p,n,label){if(themeName(settings.theme)==='heritage'){g.append(svg('ellipse',{cx:x+1,cy:y+3,rx:25,ry:24,fill:'#0007'}));g.append(svg('circle',{cx:x,cy:y,r:25,fill:'url(#checker-'+(p===1?'white':'black')+')',stroke:'#20130c','stroke-width':2}));g.append(svg('circle',{cx:x,cy:y,r:22,fill:'none',stroke:p===1?'#edf0eb':'#ff8f80','stroke-width':1.5}));}g.append(svg('circle',{cx:x,cy:y,r:24,fill:p===1?'url(#checker-white)':'url(#checker-black)',stroke:'var(--edge)','stroke-width':2}));g.append(svg('circle',{cx:x,cy:y,r:19,fill:'none',stroke:themeName(settings.theme)==='heritage'?(p===1?'#818780':'#700000'):(p===1?'#b5a98b':'#77717b'),'stroke-width':1}));if(themeName(settings.theme)==='heritage')g.append(svg('circle',{cx:x,cy:y,r:22,fill:'none',stroke:p===1?'#f5f7f3':'#ff9d90','stroke-width':1.2}));if(n)g.append(svg('text',{x,y:y+6,'text-anchor':'middle',fill:p===1?'black':'white','font-size':18},n));}
function drawDice(s,flip){
  if(!dice.length)return;
  // Keep the original pair visible until pickup, including on doubles.
  const center=(player===1)!==flip?710:234;
  const g=svg('g',{id:'dice',role:'group','aria-label':`${checkerColor(player)} dice: ${dice.join(' and ')}`});
  const patterns={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
  dice.forEach((value,i)=>{
    const x=center+(i===0?-42:42),die=svg('g',{'data-die':value});
    const heritage=themeName(settings.theme)==='heritage';
    const color=heritage?(player===1?'ivory':'ruby'):(player===1?'light':'dark');
    const edge=player===1?'#b6b2a6':heritage?'#700000':'#17131d';
    const highlight=player===1?'#fff':heritage?'#ff7777':'#aaa1b6';
    die.append(svg('rect',{x:x-26,y:314,width:55,height:55,rx:7,fill:'#0005'}));
    die.append(svg('rect',{x:x-28,y:311,width:54,height:54,rx:7,fill:`url(#${color}-die)`,stroke:edge,'stroke-width':2}));
    die.append(svg('path',{d:`M${x-25} 358 V319 Q${x-25} 314 ${x-20} 314 H${x+20}`,stroke:highlight,'stroke-width':2.5,opacity:.8,fill:'none','stroke-linecap':'round'}));
    die.append(svg('path',{d:`M${x-21} 362 H${x+19} Q${x+23} 362 ${x+23} 357 V318`,stroke:edge,'stroke-width':2,opacity:.6,fill:'none'}));
    for(const [dx,dy] of patterns[value]){
      die.append(svg('circle',{cx:x-1+dx*13,cy:338+dy*13,r:5,fill:player===1?'#171619':'#fff7e9',stroke:player===1?'#8c877c':'#19151f','stroke-width':.6}));
      die.append(svg('circle',{cx:x-2+dx*13,cy:336+dy*13,r:1.3,fill:player===1?'#77716b':'#fff'}));
    }
    if(settings.playMode==='jellyfish'&&!remainingDice().includes(value))die.setAttribute('opacity','.45');
    if(!busy&&!isComputer()&&!complete()&&dice[0]!==dice[1]){
      die.setAttribute('role','button');die.setAttribute('tabindex','0');die.setAttribute('aria-label',`Die ${value}: swap dice`);die.style.cursor='pointer';
      die.onclick=e=>{e.stopPropagation();swapDice();};
      die.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();swapDice();}};
    }
    g.append(die);
  });
  if(settings.playMode==='jellyfish'&&!isComputer()&&!autoplay){
    const enabled=!busy&&!isComputer()&&!complete()&&dice[0]!==dice[1];
    const swap=svg('g',{id:'swap-dice',role:'button',tabindex:enabled?0:-1,'aria-label':'Swap dice','aria-disabled':!enabled,style:`cursor:${enabled?'pointer':'default'};opacity:${enabled?1:.4}`});
    swap.append(svg('rect',{x:center-14,y:318,width:28,height:42,rx:5,fill:'var(--frame)'}),svg('text',{x:center,y:346,'text-anchor':'middle','font-size':24,fill:'var(--ink)','pointer-events':'none'},'⇄'));
    swap.onclick=e=>{e.stopPropagation();if(enabled)swapDice();};
    swap.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();if(enabled)swapDice();}};
    g.append(swap);
  }
  s.append(g);
}
function drawHintArrows(s,flip){
  if(!hintOverlay)return;
  if(hintOverlay.key!==hintPositionKey()){clearHintArrows();return;}
  const g=svg('g',{id:'hint-arrows','pointer-events':'none','aria-label':'Suggested checker moves'});
  const defs=svg('defs'),marker=svg('marker',{id:'hint-arrowhead',viewBox:'0 0 12 12',refX:10,refY:6,markerWidth:4,markerHeight:4,orient:'auto'});
  marker.append(svg('path',{d:'M0 0 L12 6 L0 12 Z',fill:'#5eeaff',stroke:'#123946','stroke-width':.7}));defs.append(marker);g.append(defs);
  let position=R.cloneBoard(board);
  const count=(b,location)=>location===-1?b.bar[R.playerIndex(player)]:location===24?b.off[R.playerIndex(player)]:Math.abs(b.points[location]);
  hintOverlay.moves.forEach((move,i)=>{
    const from=checkerPosition(move.from,player,count(position,move.from),flip);
    position=R.applyMove(position,player,move);
    const to=checkerPosition(move.to,player,count(position,move.to),flip);
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1;
    const x=to.x-dx/length*17,y=to.y-dy/length*17;
    const d=`M${from.x} ${from.y} L${x} ${y}`;
    g.append(svg('path',{d,fill:'none',stroke:'#123946','stroke-width':11,'stroke-linecap':'round'}));
    g.append(svg('path',{d,fill:'none',stroke:'#5eeaff','stroke-width':6,'stroke-linecap':'round','marker-end':'url(#hint-arrowhead)','data-hint-step':i+1}));
    const labelX=from.x+dx*.45,labelY=from.y+dy*.45;
    g.append(svg('circle',{cx:labelX,cy:labelY,r:12,fill:'#123946',stroke:'#5eeaff','stroke-width':2}));
    g.append(svg('text',{x:labelX,y:labelY+5,fill:'white','text-anchor':'middle','font-size':14,'font-weight':'bold'},i+1));
  });
  s.append(g);
}
function draw(){const b=animationState?.board??board,flip=animationState?.flip??settings.flip;const focused=document.activeElement?.getAttribute('data-location');const s=$('#board');s.dataset.animation=animationState?'moving':'idle';s.dataset.phase=turnPhase;s.replaceChildren();boardMaterials(s);s.append(svg('rect',{width:1000,height:680,rx:10,fill:themeName(settings.theme)==='heritage'?'url(#mahogany)':'var(--frame)'}));s.append(svg('rect',{x:24,y:30,width:420,height:620,fill:'var(--felt)',stroke:'var(--edge)','stroke-width':3}));s.append(svg('rect',{x:500,y:30,width:420,height:620,fill:'var(--felt)',stroke:'var(--edge)','stroke-width':3}));if(themeName(settings.theme)!=='classic')s.append(svg('rect',{x:0,y:0,width:1000,height:680,fill:'url(#wood-grain)','pointer-events':'none'}));if(themeName(settings.theme)==='heritage')heritageFrame(s);const targets=new Set(selected===null?[]:destinations(selected).keys());
for(let visual=0;visual<24;visual++){const top=visual>=12;const col=top?visual-12:11-visual;const p=flip?23-visual:visual;const x=59+col*70+(col>=6?56:0),y=top?31:649;const g=svg('g',{class:'point',tabindex:0,role:'button','data-location':p,'aria-pressed':selected===p,'aria-label':`Point ${p+1}: ${b.points[p]===0?'empty':Math.abs(b.points[p])+' '+checkerColor(Math.sign(b.points[p])).toLowerCase()+' checkers'}`});g.append(svg('rect',{x:x-34,y:top?30:360,width:68,height:290,fill:'transparent'}));g.append(svg('path',{d:`M${x-34} ${y} L${x+34} ${y} L${x} ${top?286:394} Z`,fill:(col+(top?0:1))%2?'var(--light)':'var(--dark)',stroke:'var(--edge)','stroke-width':1}));if(selected===p||targets.has(p))g.append(svg('path',{d:`M${x-34} ${y} L${x+34} ${y} L${x} ${top?286:394} Z`,class:selected===p?'selected':'target','pointer-events':'none'}));let count=Math.abs(b.points[p]);for(let j=0;j<Math.min(5,count);j++)checker(g,x,top?60+j*49:620-j*49,Math.sign(b.points[p]),j===4&&count>5?count:0);g.append(svg('text',{x,y:top?20:674,'text-anchor':'middle','font-size':18,fill:'var(--ink)'},p+1));g.onclick=()=>point(p);g.ondblclick=e=>{e.preventDefault();if(!e.detail||selected===p)quickPoint(p);};g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();point(p);}};s.append(g);}
for(const p of [1,-1]){const i=p===1?0:1,y=p===1?430:200,g=svg('g',{class:'point',tabindex:0,role:'button','data-location':-1,'aria-pressed':selected===-1&&p===player,'aria-label':`${checkerColor(p)} bar: ${b.bar[i]}`});g.append(svg('rect',{x:446,y:y-70,width:52,height:140,fill:'transparent'}));for(let j=0;j<Math.min(b.bar[i],3);j++)checker(g,472,y+j*28,p,j===2&&b.bar[i]>3?b.bar[i]:0);if(selected===-1&&p===player)g.append(svg('rect',{x:446,y:y-28,width:52,height:120,fill:'none',class:'selected'}));g.onclick=()=>point(-1);g.onkeydown=e=>{if(e.key==='Enter')point(-1);};s.append(g);}
const off=svg('g',{class:'point',tabindex:0,role:'button','data-location':24,'aria-label':'Bear off'});if(themeName(settings.theme)==='heritage'){
  for(const y of [30,400]){
    off.append(svg('rect',{x:935,y,width:56,height:250,rx:5,fill:'url(#recess)',stroke:targets.has(24)?'var(--highlight)':'#a05c32','stroke-width':targets.has(24)?4:3}));
  }
}else off.append(svg('rect',{x:937,y:30,width:50,height:620,fill:'var(--tray)',stroke:targets.has(24)?'var(--highlight)':'var(--edge)','stroke-width':targets.has(24)?5:2}));for(let i=0;i<b.off[0];i++)off.append(svg('rect',{x:943,y:635-i*13,width:38,height:10,fill:'var(--white)',stroke:'var(--edge)'}));for(let i=0;i<b.off[1];i++)off.append(svg('rect',{x:943,y:36+i*13,width:38,height:10,fill:'var(--black)',stroke:'#aaa'}));off.onclick=()=>point(24);off.onkeydown=e=>{if(e.key==='Enter')point(24);};s.append(off);if(themeName(settings.theme)==='heritage'){
  const cube=svg('g',{'aria-label':`Doubling cube ${match.cube}, ${match.cubeOwner===null?'centered':match.cubeOwner===1?'Silver owns':'Red owns'}`});
  cube.append(svg('rect',{x:934,y:311,width:58,height:58,rx:8,fill:'#370900',opacity:.6}));
  cube.append(svg('rect',{x:931,y:307,width:58,height:58,rx:8,fill:'url(#ruby-die)',stroke:'#7b0600','stroke-width':2}));
  cube.append(svg('text',{x:960,y:347,fill:'#fff','text-anchor':'middle','font-size':32,'font-weight':'bold'},match.cube===1?'64':match.cube));
  if(match.cubeOwner!==null)cube.append(svg('path',{d:match.cubeOwner===1?'M951 375 L969 375 L960 385 Z':'M951 297 L969 297 L960 287 Z',fill:match.cubeOwner===1?'var(--white)':'var(--black)',stroke:'#f1c991'}));
  s.append(cube);
}else{const cubeY=match.cubeOwner===1?565:match.cubeOwner===-1?65:315;s.append(svg('rect',{x:449,y:cubeY,width:46,height:46,rx:5,fill:'var(--white)',stroke:'var(--edge)','stroke-width':2}));s.append(svg('text',{x:472,y:cubeY+31,'text-anchor':'middle','font-size':24,'font-weight':'bold'},match.cube===1?'64':match.cube));}drawDice(s,flip);if(animationState){animationState.sprites.forEach((sprite,i)=>{const g=svg('g',{'data-moving-checker':i,'pointer-events':'none',transform:`translate(${sprite.pose.x} ${sprite.pose.y}) scale(1 ${sprite.pose.scaleY})`});checker(g,0,0,sprite.player,0);s.append(g);});}drawHintArrows(s,flip);if(focused!==null&&focused!==undefined)[...s.querySelectorAll('[data-location]')].find(g=>g.dataset.location===focused)?.focus({preventScroll:true});}
function showEvaluation(probability,status){
  currentEvaluation={probability,status};
  if(!hintOverlay)paintEvaluation(probability,status);
}
function paintEvaluation(probability,status){
  const meter=$('#evaluation-bar'),known=Number.isFinite(probability);
  const percent=known?Math.max(0,Math.min(100,probability*100)):50;
  $('#evaluation-white').style.width=percent+'%';
  $('#evaluation-white').style.setProperty('--win-chance',percent+'%');
  $('#eval-white').textContent=checkerColor(1)+' '+(known?percent.toFixed(1)+'%':'—');
  $('#eval-black').textContent=checkerColor(-1)+' '+(known?(100-percent).toFixed(1)+'%':'—');
  $('#eval-status').textContent=status;
  meter.setAttribute('aria-label',checkerColor(1)+' estimated game win probability');
  meter.setAttribute('aria-busy','false');
  meter.classList.toggle('unknown',!known);
  if(known)meter.setAttribute('aria-valuenow',percent.toFixed(1));else meter.removeAttribute('aria-valuenow');
  meter.setAttribute('aria-valuetext',known?`${checkerColor(1)} ${percent.toFixed(1)}%, ${checkerColor(-1)} ${(100-percent).toFixed(1)}%`:status);
}
function updateEvaluation(){
  const turnDone=dice.length&&complete()&&!animationState;
  // Evaluate only whole turns; undo/load during a turn uses its starting position.
  const evaluatedBoard=dice.length&&!turnDone?turnStart:board;
  const onRoll=turnDone?-player:player;
  const key=JSON.stringify([epoch,evaluatedBoard,onRoll,opening,match.result,evaluatorReady,settings.theme]);
  if(key===evaluationKey)return;
  evaluationKey=key;clearTimeout(evaluationTimer);
  const winner=match.result?.winner??R.winner(evaluatedBoard);
  if(winner!==null){showEvaluation(winner===1?1:0,'Game finished');return;}
  if(opening){showEvaluation(.5,'Estimated win chance');return;}
  if(!evaluatorReady){showEvaluation(null,'Evaluation unavailable');return;}
  const position=R.cloneBoard(evaluatedBoard);
  // Preserve the last value while waiting, so the bar transitions directly to the result.
  if(!hintOverlay){$('#eval-status').textContent='Evaluating…';$('#evaluation-bar').setAttribute('aria-busy','true');}
  evaluationTimer=setTimeout(async()=>{
    try{
      const value=await ai.evaluate(position,onRoll);
      if(key!==evaluationKey)return;
      showEvaluation(onRoll===1?value.win:value.lose,'Estimated win chance');
    }catch(error){if(key===evaluationKey)showEvaluation(null,'Evaluation unavailable');}
  },80);
}
function updatePlayedRank(){
  const output=$('#move-rank');
  if(!evaluatorReady||autoplay||isComputer()||match.result||!dice.length||!prefix.length||!complete()||animationState){
    playedRankKey='';output.textContent='';delete output.dataset.quality;showCubeFeedback(output);return;
  }
  const context=engineContext(),key=JSON.stringify([epoch,turnStart,board,player,dice,context]);
  if(key===playedRankKey)return;
  playedRankKey=key;delete output.dataset.quality;output.textContent='Ranking your move…';
  const played=JSON.stringify(board);
  ai.rankTurns(turnStart,player,dice,{...context,limit:Number.MAX_SAFE_INTEGER}).then(async ranked=>{
    if(key!==playedRankKey)return;
    const rank=ranked.findIndex(t=>JSON.stringify(t.board)===played);
    if(!ranked.length){output.textContent='Move ranking unavailable';return;}
    let playedScore=ranked[rank]?.score;
    if(rank<0){
      output.textContent='Evaluating your move…';
      const evaluated=await ai.scorePlayedBoard(JSON.parse(played),player,{...context,level:ranked[0].evaluationLevel??context.level});
      if(key!==playedRankKey)return;
      playedScore=evaluated.score;
    }
    const assessment=moveQuality(ranked[0].score,playedScore);
    if(!assessment){output.textContent='Move ranking unavailable';return;}
    output.dataset.quality=assessment.quality;
    output.dataset.loss=assessment.loss.toFixed(3);
    output.title='Estimated loss versus the best evaluated move. OK: up to 0.020; Error: above 0.020; Blunder: above 0.080. Uses JellyFish scoring; match-play values are not identical to XG normalized equity.';
    output.textContent=assessment.quality==='ok'?'Good':assessment.label;
  }).catch(()=>{if(key===playedRankKey)output.textContent='Move ranking unavailable';});
}
function render(){applyTheme(settings.theme);draw();updateEvaluation();updatePlayedRank();$('#human-score').textContent=match.scores[0];$('#computer-score').textContent=match.scores[1];$('#computer-name').textContent=name(-1);$('#human-pips').textContent='Pips: '+R.pipCount(board,1);$('#computer-pips').textContent='Pips: '+R.pipCount(board,-1);$('#match-info').textContent=(match.target?match.target+' point match':'Money game')+' · Game '+match.game+(match.crawford?' · Crawford':'');let prompt=autoplay?(autoplay.stop?'Stopping after this turn…':'Finishing game — JellyFish is playing both sides…'):opening?'Roll dice to decide who starts.':busy?(turnPhase==='pause'?'JellyFish rolled '+dice.join('–')+' — pausing before moving…':turnPhase==='moving'?'Moving checker…':name(player)+' is thinking…'):match.result?'Click the board for '+(match.matchWinner?'a new match.':'the next game.') :!dice.length?name(player)+': roll dice or offer a double.':complete()?'Pick up the dice to finish your turn.':name(player)+(settings.playMode==='jellyfish'?': click a checker to use the first remaining die.':': select a checker or a highlighted destination.');if(hintText)prompt=hintText;$('#instruction').textContent=prompt;$('#roll').disabled=busy||!!dice.length||!!match.result||!!match.pendingDouble;$('#undo').disabled=busy||isComputer()||!prefix.length;$('#finish').disabled=busy||isComputer()||!complete();$('#double').disabled=busy||opening||!!dice.length||!!match.result||match.crawford||!!match.pendingDouble||(match.cubeOwner!==null&&match.cubeOwner!==player);$('#hint').disabled=busy||isComputer()||opening||!!match.result||match.pendingDouble!==null||!evaluatorReady||!ai;document.querySelectorAll('[data-action=finishGame]').forEach(button=>{button.disabled=autoplay?autoplay.stop:!canFinishGame();button.textContent=autoplay?'Stop autoplay':'Finish game';});$('#next-game').hidden=!match.result;$('#next-game').textContent=match.matchWinner?'New match':'Next game';}
function newDialog(){modal('New game / match',`<label>Match length<select id="new-target">${[0,1,3,5,7,9,11,15,21].map(n=>`<option value="${n}" ${n==settings.target?'selected':''}>${n?n+' points':'Money game'}</option>`).join('')}</select></label><label>Opponent<select id="new-opponent"><option value="computer">JellyFish</option><option value="human" ${settings.opponent==='human'?'selected':''}>Another player</option></select></label>`,[['Cancel',()=>{}],['Start',()=>{settings.target=Number($('#new-target').value);settings.opponent=$('#new-opponent').value;saveSettings();reset();}]]);}
function saveSettings(){try{localStorage.setItem('jellyfish-settings',JSON.stringify(settings));}catch{}}
function settingsDialog(){modal('Settings',`<label>Play mode<select id="play-mode"><option value="destinations" ${settings.playMode!=='jellyfish'?'selected':''}>Show destinations</option><option value="jellyfish" ${settings.playMode==='jellyfish'?'selected':''}>JellyFish — first die per click</option></select></label><p>JellyFish mode starts with the higher die first. Use ⇄ between the dice to reverse their order, then click a checker to play the first remaining die.</p><fieldset class="theme-picker"><legend>Board appearance</legend>${Object.entries(THEMES).map(([id,t])=>`<label class="theme-choice"><input type="radio" name="board-theme" value="${id}" ${themeName(settings.theme)===id?'checked':''}><span class="theme-swatch" style="--swatch-base:${t.colors.felt};--swatch-one:${t.colors.light};--swatch-two:${t.colors.dark}"></span><span><b>${t.name}</b><small>${t.description}</small></span></label>`).join('')}</fieldset><label>Playing level<select id="level">${[1,2,3,4,5,6,7].map(n=>`<option value="${n}" ${settings.level==n?'selected':''}>${n}${n<=2?' — Randomized':n===3?' — Fast':n===4?' — Selective':n===5?' — Full evaluation':n===6?' — Lookahead':' — Selective lookahead'}</option>`).join('')}</select></label><label>Pause after JellyFish rolls (seconds)<input id="dice-pause" type="number" min="0" max="5" step="0.1" value="${settings.dicePauseMs/1000}"></label><label>Checker animation duration (milliseconds)<input id="animation-speed" type="range" min="0" max="1500" step="50" value="${settings.animationMs}"></label><p>Animation: <output id="animation-value">${settings.animationMs===0?'Off':settings.animationMs+' ms per checker'}</output>. Shorter is faster; 0 turns animation off.</p><label>Reverse board<input id="flip" type="checkbox" ${settings.flip?'checked':''}></label><p>Levels 1 and 2 add random variation to their evaluations, as in the original. The browser does not reproduce the original random seed.</p><p>Dice use the browser's cryptographic random generator. Dice match the current player’s checker color.</p>`,[['Cancel',()=>{}],['OK',()=>{settings.dicePauseMs=Math.max(0,Math.min(5000,(Number($('#dice-pause').value)||0)*1000));settings.animationMs=Number($('#animation-speed').value);settings.theme=$('input[name="board-theme"]:checked').value;settings.level=Number($('#level').value);settings.flip=$('#flip').checked;const mode=$('#play-mode').value;if(mode!==settings.playMode){settings.playMode=mode;selected=null;if(mode==='jellyfish'&&dice.length){dice.sort((a,b)=>b-a);turns=R.legalTurns(turnStart,player,dice);}}saveSettings();render();}]]);$('#animation-speed').oninput=e=>{$('#animation-value').textContent=Number(e.target.value)===0?'Off':e.target.value+' ms per checker';};}
async function cubeHint(){
  if(!R.canDouble(match,player)){
    modal('Cube hint','<p>I would not double. Doubling is unavailable '+(match.crawford?'during the Crawford game.':'because your opponent owns the cube.')+'</p>');
    return;
  }
  const token=epoch,key=hintPositionKey();busy=true;render();
  try{
    const advice=await ai.cubeAdvice(R.cloneBoard(board),player,engineContext());
    if(token!==epoch||key!==hintPositionKey())return;
    modal('Cube hint',advice.offer?'<p>I would double</p>':'<p>I would not double</p>');
  }catch(e){if(token===epoch)message('Cube hint failed: '+e.message);}
  finally{if(token===epoch){busy=false;render();}}
}
async function hint(){
  if(!ai||!evaluatorReady||busy||isComputer()||opening||match.result||match.pendingDouble!==null)return;
  if(!dice.length){await cubeHint();return;}
  clearTimeout(hintTimer);busy=true;render();const token=epoch,key=hintPositionKey();
  try{
    if(hintCycle?.key!==key){
      let ranked;
      if(prefix.length){
        const candidates=[...new Map(available().map(t=>[JSON.stringify(t.board),t])).values()];
        ranked=await Promise.all(candidates.map(async t=>{
          const value=await ai.evaluate(t.board,-player);
          return {moves:t.moves.slice(prefix.length),probability:player===1?value.lose:value.win,score:-value.equity};
        }));
        ranked.sort((a,b)=>b.score-a.score);
      }else{
        const turns=await ai.rankTurns(turnStart,player,dice,{...engineContext(),limit:Number.MAX_SAFE_INTEGER});
        ranked=turns.map(t=>({moves:t.moves,probability:player===1?t.evaluation.win:t.evaluation.lose,score:t.score}));
      }
      if(token!==epoch||key!==hintPositionKey())return;
      hintCycle={key,ranked:ranked.filter(t=>t.moves.length),index:-1};
    }
    if(!hintCycle.ranked.length){clearHintArrows();hintText=complete()?'No moves remaining. Pick up the dice.':'No legal moves.';return;}
    hintCycle.index=(hintCycle.index+1)%hintCycle.ranked.length;
    const option=hintCycle.ranked[hintCycle.index],number=hintCycle.index+1,total=hintCycle.ranked.length;
    hintOverlay={key,moves:option.moves};
    const ownChance=player===1?option.probability:1-option.probability;
    hintText=`Suggested turn ${number} of ${total}: `+option.moves.map(m=>(m.from===-1?'bar':m.from+1)+'/'+(m.to===24?'off':m.to+1)).join(' ')+` · ${checkerColor(player)} win chance ${(100*ownChance).toFixed(1)}%`;
    paintEvaluation(option.probability,`Hint ${number} of ${total} · estimated win chance`);
    hintTimer=setTimeout(()=>{clearHintArrows();render();},3000);
  }catch(e){clearHintArrows();message(e.message);}finally{if(token===epoch){busy=false;render();}}
}
function engineContext(){return {cube:match.cube,target:match.target,scores:[...match.scores],crawford:match.crawford,level:Number(settings.level),jacoby:false};}
async function double(){if($('#double').disabled)return;assessCubeAction('Double');try{match=R.offerDouble(match,player);const offerer=player;if(settings.opponent==='computer'&&offerer===1&&ai){const token=epoch;busy=true;render();const advice=await ai.cubeAdvice(board,-1,engineContext());if(token!==epoch)return;match=R.respondDouble(match,advice.take);busy=false;log('JellyFish '+(advice.take?'takes the cube at '+match.cube:'drops')+'.');render();modal(advice.take?'JellyFish accepts':'JellyFish declines',advice.take?'<p>The doubling cube is now at <b>'+match.cube+'</b>.</p>':'<p>'+gameResultText()+'.</p>');return;}cubeDialog(offerer);}catch(e){busy=false;if(match.pendingDouble!==null)match={...match,pendingDouble:null};message(e.message);render();}}
function cubeDialog(offerer){
  modal('Double offered','<p>'+name(offerer)+' offers the cube at '+match.cube*2+'. Taking gives ownership to '+name(-offerer)+'.</p><p id="cube-hint" aria-live="polite" hidden></p>',[['Drop',()=>{match=R.respondDouble(match,false);log(name(-offerer)+' drops.');render();showGameResult();}],['Take',()=>{match=R.respondDouble(match,true);log(name(-offerer)+' takes the cube at '+match.cube+'.');render();if(isComputer())roll();}]]);
  const hint=document.createElement('button'),line=$('#cube-hint'),offeredMatch=match;
  hint.type='button';hint.textContent='Hint';hint.disabled=!ai||!evaluatorReady;
  hint.onclick=async()=>{
    hint.disabled=true;line.hidden=false;line.textContent='Thinking…';
    try{
      const advice=await ai.cubeAdvice(R.cloneBoard(board),-offerer,engineContext());
      if(match!==offeredMatch||!line.isConnected)return;
      line.textContent=advice.take?'I would take':'I would drop';
    }catch{
      if(match!==offeredMatch||!line.isConnected)return;
      line.textContent='Hint unavailable. Please try again.';hint.disabled=false;
    }
  };
  $('#dialog-buttons').insertBefore(hint,$('#dialog-buttons').lastElementChild);
  render();
}
async function prepareComputer(){if(!isComputer()||busy||dice.length)return;const token=epoch;try{if(ai&&R.canDouble(match,-1)&&!opening){busy=true;render();const advice=await ai.cubeAdvice(board,-1,engineContext());if(token!==epoch)return;busy=false;if(advice.offer){match=R.offerDouble(match,-1);cubeDialog(-1);return;}}roll();}catch(e){busy=false;message(e.message);render();}}

function save(){if(match.pendingDouble!==null){message('Finish the cube decision before saving.');return;}const data={format:'jellyfish-web',version:1,settings,board,match,player,dice,prefix,turnStart,opening,history};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='jellyfish-game.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;const d=validateSave(JSON.parse(await f.text()));epoch++;cubeFeedback=null;cancelMotion();busy=false;({board,match,player,dice,prefix,turnStart,opening,history}=d);settings={...settings,...d.settings};turns=dice.length?R.legalTurns(turnStart,player,dice):[];selected=null;hintText='';timeline=[];checkpoint();renderLog();render();message('Game loaded.');if(isComputer()){if(prefix.length){board=R.cloneBoard(turnStart);prefix=[];}if(dice.length)computer();else roll();}}catch(e){modal('Cannot open game',e.message);}finally{$('#file').value='';}};
function checkpoint(){timeline=timeline.slice(0,timelineAt+1);timeline.push(structuredClone({board,match,player,opening,history,dice,prefix,turnStart}));timelineAt=timeline.length-1;}
function replay(direction){if(busy||match.pendingDouble)return;const i=timelineAt+direction;if(i<0||i>=timeline.length){message('No more recorded turns.');return;}epoch++;cubeFeedback=null;timelineAt=i;({board,match,player,opening,history,dice,prefix,turnStart}=structuredClone(timeline[i]));selected=null;hintText='';turns=dice.length?R.legalTurns(turnStart,player,dice):[];renderLog();render();message('Recorded turn '+(i+1)+' of '+timeline.length+'.');}
function swapDice(){if(busy||dice.length!==2||isComputer())return;dice.reverse();selected=null;turns=R.legalTurns(turnStart,player,dice);render();}
async function evaluatePosition(){if(!ai||busy)return;const token=epoch;busy=true;render();try{const v=await ai.evaluate(board,player);if(token!==epoch)return;const pct=n=>(100*n).toFixed(2)+'%';modal('Position evaluation',`<p>On roll: <b>${name(player)}</b></p><table><tr><th></th><th>Win</th><th>Lose</th></tr><tr><td>Game</td><td>${pct(v.win)}</td><td>${pct(v.lose)}</td></tr><tr><td>Gammon</td><td>${pct(v.gammonWin)}</td><td>${pct(v.gammonLose)}</td></tr><tr><td>Backgammon</td><td>${pct(v.backgammonWin)}</td><td>${pct(v.backgammonLose)}</td></tr></table><p>Equity: <b>${v.equity.toFixed(4)}</b></p><small>Gammon probabilities include backgammons.</small>`);}catch(e){message(e.message);}finally{if(token===epoch){busy=false;render();}}}
async function bestMoves(){if(!ai||busy||!dice.length||isComputer())return;busy=true;render();const token=epoch;try{const ranked=await ai.rankTurns(turnStart,player,dice,{...engineContext(),limit:10});if(token!==epoch)return;modal('Best moves — level '+settings.level,'<table><tr><th>#</th><th>Move</th><th>Ranking score</th></tr>'+ranked.map((t,i)=>'<tr><td>'+(i+1)+'</td><td>'+t.moves.map(m=>(m.from===-1?'bar':m.from+1)+'/'+(m.to===24?'off':m.to+1)).join(' ')+'</td><td>'+t.score.toFixed(4)+'</td></tr>').join('')+'</table><p>Ranks use the current cube and match score. These scores compare moves; they are not winning probabilities.</p>');}catch(e){message(e.message);}finally{if(token===epoch){busy=false;render();}}}
function editPosition(){if(busy||match.pendingDouble)return;modal('Edit position',`<p>Positive numbers are white checkers; negative numbers are black. Each player must total 15 checkers.</p><div class="position-grid">${board.points.map((n,i)=>`<label>${i+1}<input type="number" min="-15" max="15" value="${n}" data-point="${i}"></label>`).join('')}</div><div class="editor-counts">${['bar','off'].map(k=>[0,1].map(i=>`<label>${i?'Black':'White'} ${k}<input type="number" min="0" max="15" id="edit-${k}-${i}" value="${board[k][i]}"></label>`).join('')).join('')}</div><label>On roll<select id="edit-player"><option value="1" ${player===1?'selected':''}>White</option><option value="-1" ${player===-1?'selected':''}>Black</option></select></label><p id="edit-error" class="error"></p>`,[['Cancel',()=>{}],['Apply',()=>{try{const b={points:[...document.querySelectorAll('[data-point]')].map(e=>Number(e.value)),bar:[0,1].map(i=>Number($('#edit-bar-'+i).value)),off:[0,1].map(i=>Number($('#edit-off-'+i).value))};R.validateBoard(b);if(R.winner(b))throw Error('Use a position with neither player already borne off.');epoch++;cubeFeedback=null;board=b;match=R.createMatch(settings.target);player=Number($('#edit-player').value);opening=false;dice=[];prefix=[];turns=[];selected=null;turnStart=undefined;history=[];log('Edited position.');timeline=[];checkpoint();render();}catch(e){$('#dialog').showModal();$('#edit-error').textContent=e.message;}}]]);}
function showStatistics(){const stats=recordedStatistics(history);const rows=[['Recorded rolls','rolls'],['Doubles','doubles'],['Completed turns','turns'],['Checker moves','moves'],['Hits','hits'],['Forced passes','passes']];modal('Game statistics','<table><tr><th></th><th>You</th><th>'+name(-1)+'</th></tr>'+rows.map(([label,key])=>'<tr><td>'+label+'</td><td>'+stats[0][key]+'</td><td>'+stats[1][key]+'</td></tr>').join('')+'<tr><td>Average die</td>'+stats.map(s=>'<td>'+(s.averageDie===null?'—':s.averageDie.toFixed(2))+'</td>').join('')+'</tr><tr><td>Current pip count</td><td>'+R.pipCount(board,1)+'</td><td>'+R.pipCount(board,-1)+'</td></tr></table><p>Counts use the retained game log. Taking back a turn also takes back its statistics. These are descriptive counts, not luck or error ratings.</p>',[['Export log',exportLog],['Close',()=>{}]]);}
function exportLog(){const text='JellyFish browser game log\n'+(match.target?match.target+' point match':'Money game')+'\nScore: '+match.scores.join(' : ')+'\n\n'+history.join('\n')+'\n';const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='jellyfish-game-log.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function rolloutDialog(){if(!ai||busy||match.pendingDouble)return;modal('Rollout',`<p>Simulate this position with direct neural evaluation for both players. The cube and match score are ignored. Existing dice are not used; each simulated turn rolls fresh dice.</p><label>Games<select id="rollout-games"><option selected>8</option><option>16</option><option>32</option></select></label><label>Random seed<input id="rollout-seed" type="number" min="1" max="4294967295" value="1"></label><p>This is a browser simulation, not a verified reproduction of the original rollout algorithm.</p>`,[['Cancel',()=>{}],['Start',()=>runRollout(Number($('#rollout-games').value),Number($('#rollout-seed').value))]]);}
async function runRollout(games,seed){if(![8,16,32].includes(games)||!Number.isSafeInteger(seed)||seed<1||seed>4294967295){message('Choose a seed from 1 to 4294967295.');return;}const token=epoch;busy=true;hintText='Running '+games+' rollout games…';render();try{const r=await ai.rollout(board,player,{games,seed,maxTurns:1000});if(token!==epoch)return;const percent=n=>Number.isFinite(n)?(100*n).toFixed(2)+'%':'—';modal('Rollout results',`<p>Perspective: <b>${name(player)}</b> · Seed ${r.seed}</p><table><tr><td>Games requested</td><td>${r.games}</td></tr><tr><td>Wins / losses</td><td>${r.wins} / ${r.losses}</td></tr><tr><td>Unfinished</td><td>${r.unfinished}</td></tr><tr><td>Win rate</td><td>${percent(r.winRate)}</td></tr><tr><td>Cubeless equity</td><td>${Number.isFinite(r.equity)?r.equity.toFixed(4):'—'}</td></tr><tr><td>Win-rate standard error</td><td>${percent(r.standardError)}</td></tr></table><p>Direct neural evaluation for both players, fresh dice, no doubling. A small sample is uncertain; the standard error describes sampling variation only.</p>`);}catch(e){message('Rollout failed: '+e.message);}finally{if(token===epoch){busy=false;hintText='';render();}}}
const actions={finishGame,statistics:showStatistics,rollout:rolloutDialog,exportLog,back:()=>replay(-1),forward:()=>replay(1),swap:swapDice,evaluate:evaluatePosition,best:bestMoves,edit:editPosition,new:newDialog,roll,undo,finish,double,hint,settings:settingsDialog,save,load:()=>$('#file').click(),flip:()=>{settings.flip=!settings.flip;saveSettings();render();},print:()=>print(),next:()=>{if(busy||!match.result)return;if(match.matchWinner){reset();return;}epoch++;cubeFeedback=null;match=R.startGame(match);board=R.initialBoard();dice=[];prefix=[];turns=[];opening=true;selected=null;checkpoint();render();},resign:()=>{if(busy||opening||match.result||match.pendingDouble)return;modal('Resignation','Resignation is agreed between players. Select the number of points at stake.',[['Cancel',()=>{}],['Single game',()=>{match=R.resignGame(match,player,1);dice=[];log(name(player)+' resigns.');checkpoint();render();showGameResult();}]]);},help:()=>modal('How to play','<p>You play white, moving from point 24 toward point 1. Drag a checker to its destination, or click a checker and then a highlighted destination. A checker with only one legal destination moves immediately. Highlights include destinations reached using multiple dice on the same checker, including up to four moves on doubles. Each intermediate move must be legal. If routes share a destination, fewer dice are preferred, then the displayed dice order; use Swap dice or select intermediate points to choose another route. Double-click a checker to use the first available die.</p><p>Checkers on the bar enter first. You must use both dice if possible, or the higher die when only one can be used. Doubles allow four moves. Once all checkers are home, click the right-hand tray to bear off.</p><p>Click Hint repeatedly to cycle through ranked alternatives. Numbered arrows and the evaluation bar preview each suggestion for three seconds, then the bar returns to the current position. A new position restarts the cycle. Rankings consider game value, including gammons, so the best move need not have the highest simple win percentage.</p><p>Finish game (Ctrl+A) lets JellyFish play both sides at level 5 without pauses, animations, or cube prompts until the current game ends. Finish or undo a partially played turn first. Stop autoplay returns control after the current turn; normal settings are preserved.</p><p>Use Undo before picking up the dice. Click the board when waiting to roll or pick up dice, or press Space. After a game ends, click anywhere on the board to start the next game (or a new match if the match is finished). Ctrl+Z undoes. The cube may be offered before rolling, except during the Crawford game.</p>'),about:()=>modal('About JellyFish','<img class="logo" src="assets/jellyfish-logo.png" alt="JellyFish"><p><b>JellyFish Light 3.5</b><br>Browser reconstruction</p><p>Upscaled JellyFish logo supplied for this browser edition; dice redrawn in the original style. JavaScript rules and reconstructed evaluation engine.</p><p>This reconstruction is under verification. Cube decisions use the recovered money-game and match-equity policy, with the current cube, score, Crawford state, and playing level. Browser saves use JSON; legacy position and match files are not yet supported.</p>')};
$('#board').addEventListener('pointerdown',e=>{const g=e.target.closest('[data-location]');if(g&&settings.playMode!=='jellyfish'&&!busy&&!isComputer())dragStart={from:Number(g.dataset.location),x:e.clientX,y:e.clientY};});
$('#board').addEventListener('pointerup',e=>{const start=dragStart;dragStart=null;if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)<8)return;const g=e.target.closest('[data-location]');if(!g)return;const path=destinations(start.from).get(Number(g.dataset.location));if(path){moveSequence(path);suppressClick=true;setTimeout(()=>{suppressClick=false;},0);}});
$('#board').addEventListener('pointercancel',()=>{dragStart=null;});
document.addEventListener('click',e=>{if(!e.target.closest('nav'))document.querySelectorAll('nav details[open]').forEach(d=>d.open=false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const menu=$('nav details[open]');if(menu){menu.open=false;menu.querySelector('summary').focus();}}});
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav details').forEach(d=>d.open=false);try{actions[b.dataset.action]();}catch(e){message(e.message);}});
$('#dialog').addEventListener('cancel',e=>{if(match.pendingDouble!==null)e.preventDefault();});
document.addEventListener('keydown',e=>{if($('#dialog').open||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='F2'){e.preventDefault();newDialog();}if(e.key==='F4'){e.preventDefault();showStatistics();}if(e.key==='F9'){e.preventDefault();settingsDialog();}if(e.ctrlKey||e.metaKey){const a={a:'finishGame',o:'load',s:'save',r:'roll',d:'double',f:'finish',k:'back',t:'forward',w:'swap',e:'evaluate',b:'best'}[e.key.toLowerCase()];if(a){e.preventDefault();actions[a]();return;}}if(e.code==='Space'){e.preventDefault();complete()?finish():roll();}if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}});
reset();
try{ai=await import('./ai-client.js');await ai.loadAI('./data/');evaluatorReady=true;render();$('#engine-status').textContent='Evaluator ready';if(isComputer()&&dice.length)computer();}catch(e){$('#engine-status').textContent='Evaluator unavailable';message(e.message);}
window.jellyfish={getState:()=>structuredClone({board,match,player,dice,prefix,opening,busy,settings,autoplay:!!autoplay}),actions,validateSave};

setupLayout(text=>modal('Fullscreen','<p>'+text+'</p>'));
