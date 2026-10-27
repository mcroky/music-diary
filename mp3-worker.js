/* The unmodified encoder and its license notices live in assets/vendor/mp3. */
importScripts('./assets/vendor/mp3/wasm-media-encoder.js');
let encoder;
self.onmessage=async event=>{
  try{
    const message=event.data;
    if(message.type==='init'){
      const wasm=new URL('./assets/vendor/mp3/mp3.wasm',self.location.href).href;
      encoder=await self.WasmMediaEncoder.createEncoder('audio/mpeg',wasm);
      encoder.configure({channels:1,sampleRate:32000,outputSampleRate:32000,bitrate:128});
      self.postMessage({type:'ready'});return;
    }
    if(message.type==='encode'){
      const samples=message.samples,parts=[];let size=0;
      for(let offset=0;offset<samples.length;offset+=18432){
        // Encoder-owned buffers are invalidated by the next encode call.
        const result=encoder.encode([samples.subarray(offset,offset+18432)]);
        if(result.length){const copy=result.slice();parts.push(copy);size+=copy.length;}
      }
      const data=new Uint8Array(size);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length;}
      self.postMessage({type:'encoded',data},[data.buffer]);return;
    }
    if(message.type==='finish'){
      const data=encoder.finalize().slice();self.postMessage({type:'finished',data},[data.buffer]);return;
    }
    throw new Error('UNKNOWN_MP3_OPERATION');
  }catch(error){self.postMessage({type:'error',message:String(error?.message||error)});}
};
