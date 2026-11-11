import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const t=await fetch((process.env.CDP_URL||'http://localhost:9238')+'/json/new?'+encodeURIComponent(process.env.PREVIEW_URL||'http://localhost:4181'),{method:'PUT'}).then(r=>r.json());
const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){pending.get(m.id)(m.result);pending.delete(m.id);}});
const send=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
const run=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result.value;
await new Promise(r=>setTimeout(r,800));
await run(`jellyfish.actions.new();document.querySelector('#new-opponent').value='human';document.querySelector('#dialog-buttons button:last-child').click();`);



await run(`window.fullscreenCalls=0;document.documentElement.requestFullscreen=()=>{fullscreenCalls++};document.querySelector('#horizontal-layout').click();`);
await new Promise(r=>setTimeout(r,50));
for(const [width,height] of [[844,390],[667,375],[568,320]]){
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
 const layout=await run(`(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};return {board:box('#board'),rail:box('.horizontal-controls'),bar:box('#evaluation-bar'),exit:box('#vertical-layout'),quality:box('#compact-quality'),scroll:document.documentElement.scrollWidth,viewport:innerWidth}})()`);
 assert.ok(layout.rail.right<=layout.board.x);
 assert.ok(layout.board.right<=layout.bar.x);
 assert.ok(layout.board.bottom<=height&&layout.bar.bottom<=height);
 assert.ok(layout.quality.bottom<=height&&layout.exit.h>25);
 assert.equal(layout.scroll,layout.viewport);
 assert.ok(await run(`Math.abs(parseFloat(getComputedStyle(document.querySelector('#vertical-layout')).fontSize)/document.querySelector('#board').getBoundingClientRect().width-.028)<.001`));
 assert.equal(await run('fullscreenCalls'),0);
}
await run(`document.querySelector('#move-rank').dataset.loss='0.123';document.querySelector('#move-rank').dataset.quality='blunder';document.querySelector('#move-rank').textContent='Blunder: estimated loss 0.123';`);
assert.equal(await run("document.querySelector('#compact-quality').textContent"),'−0.123');
assert.equal(await run("document.querySelector('#compact-quality').dataset.quality"),'blunder');
await run(`delete document.querySelector('#move-rank').dataset.quality;document.querySelector('#move-rank').textContent='';`);
assert.equal(await run("document.querySelector('#compact-quality').textContent"),'');
assert.equal(await run("getComputedStyle(document.querySelector('#compact-quality')).backgroundColor"),await run("getComputedStyle(document.querySelector('#vertical-layout')).backgroundColor"));
await run(`document.querySelector('#evaluation-white').style.setProperty('--win-chance','75%');`);
await new Promise(r=>setTimeout(r,300));
assert.ok(await run(`Math.abs(document.querySelector('#evaluation-white').getBoundingClientRect().height/document.querySelector('#evaluation-bar').clientHeight-.75)<.01`));
await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});

await run(`window.nativeFullscreen=null;window.exitCalls=0;Object.defineProperty(document,'fullscreenEnabled',{configurable:true,get:()=>true});Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>nativeFullscreen});document.documentElement.requestFullscreen=async options=>{fullscreenCalls++;window.fullscreenOptions=options;nativeFullscreen=document.documentElement;document.dispatchEvent(new Event('fullscreenchange'));};document.exitFullscreen=async()=>{exitCalls++;nativeFullscreen=null;document.dispatchEvent(new Event('fullscreenchange'));};document.querySelector('#toggle-fullscreen').click();`);
assert.equal(await run('fullscreenCalls'),1);
assert.equal(await run('fullscreenOptions.navigationUI'),'hide');
assert.equal(await run("document.querySelector('#toggle-fullscreen').textContent"),'Windowed');
await run("document.querySelector('#toggle-fullscreen').click()");
assert.equal(await run('exitCalls'),1);
assert.equal(await run("document.body.classList.contains('board-horizontal')"),true);
await run("document.querySelector('#toggle-fullscreen').click()");
await run("document.querySelector('#vertical-layout').click()");
assert.equal(await run("document.body.classList.contains('board-horizontal')"),false);
assert.equal(await run('exitCalls'),2);
await send('Page.close');ws.close();console.log('Layouts passed: mobile landscape sizes, proportional controls, no native fullscreen, vertical evaluation, assessment and layout switching.');
