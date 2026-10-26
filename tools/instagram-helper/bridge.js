// Isolated extension world. Session cookies never enter the page's JavaScript.
let connected=false,importing=false;
const signal=(type,extra={})=>window.postMessage({type,...extra},location.origin);
function validLink(value){try{const u=new URL(value);return u.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(u.hostname)&&/^\/(p|reel|reels)\/[-_a-zA-Z0-9]+\/?$/.test(u.pathname);}catch{return false;}}
async function refreshConnection(){try{const state=await chrome.runtime.sendMessage({type:'CONNECTION_STATUS'});connected=!!state?.connected;}catch{connected=false;}signal('FIELDS_IA_INSTAGRAM_CONNECTION',{connected});}
window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.type==='FIELDS_IA_INSTAGRAM_PROBE')void refreshConnection();});
window.addEventListener('focus',refreshConnection);
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('[data-action="importlink"]'),url=document.querySelector('#video-link')?.value?.trim();
 if(!event.isTrusted||!button||button.disabled||!connected||!validLink(url))return;
 event.preventDefault();event.stopImmediatePropagation();if(importing)return;
 importing=true;button.disabled=true;signal('FIELDS_IA_INSTAGRAM_BUSY');
 try{
  let response=await fetch('/api/import-link',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({url}),signal:AbortSignal.timeout(200000)}),media=await response.json();
  if(!response.ok&&response.status===401)throw Error('Entre novamente no Fields IA.');
  if(!response.ok){
   let session=await chrome.runtime.sendMessage({type:'INSTAGRAM_COOKIES',url});
   if(session?.error)throw Error(session.error);
   if(!session?.cookies)throw Error('Abra o assistente para verificar a conexão.');
   try{response=await fetch('/api/import-instagram-session',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({url,cookies:session.cookies}),signal:AbortSignal.timeout(200000)});media=await response.json();}finally{session=null;}
  }
  if(!response.ok)throw Error(media.error||'Não foi possível importar este vídeo.');
  signal('FIELDS_IA_INSTAGRAM_IMPORTED',{media});
 }catch(error){signal('FIELDS_IA_INSTAGRAM_ERROR',{message:error.message||'A conexão falhou. Tente novamente.'});}
 finally{importing=false;button.disabled=false;signal('FIELDS_IA_INSTAGRAM_IDLE');}
},true);
void refreshConnection();
