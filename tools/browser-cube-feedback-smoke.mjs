import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const t=await fetch((process.env.CDP_URL||'http://localhost:9238')+'/json/new?'+encodeURIComponent(process.env.PREVIEW_URL||'http://localhost:4181'),{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m.result);pending.delete(m.id);}});
const send=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
const run=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
await new Promise(r=>setTimeout(r,800));
await run(`jellyfish.actions.new();document.querySelector('#new-opponent').value='human';document.querySelector('#dialog-buttons button:last-child').click();`);



await run(`jellyfish.actions.settings();document.querySelector('#level').value=5;document.querySelector('#animation-speed').value=0;document.querySelector('#dialog-buttons button:last-child').click();window.cubeCalls=[];const post=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){if(m.method==='assessCubeDecision')cubeCalls.push(m);return post.call(this,m,...args)};`);
const edit=()=>run(`jellyfish.actions.edit();document.querySelector('#dialog-buttons button:last-child').click();`);
const waitFeedback=async()=>{for(let i=0;i<200;i++){if(await run("document.querySelector('#move-rank').textContent.includes('estimated cube loss')"))return;await new Promise(r=>setTimeout(r,50));}assert.fail('Cube feedback not displayed');};
// Opening roll has no doubling decision.
await run('jellyfish.actions.roll()');assert.equal(await run('cubeCalls.length'),0);
await edit();
await run("document.querySelector('#roll').click()");await waitFeedback();
assert.equal(await run('cubeCalls.length'),1);
assert.equal(await run('cubeCalls[0].args[2].cube'),1);
assert.match(await run("document.querySelector('#move-rank').textContent"),/^No double/);
await run("document.querySelector('#horizontal-layout').click()");
assert.ok(await run("document.querySelector('#compact-quality').textContent.length>0"));
await run(`jellyfish.actions.settings();document.querySelector('#play-mode').value='jellyfish';document.querySelector('#dialog-buttons button:last-child').click();`);
await send('Runtime.evaluate',{expression:`(async()=>{const R=await import('/src/rules.js');const start=jellyfish.getState(),turn=R.legalTurns(start.board,start.player,start.dice)[0];for(const m of turn.moves){const now=jellyfish.getState(),remaining=now.dice[0]===now.dice[1]?Array(4).fill(now.dice[0]):[...now.dice];for(const used of now.prefix)remaining.splice(remaining.indexOf(used.die),1);if(remaining[0]!==m.die)jellyfish.actions.swap();document.querySelector('[data-location="'+m.from+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,20));}})()`,awaitPromise:true});
for(let i=0;i<100;i++){if(await run("document.querySelector('#move-rank').textContent.startsWith('Your move:')"))break;await new Promise(r=>setTimeout(r,50));}
assert.match(await run("document.querySelector('#move-rank').textContent"),/^Your move:/);
await run(`jellyfish.actions.settings();document.querySelector('#play-mode').value='destinations';document.querySelector('#dialog-buttons button:last-child').click();`);

await edit();
await run("document.querySelector('#board').dispatchEvent(new MouseEvent('click',{bubbles:true}))");await waitFeedback();
assert.equal(await run('cubeCalls.length'),2);
await edit();
await run("document.querySelector('#compact-double').click()");
await waitFeedback();
assert.match(await run("document.querySelector('#move-rank').textContent"),/^Double/);
assert.equal(await run('cubeCalls[2].args[2].cube'),1);
await run("document.querySelector('#dialog-buttons button:last-child').click()");
assert.equal(await run('jellyfish.getState().match.cube'),2);
await run('jellyfish.actions.roll()');
assert.equal(await run('cubeCalls.length'),3);
assert.match(await run("document.querySelector('#move-rank').textContent"),/^Double/);
// A reset cannot display a stale assessment.
await run(`jellyfish.actions.new();document.querySelector('#dialog-buttons button:last-child').click();`);
assert.equal(await run("document.querySelector('#compact-quality').textContent"),'');
await send('Page.close');ws.close();console.log('Cube feedback passed: opening excluded, roll button and board click, pre-double cube, shared compact field, retained assessment and reset.');
