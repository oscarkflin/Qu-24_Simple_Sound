import assert from 'node:assert/strict';
import { initialMix, applyAction, suggest } from '../lib/assistant-model.ts';
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
