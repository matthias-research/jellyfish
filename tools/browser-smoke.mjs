import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const endpoint=process.env.CDP_URL||'http://localhost:9238';
const target=await fetch(endpoint+'/json/new?'+encodeURIComponent(process.env.PREVIEW_URL||'http://localhost:4181'),{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,m=>m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result));ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
try{
await send('Runtime.enable');await send('Page.enable');await send('Page.addScriptToEvaluateOnNewDocument',{source: `localStorage.setItem("jellyfish-settings",JSON.stringify({opponent:"computer",target:7,level:5,flip:false,dicePauseMs:0,animationMs:0}));window.__cubeRequests=[];window.__searchRequests=[];const originalPostMessage=Worker.prototype.postMessage;Worker.prototype.postMessage=function(message,...rest){if(message.method==='cubeAdvice')window.__cubeRequests.push(structuredClone(message.args));if(['chooseTurn','rankTurns'].includes(message.method))window.__searchRequests.push({method:message.method,args:structuredClone(message.args)});return originalPostMessage.call(this,message,...rest);};`});await send('Page.reload');await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
for(let i=0;i<100;i++){if(await evaluate('!!window.jellyfish'))break;await new Promise(r=>setTimeout(r,100));}
assert.equal(await evaluate('!!window.jellyfish'),true);
await evaluate("jellyfish.actions.new();document.querySelector('#new-opponent').value='human';document.querySelector('#dialog-buttons button:last-child').click()");
let state=await evaluate('jellyfish.getState()');assert.equal(state.opening,true);assert.equal(state.settings.opponent,'human');
await evaluate('document.querySelector("#board [data-location]").dispatchEvent(new MouseEvent("click",{bubbles:true}))');state=await evaluate('jellyfish.getState()');assert.equal(state.dice.length,2);assert.equal(state.opening,false);assert.equal(state.prefix.length,0);
const beforeBoardClick=state;
await evaluate('document.querySelector("#board").dispatchEvent(new MouseEvent("click",{bubbles:true}))');
assert.deepEqual(await evaluate('jellyfish.getState()'),beforeBoardClick,'background click must not skip required checker moves');
const played=await evaluate(`(async()=>{const R=await import('./src/rules.js');const s=jellyfish.getState();const m=R.legalTurns(s.board,s.player,s.dice)[0].moves[0];const click=p=>{const label=p===-1?(s.player===1?'White':'Black')+' bar:':p===24?'Bear off':'Point '+(p+1)+':';[...document.querySelectorAll('#board [role=button]')].find(n=>n.getAttribute('aria-label').startsWith(label)).dispatchEvent(new MouseEvent('click',{bubbles:true}));};if(m){click(m.from);click(m.to);}return !!m;})()`);
if(played){assert.equal((await evaluate('jellyfish.getState()')).prefix.length,1);await evaluate('jellyfish.actions.undo()');assert.equal((await evaluate('jellyfish.getState()')).prefix.length,0);}
if(played){await evaluate(`(async()=>{const R=await import('./src/rules.js');const s=jellyfish.getState(),m=R.legalTurns(s.board,s.player,s.dice)[0].moves[0];const buttons=[...document.querySelectorAll('[data-location]')];const a=buttons.find(e=>Number(e.dataset.location)===m.from),b=buttons.find(e=>Number(e.dataset.location)===m.to);a.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:10,clientY:10}));b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:100,clientY:100}));})()`);assert.equal((await evaluate('jellyfish.getState()')).prefix.length,1);await evaluate('jellyfish.actions.undo()');}
const playTurn=async()=>evaluate(`(async()=>{const R=await import('./src/rules.js');const s=jellyfish.getState();const t=R.legalTurns(s.board,s.player,s.dice)[0];for(const m of t.moves){const click=p=>{const label=p===-1?(s.player===1?'White':'Black')+' bar:':p===24?'Bear off':'Point '+(p+1)+':';[...document.querySelectorAll('#board [role=button]')].find(n=>n.getAttribute('aria-label').startsWith(label)).dispatchEvent(new MouseEvent('click',{bubbles:true}));};click(m.from);click(m.to);while(jellyfish.getState().busy)await new Promise(r=>setTimeout(r,10));}return document.querySelector('#finish').disabled;})()`);
assert.equal(await playTurn(),false);const oldPlayer=(await evaluate('jellyfish.getState()')).player;
await evaluate('document.querySelector("#board [data-location]").dispatchEvent(new MouseEvent("click",{bubbles:true}))');assert.equal((await evaluate('jellyfish.getState()')).player,-oldPlayer);
assert.equal((await evaluate('jellyfish.getState()')).dice.length,0,'submission click must not also roll the next turn');
await evaluate('jellyfish.actions.settings()');
const beforeModalClick=await evaluate('jellyfish.getState()');
await evaluate('document.querySelector("#board").dispatchEvent(new MouseEvent("click",{bubbles:true}))');
assert.deepEqual(await evaluate('jellyfish.getState()'),beforeModalClick,'dialog must prevent board advancement');
await evaluate('document.querySelector("#dialog").close()');
await evaluate('jellyfish.actions.double()');assert.equal(await evaluate('document.querySelector("#dialog").open'),true);
await evaluate('document.querySelector("#dialog-buttons button:last-child").click()');assert.equal((await evaluate('jellyfish.getState()')).match.cube,2);
await evaluate("jellyfish.actions.new();document.querySelector('#new-opponent').value='computer';document.querySelector('#dialog-buttons button:last-child').click()");
assert.equal(await evaluate('document.querySelector("#engine-status").textContent'),'Evaluator ready');
await evaluate('jellyfish.actions.roll()');
async function idle(){for(let i=0;i<200;i++){const s=await evaluate('jellyfish.getState()');if(!s.busy&&s.player===1)return s;await new Promise(r=>setTimeout(r,100));}throw Error('Computer turn timed out');}
state=await idle();if(!state.dice.length)await evaluate('jellyfish.actions.roll()');
assert.equal(await playTurn(),false);await evaluate('jellyfish.actions.finish()');await new Promise(r=>setTimeout(r,500));state=await idle();assert.equal(state.player,1);assert.equal(state.dice.length,0);
await evaluate('jellyfish.actions.double()');await new Promise(r=>setTimeout(r,400));assert.equal((await evaluate('jellyfish.getState()')).match.pendingDouble,null);
await evaluate('jellyfish.actions.evaluate()');
for(let i=0;i<50;i++){if(await evaluate('document.querySelector("#dialog").open'))break;await new Promise(r=>setTimeout(r,100));}
assert.equal(await evaluate('document.querySelector("#dialog-title").textContent'),'Position evaluation');
assert.equal(await evaluate('document.querySelector("#dialog-body").textContent.includes("NaN")'),false);
await evaluate('document.querySelector("#dialog").close();jellyfish.actions.edit()');
await evaluate('document.querySelector("[data-point]").value=15;document.querySelector("#dialog-buttons button:last-child").click()');
assert.equal(await evaluate('document.querySelector("#dialog").open'),true);
assert.equal(await evaluate('document.querySelector("#edit-error").textContent.length>0'),true);
await evaluate('document.querySelector("#dialog").close()');const beforeReplay=await evaluate('jellyfish.getState()');await evaluate('jellyfish.actions.back()');
const backState=await evaluate('jellyfish.getState()');await evaluate('jellyfish.actions.forward()');
const afterReplay=await evaluate('jellyfish.getState()');assert.deepEqual(afterReplay.board,beforeReplay.board);assert.equal(afterReplay.player,beforeReplay.player);
await evaluate('jellyfish.actions.roll()');
if((await evaluate('jellyfish.getState()')).player===1){await evaluate('jellyfish.actions.hint()');for(let i=0;i<100;i++){if(!(await evaluate('jellyfish.getState()')).busy)break;await new Promise(r=>setTimeout(r,100));}assert.ok(await evaluate('document.querySelector("#instruction").textContent.startsWith("Suggested turn")||document.querySelector("#instruction").textContent==="No legal moves."'));await evaluate('jellyfish.actions.best()');for(let i=0;i<100;i++){if(await evaluate('document.querySelector("#dialog").open'))break;await new Promise(r=>setTimeout(r,100));}assert.equal(await evaluate('document.querySelector("#dialog-title").textContent.startsWith("Best moves")'),true);await evaluate('document.querySelector("#dialog").close()');}
await evaluate('jellyfish.actions.statistics()');assert.equal(await evaluate('document.querySelector("#dialog-body").textContent.includes("Recorded rolls")'),true);await evaluate('document.querySelector("#dialog").close();jellyfish.actions.edit()');
await evaluate(`document.querySelectorAll('[data-point]').forEach((e,i)=>e.value=i===0?1:i===23?-1:0);document.querySelector('#edit-bar-0').value=0;document.querySelector('#edit-bar-1').value=0;document.querySelector('#edit-off-0').value=14;document.querySelector('#edit-off-1').value=14;document.querySelector('#edit-player').value=1;document.querySelector('#dialog-buttons button:last-child').click();jellyfish.actions.rollout();document.querySelector('#rollout-games').value=8;document.querySelector('#dialog-buttons button:last-child').click()`);
for(let i=0;i<100;i++){if(await evaluate('document.querySelector("#dialog").open'))break;await new Promise(r=>setTimeout(r,100));}
assert.equal(await evaluate('document.querySelector("#dialog-title").textContent'),'Rollout results');assert.equal(await evaluate('document.querySelector("#dialog-body").textContent.includes("8 / 0")'),true);await evaluate('document.querySelector("#dialog").close();jellyfish.actions.new();document.querySelector("#dialog-buttons button:last-child").click()');
await evaluate('jellyfish.actions.settings();document.querySelector("#level").value=4;document.querySelector("#dialog-buttons button:last-child").click();jellyfish.actions.roll()');
state=await idle();if(state.dice.length){assert.equal(await playTurn(),false);await evaluate('jellyfish.actions.finish()');await new Promise(r=>setTimeout(r,500));state=await idle();}assert.equal(state.player,1);assert.equal(state.busy,false);
await evaluate('jellyfish.actions.settings();document.querySelector("#level").value=5;document.querySelector("#dialog-buttons button:last-child").click();jellyfish.actions.new();document.querySelector("#dialog-buttons button:last-child").click()');
await fs.mkdir('analysis/browser',{recursive:true});
const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile('analysis/browser/desktop.png',Buffer.from(shot.data,'base64'));
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
const mobile=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile('analysis/browser/mobile.png',Buffer.from(mobile.data,'base64'));
const cubeRequests=await evaluate('window.__cubeRequests');assert.ok(cubeRequests.length>0);for(const [b,p,c] of cubeRequests){assert.equal(p,-1);assert.equal(c.target,7);assert.deepEqual(c.scores,[0,0]);assert.ok([4,5].includes(c.level));assert.equal(c.crawford,false);assert.equal(c.jacoby,false);assert.ok([1,2].includes(c.cube));}const searchRequests=await evaluate('window.__searchRequests');assert.ok(searchRequests.some(r=>r.method==='chooseTurn'));assert.ok(searchRequests.some(r=>r.method==='rankTurns'));assert.ok(searchRequests.some(r=>r.method==='chooseTurn'&&r.args[3].level===4));for(const r of searchRequests){const c=r.args[3];assert.equal(c.target,7);assert.deepEqual(c.scores,[0,0]);assert.ok([4,5].includes(c.level));assert.equal(c.crawford,false);assert.ok([1,2].includes(c.cube));}assert.deepEqual(errors,[]);console.log('Browser smoke passed: load, human game, roll, checker move, undo, completed turns, human and AI cube responses, worker computer turn, statistics, rollout, responsive layout.');
}finally{ws.close();await fetch(endpoint+'/json/close/'+target.id);}
