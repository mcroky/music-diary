// Albums are views over saved diaries; they do not create a second copy of the data.
export function entriesForMonth(entries,year,month){
  const prefix=`${String(year).padStart(4,'0')}-${String(month+1).padStart(2,'0')}-`;
  return entries.filter(entry=>entry.date.startsWith(prefix)).sort((a,b)=>a.date.localeCompare(b.date));
}
export function albumSummary(entries){
  const moods={};for(const entry of entries)for(const mood of new Set(entry.moods))moods[mood]=(moods[mood]||0)+1;
  return {entries:entries.length,days:new Set(entries.map(entry=>entry.date)).size,moods};
}
export const canHear=entry=>entry.master>0&&Object.values(entry.sounds).some(value=>value>0);
export function nextAudible(entries,index){for(let i=Math.max(0,index);i<entries.length;i++)if(canHear(entries[i]))return i;return -1;}
// Catalog pieces are 16 bars of 4/4. A free mix loops without a fixed ending.
export function albumDuration(entry){return entry.trackId?Math.round(3840/entry.tempo*1000)+80:30000;}

export class AlbumPlayer{
  constructor(audio,{onChange=()=>{},onError=()=>{},setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}){
    this.audio=audio;this.onChange=onChange;this.onError=onError;this.setTimer=setTimer;this.clearTimer=clearTimer;this.queue=Promise.resolve();this.generation=0;this.playing=false;this.loading=false;this.ended=false;this.index=-1;this.timer=null;
  }
  notify(){this.onChange({index:this.index,playing:this.playing,loading:this.loading,ended:this.ended});}
  playFrom(entries,index){
    const generation=++this.generation;this.clearTimer(this.timer);this.timer=null;
    const next=nextAudible(entries,index);this.index=next;this.playing=false;this.loading=next!==-1;this.ended=next===-1;this.notify();
    this.queue=this.queue.catch(()=>{}).then(async()=>{
      await this.audio.stop();if(generation!==this.generation)return;
      if(next===-1){this.loading=false;this.notify();return;}
      try{
        await this.audio.start(entries[next]);
        if(generation!==this.generation){await this.audio.stop();return;}
        this.loading=false;this.playing=true;this.notify();
        this.timer=this.setTimer(()=>{if(generation===this.generation)this.playFrom(entries,next+1);},albumDuration(entries[next]));
      }catch(error){
        await this.audio.stop();if(generation!==this.generation)return;
        this.loading=false;this.playing=false;this.notify();this.onError(error);
      }
    });return this.queue;
  }
  stop(){
    ++this.generation;this.clearTimer(this.timer);this.timer=null;this.playing=false;this.loading=false;this.ended=false;this.notify();
    this.queue=this.queue.catch(()=>{}).then(()=>this.audio.stop());return this.queue;
  }
}
