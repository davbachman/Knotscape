const CACHE='knotscape-v1';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
  if(event.data?.type!=='cache-all')return;
  event.waitUntil((async()=>{try{const files=await(await fetch('./offline-files.json',{cache:'reload'})).json();const cache=await caches.open(CACHE);for(let i=0;i<files.length;i+=8)await cache.addAll(files.slice(i,i+8));event.ports[0]?.postMessage({ok:true});}catch(error){event.ports[0]?.postMessage({error:'Offline download failed: '+error.message});}})());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(fetch(event.request).then(async response=>{if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone());}return response;}).catch(()=>caches.match(event.request).then(r=>r||Response.error())));
});
