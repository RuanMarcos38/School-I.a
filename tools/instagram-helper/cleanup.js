const ACCESS={permissions:['cookies','scripting'],origins:['https://www.instagram.com/*','https://fieldsia.r2rmarketingdigital.com.br/*']};
const revoke=async()=>{await chrome.permissions.remove(ACCESS);await chrome.alarms.clear('revoke-instagram');};
chrome.runtime.onMessage.addListener((message,sender,reply)=>{if(message?.type!=='START_TEMPORARY_IMPORT')return;chrome.alarms.create('revoke-instagram',{when:Date.now()+180000}).then(()=>reply({ok:true}));return true;});
chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='revoke-instagram')revoke();});
chrome.runtime.onStartup.addListener(revoke);
