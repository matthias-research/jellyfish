import test from 'node:test';
import assert from 'node:assert/strict';
import {MATCH_EQUITY_PERCENT as table,nativeMatchEquity as equity,nativeRecubeAdjustment as recube} from '../src/match-equity.js';
test('native equity table is symmetric, monotonic and neutral at equal scores',()=>{assert.equal(table.length,11);for(let a=1;a<=11;a++){assert.equal(equity(a,a),.5);for(let b=1;b<=11;b++){assert.equal(table[a-1][b-1]+table[b-1][a-1],100);if(b<11)assert.ok(equity(a,b+1)>=equity(a,b));}}assert.ok(Math.abs(equity(1,2)-.7)<1e-14);assert.equal(equity(3,7),.76);assert.equal(equity(11,1),.03);});
test('equity boundaries and money mode reproduce native branches',()=>{assert.equal(equity(0,5),1);assert.equal(equity(5,0),0);assert.equal(equity(0,0),1);assert.equal(equity(10,4,0),-6);assert.equal(equity(-3,4,0),4);assert.throws(()=>equity(12,4),/11/);});
test('native recube adjustment arithmetic',()=>{assert.equal(recube(5,1,1),0);assert.ok(Math.abs(recube(3,5,1)-.17307692307692307)<1e-14);assert.ok(Math.abs(recube(5,5,1,0)-1/6)<1e-14);assert.equal(recube(2,5,1,0),.25);});
