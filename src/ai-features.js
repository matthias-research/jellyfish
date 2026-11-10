/** Contact-network inputs translated from JFL3532.exe 0x42cb60/0x42cd70.
 * Source: docs/ai-fidelity.md (full REA evidence retained locally). Feature scales and ratios checked
 * against x87 assembly; JavaScript double precision may differ at truncation
 * boundaries from the original x87 extended intermediates.
 */
const positive=n=>Math.max(n,0), flag=b=>b?1000:0;
const scaled=(n,s)=>Math.trunc(n*s*1000);
const ratio=(n,d)=>Math.trunc(n/d*1000);
export function reverseNative(p) {
  const q=new Int32Array(p);
  for(let i=0;i<26;i++)q[i]=-p[25-i];
  q[45]=p[46];q[46]=p[45];q[47]=p[48];q[48]=p[47];
  return q;
}
const count=(p,a,b,fn)=>{let n=0;for(let i=a;i<=b;i++)n+=fn(p[i],i);return n;};
export const farthest=p=>{for(let i=25;i>0;i--)if(p[i]>0)return i;return 0;};
const below=(p,n)=>count(p,1,n-1,positive);
const enemiesBelow=(p,n)=>count(p,0,n-1,x=>positive(-x));
export function contactPairs(p) {let opponents=0,n=0;for(let i=0;i<26;i++){if(p[i]<=0)opponents-=p[i];else n+=opponents*p[i];}return n;}
function occupiedPairs(p) {let opponents=0,n=0;for(let i=0;i<26;i++){if(p[i]<0)opponents++;else if(p[i]>0)n+=opponents;}return n;}
function contactCheckers(p) {let seen=0,n=0;for(let i=0;i<26;i++){if(p[i]<0)seen=1;else if(p[i]>0)n+=seen*p[i];}return n;}
function distribution(p) {return count(p,7,24,(n,i)=>positive(n)*Math.floor((i-1)/6))+p[25]*4;}
function quadrantPips(p,quadrant) {return count(p,quadrant*6-5,quadrant*6,(n,i)=>positive(n)*i)+(quadrant===4?p[25]:0);}
function spareReach(p) {
  const spare=new Int32Array(32),result=new Int32Array(26);
  for(let i=2;i<=6;i++)spare[i]=+(p[i]>2);
  for(let i=7;i<=25;i++)spare[i]=+(p[i]>0);
  for(let i=1;i<=24;i++)for(let j=i+1;j<=i+6;j++)result[i]+=spare[j];
  return result;
}
function builders(p,point) {return count(p,point+1,Math.min(25,point+6),n=>+(n===1||n>2));}
function prime(p) {
  let i=1,best=0,start=0,length=0,current=0;
  while(i<25&&p[i]>1)i++; // Native deliberately skips the run starting at the ace point.
  for(;i<25;i++) {if(p[i]<2)length=0;else {length++;if(length===1)current=i;if(length>best){best=length;start=current;}}}
  return {length:best,start};
}
function brokenPrime(p) {
  let boundaryOpen=p[1]<2,made=0,gap=0;
  for(let i=2;i<8;i++){if(p[i]<2)gap=i;else made++;}
  for(let i=8;i<24;i++) {
    if(made===5&&boundaryOpen)return gap;
    if(p[i]<2)gap=i;else made++;
    if(p[i-6]<2)boundaryOpen=true;else made--;
  }
  return 0;
}
export function directShots(p) {
  const shots=new Int32Array(7);
  for(let point=24;point>0;point--)if(p[point]===-1)for(let die=1;die<=6;die++) {
    const from=point+die;
    if(shots[die]===0&&from<26&&p[from]>0&&(from>6||p[from]!==2))shots[die]=point;
  }
  return shots;
}
function indirectShot(p,a,b,blots,shots) {
  if(p[25]>0) {
    const entryA=p[25-a],entryB=p[25-b];
    if(entryA===-1||entryB===-1)return true;
    if(p[25]===1) {
      if(entryA>-2&&(p[25-a-b]===-1||shots[b]!==0))return true;
      if(entryB>-2&&(p[25-a-b]===-1||shots[a]!==0))return true;
    }
    return false;
  }
  if(shots[a]!==0||shots[b]!==0)return true;
  for(const point of blots) {
    const from=point+a+b;
    if(from<26&&p[from]>0&&(p[from]!==2||from>6)&&(p[point+a]>-2||p[point+b]>-2))return true;
  }
  return false;
}
function doubleShot(p,die,blots) {
  if(p[25]>0){if(p[25-die]===-1)return true;if(p[25-die]<-1)return false;}
  const uses=4-p[25];
  for(const point of blots)for(let n=1;n<=uses;n++) {
    const from=point+n*die;
    if(from<26){if(p[from]<-1)break;if(p[from]>0)return true;}
  }
  return false;
}
export function hittingRolls(p,shots=directShots(p)) {
  const blots=[];for(let i=24;i>0;i--)if(p[i]===-1)blots.push(i);
  if(!blots.length)return 0;
  let total=0;
  for(let a=1;a<=6;a++) {
    for(let b=1;b<a;b++)if(indirectShot(p,a,b,blots,shots))total+=2;
    if((p[25]===0&&shots[a]!==0)||doubleShot(p,a,blots))total++;
  }
  return total;
}
export function contactSideFeatures(p) {
  const f=[];
  for(let i=1;i<=24;i++) {
    const n=p[i];
    f.push(flag(n===1),flag([4,5,6,13].includes(i)?n<2:n>=2),n>2?ratio(n-2,n-1):0);
  }
  const bar=p[25];f.push(flag(bar>0),flag(bar>1),bar>1?ratio(bar-2,bar-1):0);
  const reach=spareReach(p);
  for(let i=1;i<=24;i+=2)f.push(scaled((Math.abs(p[i])<2?reach[i]:0)+(Math.abs(p[i+1])<2?reach[i+1]:0),1/12));
  for(let i=2;i<=4;i++){const n=below(p,i);f.push(ratio(n,n+2));}
  let n=count(p,19,24,n=>+(n>1));f.push(flag(n===0),flag(n>1),flag(n>2));
  n=count(p,20,25,positive);f.push(flag(n===0),flag(n===1),n>2?ratio(n-2,n):0);
  n=count(p,1,24,n=>+(n===1));f.push(flag(n===0),flag(n===2),flag(n===3),n>3?ratio(n-3,n):0);
  const home=count(p,1,6,n=>+(n>1));
  f.push(flag(home===2),flag(home===3),flag(home===4),flag(home===5),flag(home===6),flag(home===6&&p[0]!==0));
  n=count(p,1,6,n=>+(n===1));f.push(flag(n===1),flag(n===2),flag(n>2));
  const {length,start}=prime(p),base=f.length;
  f.push(...Array(22).fill(0));
  if(length>=4) {
    if(length<6) {const edge=p[start+length];if(edge<-1)f[base]=1000;else {f[base+1]=flag(edge===1);f[base+2]=scaled(reach[start+length],1/6);}}
    f[base+3]=1000;f[base+4]=flag(length>4);f[base+5]=flag(length>=6);
    const behind=enemiesBelow(p,start);
    if(length>=6){f[base+6]=flag(behind===1);f[base+7]=flag(behind>1);}
    f[base+8]=flag(behind===1);f[base+9]=flag(behind>1);
    const front=p[start-1];
    if(front<-1){f[base+10]=1000;f[base+11]=scaled(-front-2,1);}
    else {f[base+12]=flag(front===1);f[base+13]=flag(front===-1);f[base+14]=scaled(below(p,start-1),1/3);f[base+15]=scaled(builders(p,start-1),1/3);}
    f[base+16]=scaled(start,1/12);
    for(let i=2;i<=6;i++)f[base+15+i]=flag(start===i);
  }
  const gap=length<5?brokenPrime(p):0;
  f.push(flag(gap!==0),flag(gap!==0&&p[gap]<-1),flag(gap!==0&&p[gap]===1),gap!==0&&p[gap]>=-1?scaled(builders(p,gap),1/6):0);
  f.push(scaled(quadrantPips(p,2),.02),scaled(quadrantPips(p,3),.02));
  const back=farthest(p);f.push(scaled(back,1/25),flag(back<8&&p[back]===3),scaled(p[45],1/167));
  const off=Math.min(14,15-p[47]);for(let i=1;i<=14;i++)f.push(flag(i<=off));
  const dist=distribution(p);f.push(ratio(dist,dist+10));
  const shots=directShots(p);for(let die=1;die<=6;die++)f.push(flag(shots[die]>0),scaled(shots[die],1/24));
  f.push(scaled(hittingRolls(p,shots),1/36));
  const homeReach=count(p,1,6,(n,i)=>Math.abs(n)<2?reach[i]:0);
  f.push(home<6?scaled(homeReach/(6-home),1/6):1000,scaled(contactCheckers(p),1/15));
  if(f.length!==170)throw new Error(`Contact feature layout mismatch: ${f.length}`);
  return Int32Array.from(f);
}
export function contactFeatures(p) {
  const q=reverseNative(p),f=[1000,...contactSideFeatures(p),...contactSideFeatures(q)];
  const overlap=farthest(p)+farthest(q)-25;
  for(let n=1;n<=6;n++)f.push(flag(overlap===n));
  f.push(scaled(contactPairs(p),.01));
  const pairs=occupiedPairs(p);for(let n=1;n<=6;n++)f.push(flag(pairs===n));f.push(flag(pairs>6));
  const difference=(p[45]-p[46])*.1,amount=Math.abs(difference);
  const pipFeatures=[scaled(Math.min(amount,1),1),amount>1?scaled(1-1/amount,1):0];
  f.push(...(difference>0?[...pipFeatures,0,0]:[0,0,...pipFeatures]));
  if(f.length!==359)throw new Error(`Contact vector length: ${f.length}`);
  return Int32Array.from(f);
}
