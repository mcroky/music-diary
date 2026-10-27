// Browser builds remain dependency-free. Capacitor is included only in the Android bundle.
export const isAndroid=globalThis.Capacitor?.getPlatform?.()==='android';
let native,app;
if(isAndroid){
  const {registerPlugin}=await import('./assets/native/capacitor.js');
  native=registerPlugin('DiaryNative');app=registerPlugin('App');
}

function cancelled(){return new DOMException('Cancelled','AbortError');}

// Stream bounded chunks across the native bridge rather than base64-encoding a whole album.
export async function saveNativeFile(plugin,blob,name,{signal}={}){
  if(signal?.aborted)throw cancelled();
  const {session}=await plugin.beginSave({name,mimeType:blob.type||'application/octet-stream',size:blob.size});
  try{
    for(let offset=0;offset<blob.size;offset+=48*1024){
      if(signal?.aborted)throw cancelled();
      const bytes=new Uint8Array(await blob.slice(offset,offset+48*1024).arrayBuffer());
      const base64=btoa(String.fromCharCode(...bytes));
      await plugin.appendSave({session,base64});
    }
    if(signal?.aborted)throw cancelled();
    await plugin.finishSave({session});
  }catch(error){await plugin.abortSave({session}).catch(()=>{});throw error;}
}

export async function saveFile(blob,name,options){
  if(isAndroid){
    try{await saveNativeFile(native,blob,name,options);}
    catch(error){if(error.code==='CANCELLED')throw cancelled();throw error;}
    return;
  }
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}

export async function requestAudioFocus(){
  if(isAndroid){const {granted}=await native.requestAudioFocus();if(!granted)throw new Error('AUDIO_FOCUS_DENIED');}
}
export async function abandonAudioFocus(){if(isAndroid)await native.abandonAudioFocus();}
export async function minimizeApp(){if(isAndroid)await app.minimizeApp();}
export async function connectAndroid({onPause,onBack}){
  if(!isAndroid)return;
  window.addEventListener('roky-native-pause',onPause);
  await app.addListener('appStateChange',({isActive})=>{if(!isActive)onPause();});
  await app.addListener('backButton',onBack);
  await native.addListener('audioInterrupt',onPause);
}
