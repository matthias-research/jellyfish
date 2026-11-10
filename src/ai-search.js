// Native outer candidate filters: 0x423fe0, 0x4241a0, 0x4243d0, 0x4244a0.
let longbear=null,longbearEnabled=false;
export function setLongbearEnabled(enabled){longbearEnabled=!!enabled;}
export function initializeLongbear(text){
 if(!text){longbear=null;return;}
 const values=text.trim().split(/\s+/).map(Number),table=new Map(),counts=Array(7).fill(0);let at=0;
 function visit(index,max){if(index<0){table.set(counts.slice(1).join(','),values[at++]);return;}for(let n=0;n<=max;n++){counts[n]++;visit(index-1,n);counts[n]--;}}
 visit(14,6);if(at!==values.length||values.some(n=>!Number.isInteger(n)))throw Error('Invalid longbear database');longbear=table;
}
export function longbearValue(p){return longbear?.get(Array.from(p).slice(1,7).map(n=>Math.max(0,n)).join(','));}
function far(p){for(let i=25;i>0;i--)if(p[i]>0)return i;return 0;}
function flip(p){return Array.from({length:26},(_,i)=>-p[25-i]);}
function crossed(p){let behind=false,total=0;for(let i=0;i<26;i++){if(p[i]<0)behind=true;else if(behind)total+=p[i];}return total;}
function raceScore(p){
 if(crossed(p)||(p[47]>14&&p[48]<5))return null;
 if(p[47]<6&&p[48]<7&&far(p)<7&&far(flip(p))<7)return null;
 if(!longbear||!longbearEnabled)return 15-p[47];
 return far(p)<7?32000-longbearValue(p):0;
}
function closedBoardScore(p){const f=far(p);if(f<=3||f>=7||p[0]===0||p[48]<=14)return null;let made=0;for(let i=1;i<=6;i++){if(p[i]===1)return null;if(p[i]>1)made++;}return -((f-made)*2+(p[f]===3&&(f<5||p[f-1]<3)?1:0));}
function trapScore(p){
 if(p[46]>60||p[45]<100||p[47]!==15||crossed(p)<10||crossed(flip(p))!==1)return null;
 let i=1;while(p[i]>1)i++;let length=0,start=0,current=0,at=0;for(;i<25;i++){if(p[i]<2)current=0;else{if(++current===1)at=i;if(current>length){length=current;start=at;}}}
 if(length<5)return 0;for(i=1;i<start-2;i++)if(p[i]>0)return 0;
 let score=p[start-2]>0?10-p[start-2]:10;
 if(length===5&&p[start-1]===-1)return 0;if(length>5)score+=(24-start)*4;if(p[start-1]===1)score+=2;
 for(i=start;i<start+6&&i<26;i++)if(p[i]===1||p[i]>2)score++;
 return score;
}
export function nativeCandidateFilters(candidates,level){
 if(candidates.length>=800)return candidates;
 for(const score of level===6?[raceScore,closedBoardScore,trapScore]:[raceScore,trapScore]){
  const scored=candidates.map(t=>({t,v:score(t.native)})),max=Math.max(...scored.filter(x=>x.v!==null).map(x=>x.v));
  candidates=scored.filter(x=>x.v===null||x.v===max).map(x=>x.t);
 }
 return candidates;
}
