const connect=document.querySelector('#connect'),disconnect=document.querySelector('#disconnect'),connectionStatus=document.querySelector('#connection-status');
if(location.protocol==='chrome-extension:'&&typeof chrome!=='undefined'&&chrome.runtime?.id){
 async function draw(){const state=await chrome.runtime.sendMessage({type:'CONNECTION_STATUS'});connect.hidden=!!state?.connected;disconnect.hidden=!state?.connected;connectionStatus.textContent=state?.connected?'Pronto. Cole o link no Fields IA e clique em Baixar. A conexão será mantida ao reabrir o Chrome.':'Configure uma vez para usar o botão Baixar diretamente no Estúdio.';}
 connect.addEventListener('click',async()=>{
  connect.disabled=true;
  try{if(!await chrome.permissions.request(ACCESS))throw Error('Conexão não autorizada.');const result=await chrome.runtime.sendMessage({type:'KEEP_CONNECTED'});if(result?.error)throw Error(result.error);await draw();}
  catch(error){connectionStatus.textContent=error.message;}
  finally{connect.disabled=false;}
 });
 disconnect.addEventListener('click',async()=>{await chrome.runtime.sendMessage({type:'DISCONNECT'});await draw();});
 void draw().catch(()=>{connectionStatus.textContent='Recarregue a extensão atualizada no Chrome.';});
}else{connect.hidden=true;disconnect.hidden=true;}
