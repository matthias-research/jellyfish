const worker=new Worker(new URL('./ai-worker.js',import.meta.url),{type:'module'});
let sequence=0;
const pending=new Map();
worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.result);};
worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message||'Evaluator worker failed'));pending.clear();};
function call(method,...args){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});worker.postMessage({id,method,args});});}
export const loadAI=path=>call('loadAI',new URL(path,document.baseURI).href);
export const chooseTurn=(...args)=>call('chooseTurn',...args);
export const evaluate=(...args)=>call('evaluate',...args);
export const cubeAdvice=(...args)=>call('cubeAdvice',...args);

export const rankTurns=(...args)=>call('rankTurns',...args);
export const rollout=(...args)=>call('rollout',...args);
