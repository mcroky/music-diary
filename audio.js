import {legacyBrightness,musicExpression} from './music.js';
import {getTrack,composeFrame} from './catalog.js';
// All sounds are synthesized locally. No samples, microphones or network audio.
export class RoomAudio {
  constructor(){this.context=null;this.running=false;this.layers={};this.sources=new Set();this.step=0;}
  async start(config){
    if(!this.context){
      this.context=new (window.AudioContext||window.webkitAudioContext)();
      this.output=this.context.createGain();this.output.gain.value=0;
      const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-18;limiter.knee.value=18;limiter.ratio.value=5;
      this.output.connect(limiter);limiter.connect(this.context.destination);
      this.tone=this.context.createBiquadFilter();this.tone.type='lowpass';this.tone.Q.value=.5;this.tone.connect(this.output);
      for(const id of Object.keys(config.sounds)){const gain=this.context.createGain();gain.gain.value=0;gain.connect(['piano','drums','bass','keys','guitar','bell'].includes(id)?this.tone:this.output);this.layers[id]=gain;}
      this.noise=this.context.createBuffer(1,this.context.sampleRate*5,this.context.sampleRate);
      const data=this.noise.getChannelData(0);let seed=1729;for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=(seed/2147483647)*2-1;}
    }
    await this.context.resume();
    if(this.context.state!=='running')throw new Error('AUDIO_UNAVAILABLE');
    this.config=config;this.update(config);
    if(this.running)return;
    this.running=true;this.step=0;this.activeTrackId=undefined;this.next=this.context.currentTime+.08;this.ambient();
    this.clock=setInterval(()=>this.schedule(),80);this.schedule();
  }
  track(node){this.sources.add(node);node.onended=()=>this.sources.delete(node);return node;}
  update(config){
    this.config=structuredClone(config);
    if(!this.context)return;
    const t=this.context.currentTime;
    for(const [id,gain]of Object.entries(this.layers))gain.gain.setTargetAtTime(config.sounds[id]/100,t,.09);
    this.output.gain.setTargetAtTime(config.master/100*.62,t,.12);
    this.tone.frequency.setTargetAtTime(musicExpression(config.brightness??legacyBrightness(config.moods)).cutoff,t,.18);
  }
  noiseSource(id,type,freq,volume){
    const c=this.context,src=this.track(c.createBufferSource()),filter=c.createBiquadFilter(),gain=c.createGain();
    src.buffer=this.noise;src.loop=true;filter.type=type;filter.frequency.value=freq;gain.gain.value=volume;
    src.connect(filter);filter.connect(gain);gain.connect(this.layers[id]);src.start();return gain;
  }
  ambient(){
    this.noiseSource('rain','highpass',1100,.32);
    this.noiseSource('fire','lowpass',450,.4);
    this.noiseSource('cafe','bandpass',650,.35);
    const waves=this.noiseSource('waves','lowpass',1200,.12);
    this.modulate(waves.gain,.09,.08);
    const wind=this.noiseSource('wind','bandpass',370,.12);
    this.modulate(wind.gain,.055,.04);
  }
  modulate(param,hz,amount){const c=this.context,o=this.track(c.createOscillator()),g=c.createGain();o.frequency.value=hz;g.gain.value=amount;o.connect(g);g.connect(param);o.start();}
  note(id,midi,at,duration=.7,volume=.16){
    if(this.config.sounds[id]===0)return;
    const c=this.context;
    const partials=id==='piano'?[[1,1],[2,.24],[3,.08]]:id==='bell'?[[1,1],[2.76,.24],[4.1,.08]]:[[1,1]];
    for(const [multiple,level]of partials){
      const o=this.track(c.createOscillator()),gain=c.createGain();
      o.type=id==='keys'?'triangle':id==='guitar'?'triangle':'sine';o.frequency.value=440*2**((midi-69)/12)*multiple;
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume*level,at+(id==='keys'?.055:.012));gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
      o.connect(gain);gain.connect(this.layers[id]);o.start(at);o.stop(at+duration+.04);
    }
  }
  hiss(id,at,duration,volume,freq=4000){
    const c=this.context,s=this.track(c.createBufferSource()),f=c.createBiquadFilter(),g=c.createGain();
    s.buffer=this.noise;f.type='highpass';f.frequency.value=freq;g.gain.setValueAtTime(volume,at);g.gain.exponentialRampToValueAtTime(.0001,at+duration);s.connect(f);f.connect(g);g.connect(this.layers[id]);s.start(at);s.stop(at+duration);
  }
  kick(at){
    const c=this.context,o=this.track(c.createOscillator()),g=c.createGain();o.frequency.setValueAtTime(125,at);o.frequency.exponentialRampToValueAtTime(42,at+.18);g.gain.setValueAtTime(.38,at);g.gain.exponentialRampToValueAtTime(.0001,at+.28);o.connect(g);g.connect(this.layers.drums);o.start(at);o.stop(at+.3);
  }
  chirp(at){const c=this.context,o=this.track(c.createOscillator()),g=c.createGain();o.frequency.setValueAtTime(2100,at);o.frequency.exponentialRampToValueAtTime(3400,at+.12);o.frequency.exponentialRampToValueAtTime(2300,at+.24);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.09,at+.04);g.gain.exponentialRampToValueAtTime(.0001,at+.25);o.connect(g);g.connect(this.layers.birds);o.start(at);o.stop(at+.3);}
  schedule(){
    if(!this.running)return;
    const c=this.context;
    if(this.next<c.currentTime-.3)this.next=c.currentTime+.03;
    while(this.next<c.currentTime+.22){
      const s=this.step%32,beat=s%8,bar=Math.floor(s/8),t=this.next;
      // Keep one harmony throughout a bar while the tone filter follows the slider smoothly.
      if(beat===0){
        this.phraseBrightness=this.config.brightness??legacyBrightness(this.config.moods);
        this.phrase=musicExpression(this.phraseBrightness);
        const id=this.config.trackId??null;
        if(this.activeTrackId!==id){this.activeTrackId=id;this.trackStartedStep=this.step;}
        this.phraseTrack=getTrack(id);
      }
      if(this.phraseTrack){
        const frame=composeFrame(this.phraseTrack,Math.floor((this.step-this.trackStartedStep)/8),beat,this.phraseBrightness);
        const at=t+frame.swing*60/this.config.tempo/2;
        for(const note of frame.notes)this.note(note.id,note.midi,at+(note.delay||0),note.duration,note.volume);
        if(this.config.sounds.drums>0){if(frame.kick)this.kick(at);if(frame.snare)this.hiss('drums',at,.13,.17,1800);if(frame.hat)this.hiss('drums',at,.04,.055,7000);}
      }else{
      const root=this.phrase.roots[bar],third=this.phrase.thirds[bar];
      const chord=[root,root+third,root+7];const pattern=[0,2,1,2,0,1,2,1];
      this.note('piano',chord[pattern[beat]]+12,t,1.4,.19);
      if(beat===0){chord.forEach((n,i)=>this.note('keys',n,t+i*.012,2.4,.085));this.note('bass',root-12,t,1.2,.25);}
      if(beat===4)this.note('bass',root-5,t,.8,.17);
      if(beat%2===0)this.note('guitar',chord[(beat/2)%3],t,.65,.16);
      if(beat===2||beat===6)this.note('bell',chord[beat===2?1:2]+24,t,1.7,.1);
      if(this.config.sounds.drums>0){if(beat===0||beat===4)this.kick(t);if(beat===2||beat===6)this.hiss('drums',t,.13,.2,1800);this.hiss('drums',t,.035,.07,7000);}
      }
      if(this.config.sounds.fire>0&&s%3===0)this.hiss('fire',t,.025+(s%4)*.012,.14,1200);
      if(this.config.sounds.cafe>0&&s%7===0)this.hiss('cafe',t,.035,.05,2200);
      if(this.config.sounds.birds>0&&(s===1||s===19)){this.chirp(t);this.chirp(t+.3);}
      this.next+=60/this.config.tempo/2;this.step++;
    }
  }
  async stop(){
    this.running=false;clearInterval(this.clock);
    if(!this.context)return;
    this.output.gain.cancelScheduledValues(this.context.currentTime);this.output.gain.setTargetAtTime(0,this.context.currentTime,.025);
    const sources=[...this.sources];this.sources.clear();
    for(const source of sources){try{source.stop(this.context.currentTime+.12);}catch{}}
    // Keep the context alive but silent; the next user gesture resumes it.
  }
}
