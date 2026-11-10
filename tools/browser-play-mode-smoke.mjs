import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const t=await fetch((process.env.CDP_URL||'http://localhost:9238')+'/json/new?'+encodeURIComponent(process.env.PREVIEW_URL||'http://localhost:4181'),{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m.result);pending.delete(m.id);}});
const send=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
const run=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
await new Promise(r=>setTimeout(r,800));
await run(`jellyfish.actions.new();document.querySelector('#new-opponent').value='human';document.querySelector('#dialog-buttons button:last-child').click();`);


await run(`jellyfish.actions.settings();document.querySelector('#play-mode').value='jellyfish';document.querySelector('#animation-speed').value=0;document.querySelector('#dialog-buttons button:last-child').click();window.oldRandom=crypto.getRandomValues;window.values=[3,5];crypto.getRandomValues=a=>{a[0]=values.shift();return a};jellyfish.actions.roll();crypto.getRandomValues=oldRandom;`);
assert.deepEqual(await run('jellyfish.getState().dice'),[6,4]);
await run(`document.querySelector('[data-die]').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
assert.deepEqual(await run('jellyfish.getState().dice'),[4,6]);
// Use engine legal turns to find a legal first-die source for either opening player.
const result=await send('Runtime.evaluate',{expression:`(async()=>{const R=await import('/src/rules.js');window.R=R;const s=jellyfish.getState();window.first=R.legalTurns(s.board,s.player,s.dice).find(t=>t.moves[0].die===4).moves[0];document.querySelector('[data-location="'+first.from+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`,awaitPromise:true,returnByValue:true});
assert.ok(!result.exceptionDetails);
await new Promise(r=>setTimeout(r,30));
assert.equal(await run('jellyfish.getState().prefix.length'),1);
assert.equal(await run('jellyfish.getState().prefix[0].die'),4);
assert.equal(await run("document.querySelectorAll('#board .target,#board .selected').length"),0);
await run(`jellyfish.actions.undo();document.querySelector('#swap-dice').dispatchEvent(new MouseEvent('click',{bubbles:true}));const s=jellyfish.getState();const m=R.legalTurns(s.board,s.player,s.dice).find(t=>t.moves[0].die===6).moves[0];document.querySelector('[data-location="'+m.from+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
await new Promise(r=>setTimeout(r,30));
assert.equal(await run('jellyfish.getState().prefix[0].die'),6);
await run(`{const s=jellyfish.getState();const t=R.legalTurns(R.initialBoard(),s.player,s.dice).find(t=>t.moves[0].from===s.prefix[0].from&&t.moves[0].die===6);document.querySelector('[data-location="'+t.moves[1].from+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));}`);
await new Promise(r=>setTimeout(r,30));
assert.deepEqual(await run('jellyfish.getState().prefix.map(m=>m.die)'),[6,4]);
// The first die is blocked from point 6, but the second permits a full legal turn.
await run(`jellyfish.actions.edit();document.querySelectorAll('[data-point]').forEach(e=>e.value=0);document.querySelector('[data-point="5"]').value=15;document.querySelector('[data-point="2"]').value=-2;document.querySelector('[data-point="23"]').value=-13;document.querySelector('#edit-player').value=1;document.querySelector('#dialog-buttons button:last-child').click();window.values=[2,0];crypto.getRandomValues=a=>{a[0]=values.shift();return a};jellyfish.actions.roll();crypto.getRandomValues=oldRandom;document.querySelector('[data-location="5"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
await new Promise(r=>setTimeout(r,30));
assert.deepEqual(await run('jellyfish.getState().dice'),[1,3]);
assert.equal(await run('jellyfish.getState().prefix[0].die'),1);
assert.equal(await run('jellyfish.getState().board.points[4]'),1);
await run(`document.querySelector('[data-location="4"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));`);
await new Promise(r=>setTimeout(r,30));
assert.deepEqual(await run('jellyfish.getState().prefix.map(m=>m.die)'),[1,3]);
await run(`jellyfish.actions.settings();document.querySelector('#play-mode').value='destinations';document.querySelector('#dialog-buttons button:last-child').click();`);
assert.equal(await run("document.querySelector('#swap-dice')===null"),true);
await send('Page.close');ws.close();console.log('Play modes passed: sorted dice, swap, one die per click, no highlights, undo, remaining die, mode switching.');
