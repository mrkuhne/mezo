import test from 'node:test';
import assert from 'node:assert/strict';
import { createMezo, decidePattern, startExperiment, advanceExperiment, acceptCandidate, correctClaim, forecastScore, matchesSearch } from './mezo-state.js';
test('confirming a pattern creates one linked fact and rejection disables its use',()=>{const s=createMezo();decidePattern(s,'evening','confirmed');decidePattern(s,'evening','confirmed');assert.equal(s.facts.filter(f=>f.pattern==='evening').length,1);decidePattern(s,'evening','rejected');assert.equal(s.facts.find(f=>f.pattern==='evening').active,false);});
test('one experiment per topic, bounded simulated days and no fabricated success',()=>{const s=createMezo();startExperiment(s,'evening');startExperiment(s,'evening');assert.equal(s.experiments.length,1);for(let i=0;i<12;i++)advanceExperiment(s,'evening');assert.equal(s.experiments[0].day,7);assert.equal(s.experiments[0].status,'completed');assert.equal(s.experiments[0].outcome,'mixed');});
test('candidate acceptance is idempotent and claim corrections remain pending',()=>{const s=createMezo();acceptCandidate(s);acceptCandidate(s);assert.equal(s.facts.filter(f=>f.id==='candidate').length,1);const before=s.claims[0].text;correctClaim(s,s.claims[0].id,'Ez csak munkanapokon igaz.');assert.equal(s.claims[0].text,before);assert.equal(s.claims[0].correction,'Ez csak munkanapokon igaz.');});
test('forecast accuracy excludes pending rows',()=>{const s=createMezo();assert.deepEqual(forecastScore(s),{hit:1,closed:2});});

test('Hungarian searches tolerate accents, casing and surrounding whitespace',()=>{assert.equal(matchesSearch('Hetente röplabdázol.',' RÖPLABDA '),true);assert.equal(matchesSearch('Nyugodt reggel','reggel'),true);assert.equal(matchesSearch('Nyugodt reggel','vacsora'),false);});
