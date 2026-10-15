'use strict';
/* Service worker: permite usar el juego sin conexión.
   Estrategia: red primero (para recibir actualizaciones) y, si no hay red, la copia guardada. */
const CACHE='reactor-idle-v3';
const FILES=['./','index.html','manifest.webmanifest','js/data.js','js/sim.js','js/icons.js','js/audio.js','js/ui.js','js/sync.js',
  'icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/icon-180.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;   // la API de GitHub nunca pasa por la caché
  e.respondWith(fetch(r).then(res=>{
    if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}
    return res;
  }).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));
});
