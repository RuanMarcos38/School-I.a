const ACCESS={permissions:['cookies','scripting'],origins:['https://www.instagram.com/*','https://fieldsia.r2rmarketingdigital.com.br/*']};
const button=document.querySelector('#import'),status=document.querySelector('#status');
const extensionReady=location.protocol==='chrome-extension:'&&typeof chrome!=='undefined'&&!!chrome.runtime?.id&&typeof chrome.permissions?.request==='function'&&typeof chrome.permissions?.remove==='function'&&typeof chrome.tabs?.query==='function';
if(!extensionReady){
 button.hidden=true;document.querySelector('#installation').hidden=false;
 status.textContent='Este arquivo foi aberto fora da extensão. Instale a pasta no Chrome e use o ícone Fields IA na barra de extensões. Nenhuma sessão foi acessada ou enviada.';
}else{
const revoke=()=>chrome.permissions.remove(ACCESS);
window.addEventListener('pagehide',()=>{void revoke().catch(()=>{});});
button.addEventListener('click',async()=>{
 button.disabled=true;let cookies=[];
 try{
  if(!await chrome.permissions.request(ACCESS))throw Error('Acesso não autorizado. Nenhum cookie foi enviado.');
  await chrome.runtime.sendMessage({type:'START_TEMPORARY_IMPORT'});
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.url||new URL(tab.url).origin!=='https://fieldsia.r2rmarketingdigital.com.br')throw Error('Abra o Estúdio do Fields IA nesta aba.');
  const [input]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>document.querySelector('#video-link')?.value||''});
  let url;try{url=new URL(input.result);}catch{throw Error('Cole o link Instagram no Estúdio.');}
  if(url.protocol!=='https:'||!['instagram.com','www.instagram.com'].includes(url.hostname)||!/^\/(p|reel|reels)\/[-_a-zA-Z0-9]+\/?$/.test(url.pathname))throw Error('Use o link de um vídeo Instagram.');
  for(const name of ['sessionid','csrftoken','ds_user_id']){const c=await chrome.cookies.get({url:'https://www.instagram.com/',name});if(c)cookies.push(c);}
  if(!cookies.some(c=>c.name==='sessionid'&&c.value))throw Error('Entre no Instagram neste perfil do Chrome.');
  status.textContent='Importando. Mantenha esta janela aberta…';
  const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',args:[url.href,cookies],func:async(url,cookies)=>{
   if(location.origin!=='https://fieldsia.r2rmarketingdigital.com.br')return {error:'Abra o Fields IA.'};
   try{
    const response=await fetch('/api/import-instagram-session',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({url,cookies})});
    const media=await response.json();if(!response.ok)return {error:media.error||'A importação falhou.'};
    window.postMessage({type:'FIELDS_IA_INSTAGRAM_IMPORTED',media},location.origin);return {ok:true,duration:media.duration};
   }catch{return {error:'A conexão falhou. Tente novamente no Fields IA.'};}
  }});
  if(!result?.result?.ok)throw Error(result?.result?.error||'Importação não concluída.');
  status.textContent='Vídeo importado ('+Number(result.result.duration).toFixed(1)+' s). Volte ao Fields IA.';
 }catch(e){status.textContent=e.message;}
 finally{cookies=[];try{await revoke();}catch{status.textContent+=' Se necessário, remova a extensão no Chrome para revogar o acesso.';}button.disabled=false;}
});

}

