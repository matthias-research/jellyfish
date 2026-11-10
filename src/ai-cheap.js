import {reverseNative,contactPairs,farthest} from './ai-features.js';
// Small evaluator used by levels 1–3 and candidate pruning (0x426580).
const i32=n=>Math.trunc(n)|0;
const act=Float64Array.from({length:401},(_,i)=>1000/(1+Math.exp(-(-1e7+i*50000)*1e-6)));
function activation(x){if(x<=-1e7)return 0;if(x>=1e7)return 1000;const i=Math.trunc((x+1e7)/50000),s=(act[i+1]-act[i])/50000;return i32(x*s+(act[i]-(-1e7+i*50000)*s));}
const count=(p,a,b,fn)=>{let n=0;for(let i=a;i<=b;i++)n+=fn(p[i],i);return n;};
const pos=n=>Math.max(0,n);
function prime(p){let i=1;while(i<25&&p[i]>1)i++;let length=0,best=0,start=0,current=0;for(;i<25;i++){if(p[i]<2)length=0;else {length++;if(length===1)current=i;if(length>best){best=length;start=current;}}}return {length:best,start};}
function reach(p){const spare=new Int32Array(32),out=new Int32Array(26);for(let i=2;i<=6;i++)spare[i]=+(p[i]>2);for(let i=7;i<=25;i++)spare[i]=+(p[i]>0);for(let i=1;i<=24;i++)for(let j=i+1;j<=i+6;j++)out[i]+=spare[j];return out;}
function sideFeatures(p,f,offset){
  const r=reach(p),set=(i,n)=>{f[offset+i]=i32(n);};
  for(let point=1;point<=24;point++) {
    const base=(point-1)*4,n=p[point];
    if(n===1)set(base+1,1000);
    else if(n>1){set(base+2,1000);set(base+3,(1-1/(n-1))*1000);}
    if(n<2)set(base+4,r[point]*.16667*(n===-1?2:1)*1000);
  }
  if(p[25]>0)set(97,1000);
  if(p[25]>1){set(98,1000);set(99,(1-1/(p[25]-1))*1000);}
  let n=count(p,19,24,x=>+(x>1));for(let i=1;i<=3;i++)if(i<=n)set(99+i,1000);
  n=count(p,20,25,pos);for(let i=1;i<=4;i++)if(i<=n)set(102+i,1000);
  n=count(p,1,24,x=>+(x===1));for(let i=1;i<=3;i++)if(i<=n)set(106+i,1000);if(n>3)set(110,(n-3)/n*1000);
  const home=count(p,1,6,x=>+(x>1)),enemyBar=Math.min(2,-p[0]);
  for(let i=1;i<=5;i++)if(i<home)set(110+i,(enemyBar+1)*1000);
  n=count(p,1,6,x=>+(x===1));for(let i=1;i<=3;i++)if(i<=n)set(115+i,1000);
  const {length,start}=prime(p);
  if(length>3){const enemies=count(p,0,5,x=>pos(-x))>0?1:0;set(119,(enemies+1)*1000);if(length>4)set(120,(enemies+1)*1000);if(length>5){set(121,1000);set(127,enemies*1000);}for(let i=1;i<=5;i++)if(start===i+1)set(121+i,1000);}
  set(128,farthest(p)*.04*1000);set(129,p[45]*(1/167)*1000);
  let off=15-p[47];if(off>0){set(130,1000);off--;}
  for(let i=1;i<=6;i++){if(off>=2)set(130+i,1000);else if(off>0)set(130+i,500);off-=2;}
  if(off===1)set(137,1000);
  const cross=count(p,7,24,(n,i)=>pos(n)*Math.floor((i-1)/6))+p[25]*4;
  set(138,cross/(cross+10)*1000);
}
export function cheapFeatures(p){
  const f=new Int32Array(294);sideFeatures(p,f,0);sideFeatures(reverseNative(p),f,138);
  const difference=(p[45]-p[46])*.1,n=Math.abs(difference),offset=difference>0?277:279;
  f[offset]=i32(Math.min(n,1)*1000);if(n>1)f[offset+1]=i32((1-1/n)*1000);
  f[281]=i32(contactPairs(p)*.01*1000);
  const shots=new Int32Array(7);
  // Older builder4299b0 tests the target point's home quadrant, unlike429a70.
  for(let point=24;point>0;point--)if(p[point]===-1)for(let die=1;die<=6;die++){const from=point+die;if(!shots[die]&&from<26&&p[from]>0&&(point>6||p[from]!==2))shots[die]=point;}
  for(let die=1;die<=6;die++)if(shots[die]){f[280+die*2]=1000;f[281+die*2]=i32(shots[die]*.04125*1000);}
  return f;
}
export function parseCheapNetwork(text){
  const data=text.trim().split(/\s+/).map(Number);
  if(data.length<2400||data.some(n=>!Number.isInteger(n)))throw new Error('Invalid jf300 network');
  const weights=new Int32Array(8*294),output=new Int32Array(8*6);let at=0;
  for(let h=0;h<8;h++){for(let i=0;i<294;i++)weights[h*294+i]=data[at++];for(let o=0;o<6;o++)output[h*6+o]=data[at++];}
  return {weights,output};
}
export function runCheapNetwork(model,features){
  if(features.length!==294)throw new Error('Expected 294 small-network inputs');
  const h=new Int32Array(8);h[0]=1000;
  for(let j=1;j<8;j++){let sum=Math.imul(model.weights[j*294],1000);for(let i=1;i<294;i++)sum=(sum+Math.imul(model.weights[j*294+i],features[i]))|0;h[j]=activation(sum);}
  const output=new Float64Array(6);
  for(let o=0;o<6;o++){let sum=0;for(let j=0;j<7;j++)sum=(sum+Math.imul(h[j],model.output[j*6+o]))|0;sum=(sum+Math.imul(Math.imul(h[7],model.output[42+o]),14))|0;output[o]=activation(sum)*.001;}
  return output;
}
/** Position is native canonical72 ints; level1/2 reproduce native noise shape.
 * randInt must supply the original CRT rand range0..32767 for deterministic parity.
 */
export function cheapProbabilities(model,p,{level=3,randInt=()=>Math.floor(Math.random()*32768)}={}){
  let out;
  if(!p[47]||!p[48]){out=new Float64Array(6);const own=!p[47],loser=own?reverseNative(p):p;out[own?3:2]=1;if(loser[47]===15){out[own?4:1]=1;if(loser[25]>0||count(loser,19,24,pos)>0)out[own?5:0]=1;}}
  else out=runCheapNetwork(model,cheapFeatures(p));
  if(p[47]<15){out[0]=0;out[1]=0;}if(p[48]<15){out[4]=0;out[5]=0;}
  if(level<3)for(let i=1;i<=4;i++)out[i]+=(3-level)*(randInt()%2000-1000)*.00005;
  return out;
}
export function cheapEquity(model,p,options){const v=cheapProbabilities(model,p,options);return -v[0]-v[1]-v[2]+v[3]+v[4]+v[5];}
