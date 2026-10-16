export async function requestJson(path,body,{fetcher=fetch,timeoutMs=body?180000:20000}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 const failure=(message,code,status)=>Object.assign(new Error(message),{code,status});
 try{
  let response;
  try{response=await fetcher('/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:controller.signal});}
  catch(e){if(body)throw failure('Não foi possível confirmar a resposta do servidor. Consulte a Fila antes de reenviar uma geração para evitar duplicidade.','NETWORK_UNAVAILABLE');throw failure(controller.signal.aborted?'A conexão demorou a responder. Tente novamente quando o serviço voltar.':'Não foi possível conectar ao Fields IA. Verifique a conexão ou aguarde o serviço voltar.','NETWORK_UNAVAILABLE');}
  let data;try{data=await response.json();}catch{throw failure('O serviço está temporariamente indisponível. Seu vídeo e prompt não foram alterados.','SERVICE_UNAVAILABLE',response.status);}
  if(!response.ok)throw failure(data.error||'Não foi possível concluir esta operação.',response.status>=500?'SERVICE_UNAVAILABLE':'REQUEST_REJECTED',response.status);
  return data;
 }finally{clearTimeout(timer);}
}