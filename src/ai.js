import {legalTurns, winner} from './rules.js';
import {contactFeatures} from './ai-features.js';
import {nativeMoneyCube,nativeMatchCube,nativeEquityWeights} from './ai-cube.js';
import {parseCheapNetwork,cheapProbabilities} from './ai-cheap.js';
import {initializeLongbear,nativeCandidateFilters} from './ai-search.js';

// The integer networks, feature scales and activation interpolation come from
// JFL3532 build 268. Addresses and limitations: docs/ai-fidelity.md (full REA evidence retained locally).
let models = null;
const cache = new Map();
export const AI_FIDELITY = 'Recovered JellyFish 3.5 neural evaluator; browser search';
const trunc = x => Math.trunc(x) | 0;
const clamp = x => Math.max(0, Math.min(1, x));
const activations = Float64Array.from({length:401},(_,i)=>1000/(1+Math.exp(-(-1e7+i*50000)*1e-6)));
export function activation(x) {
  if(x<=-1e7)return 0;
  if(x>=1e7)return 1000;
  const i=Math.trunc((x+1e7)/50000), slope=(activations[i+1]-activations[i])/50000;
  return trunc(x*slope+(activations[i]-(-1e7+i*50000)*slope));
}
export function parseNetwork(text, inputs, hidden) {
  const v=text.trim().split(/\s+/).map(Number), count=hidden*(inputs+7);
  if(v.length<count+1 || v[count]!==0 || v.some(n=>!Number.isInteger(n)))throw Error('Invalid JellyFish network data');
  const weights=new Int32Array(hidden*inputs), output=new Int32Array(hidden*7);
  let at=0;
  for(let h=0;h<hidden;h++) {
    for(let i=0;i<inputs;i++)weights[h*inputs+i]=v[at++];
    for(let o=0;o<7;o++)output[h*7+o]=v[at++];
  }
  return {inputs,hidden,weights,output};
}
export function runNetwork(model,features) {
  if(features.length!==model.inputs)throw Error(`Expected ${model.inputs} features, received ${features.length}`);
  const h=new Int32Array(model.hidden); h[0]=1000;
  for(let j=1;j<h.length;j++) {
    let sum=0; const start=j*model.inputs;
    for(let i=0;i<features.length;i++)sum=(sum+Math.imul(features[i],model.weights[start+i]))|0;
    h[j]=activation(sum);
  }
  const out=new Float64Array(7);
  for(let o=0;o<7;o++) {
    if(o===3)continue;
    let sum=0;
    for(let j=0;j<h.length;j++)sum=(sum+Math.imul(h[j],model.output[j*7+o]))|0;
    out[o]=activation(sum)*.001;
  }
  out[3]=1-out[2];
  return out;
}
export function parseBearoff(text) {
  const v=text.trim().split(/\s+/).map(Number), n=v[0], table=new Map();
  if(v.length!==1+n*16)throw Error('Invalid bearoff database');
  for(let r=0;r<n;r++) {const i=1+r*16;table.set(v.slice(i,i+6).join(','),v.slice(i+7,i+16));}
  return table;
}
export function initializeAI(data) {
  models={race:parseNetwork(data['jf304.dat'],87,51),contact:parseNetwork(data['jf301.dat'],359,77),
    crashed:parseNetwork(data['jf302.dat'],359,77),backgame:parseNetwork(data['jf303.dat'],359,77),bearoff:parseBearoff(data['bearoff.dat'])};
  models.cheap=data['jf300.dat']?parseCheapNetwork(data['jf300.dat']):null;
  initializeLongbear(data['longbear.dat']);
  cache.clear();
  return {ready:true,source:AI_FIDELITY};
}
export async function loadAI(baseURL='../data/') {
  const base=new URL(baseURL,import.meta.url);
  const files=['jf300.dat','jf301.dat','jf302.dat','jf303.dat','jf304.dat','bearoff.dat','longbear.dat'];
  const entries=await Promise.all(files.map(async name=>{
    const response=await fetch(new URL(name,base));
    if(!response.ok)throw Error(`Unable to load ${name}: ${response.status}`);
    return [name,await response.text()];
  }));
  return initializeAI(Object.fromEntries(entries));
}
export function nativePosition(board,player) {
  const p=new Int32Array(72), side=player===1?0:1;
  p[0]=-board.bar[1-side];p[25]=board.bar[side];
  for(let i=0;i<24;i++)p[i+1]=player===1?board.points[i]:-board.points[23-i];
  for(let i=0;i<26;i++) {
    if(p[i]>0){p[45]+=i*p[i];p[47]+=p[i];}
    if(p[i]<0){p[46]-=(25-i)*p[i];p[48]-=p[i];}
  }
  return p;
}
export function flipPosition(p) {
  const q=new Int32Array(p);
  for(let i=0;i<26;i++)q[i]=-p[25-i];
  [q[45],q[46]]=[p[46],p[45]];[q[47],q[48]]=[p[48],p[47]];
  return q;
}
function farthest(p) {for(let i=25;i>0;i--)if(p[i]>0)return i;return 0;}
function crossCount(p) {let opposing=0,total=0;for(let i=0;i<26;i++)if(p[i]>0)total+=opposing*p[i];else opposing-=p[i];return total;}
function crossPoints(p) {let opposing=0,total=0;for(let i=0;i<26;i++)if(p[i]>0)total+=opposing;else if(p[i]<0)opposing++;return total;}
function backgame(p) {
  let anchors=0;for(let i=19;i<=24;i++)if(p[i]>1)anchors++;
  const diff=p[45]-p[46]-50;
  const wasted=(p[1]>1?p[1]*2:0)+(p[2]>2?p[2]:0);
  return diff>=0 && anchors && crossCount(p)>3 && anchors-wasted*.2>0;
}
function crossovers(p){let n=p[25]*4;for(let i=7;i<=24;i++)n+=Math.max(0,p[i])*Math.floor((i-1)/6);return n;}
function backMen(p){let n=p[25]*2;for(let i=19;i<=24;i++)n+=Math.max(0,p[i]);return n;}
function finishRolls(p) {
  let count=0;const far=farthest(p);
  for(let a=1;a<=6;a++)for(let b=1;b<a;b++) {
    if(p[47]<3&&(p[47]===1?far<=a+b:far<=a&&p[45]-far<=b))count+=2;
  }
  if(p[47]<=4)for(let d=1;d<=6;d++) {
    let spare=d*4-p[45];
    if(spare>=0) {for(let i=1;i<=far;i++)if(p[i]>0&&i%d)spare-=(d-i%d)*p[i];if(spare>=0)count++;}
  }
  return count;
}
function differenceFeatures(diff) {
  const f=[0,0,0,0],v=Math.abs(diff)*.1,offset=diff>0?0:2;
  f[offset]=trunc(Math.min(1,v)*1000); f[offset+1]=v>1?trunc((1-1/v)*1000):0;
  return f;
}
export function raceFeatures(p) {
  const f=[1000], q=flipPosition(p);
  function side(s) {
    for(let i=1;i<24;i++)f.push(s[i]>0?trunc(s[i]/(s[i]+2)*1000):0);
    for(let i=1;i<15;i++)f.push(i<=15-s[47]?1000:0);
    f.push(trunc(s[45]*.01*1000),trunc(crossovers(s)*.2*1000),trunc(backMen(s)*.5*1000));
  }
  side(p);const finish=finishRolls(p)/36;f.push(trunc(finish*1000));
  side(q);f.push(trunc(finishRolls(q)*(1-finish)/36*1000));
  f.push(...differenceFeatures(p[45]-p[46]));
  return Int32Array.from(f);
}
function bearoffKey(p){const key=[];for(let i=1;i<=6;i++)for(let j=0;j<p[i];j++)key.push(i);while(key.length<6)key.unshift(0);return key.join(',');}
function result(out,source) {
  const [backgammonLose,gammonLose,lose,win,gammonWin,backgammonWin]=out;
  return {equity:win-lose+gammonWin-gammonLose+backgammonWin-backgammonLose,win,lose,gammonWin,gammonLose,backgammonWin,backgammonLose,uncertainty:out[6]??0,source,probabilities:Array.from(out)};
}
function terminal(p) {
  if(p[47]&&p[48])return null;
  const o=new Float64Array(7),own=p[47]===0,loser=own?flipPosition(p):p;
  o[own?3:2]=1;
  if(loser[47]===15){o[own?4:1]=1;if(backMen(loser)>0)o[own?5:0]=1;}
  return result(o,'terminal');
}
export function evaluate(board,player=1) {
  const p=nativePosition(board,player),end=terminal(p);if(end)return end;
  if(!models)throw Error('JellyFish evaluator data has not loaded');
  const key=Array.from(p.subarray(0,26)).join(',');const prior=cache.get(key);if(prior)return prior;
  const q=flipPosition(p),contact=crossCount(p)>0;
  let out,source;
  if(!contact) {
    source='jf304 race';out=runNetwork(models.race,raceFeatures(p));
    if(p[47]<=6&&p[48]<=6&&farthest(p)<=6&&farthest(q)<=6) {
      const a=models.bearoff.get(bearoffKey(p)),b=models.bearoff.get(bearoffKey(q));
      if(a&&b){let win=0;for(let i=0;i<9;i++)for(let j=i;j<9;j++)win+=a[i]*b[j];out=new Float64Array([0,0,1-win,win,0,0,out[6]]);source='original bearoff database';}
    }
    if(backMen(p)===0)out[0]=0;if(backMen(q)===0)out[5]=0;
  } else {
    const type=p[47]+p[48]<30?'crashed':backgame(p)||backgame(q)?'backgame':'contact';
    source={crashed:'jf302 contact with borne-off checkers',backgame:'jf303 backgame',contact:'jf301 contact'}[type];
    out=runNetwork(models[type],contactFeatures(p));
    if(type!=='contact') {
      function prime(s){let i=1;while(s[i]>1)i++;let longest=0,current=0;for(;i<25;i++){current=s[i]>1?current+1:0;longest=Math.max(longest,current);}return longest;}
      if(prime(p)>5){out[3]+=.01;out[2]-=.01;}if(prime(q)>5){out[3]-=.01;out[2]+=.01;}
    }
  }
  if(p[47]<15){out[0]=0;out[1]=0;}if(p[48]<15){out[4]=0;out[5]=0;}
  const value=result(out,source);if(cache.size>50000)cache.clear();cache.set(key,value);return value;
}
function invert(value){return result([value.backgammonWin,value.gammonWin,value.win,value.lose,value.gammonLose,value.backgammonLose,value.uncertainty],value.source);}
function uniqueTurns(board,player,dice) {
  const ordered=legalTurns(board,player,dice).sort((a,b)=>{
    for(let i=0;i<Math.min(a.moves.length,b.moves.length);i++){
      const x=a.moves[i],y=b.moves[i];
      if(x.die!==y.die)return x.die===dice[0]?-1:1;
      const xf=x.from===-1?25:player===1?x.from+1:24-x.from,yf=y.from===-1?25:player===1?y.from+1:24-y.from;
      if(xf!==yf)return yf-xf;
    }return 0;
  });
  const seen=new Set();return ordered.filter(t=>{const k=t.board.points.join(',')+';'+t.board.bar+';'+t.board.off;if(seen.has(k))return false;seen.add(k);return true;});
}
function bestDirect(board,player,dice,weights=[-1,-1,-1,1,1,1]) {
  const turns=cheapFilter(uniqueTurns(board,player,dice),player,weights);let best=null;
  for(const turn of turns){const v=invert(evaluate(turn.board,-player)),score=v.probabilities.slice(0,6).reduce((sum,n,i)=>sum+n*weights[i],0);if(!best||score>best.score)best={...turn,score,evaluation:v};}
  return best;
}
function cheapFilter(turns,player,weights=[-1,-1,-1,1,1,1]){
  if(!models.cheap||!turns.length||!crossCount(nativePosition(turns.at(-1).board,player)))return turns;
  const scored=turns.map(t=>({t,score:scoreProbabilities(cheapProbabilities(models.cheap,nativePosition(t.board,-player),{level:3}),weights)}));
  const best=Math.max(...scored.map(x=>x.score));return scored.filter(x=>x.score>best-.1).map(x=>x.t);
}
function scoreProbabilities(opponent,ownWeights){let score=0;for(let i=0;i<6;i++)score+=opponent[5-i]*ownWeights[i];return score;}
export function evaluateLookahead(board,player=1,{level=6,weights=[-1,-1,-1,1,1,1]}={}) {
  if(winner(board))return evaluate(board,player);
  const out=new Float64Array(7),correction=new Float64Array(6);let mean=0,secondMoment=0,extraVariance=0;
  for(let a=1;a<=6;a++)for(let b=1;b<=a;b++) {
    const best=bestDirect(board,player,[a,b],weights);
    const v=best?best.evaluation:invert(evaluate(board,-player)),weight=(a===b?1:2)/36;
    const equity=best?.score??v.equity;mean+=equity*weight;secondMoment+=equity*equity*weight;
    for(let i=0;i<6;i++)out[i]+=v.probabilities[i]*weight;
    if(level>=7&&best&&((a===5&&b===1)||(a===3&&b===2)||(a===6&&b===4))&&!winner(best.board)) {
      const next=evaluateLookahead(best.board,-player,{level:6,weights:weights.slice().reverse().map(x=>-x)}),deep=invert(next);extraVariance+=(next.variance??0)/3;
      for(let i=0;i<6;i++)correction[i]+=(deep.probabilities[i]-v.probabilities[i])*.25;
    }
  }
  const shallow=result(out,'original level 6 lookahead');
  for(let i=0;i<6;i++)out[i]=clamp(out[i]+correction[i]);
  out[4]=Math.min(out[4],out[3]);out[5]=Math.min(out[5],out[4]);out[1]=Math.min(out[1],out[2]);out[0]=Math.min(out[0],out[1]);
  return {...result(out,`original evaluator with level ${level} lookahead`),variance:Math.max(0,secondMoment-mean*mean+extraVariance),shallow};
}
export function chooseTurn(board,player,dice,options={}) {
  return rankTurns(board,player,dice,{...options,limit:1})[0]??null;
}
// Evaluate a played successor using the same perspective and cube/match weights as ranking.
export function scorePlayedBoard(board,player,{level=5,target=0,scores=[0,0],cube=1}={}){
  const side=player===1?0:1;
  const weights=nativeEquityWeights(target?target-scores[1-side]:0,target?target-scores[side]:0,cube).reverse().map(x=>-x);
  const evaluation=invert(level>=6?evaluateLookahead(board,-player,{level,weights:weights.slice().reverse().map(x=>-x)}):evaluate(board,-player));
  return {score:evaluation.probabilities.slice(0,6).reduce((sum,n,i)=>sum+n*weights[i],0),evaluation};
}
export function rankTurns(board,player,dice,{level=5,limit=10,target=0,scores=[0,0],cube=1,randInt,searchBudget=10}={}) {
  const side=player===1?0:1,weights=nativeEquityWeights(target?target-scores[1-side]:0,target?target-scores[side]:0,cube).reverse().map(x=>-x);
  const opponentWeights=weights.slice().reverse().map(x=>-x);
  const score=v=>v.probabilities.slice(0,6).reduce((sum,n,i)=>sum+n*weights[i],0);
  let turns=uniqueTurns(board,player,dice);
  if(level<4&&!models.cheap)throw Error('Original jf300 evaluator data has not loaded');
  if(level===4)turns=cheapFilter(turns,player,weights);
  if(level>=6){
    turns=nativeCandidateFilters(turns.map(t=>({...t,native:nativePosition(t.board,player)})),level);
    const direct=turns.map(t=>({...t,direct:score(invert(evaluate(t.board,-player)))})).sort((a,b)=>b.direct-a.direct);
    const threshold=level===6?.06:.12000000000000001;
    turns=direct.filter(t=>direct[0].direct-t.direct<=threshold).slice(0,level===6?3:99);
  }
  if(level>=7&&turns.length>1){
    // Native 0x427e00 budgets the number of legal successor boards, not time.
    function complexity(b,side){let n=0;for(let a=1;a<=6;a++)for(let d=1;d<=a;d++)n+=uniqueTurns(b,side,[a,d]).length;return n;}
    let deepCount=0,shallowCount=0,deepWork=0,shallowWork=0;
    for(let i=0;i<turns.length;i++){
      const own=deepCount===0?complexity(turns[i].board,player):0;
      const other=deepCount===0||shallowCount===0?complexity(turns[i].board,-player):0;
      deepWork+=other+own*3;shallowWork+=other;
      if(deepCount===0&&deepWork>searchBudget*700)deepCount=i;
      if(shallowCount===0&&shallowWork>searchBudget*300)shallowCount=i;
    }
    if(!deepCount)deepCount=turns.length;if(!shallowCount)shallowCount=turns.length;
    if(deepCount===1)deepCount=0;if(shallowCount===1)shallowCount=0;
    const deep=[],shallow=[];
    for(let i=0;i<Math.max(deepCount,shallowCount);i++){
      const turn=turns[i],next=evaluateLookahead(turn.board,-player,{level:i<deepCount?7:6,weights:opponentWeights}),v=invert(next);
      if(i<deepCount)deep.push({...turn,score:score(v),evaluation:v,evaluationLevel:7});
      if(i<shallowCount){const sv=invert(next.shallow??next);shallow.push({...turn,index:i,score:score(sv),evaluation:sv,evaluationLevel:6});}
    }
    shallow.sort((a,b)=>b.score-a.score);
    if(!deepCount)return (shallow.length?shallow:turns.map(t=>({...t,score:t.direct,evaluation:invert(evaluate(t.board,-player)),evaluationLevel:5}))).slice(0,limit);
    if(shallow[0]?.index>=deepCount){const turn=shallow[0],v=invert(evaluateLookahead(turn.board,-player,{level:7,weights:opponentWeights}));deep.push({...turn,score:score(v),evaluation:v,evaluationLevel:7});}
    return deep.sort((a,b)=>b.score-a.score).slice(0,limit);
  }
  return turns.map(turn=>{
    const v=invert(level<4?result(cheapProbabilities(models.cheap,nativePosition(turn.board,-player),{level,randInt}),'jf300 small network'):level>=6?evaluateLookahead(turn.board,-player,{level,weights:opponentWeights}):evaluate(turn.board,-player));
    return {...turn,score:score(v),evaluation:v,evaluationLevel:level===4?5:level};
  }).sort((a,b)=>b.score-a.score).slice(0,limit);
}
export function cubeAdvice(board,player=1,{cube=1,target=0,scores=[0,0],crawford=false,level=5,jacoby=false}={}) {
  function decision(side){
    const p=nativePosition(board,side),index=side===1?0:1;p[68]=cube;
    p[49]=target?target-scores[index]:0;p[50]=target?target-scores[1-index]:0;
    let evaluation=level<4?result(cheapProbabilities(models.cheap,p,{level}),'jf300 small network'):evaluate(board,side),volatility=level<4?.25:evaluation.uncertainty*1.2;
    const shouldSearch=target?evaluation.win>.55:evaluation.equity>.2&&evaluation.equity<1;
    if(level>=6&&shouldSearch){evaluation=evaluateLookahead(board,side,{level});volatility=Math.sqrt(evaluation.variance+(level>=7?.0001:.02));}
    return {...(target?nativeMatchCube(p,evaluation.probabilities,volatility):nativeMoneyCube(p,evaluation.probabilities,volatility,{jacoby})),evaluation};
  }
  const own=decision(player),opponent=decision(-player);
  return {offer:!crawford&&own.offer,take:opponent.take!==0,beaver:!target&&opponent.take===2,opponentTake:own.take!==0,evaluation:own.evaluation,source:'recovered native money and match cube policy'};
}
