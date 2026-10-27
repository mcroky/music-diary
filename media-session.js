// Hardware and OS media controls are optional; playback must still work without them.
export function connectMediaSession(session,{play,pause,stop=pause}={}){
  if(!session?.setActionHandler)return {update(){}};
  for(const [action,handler] of Object.entries({play,pause,stop})){
    try{session.setActionHandler(action,()=>Promise.resolve().then(handler).catch(()=>{}));}catch{}
  }
  return {update({playing,title,artist,album}){
    try{session.playbackState=playing?'playing':'paused';}catch{}
    if(typeof globalThis.MediaMetadata==='function')try{session.metadata=new MediaMetadata({title,artist,album});}catch{}
  }};
}
