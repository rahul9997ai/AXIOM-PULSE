const CACHE='axiom-pulse-v5';
const ASSETS=['./','./index.html','./config.js','./manifest.webmanifest','./icon.svg'];
const AUTH_COPY='Your Finance Manager will provide a single-use invitation code for your authorized AXIOM PULSE access.';
const BRAND_CSS=`<style>
body{background:#07111f!important}
.topbar{background:#111f31f2!important}
.brandline{max-width:760px;margin:0 auto;justify-content:center}
.axiom{font-weight:900!important;letter-spacing:.16em!important;color:#f4f7fb!important}
.pulse{font-weight:800!important;font-style:italic!important;color:#58a8ff!important;text-shadow:0 0 12px rgba(75,156,255,.5)!important}
.pulseline{max-width:330px;position:relative;overflow:hidden}
.pulseline:after{content:'';position:absolute;left:-90px;top:0;width:74px;height:1px;background:#63b0ff;box-shadow:0 0 12px #5aa8ff;animation:axiomSweep 1.6s linear infinite}
@keyframes axiomSweep{to{transform:translateX(520px)}}
.brandmeta{max-width:760px;margin:7px auto 0;text-align:center!important;font-size:9px!important;letter-spacing:.13em!important;color:#7aabd9!important}
.brandby{max-width:760px;margin:2px auto 0;text-align:center!important;font-family:"Segoe Script","Brush Script MT",cursive!important;font-size:15px!important;font-style:italic!important;color:#e3e8ef!important}
.brandtag{max-width:760px;margin:2px auto 0;text-align:center!important;font-size:12px!important;color:#c1ccda!important}
.identity{min-height:340px!important;background:transparent!important;box-shadow:none!important}
.identity-wave{left:0!important;right:0!important;top:40%!important;height:115px!important;background:linear-gradient(90deg,transparent 0%,transparent 4%,#173b60 7%,#63b3ff 9%,#173b60 11%,transparent 15%,transparent 55%,#173b60 59%,#63b3ff 62%,#173b60 65%,transparent 70%)!important;filter:drop-shadow(0 0 10px #388de4)!important}
.identity-logo{gap:14px!important}
.identity-axiom{font-size:58px!important;letter-spacing:.11em!important;font-weight:900!important;color:#f6f8fb!important}
.identity-pulse{font-size:52px!important;font-weight:800!important;font-style:italic!important;color:#5ca7ff!important;text-shadow:0 0 18px rgba(46,125,227,.55)!important}
.identity-meaning{margin-top:44px!important;font-size:9px!important;letter-spacing:.16em!important;color:#78a8d8!important}
.identity-by{margin-top:7px!important;font-size:20px!important;font-family:"Segoe Script","Brush Script MT",cursive!important;font-style:italic!important;color:#e3e8ef!important}
.identity-tag{margin-top:8px!important;font-size:14px!important;color:#c7d1de!important}
.loginbox{width:min(100%,620px)!important}
.loginbox>.card{background:linear-gradient(145deg,#122338,#0e1c2d)!important;border:1px solid #294e72!important;border-radius:22px!important}
@media(max-width:600px){.identity-axiom{font-size:42px!important}.identity-pulse{font-size:38px!important}.identity{min-height:270px!important}.brandline{gap:9px}.axiom{font-size:24px!important}.pulse{font-size:23px!important}.brandmeta{font-size:7px!important}.brandby{font-size:13px!important}}
</style>`;
function injectPage(text){
  text=text.replace(/Your\s+(?:Master|master)\s+provides a single-use invitation code\.?\s*You cannot choose an elevated role yourself\.?/g,AUTH_COPY+' You cannot choose an elevated role yourself.');
  if(text.includes('</body>')){
    const boot=`<script>(function(){
      function addSplash(){
        if(document.getElementById('axiomApprovedSplash'))return;
        const s=document.createElement('div');s.id='axiomApprovedSplash';s.style.cssText='position:fixed;inset:0;z-index:99999;background:radial-gradient(circle at 50% 45%,#12345b 0%,#07111f 58%);display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;transition:opacity .3s ease';
        s.innerHTML='<div style="width:min(100%,900px)"><div style="position:relative;height:170px;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 900 150" preserveAspectRatio="none" style="position:absolute;left:0;right:0;width:100%;height:150px;opacity:.95"><path d="M0 76H70L82 76 92 52 104 104 116 38 130 76H210L228 76 240 58 250 98 262 76H640L655 76 666 58 678 116 690 34 704 76 720 76 732 56 744 100 758 70 770 88 784 76H900" fill="none" stroke="#2e77b6" stroke-width="2"/><path d="M0 76H70L82 76 92 52 104 104 116 38 130 76H210L228 76 240 58 250 98 262 76H640L655 76 666 58 678 116 690 34 704 76 720 76 732 56 744 100 758 70 770 88 784 76H900" fill="none" stroke="#65b4ff" stroke-width="2" stroke-dasharray="44 720" style="filter:drop-shadow(0 0 7px #4b9dff);animation:axiomEcg 3s linear infinite"/></svg><div style="position:relative;z-index:2;display:flex;gap:14px;align-items:baseline;padding:0 20px"><span style="font:900 76px/1 Arial,sans-serif;letter-spacing:.12em;color:#f5f7fb">AXIOM</span><span style="font:800 italic 66px/1 Arial,sans-serif;color:#58a7ff;text-shadow:0 0 18px #2e7de388">Pulse</span></div></div><div style="font:650 10px/1.3 Arial,sans-serif;letter-spacing:.17em;color:#77a9db;text-transform:uppercase">AI eXecutive Intelligence &amp; Operations Management</div><div style="font:italic 22px/1.2 cursive;color:#e3e8ef;margin-top:7px">by Rahul Champaneri</div><div style="font:500 17px/1.3 Arial,sans-serif;color:#c8d2df;margin-top:10px">The Pulse of Every Delivery</div><button id="axiomEnter" style="margin-top:32px;background:#3f8df5;color:#fff;border:0;border-radius:13px;padding:14px 20px;font:800 16px Arial,sans-serif;letter-spacing:.02em">ENTER AXIOM PULSE</button></div>';
        const st=document.createElement('style');st.textContent='@keyframes axiomEcg{from{stroke-dashoffset:764}to{stroke-dashoffset:0}}';document.head.appendChild(st);document.body.appendChild(s);
        document.getElementById('axiomEnter').onclick=()=>{s.style.opacity='0';setTimeout(()=>s.remove(),320)};
      }
      function normalizeJoin(){document.querySelectorAll('body *').forEach(el=>{if(el.children.length===0&&/your\\s+master\\s+provides/i.test(el.textContent)){el.textContent=AUTH_COPY+' You cannot choose an elevated role yourself.'}})}
      function init(){normalizeJoin();addSplash();const mo=new MutationObserver(normalizeJoin);mo.observe(document.body,{childList:true,subtree:true});}
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
    })();</script>`;
    return text.replace('</body>',BRAND_CSS+boot+'</body>');
  }
  return text;
}
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('axiom-pulse-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(async response=>{if(new URL(event.request.url).origin!==location.origin)return response;if(event.request.destination==='document'||event.request.url.endsWith('/index.html')){const text=await response.text();const patched=injectPage(text);const out=new Response(patched,{status:response.status,statusText:response.statusText,headers:response.headers});caches.open(CACHE).then(c=>c.put(event.request,out.clone()));return out}const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response}).catch(()=>caches.match(event.request)))});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>list[0]?list[0].focus():clients.openWindow('./')))});