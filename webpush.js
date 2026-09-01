const AXP_VAPID_PUBLIC_KEY="BCDocZCDnNop1hme5y4QaG9GWXgWY_KkcqM0RKMb3gXKLGFeaiQ1JBFbwQiq-xRzvmHHQdy_MrEIW-HlxsACRoE";
const AXP_PUSH_FLAG="axp_webpush_registered_v1";
function axpBase64ToUint8Array(base64){const pad="=".repeat((4-base64.length%4)%4),raw=atob((base64+pad).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
function axpIsStandalone(){return window.matchMedia?.("(display-mode: standalone)").matches||window.navigator.standalone===true}
async function axpRegisterWebPush(){
 if(!S?.a)throw Error("Please sign in first.");
 if(!window.isSecureContext)throw Error("Notifications require a secure connection.");
 if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window))throw Error("Push notifications are not supported on this device/browser.");
 const isiOS=/iPhone|iPad|iPod/i.test(navigator.userAgent);
 if(isiOS&&!axpIsStandalone())throw Error("On iPhone or iPad, first add AXIOM PULSE to the Home Screen, then open the installed app and enable notifications.");
 const permission=Notification.permission==="granted"?"granted":await Notification.requestPermission();
 if(permission!=="granted")throw Error("Notification permission was not granted.");
 const reg=await navigator.serviceWorker.ready;
 let sub=await reg.pushManager.getSubscription();
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:axpBase64ToUint8Array(AXP_VAPID_PUBLIC_KEY)});
 const resp=await fetch("https://xjahoajimgdyuwxdjakw.supabase.co/functions/v1/register-webpush",{method:"POST",headers:{"Content-Type":"application/json",apikey:C.key,Authorization:"Bearer "+S.a},body:JSON.stringify({subscription:sub.toJSON()})});
 const text=await resp.text();let data={};try{data=text?JSON.parse(text):{}}catch{}if(!resp.ok||data.error)throw Error(data.error||"Unable to register this device for notifications.");
 localStorage.setItem(AXP_PUSH_FLAG,"1");
 return sub;
}
async function sendAXPTestPush(){
 const r=await fetch("https://xjahoajimgdyuwxdjakw.supabase.co/functions/v1/send-test-webpush",{method:"POST",headers:{apikey:C.key,Authorization:"Bearer "+S.a}});const t=await r.text();let x={};try{x=t?JSON.parse(t):{}}catch{}if(!r.ok||x.error)throw Error(x.error||"Unable to send test notification.");return x;
}
function axpNotificationCard(){
 if(S.p?.role!=="salesperson")return "";
 const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent),standalone=axpIsStandalone(),supported="Notification" in window&&"serviceWorker" in navigator&&"PushManager" in window,granted=supported&&Notification.permission==="granted"&&localStorage.getItem(AXP_PUSH_FLAG)==="1";
 if(!supported)return '<section class="card"><h3>Delivery Notifications</h3><p class="muted">This device/browser does not support AXIOM PULSE push notifications.</p></section>';
 if(granted)return '<section class="card"><h3>Delivery Notifications</h3><div class="status ok">Background push notifications enabled on this device.</div><p class="muted">Delivery reminders can arrive even when AXIOM PULSE is closed.</p><button class="btn secondary" onclick="axpTestPushUI()">SEND TEST NOTIFICATION</button></section>';
 if(ios&&!standalone)return '<section class="card"><h3>Enable Delivery Notifications</h3><p class="muted">On iPhone/iPad, add AXIOM PULSE to your Home Screen first. Then open the Home Screen app and tap Enable Notifications.</p><div class="status warn">Home Screen app required for iPhone/iPad push.</div></section>';
 return '<section class="card"><h3>Enable Delivery Notifications</h3><p class="muted">Allow AXIOM PULSE to send delivery reminders even when the app is closed.</p><button class="btn" onclick="enableDeliveryNotifications()">ENABLE NOTIFICATIONS</button></section>';
}
async function axpTestPushUI(){try{const x=await sendAXPTestPush();note("Test notification sent","Push service accepted the notification for "+(x.sent??0)+" registered device(s). Close AXIOM PULSE now to verify background delivery.")}catch(e){note("Test notification failed",e.message)}}
async function axpEnableNotifications(){try{await axpRegisterWebPush();if(typeof scheduleReminderTimers==="function")scheduleReminderTimers();go(S.screen);note("Notifications enabled","AXIOM PULSE can now send delivery reminders in the background, including when the PWA is closed.")}catch(e){note("Unable to enable notifications",e.message)}}
window.enableDeliveryNotifications=axpEnableNotifications;
window.notificationCard=axpNotificationCard;
const axpOriginalSchedule=window.scheduleReminderTimers;
window.scheduleReminderTimers=function(){if(localStorage.getItem(AXP_PUSH_FLAG)==="1")return;return axpOriginalSchedule?.()};
setTimeout(()=>{try{if(window.S?.p?.role==="salesperson"&&typeof window.go==="function")window.go(window.S.screen||"home")}catch{}},1000);
