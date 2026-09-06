export const PROFILE_KEY = 'sunday-sound.profile.v1';
export type Assignment = { id:number; label:string; channels:string; group:'speech'|'vocals'|'instruments' };
export type Profile = { version:1; assignments:Assignment[] };
export const initialProfile:Profile={version:1,assignments:[
 {id:0,label:'',channels:'1',group:'speech'},
 {id:1,label:'',channels:'2',group:'vocals'},
 {id:2,label:'',channels:'3, 4',group:'vocals'},
 {id:3,label:'',channels:'9, 10',group:'instruments'},
 {id:4,label:'',channels:'11',group:'instruments'},
 {id:5,label:'',channels:'13, 14',group:'instruments'},
]};
export function validateProfile(value:unknown):Profile {
 const p=value as Partial<Profile>;
 if(!p||p.version!==1||!Array.isArray(p.assignments)||p.assignments.length!==6)throw new Error('Expected six source assignments in a version 1 profile.');
 const used=new Set<number>(), ids=new Set<number>();
 const assignments=p.assignments.map(a=>{
  if(!a||!Number.isInteger(a.id)||a.id<0||a.id>5||ids.has(a.id))throw new Error('Each source must appear exactly once.');
  ids.add(a.id);
  if(typeof a.label!=='string'||a.label.length>40||typeof a.channels!=='string'||a.channels.length>100||!['speech','vocals','instruments'].includes(a.group))throw new Error('Invalid source name or group.');
  if(!/^\s*\d{1,2}(\s*,\s*\d{1,2})*\s*$/.test(a.channels))throw new Error('Use channel numbers separated by commas, for example 9, 10.');
  const channels=a.channels.split(',').map(Number);
  for(const ch of channels){if(ch<1||ch>24)throw new Error('Qu-24 input channels must be between 1 and 24.');if(used.has(ch))throw new Error(`CH ${ch} is already assigned. Each input can only belong to one source.`);used.add(ch);}
  return {id:a.id,label:a.label.trim(),channels:channels.join(', '),group:a.group};
 });
 return {version:1,assignments:assignments.sort((a,b)=>a.id-b.id)};
}
