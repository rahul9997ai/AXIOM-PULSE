const CACHE="axiom-pulse-v7";
const ASSETS=["/manifest.webmanifest","/icons/axiom-pulse-icon.svg"];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener("activate",event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;

  if(event.request.mode==="navigate"||url.pathname==="/"||url.pathname==="/index.html"){
    event.respondWith(
      fetch(event.request,{cache:"no-store"})
        .catch(()=>caches.match("/index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }))
  );
});
self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{}}
  catch{data={title:"AXIOM PULSE",body:event.data?event.data.text():""}}
  const title=data.title||"AXIOM PULSE";
  const options={
    body:data.body||"",
    icon:data.icon||"/icons/axiom-pulse-icon.svg",
    badge:data.badge||"/icons/axiom-pulse-icon.svg",
    data:{...(data.data||{}),url:data.data?.url||"/"},
    tag:data.data?.deliveryId?String(data.data.deliveryId):undefined,
    renotify:true,
    requireInteraction:data.data?.type==="delivery_time"
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const url=event.notification.data?.url||"/";
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
    const existing=list.find(client=>"focus" in client);
    if(existing)return existing.focus();
    return clients.openWindow(url);
  }));
});