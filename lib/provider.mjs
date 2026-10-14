export const VIDEO_MODEL='higgsfield/genjutsu/object-swap/v1.0';
export const IMAGE_MODEL='marketing-studio/image/flare';
export function createProvider(readKey){
 return async(path,method='GET',input)=>{
  const key=readKey();if(!key){const e=Error('Conecte sua chave Higgsfield em Configurações.');e.status=503;throw e;}
  if(!/^\/(files\/generate-upload-url|models\/higgsfield\/genjutsu\/restyle\/v1\.0\/presets|requests\/[a-zA-Z0-9_-]+\/(status|cancel)|higgsfield\/genjutsu\/object-swap\/v1\.0|marketing-studio\/image\/flare)$/.test(path))throw Error('Operação do provedor inválida.');
  const r=await fetch('https://api.higgsfield.ai'+path,{method,headers:{Authorization:'Key '+key,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined,signal:AbortSignal.timeout(90000)});
  if(!r.ok){const e=Error(r.status===401?'Chave Higgsfield inválida.':r.status===403?'Conta sem acesso a esta operação.':r.status===429?'Limite de solicitações atingido. Aguarde.':'Higgsfield recusou a operação (HTTP '+r.status+').');e.definitive=r.status>=400&&r.status<500;e.status=r.status;throw e;}
  const data=await r.json();return data;
 };
}
export function characterPrompt(description){
 return 'Create one photorealistic human character card, vertical full-body portrait against a warm yellow studio background. Exaggerated distinctive facial features, detailed natural skin and hair, coherent clothing, cinematic soft studio light. No text, no logo, no watermark. Keep the traits described below and use the supplied images as appearance references. Character description: '+description;
}
export const views={
 front:'Full body straight front view, neutral standing pose.',
 profile:'Full body right side profile view.',
 threequarter:'Full body three-quarter right view.',
 back:'Full body back view.',
 hair:'Close-up of head and hair, clear hairstyle detail.'
};
export function viewPrompt(description,view){
 if(!views[view])throw Error('Vista inválida.');
 return 'Create a reference photograph of exactly the same adult character shown in the reference image. Preserve face, hairstyle, body shape, clothing and colors. Plain warm yellow studio background. '+views[view]+' No text or watermark. '+description;
}

