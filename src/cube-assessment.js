import {nativeMatchEquity} from './match-equity.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const ratio=(a,b)=>b>1e-12?clamp(a/b):0;
function interpolate(p,points){
  if(p<=0)return points[0][1];
  for(let i=1;i<points.length;i++){
    const [x,y]=points[i],[previous,value]=points[i-1];
    if(p<=x&&x>previous)return value+(y-value)*(p-previous)/(x-previous);
  }
  return points.at(-1)[1];
}

/** Approximate cubeful feedback, separate from the recovered native cube policy.
 * Janowski live/dead interpolation, fixed efficiency .68, conditional gammon
 * rates held constant. Match losses use a single-game win/loss equity scale.
 * Reference: GNU Backgammon manual, Technical Notes / Cubeful equities.
 */
export function assessCube(probabilities,{player=1,cube=1,cubeOwner=null,target=0,scores=[0,0],efficiency=.68}={}){
  const [bl,gl,l,w,gw,bw]=probabilities;
  if(![bl,gl,l,w,gw,bw].every(Number.isFinite))throw Error('Invalid cube probabilities');
  const p=clamp(w),wins=w>1e-12?[(w-gw)/w,(gw-bw)/w,bw/w]:[1,0,0];
  const losses=l>1e-12?[(l-gl)/l,(gl-bl)/l,bl/l]:[1,0,0];
  const W=w>1e-12?1+(gw+bw)/w:1,L=l>1e-12?1+(gl+bl)/l:1;
  const side=player===1?0:1,a=target-scores[side],b=target-scores[1-side];
  const mode=a<=11&&b<=11?1:0;
  const met=(x,y)=>nativeMatchEquity(x,y,mode);
  function endpoints(c){
    if(!target)return {low:-L,high:W,losePass:-1,winPass:1};
    return {low:losses.reduce((sum,n,i)=>sum+n*met(a,b-(i+1)*c),0),high:wins.reduce((sum,n,i)=>sum+n*met(a-(i+1)*c,b),0),losePass:met(a,b-c),winPass:met(a-c,b)};
  }
  const cache=new Map();
  function points(c){
    if(cache.has(c))return cache.get(c);
    let result;
    if(!target)result={tp:(L-.5)/(W+L+.5),cp:1-(W-.5)/(W+L+.5)};
    else if(c>=Math.max(a,b))result={tp:0,cp:1};
    else{
      const current=endpoints(c),next=endpoints(c*2),future=points(c*2);
      result={tp:ratio(current.losePass-next.low,next.winPass-next.low)*future.cp,
        cp:1-ratio(next.high-current.winPass,next.high-next.losePass)*(1-future.tp)};
    }
    cache.set(c,result);return result;
  }
  function value(c,owner){
    const {low,high,losePass,winPass}=endpoints(c),{tp,cp}=points(c);
    const nodes=[[0,low]];
    if(owner!==player)nodes.push([tp,losePass]);
    if(owner!==-player)nodes.push([cp,winPass]);
    nodes.push([1,high]);
    const dead=low*(1-p)+high*p,live=interpolate(p,nodes);
    return (1-efficiency)*dead+efficiency*live;
  }
  const noDouble=value(cube,cubeOwner);
  const doubleTake=value(cube*2,-player)*(target?1:2);
  const doublePass=endpoints(cube).winPass;
  const double=Math.min(doubleTake,doublePass),best=Math.max(noDouble,double);
  const scale=target?(met(a-cube,b)-met(a,b-cube))/2:1;
  if(!(scale>0))throw Error('Cube assessment scale unavailable');
  return {noDouble,doubleTake,doublePass,double,noDoubleLoss:Math.max(0,(best-noDouble)/scale),doubleLoss:Math.max(0,(best-double)/scale),efficiency,
    source:'Estimated cubeful loss: Janowski interpolation, fixed cube efficiency 0.68; JellyFish probabilities and match equity. Not native JellyFish or XG cube analysis.'};
}
