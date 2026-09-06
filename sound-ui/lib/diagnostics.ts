export const BUILD_ID='landscape-preview-0.2.0';
const KEY='sunday-sound.diagnostics.v1';
export type LogEvent={at:string;level:'info'|'error';event:string;details:Record<string,unknown>};
let events:LogEvent[]=[];
let initialized=false;
export function scrub(value:unknown):string {
 return String(value).slice(0,3000).replace(/https?:\/\/[^\s)]+/g,'[url removed]').replace(/(?:[A-Za-z]:\\|\/Users\/|\/home\/)[^\n]+/g,'[local path removed]').replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[address removed]').replace(/(token|password|authorization|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,'$1=[redacted]');
}
export function logEvent(event:string,details:Record<string,unknown>={},level:'info'|'error'='info'){
 if(typeof window==='undefined')return;
 events=[...events.slice(-299),{at:new Date().toISOString(),level,event,details}];
 try{localStorage.setItem(KEY,JSON.stringify(events));}catch{/* Memory logging continues if storage is full/disabled. */}
 window.dispatchEvent(new Event('sound-diagnostics'));
}
export function startDiagnostics(){
 if(!initialized){try{const old=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(old))events=old.filter(x=>x&&typeof x.at==='string'&&typeof x.event==='string'&&['info','error'].includes(x.level)).slice(-250);}catch{/* Ignore corrupt local logs. */}initialized=true;}
 logEvent('session.started',{build:BUILD_ID});
 const error=(e:ErrorEvent)=>logEvent('browser.error',{message:scrub(e.message),stack:scrub(e.error?.stack||'')},'error');
 const rejection=(e:PromiseRejectionEvent)=>logEvent('browser.unhandled-rejection',{message:scrub(e.reason?.message||e.reason),stack:scrub(e.reason?.stack||'')},'error');
 const visibility=()=>logEvent('browser.visibility',{state:document.visibilityState});
 const online=()=>logEvent('browser.network-hint',{online:navigator.onLine});
 window.addEventListener('error',error);window.addEventListener('unhandledrejection',rejection);document.addEventListener('visibilitychange',visibility);window.addEventListener('online',online);window.addEventListener('offline',online);
 return ()=>{window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',online);window.removeEventListener('offline',online);};
}
export const getEvents=()=>events;
export function downloadJson(filename:string,data:unknown){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function scrubDetails(details:Record<string,unknown>){return Object.fromEntries(Object.entries(details).map(([k,v])=>[k,typeof v==='string'?scrub(v):v]));}
export function createReport(state:unknown,note:string){return {schemaVersion:1,build:BUILD_ID,createdAt:new Date().toISOString(),mode:'ui-preview-no-mixer',device:{userAgent:navigator.userAgent,language:navigator.language,viewport:{width:innerWidth,height:innerHeight},onlineHint:navigator.onLine},note:scrub(note),state,events:events.map(e=>({...e,details:scrubDetails(e.details)}))};}
