import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkout, logSet, finishWorkout, metrics, loadRows } from './workout-state.js';
test('editing a set replaces it, invalid input does not mutate it, unfinished work cannot earn a finish',()=>{
 const w=createWorkout();assert.equal(finishWorkout(w),false);
 assert.equal(logSet(w,0,0,{kg:60,reps:10,rir:2}),true);
 assert.equal(logSet(w,0,0,{kg:62.5,reps:8,rir:1}),true);
 assert.equal(metrics(w).count,1);assert.equal(metrics(w).volume,500);
 assert.equal(logSet(w,0,0,{kg:-1,reps:8,rir:1}),false);
 assert.equal(metrics(w).volume,500);
});
test('weekly completed load increases only on explicit finish, and never twice',()=>{
 const w=createWorkout();const before=loadRows(w)[0].done;
 logSet(w,0,0,{kg:60,reps:10,rir:2});
 assert.equal(loadRows(w)[0].done,before);
 assert.equal(finishWorkout(w),true);assert.equal(loadRows(w)[0].done,before+1);
 assert.equal(finishWorkout(w),false);assert.equal(loadRows(w)[0].done,before+1);
 assert.equal(logSet(w,0,1,{kg:60,reps:10,rir:2}),false);
});
