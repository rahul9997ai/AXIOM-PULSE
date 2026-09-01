const CACHE="axiom-pulse-v9";
const ASSETS=["/manifest.webmanifest","/icons/axiom-pulse-icon.svg","/create-date-time-pickers.js"];

async function appShellResponse(request){
  let response;
  try{ response=await fetch(request,{cache:"no-store"}); }
  catch{ response=await caches.match("/index.html"); }
  if(!response) return response;
  const type=response.headers.get("content-type")||"";
  if(!type.includes("text/html")) return response;
  const html=await response.text();
  if(html.includes("/create-date-time-pickers.js")) return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
  const patched=html.replace(/<\/body>/i,'<script src="/create-date-time-pickers.js"></script></body>');
  const headers=new Headers(response.headers);headers.set("content-type","text/html; charset=UTF-8");headers.set("cache-control","no-store");
  return new Response(patched,{status:response.status,statusText:response.statusText,headers});
}

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
    event.respondWith(appShellResponse(event.request));
    return;
  }
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{
    const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
  })));
});
self.addEventListener("push",event=>{
  let data={};try{data=event.data?event.data.json():{}}catch{data={title:"AXIOM PULSE",body:event.data?event.data.text():""}}
  event.waitUntil(self.registration.showNotification(data.title||"AXIOM PULSE",{
    body:data.body||"",icon:data.icon||"/icons/axiom-pulse-icon.svg",badge:data.badge||"/icons/axiom-pulse-icon.svg",
    data:{...(data.data||{}),url:data.data?.url||"/"},tag:data.data?.deliveryId?String(data.data.deliveryId):undefined,
    renotify:true,requireInteraction:data.data?.type==="delivery_time"
  }));
});
self.addEventListener("notificationclick",event=>{event.notification.close();const url=event.notification.data?.url||"/";event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{const existing=list.find(client=>"focus"in client);if(existing)return existing.focus();return clients.openWindow(url)}))});