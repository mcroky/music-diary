const CACHE='roky-music-room-0.6.0';
const FILES=['./','./index.html','./styles.css','./room-art.css','./app.js','./audio.js','./music.js','./catalog.js','./room-art.js','./storage.js','./drafts.js','./translations.js','./icon.svg','./manifest.webmanifest',...['attic','bedroom','studio','cabin','seaside'].map(room=>`./assets/rooms/${room}.webp`)];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('roky-music-room-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return response;}).catch(()=>caches.match(e.request)));});
