import {nativeMatchEquity as met,nativeRecubeAdjustment as recube} from './match-equity.js';

// Match-dependent checker-play weights, native 0x425e60.
export function nativeEquityWeights(a=0,b=0,c=1){
 const w=[-1,-1,-1,1,1,1];if(!a)return w;
 if(c>=a)w[4]=0;if(2*c>=a)w[5]=0;
 if(c>=b){w[0]=0;w[1]=0;}else if(b<=2*c)w[0]=0;
 if(a!==1){if(b===1){if(c===1){if(a%2===0){w[5]=0;w[4]*=2;}else{w[4]=0;w[5]*=2;}}else{w[4]*=2;w[5]*=2;}}}
 else if(c!==1){w[1]*=2;w[0]*=2;}else if(b%2===0){w[0]=0;w[1]*=2;}else{w[1]=0;w[0]*=2;}
 return w;
}

// Literal reconstruction of JFL3532 build 268, 0x424960 and 0x424e00.
// p is the native position, viewed by the player considering an offer.
function flip(p){const q=Array.from(p);for(let i=0;i<26;i++)q[i]=-p[25-i];return q;}
function crossings(p,points=false){let opposing=0,total=0;for(let i=0;i<26;i++)if(p[i]>0)total+=opposing*(points?1:p[i]);else opposing+=points?(p[i]<0?1:0):-p[i];return total;}
function risk(p){const q=flip(p);if(!crossings(q))return false;let anchors=0;for(let i=19;i<=24;i++)if(q[i]>1)anchors++;if(!anchors&&q[18]<2)return false;for(let i=14;i<=25;i++)if(p[i]>0)return false;for(let d=1;d<=6;d++)for(let i=24;i>=1;i--)if(i+d<26&&p[i]===-1&&p[i+d]>0&&(i>6||p[i+d]!==2))return false;return crossings(p,true)<=4&&p[12]*p[13]<0;}
export function nativeMoneyCube(p,v,volatility=v[6]*1.2,{jacoby=false}={}){
 const equity=v[3]+v[4]+v[5]-v[0]-v[1]-v[2],adjusted=equity-(v[2]+v[1]*.5)*.3;
 const take=adjusted<=.5?(equity<=0?2:1):0;
 if(risk(p)&&volatility<.3)volatility=.3;
 let offer=(adjusted>.2&&(p[68]<2?.75:.5)*volatility+adjusted>.5)||(!crossings(p)&&p[47]<5&&adjusted>0);
 if(offer&&(p[68]>1||!jacoby)){
  if(equity>1)return {offer:false,take};
  if(v[2]>=.001&&v[3]>=.001){const W=(v[4]+v[3])/v[3],L=-(v[1]+v[2])/v[2],denom=2*W-2*L;
   if(denom>=.001){const threshold=((1-2*L)/denom+.1667)*.8571183680466272,gap=v[3]-threshold;
    if(threshold>=.001&&gap>=.001){volatility=Math.max(volatility,gap);if((1-L)*(1-v[3])*.04+(1-L)/threshold*(volatility-gap)**2*.48<v[3]*(W-1)*.04+(W-1)/(1-v[3])*volatility**2*.48)offer=false;}
   }
  }
 }
 return {offer:!!offer,take};
}
export function nativeMatchCube(p,v,volatility=v[6]*1.2){
 const a=p[49],b=p[50],c=p[68],mode=a<12&&b<12?1:0,M=(x,y)=>met(x,y,mode);
 if(a<=c)return {offer:false,take:1};
 const bl=v[0],bw=v[5],gl=v[1]-bl,gw=v[4]-bw,sl=v[2]-v[1],sw=v[3]-v[4];
 if(risk(p)&&volatility<.3)volatility=.3;
 if(a===2&&b===2){const pass=M(1,2);return {offer:v[3]>.4&&M(1,2)*sw+M(2,1)*sl+(gw+bw)*M(0,2)+(bl+gl)*M(2,0)<pass,take:(sl+gl+bl)*M(2,0)+(sw+gw+bw)*M(0,2)<pass?1:0};}
 if(b===1)return {offer:true,take:a%2!==0||v[3]<=.5?1:0};
 const pass=M(a-c,b),r=recube(a,b,c*2,mode);
 let doubled=M(a,b-4*c)*gl+M(a-4*c,b)*gw+(sw-r*v[2])*M(a-2*c,b)+(sl+r*v[2])*M(a,b-2*c)+M(a-6*c,b)*bw+M(a,b-6*c)*bl;
 doubled=Math.min(doubled,M(a,b-4*c)*sl+M(a-4*c,b)*sw+M(a-8*c,b)*gw+M(a,b-8*c)*gl+M(a-12*c,b)*bw+M(a,b-12*c)*bl);
 let current=M(a-c,b)*sw+M(a,b-2*c)*gl+M(a-2*c,b)*gw+M(a,b-c)*sl+M(a-3*c,b)*bw+M(a,b-3*c)*bl;
 const take=pass<=doubled?0:1;let offer=false;
 if(current<doubled&&current<pass){if(p[47]>4)current=Math.max(pass-(c<2?1.5:1)*(M(a-c,b)-M(a,b))*volatility,pass*.2+current*.8);if(current<doubled)offer=true;}
 const loss=gl+sl,win=gw+sw;
 if(offer&&loss>=.001&&win>=.001){const low=(M(a,b-2*c)*sl+M(a,b-4*c)*gl)/loss,spread=(M(a-2*c,b)*sw+M(a-4*c,b)*gw)/win-low;
  if(spread>=.001&&r+1>=.001){const threshold=((pass-low)/spread+r)/(r+1);
   if(threshold>=.001){const winning=bw+win,L=pass-(M(a,b-2*c)*gl+M(a,b-c)*sl)/loss,W=(M(a-c,b)*sw+M(a-2*c,b)*gw)/win-pass,gap=winning-threshold;
    if(gap>=.001){volatility=Math.max(volatility,gap);if((1-winning)*L*.03+L/threshold*(volatility-gap)**2*.485<winning*W*.03+W/(1-winning)*volatility**2*.485)offer=false;}
   }
  }
 }
 if(b<=c)offer=true;
 return {offer,take};
}
