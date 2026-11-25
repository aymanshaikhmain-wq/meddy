const C='meddy-v3',M='meddy-models-v1'; // bump M only when the .glb files change
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x!==M).map(x=>caches.delete(x)))).then(()=>clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.pathname.startsWith('/api/'))return;
 if(u.pathname.includes('/models/')&&u.pathname.endsWith('.glb')){ // cache-first, never re-download 50 MB in the background
  e.respondWith(caches.open(M).then(async c=>{const hit=await c.match(r);if(hit)return hit;const res=await fetch(r);if(res&&res.ok)c.put(r,res.clone());return res}));return}
 if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const k=res.clone();caches.open(C).then(c=>c.put(r,k));return res}).catch(()=>caches.match(r)||caches.match('./')));return}
 e.respondWith(caches.open(C).then(async c=>{const hit=await c.match(r);const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone());return res}).catch(()=>hit);return hit||net}))});
