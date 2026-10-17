import assert from 'node:assert/strict';
import { initialMix, applyAction, suggest, examplePatch, validatePatch, parseChannels, applyPatch, balanceIds } from '../lib/assistant-model.ts';
const start = initialMix();
assert.equal(start.channels.length, 31);
// Include an unassigned input so mute-all cannot accidentally use only mapped channels.
start.channels.find((c) => c.id === 'ch24').muted = false;
start.channels.find((c) => c.id === 'st3').muted = false;
const snapshot = structuredClone(start.channels);
const muted = applyAction(start, { type: 'mute-all' });
assert.ok(muted.channels.every((c) => c.muted));
assert.deepEqual(applyAction(muted, { type: 'mute-all' }), muted);
assert.equal(applyAction(muted, { type: 'mode', mode: 'speaking' }), muted);
assert.equal(
  applyAction(muted, { type: 'adjust', ids: ['ch1'], delta: 1 }),
  muted,
);
assert.deepEqual(applyAction(muted, { type: 'restore' }).channels, snapshot);
const proposal = suggest('piano too loud', start);
assert.equal(proposal.action.type, 'adjust');
assert.deepEqual(proposal.action.ids, ['ch9', 'ch10']);
const adjusted = applyAction(start, proposal.action);
assert.equal(adjusted.channels.find((c) => c.id === 'ch9').level, -13);
assert.equal(adjusted.channels.find((c) => c.id === 'ch11').level, -12);
assert.equal(suggest('piano and guitar too loud', start), null);
assert.equal(suggest('piano too loud in monitor', start), null);
assert.equal(suggest('piano muddy', start), null);
const speech = applyAction(start, { type: 'mode', mode: 'speaking' });
assert.equal(speech.channels.find((c) => c.id === 'ch1').muted, false);
assert.equal(suggest('piano louder', speech), null);
assert.equal(suggest('全部靜音', speech).action.type, 'mute-all');
console.log(
  'Passed: complete input mute coverage, repeated mute snapshot, restore, blocked writes while muted, scoped suggestions and unsupported requests.',
);
const patch=structuredClone(examplePatch);
patch.sources[0].channels=['ch8'];patch.sources[3].channels=['ch5','ch6'];
patch.sources[3].name='Nord stage';
patch.sources.push({id:'bass',name:'Bass player',kind:'bass',role:'music',channels:['st2']});
assert.deepEqual(parseChannels('CH 5, 6, ST2'),['ch5','ch6','st2']);
assert.throws(()=>parseChannels('5-6'));
const customMix=initialMix(validatePatch(patch));
assert.deepEqual(suggest('piano too loud',customMix).action.ids,['ch5','ch6']);
assert.deepEqual(suggest('Nord stage louder',customMix).action.ids,['ch5','ch6']);
assert.deepEqual(suggest('bass too loud',customMix).action.ids,['st2']);
assert.equal(customMix.channels.find(c=>c.id==='ch9').muted,true);
const together=applyAction(customMix,{type:'mode',mode:'together'});
assert.equal(together.channels.find(c=>c.id==='ch8').muted,false);
assert.equal(together.channels.find(c=>c.id==='ch5').muted,false);
assert.equal(together.channels.find(c=>c.id==='ch2').muted,false);
assert.equal(together.channels.find(c=>c.id==='ch1').muted,true);
assert.ok(balanceIds(together,'voice').includes('ch8'));
assert.equal(applyPatch(applyAction(together,{type:'mute-all'}),patch).beforeMute.length,31);
const duplicate=structuredClone(patch);duplicate.sources[1].channels=['ch8'];
assert.throws(()=>validatePatch(duplicate),/assigned more than once/);
const outOfRange=structuredClone(patch);outOfRange.sources[0].channels=['ch25'];assert.throws(()=>validatePatch(outOfRange));
const removed=structuredClone(patch);removed.sources=removed.sources.filter(s=>s.id!=='bass');
assert.equal(applyPatch(customMix,removed).channels.find(c=>c.id==='st2').muted,true);
console.log('Passed: custom patch, stereo input parsing, instrument and custom-name targeting, Together mode, duplicate rejection, removed-source muting.');
