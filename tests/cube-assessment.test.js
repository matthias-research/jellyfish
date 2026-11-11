import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCube} from '../src/cube-assessment.js';

const race=p=>[0,0,1-p,p,0,0];
test('cube feedback compares against an optimal take or pass, on the current cube scale',()=>{
  const early=assessCube(race(.5));
  assert.equal(early.noDoubleLoss,0);
  assert.ok(early.doubleLoss>.08);
  const cash=assessCube(race(.8));
  assert.equal(cash.double,cash.doublePass);
  assert.equal(cash.doubleLoss,0);
  assert.ok(cash.noDoubleLoss>.08);
  assert.deepEqual(assessCube(race(.8),{cube:4}),cash);
});
test('too-good gammons and backgammons retain their value',()=>{
  const gammon=assessCube([0,0,0,1,1,0]);
  assert.equal(gammon.noDouble,2);
  assert.equal(gammon.double,1);
  assert.equal(gammon.doubleLoss,1);
  const backgammon=assessCube([0,0,0,1,1,1]);
  assert.equal(backgammon.doubleLoss,2);
});
test('match assessment respects perspective, cube ownership and match-winning stakes',()=>{
  const options={target:7,scores:[2,4],cube:2,cubeOwner:1};
  assert.deepEqual(assessCube(race(.65),options),assessCube(race(.65),{...options,player:-1,scores:[4,2],cubeOwner:-1}));
  const dead=assessCube(race(.7),{target:7,scores:[5,5],cube:2});
  assert.ok(Math.abs(dead.doubleLoss)<1e-12);
  assert.ok(Math.abs(dead.noDoubleLoss)<1e-12);
  for(const scores of [[0,0],[6,0],[0,6],[6,5]]){
    const v=assessCube(race(.6),{target:7,scores});
    assert.ok(Number.isFinite(v.doubleLoss)&&Number.isFinite(v.noDoubleLoss));
    assert.ok(v.doubleLoss===0||v.noDoubleLoss===0);
  }
});
