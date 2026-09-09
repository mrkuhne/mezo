import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRoute, rememberRoute, initialNavigation } from './navigation-state.js';
test('switching domains restores the local page and invalid routes fall back safely',()=>{
 const state=initialNavigation();
 rememberRoute(state,'train',2);rememberRoute(state,'fuel',1);
 assert.equal(state.train,2);assert.equal(state.fuel,1);
 assert.deepEqual(resolveRoute('#train/2'),{domain:'train',page:2});
 assert.deepEqual(resolveRoute('#unknown/90'),{domain:'nap',page:0});
 assert.deepEqual(resolveRoute('#train/9'),{domain:'train',page:0});
});
