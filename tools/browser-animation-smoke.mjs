import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';

const endpoint=process.env.CDP_URL||'http://localhost:9238',base=process.env.PREVIEW_URL||'http://localhost:4181';
const target=await fetch(endpoint+'/json/new?'+encodeURIComponent(base),{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true});});
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method));},15000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(expression,label,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expression))return;await delay(25);}throw Error('Timed out: '+label);}
const state=()=>evaluate('jellyfish.getState()');
const moving="document.querySelector('#board').dataset.animation==='moving'";
const idle="!jellyfish.getState().busy && document.querySelector('#board').dataset.animation!=='moving'";
async function settings(pause,speed,flip=false){await evaluate(`jellyfish.actions.settings();document.querySelector('#dice-pause').value=${pause};document.querySelector('#animation-speed').value=${speed};document.querySelector('#flip').checked=${flip};document.querySelector('#dialog-buttons button:last-child').click();`);}
async function newGame(opponent='human'){await evaluate(`jellyfish.actions.new();document.querySelector('#new-opponent').value=${JSON.stringify(opponent)};document.querySelector('#dialog-buttons button:last-child').click();`);}
async function edit(board,player=1){await evaluate(`jellyfish.actions.edit();{const b=${JSON.stringify(board)};document.querySelectorAll('[data-point]').forEach((e,i)=>e.value=b.points[i]);for(const k of ['bar','off'])for(let i=0;i<2;i++)document.querySelector('#edit-'+k+'-'+i).value=b[k][i];document.querySelector('#edit-player').value=${player};document.querySelector('#dialog-buttons button:last-child').click();}`);}
function board(entries,bar=[0,0]){const points=Array(24).fill(0);for(const [i,n]of entries)points[i]=n;return {points,bar,off:[15-bar[0]-points.reduce((s,n)=>s+Math.max(0,n),0),15-bar[1]-points.reduce((s,n)=>s+Math.max(0,-n),0)]};}
async function roll(a=2,b=1){await evaluate(`{let i=0;const values=[${a-1},${b-1}];crypto.getRandomValues=function(v){v[0]=values[(i++)%2];return v;};jellyfish.actions.roll();}`);}
async function clickMove(from,to){await evaluate(`{const click=p=>[...document.querySelectorAll('#board [data-location]')].find(e=>Number(e.dataset.location)===p).dispatchEvent(new MouseEvent('click',{bubbles:true}));click(${from});click(${to});}`);}
async function snapshot(name){const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile('analysis/browser/'+name,Buffer.from(shot.data,'base64'));}

try{
 await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
 await waitFor('!!window.jellyfish','app ready');await fs.mkdir('analysis/browser',{recursive:true});
 await newGame('computer');await settings(1.2,1200);
 const start=await evaluate("(async()=> (await import('./src/rules.js')).initialBoard())()");await edit(start,-1);
 const rolledAt=Date.now();await roll();await waitFor("document.querySelector('#board').dataset.phase==='pause'",'post-roll pause');
 const paused=await state();assert.equal(paused.dice.length,2);assert.equal(paused.prefix.length,0);assert.equal(paused.busy,true);
 await delay(300);assert.deepEqual((await state()).board,paused.board,'computer must not move during configured pause');
 await snapshot('dice-pause.png');
 await waitFor(moving,'computer checker moving');assert.ok(Date.now()-rolledAt>=1100,'configured 1.2-second pause must elapse before moving');
 const first=await evaluate("document.querySelector('[data-moving-checker]').getAttribute('transform')");
 await delay(120);const second=await evaluate("document.querySelector('[data-moving-checker]')?.getAttribute('transform')");assert.ok(second&&first!==second,'checker must travel between frames');
 assert.equal((await state()).busy,true);await snapshot('checker-mid-animation.png');await delay(450);assert.equal((await state()).prefix.length,1,'slow setting must still be animating the first move');assert.equal(await evaluate(moving),true);
 // Reset during a pending animation must remove ghosts and prevent stale commits.
 await newGame('human');const resetState=await state();await delay(1400);assert.deepEqual((await state()).board,resetState.board);assert.equal((await state()).opening,true);assert.equal(await evaluate("!!document.querySelector('[data-moving-checker]')"),false);

 // Human hits animate, then Undo restores both the hit checker and source.
 await settings(0,500);const hit=board([[10,1],[8,-1],[18,-14]]);await edit(hit);await roll();const hitAt=Date.now();await clickMove(10,8);await waitFor(moving,'human hit animation');await waitFor(idle,'human hit settled');assert.ok(Date.now()-hitAt>=900,'hit and captured checker each use selected duration');assert.equal((await state()).board.bar[1],1);await evaluate('jellyfish.actions.undo()');assert.deepEqual((await state()).board,hit);
 // Entry and bearing off exercise special endpoints on a flipped board.
 await settings(0,500,true);await edit(board([[10,14],[18,-15]],[1,0]));await roll();await clickMove(-1,22);await waitFor(moving,'flipped bar entry');await waitFor(idle,'bar entry settled');assert.equal((await state()).board.bar[0],0);
 await edit(board([[0,1],[23,-1]]));await roll();await clickMove(0,24);await waitFor(moving,'bearing off');await waitFor(idle,'bearoff settled');assert.equal((await state()).board.off[0],15);
 // Zero speed disables the tween and zero pause remains a supported setting.
 await settings(0,0);await edit(start);await roll();await clickMove(23,21);await waitFor(idle,'instant move');assert.equal(await evaluate("!!document.querySelector('[data-moving-checker]')"),false);assert.equal((await state()).prefix.length,1);

 // Loading a different game while a human checker travels cannot resurrect the old turn.
 await settings(0,1200);await edit(start);await roll();await clickMove(23,21);await waitFor(moving,'move to cancel by loading');
 const loaded={format:'jellyfish-web',version:1,settings:{opponent:'human',target:7,level:5,flip:false,confirm:true,dicePauseMs:700,animationMs:500},board:start,match:await evaluate("(async()=> (await import('./src/rules.js')).createMatch(7))()"),player:1,dice:[],prefix:[],opening:true,history:['Loaded test game.']};
 await fs.mkdir('.local',{recursive:true});const file=resolve('.local/animation-load.json');await fs.writeFile(file,JSON.stringify(loaded));
 const doc=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#file'});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});
 await waitFor("jellyfish.getState().opening && !jellyfish.getState().busy",'load cancels animation');await delay(1300);assert.deepEqual((await state()).board,start);assert.equal(await evaluate("!!document.querySelector('[data-moving-checker]')"),false);
 await settings(1.2,750,true);await send('Page.reload');await waitFor('!!window.jellyfish','reload');const persisted=(await state()).settings;assert.equal(persisted.dicePauseMs,1200);assert.equal(persisted.animationMs,750);assert.equal(persisted.flip,true);
 await settings(1,350,false);await newGame('computer');assert.deepEqual(errors,[]);
 console.log('Animation smoke passed: dice pause, per-frame motion, hit/bar/bearoff/flip, off setting, new/load cancellation, and persistence.');
}finally{ws.close();await fetch(endpoint+'/json/close/'+target.id);}
