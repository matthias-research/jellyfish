import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const t=await fetch((process.env.CDP_URL||'http://localhost:9238')+'/json/new?'+encodeURIComponent(process.env.PREVIEW_URL||'http://localhost:4181'),{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m.result);pending.delete(m.id);}});
const send=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
const run=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
await new Promise(r=>setTimeout(r,800));
await run(`jellyfish.actions.new();document.querySelector('#new-opponent').value='human';document.querySelector('#dialog-buttons button:last-child').click();`);

const finish=()=>send('Runtime.evaluate',{expression:'jellyfish.actions.finishGame()',awaitPromise:true,returnByValue:true});
await run(`jellyfish.actions.settings();document.querySelector('#level').value=2;document.querySelector('#dice-pause').value=5;document.querySelector('#animation-speed').value=1500;document.querySelector('#dialog-buttons button:last-child').click();window.calls=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){if(['chooseTurn','cubeAdvice'].includes(m.method))calls.push(m);return post.call(this,m,...args)};`);
const settingsBefore=await run('JSON.stringify(jellyfish.getState().settings)');
await finish();
let state=await run('jellyfish.getState()');assert.ok(state.match.result);assert.equal(state.match.game,1);assert.equal(state.busy,false);assert.equal(state.autoplay,false);
assert.equal(await run('JSON.stringify(jellyfish.getState().settings)'),settingsBefore);
assert.equal(await run("document.querySelector('#dialog').open"),true);
assert.equal(await run("document.querySelector('#dialog-title').textContent"),'Game finished');
assert.equal(await run("document.querySelector('#dialog-body').textContent"),`${state.match.result.winner===1?'You win':'Player 2 wins'} ${state.match.result.points} point${state.match.result.points===1?'':'s'}`);
await run("document.querySelector('#dialog-buttons button').click()");
const ended=state;
await run("document.querySelector('[data-location]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}))");
state=await run('jellyfish.getState()');assert.equal(state.opening,true);assert.equal(state.dice.length,0);assert.equal(state.match.result,null);
assert.equal(state.match.game,ended.match.matchWinner?1:2);
assert.deepEqual(state.match.scores,ended.match.matchWinner?[0,0]:ended.match.scores);
await run("document.querySelector('#board').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:2}))");assert.equal(await run('jellyfish.getState().dice.length'),2);

const calls=await run('window.calls');assert.ok(calls.some(m=>m.method==='chooseTurn'&&m.args[1]===1));assert.ok(calls.some(m=>m.method==='chooseTurn'&&m.args[1]===-1));assert.ok(calls.filter(m=>m.method==='chooseTurn').every(m=>m.args[3].level===5));assert.ok(calls.filter(m=>m.method==='cubeAdvice').every(m=>m.args[2].level===5));
// A stop request finishes a whole turn and restores normal controls.
await run(`jellyfish.actions.new();document.querySelector('#new-opponent').value='human';document.querySelector('#dialog-buttons button:last-child').click();jellyfish.actions.finishGame();jellyfish.actions.finishGame();`);
for(let i=0;i<100;i++){if(!await run('jellyfish.getState().autoplay'))break;await new Promise(r=>setTimeout(r,25));}
state=await run('jellyfish.getState()');assert.equal(state.autoplay,false);assert.equal(state.busy,false);assert.equal(state.dice.length,0);
// New game invalidates any pending worker response.
await run(`jellyfish.actions.finishGame();jellyfish.actions.new();document.querySelector('#dialog-buttons button:last-child').click();`);
await new Promise(r=>setTimeout(r,250));state=await run('jellyfish.getState()');assert.equal(state.opening,true);assert.equal(state.autoplay,false);assert.deepEqual(state.match.scores,[0,0]);
// Partially played turns are rejected, but existing unplayed dice are used.
await run(`jellyfish.actions.new();document.querySelector('#new-opponent').value='human';document.querySelector('#new-target').value=1;document.querySelector('#dialog-buttons button:last-child').click();jellyfish.actions.settings();document.querySelector('#animation-speed').value=0;document.querySelector('#dialog-buttons button:last-child').click();jellyfish.actions.edit();document.querySelectorAll('[data-point]').forEach(e=>e.value=0);document.querySelector('[data-point="1"]').value=1;document.querySelector('[data-point="18"]').value=-15;document.querySelector('#edit-off-0').value=14;document.querySelector('#edit-off-1').value=0;document.querySelector('#edit-player').value=1;document.querySelector('#dialog-buttons button:last-child').click();window.originalRandom=crypto.getRandomValues;window.fixedDice=[0,1];crypto.getRandomValues=a=>{a[0]=fixedDice.shift();return a};jellyfish.actions.roll();crypto.getRandomValues=originalRandom;document.querySelector('[data-location="1"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));document.querySelector('[data-location="0"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
await new Promise(r=>setTimeout(r,30));
assert.equal(await run('jellyfish.getState().prefix.length'),1);
assert.equal(await run("document.querySelector('#finish-game').disabled"),true);
await finish();assert.equal(await run('jellyfish.getState().prefix.length'),1);
await run('jellyfish.actions.undo()');await finish();
state=await run('jellyfish.getState()');assert.equal(state.match.result.points,2);assert.equal(state.board.off[0],15);assert.equal(state.match.game,1);
assert.equal(await run("document.querySelector('#dialog-body').textContent"),'You win 2 points');
await run("document.querySelector('#dialog-buttons button').click()");
await run("document.querySelector('#board').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}))");
state=await run('jellyfish.getState()');assert.equal(state.opening,true);assert.deepEqual(state.match.scores,[0,0]);
await send('Page.close');ws.close();console.log('Finish game passed: full game without clicks, both sides at level 5, cube decisions, unchanged settings, stop, and new-game cancellation.');
