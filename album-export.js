import {RoomAudio} from './audio.js';
import {albumDuration,canHear} from './album.js';

// Mono 32 kHz PCM avoids codec dependencies and produces a widely playable WAV.
export const SAMPLE_RATE=32000;
export const MAX_WAV_BYTES=180_000_044;
export const MP3_BITRATE=128;
const modes={full:Infinity,thirty:30000,fifteen:15000};
export function exportPlan(entries,mode='full'){
  if(!Object.hasOwn(modes,mode))throw new Error('INVALID_EXPORT_MODE');
  const audible=entries.filter(canHear);
  const segments=audible.map(entry=>{const milliseconds=Math.min(albumDuration(entry),modes[mode]);return {entry,frames:Math.round(milliseconds*SAMPLE_RATE/1000)};});
  const frames=segments.reduce((sum,segment)=>sum+segment.frames,0);
  return {segments,frames,bytes:44+frames*2,skipped:entries.length-audible.length};
}
export function estimatedBytes(plan,format){
  if(format==='wav')return plan.bytes;
  if(format==='mp3')return (Math.ceil(plan.frames/1152)+2)*576;
  throw new Error('INVALID_EXPORT_FORMAT');
}
export function wavHeader(frames,sampleRate=SAMPLE_RATE){
  const dataBytes=frames*2;if(!Number.isSafeInteger(frames)||frames<0||dataBytes>0xffffffff-36)throw new Error('INVALID_WAV_SIZE');
  const bytes=new Uint8Array(44),view=new DataView(bytes.buffer),write=(offset,value)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
  write(0,'RIFF');view.setUint32(4,36+dataBytes,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,dataBytes,true);return bytes;
}
export function pcm16(samples){
  const bytes=new Uint8Array(samples.length*2),view=new DataView(bytes.buffer);
  for(let i=0;i<samples.length;i++){const sample=Number.isFinite(samples[i])?Math.max(-1,Math.min(1,samples[i])):0;view.setInt16(i*2,sample<0?Math.round(sample*32768):Math.round(sample*32767),true);}
  return bytes;
}
export async function renderOfflineEntry(entry,frames){
  const Offline=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
  if(!Offline)throw new Error('OFFLINE_AUDIO_UNAVAILABLE');
  const context=new Offline(1,frames,SAMPLE_RATE),audio=new RoomAudio(),duration=frames/SAMPLE_RATE;
  audio.initialize(context,entry);audio.update(entry);audio.running=true;audio.step=0;audio.activeTrackId=undefined;audio.next=.08;audio.ambient();audio.schedule(duration);
  // Short fades soften the join between consecutive recordings.
  const fadeStart=Math.max(0,duration-.15);audio.output.gain.setValueAtTime(entry.master/100*.62,fadeStart);audio.output.gain.linearRampToValueAtTime(0,duration);
  const result=await context.startRendering();audio.running=false;return result.getChannelData(0);
}
function checkAbort(signal){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');}
export async function renderAlbumWav(plan,{signal,onProgress=()=>{},render=renderOfflineEntry}={}){
  if(!plan.segments.length)throw new Error('EMPTY_ALBUM');
  if(plan.bytes>MAX_WAV_BYTES)throw new Error('ALBUM_TOO_LARGE');
  const parts=[wavHeader(plan.frames)];
  for(let index=0;index<plan.segments.length;index++){
    checkAbort(signal);onProgress(index,plan.segments.length);
    const segment=plan.segments[index],samples=await render(segment.entry,segment.frames);
    checkAbort(signal);if(samples.length!==segment.frames)throw new Error('RENDER_LENGTH_MISMATCH');
    parts.push(pcm16(samples));onProgress(index+1,plan.segments.length);
  }
  checkAbort(signal);return new Blob(parts,{type:'audio/wav'});
}
export async function renderAlbumMp3(plan,{signal,onProgress=()=>{},render=renderOfflineEntry,createWorker=()=>new Worker(new URL('./mp3-worker.js',import.meta.url))}={}){
  if(!plan.segments.length)throw new Error('EMPTY_ALBUM');
  // Limit the uncompressed processing workload, even though MP3 itself is smaller.
  if(plan.bytes>MAX_WAV_BYTES)throw new Error('ALBUM_TOO_LARGE');
  checkAbort(signal);const worker=createWorker(),parts=[];let pending=null;
  const abort=()=>{worker.terminate();if(pending){const request=pending;pending=null;request.reject(new DOMException('Cancelled','AbortError'));}};
  signal?.addEventListener('abort',abort,{once:true});
  worker.onmessage=event=>{if(!pending)return;const request=pending;pending=null;if(event.data?.type==='error')request.reject(new Error(event.data.message||'MP3_ENCODER_FAILED'));else request.resolve(event.data);};
  worker.onerror=worker.onmessageerror=()=>{if(pending){const request=pending;pending=null;request.reject(new Error('MP3_WORKER_FAILED'));}};
  function request(type,data={},transfers=[]){
    checkAbort(signal);return new Promise((resolve,reject)=>{pending={resolve,reject};try{worker.postMessage({type,...data},transfers);}catch(error){pending=null;reject(error);}});
  }
  try{
    if((await request('init')).type!=='ready')throw new Error('MP3_PROTOCOL_ERROR');
    for(let index=0;index<plan.segments.length;index++){
      checkAbort(signal);onProgress(index,plan.segments.length);
      const segment=plan.segments[index],samples=await render(segment.entry,segment.frames);
      checkAbort(signal);if(samples.length!==segment.frames)throw new Error('RENDER_LENGTH_MISMATCH');
      const owned=samples.byteOffset===0&&samples.byteLength===samples.buffer.byteLength?samples:samples.slice();
      const encoded=await request('encode',{samples:owned},[owned.buffer]);if(encoded.type!=='encoded')throw new Error('MP3_PROTOCOL_ERROR');
      if(encoded.data.length)parts.push(encoded.data);onProgress(index+1,plan.segments.length);
    }
    checkAbort(signal);const last=await request('finish');if(last.type!=='finished')throw new Error('MP3_PROTOCOL_ERROR');if(last.data.length)parts.push(last.data);
    checkAbort(signal);return new Blob(parts,{type:'audio/mpeg'});
  }finally{signal?.removeEventListener('abort',abort);worker.terminate();}
}
