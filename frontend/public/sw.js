const CACHE='dream-aquarium-shell-v1';
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);const response=await fetch('/',{cache:'reload'});if(!response.ok)throw Error('Shell unavailable');const html=await response.clone().text();await cache.put('/',response);const files=[...html.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(m=>m[1]);await cache.addAll(files);self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/'))return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/')));return;}
 if(url.pathname.startsWith('/assets/'))event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(async r=>{if(r.ok){const cache=await caches.open(CACHE);await cache.put(event.request,r.clone());}return r;})));
});
