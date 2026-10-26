import {legacyBrightness} from './music.js';
import {isTrackId} from './catalog.js';
export const KEY='roky-music-diary.v1';
export const SOUNDS=['rain','fire','waves','wind','birds','cafe','piano','drums','bass','keys','guitar','bell'];
export const MOODS=['calm','happy','sad','tired','hopeful','restless'];
export const ROOMS=['attic','bedroom','studio','cabin','seaside'];
export const LIGHTS=['warm','candle','soft','cool','off'];
export const WEATHERS=['clear','cloudy','rainy','snowy','foggy'];
export const TIMES=['morning','sunset','night'];
const member=(v,a)=>a.includes(v);
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateEntry(e){
  if(!e||typeof e!=='object'||typeof e.id!=='string'||e.id.length>100||!e.id.length||typeof e.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date||typeof e.title!=='string'||e.title.length>80||typeof e.note!=='string'||e.note.length>2000||!Array.isArray(e.moods)||e.moods.length>6||e.moods.some(m=>!member(m,MOODS))||!member(e.room,ROOMS)||!member(e.light,LIGHTS)||!member(e.weather,WEATHERS)||!member(e.time,TIMES)||!finite(e.tempo,50,120)||!finite(e.master,0,100)||!e.sounds||SOUNDS.some(s=>!finite(e.sounds[s],0,100)))throw new Error('INVALID_ENTRY');
  const brightness=e.brightness===undefined?legacyBrightness(e.moods):e.brightness;
  if(!finite(brightness,0,100))throw new Error('INVALID_ENTRY');
  const trackId=e.trackId===undefined?null:e.trackId;
  if(!isTrackId(trackId))throw new Error('INVALID_ENTRY');
  return {id:e.id,date:e.date,title:e.title,note:e.note,moods:[...new Set(e.moods)],room:e.room,light:e.light,weather:e.weather,time:e.time,tempo:e.tempo,master:e.master,brightness,trackId,sounds:Object.fromEntries(SOUNDS.map(s=>[s,e.sounds[s]]))};
}
export function parseBackup(raw){
  if(typeof raw!=='string'||raw.length>5_000_000||new TextEncoder().encode(raw).byteLength>5_000_000)throw new Error('INVALID_BACKUP');
  const data=JSON.parse(raw);
  if(data?.app!=='roky-music-room'||![1,2,3].includes(data.version)||!Array.isArray(data.entries)||data.entries.length>5000)throw new Error('INVALID_BACKUP');
  if(data.version>=2&&data.entries.some(e=>!e||e.brightness===undefined))throw new Error('INVALID_BACKUP');
  if(data.version===3&&data.entries.some(e=>e.trackId===undefined))throw new Error('INVALID_BACKUP');
  const entries=data.entries.map(validateEntry);
  if(new Set(entries.map(e=>e.id)).size!==entries.length)throw new Error('DUPLICATE_ID');
  return entries;
}
export function encodeBackup(entries){
  const raw=JSON.stringify({app:'roky-music-room',version:3,exportedAt:new Date().toISOString(),entries:entries.map(validateEntry)},null,2);
  // Never persist a file that our own importer would reject, including UTF-8 size.
  parseBackup(raw);return raw;
}
export function mergeEntries(current,incoming){
  const map=new Map(current.map(e=>[e.id,validateEntry(e)]));
  for(const entry of incoming){const safe=validateEntry(entry);if(!map.has(safe.id))map.set(safe.id,safe);}
  return [...map.values()];
}
export function readEntries(storage){
  const raw=storage.getItem(KEY);
  return raw===null?[]:parseBackup(raw);
}
export function writeEntries(storage,entries){storage.setItem(KEY,encodeBackup(entries));}
