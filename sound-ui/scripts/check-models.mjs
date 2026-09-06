import assert from 'node:assert/strict';
import {initialProfile,validateProfile} from '../lib/channel-profile.ts';
import {scrub} from '../lib/diagnostics.ts';
assert.equal(validateProfile(initialProfile).assignments[3].channels,'9, 10');
for(const channels of ['0','25','9-10','1, 1','1','2']){
 const p=structuredClone(initialProfile);p.assignments[3].channels=channels;
 assert.throws(()=>validateProfile(p),undefined,`Must reject ${channels}`);
}
const renamed=structuredClone(initialProfile);renamed.assignments[1].label='Worship leader';
assert.equal(validateProfile(renamed).assignments[1].label,'Worship leader');
assert.throws(()=>validateProfile({version:2,assignments:[]}));
assert.equal(scrub('token=abc password=def'),'token=[redacted] password=[redacted]');
assert.ok(!scrub('failed at http://192.168.1.3:3000/?token=abc').includes('192.168'));
console.log('Passed: profile bounds, duplicate channels, schema, rename, and diagnostic redaction.');
