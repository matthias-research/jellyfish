import {rollout} from './rollout.js';
import * as ai from './ai.js';
self.onmessage = async ({data:{id,method,args}}) => {
  try {
    if(method==='rollout'){self.postMessage({id,result:rollout(...args)});return;}
    if(!['loadAI','chooseTurn','evaluate','cubeAdvice','rankTurns'].includes(method) || typeof ai[method] !== 'function') throw Error('Unknown evaluator request');
    const result=await ai[method](...args);
    self.postMessage({id,result});
  } catch(error) {self.postMessage({id,error:error.message});}
};
