const ACCESS={permissions:['cookies','scripting'],origins:['https://www.instagram.com/*','https://fieldsia.r2rmarketingdigital.com.br/*']};
const remembered=async()=>!!(await chrome.storage.local.get('keepConnected')).keepConnected;
const revoke=async()=>{await chrome.permissions.remove(ACCESS);await chrome.alarms.clear('revoke-instagram');};
const connected=async()=>await remembered()&&await chrome.permissions.contains(ACCESS);
const validLink=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['instagram.com','www.instagram.com'].includes(u.hostname)&&/^\/(p|reel|reels)\/[-_a-zA-Z0-9]+\/?$/.test(u.pathname);}catch{return false;}};
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 const popup=sender.id===chrome.runtime.id&&sender.url===chrome.runtime.getURL('popup.html');
 const studio=sender.id===chrome.runtime.id&&sender.frameId===0&&sender.tab&&(()=>{try{return new URL(sender.url).origin==='https://fieldsia.r2rmarketingdigital.com.br';}catch{return false;}})();
 if(!popup&&!studio)return;
 const respond=async()=>{
  if(message?.type==='CONNECTION_STATUS')return {connected:await connected()};
  if(popup&&message?.type==='KEEP_CONNECTED'){if(!await chrome.permissions.contains(ACCESS))throw Error('Autorize o acesso no Chrome.');await chrome.storage.local.set({keepConnected:true});await chrome.alarms.clear('revoke-instagram');return {ok:true};}
  if(popup&&message?.type==='DISCONNECT'){await chrome.storage.local.set({keepConnected:false});await revoke();return {ok:true};}
  if(popup&&message?.type==='START_TEMPORARY_IMPORT'){if(!await remembered())await chrome.alarms.create('revoke-instagram',{when:Date.now()+180000});return {ok:true};}
  if(studio&&message?.type==='INSTAGRAM_COOKIES'){
   if(!validLink(message.url)||!await connected())throw Error('Conecte o assistente Instagram uma vez no Chrome.');
   const cookies=[];for(const name of ['sessionid','csrftoken','ds_user_id']){const cookie=await chrome.cookies.get({url:'https://www.instagram.com/',name});if(cookie)cookies.push(cookie);}
   if(!cookies.some(cookie=>cookie.name==='sessionid'&&cookie.value))throw Error('Sua sessão Instagram expirou. Entre novamente no Instagram neste perfil do Chrome.');
   return {cookies};
  }
  return {error:'Pedido não permitido.'};
 };
 respond().then(reply,error=>reply({error:error.message}));return true;
});
chrome.alarms.onAlarm.addListener(async alarm=>{if(alarm.name==='revoke-instagram'&&!await remembered())await revoke();});
chrome.runtime.onStartup.addListener(async()=>{if(!await remembered())await revoke();});
