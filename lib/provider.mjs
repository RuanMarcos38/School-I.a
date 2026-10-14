import {realismGuidance} from './realism.mjs';
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
export function characterPrompt(description,framing='portrait'){
 if(!['portrait','body'].includes(framing))throw Error('Enquadramento inválido.');
 const composition=framing==='body'?'vertical full-body portrait, head and feet fully visible, neutral standing pose':'vertical chest-up portrait, entire head and hairstyle fully visible with comfortable space above the hair, shoulders and upper chest in frame, face fills the upper half, natural three-quarter pose';
 return realismGuidance()+'\nCreate one photographic adult human character card, '+composition+' against a warm yellow seamless studio background. Real camera photograph, physically plausible anatomy, natural proportions, subtle facial asymmetry, realistic skin pores and fine facial hair, individual hair strands, detailed fabric weave and seams. Soft directional studio light with coherent shadows and natural skin tones. Avoid plastic or waxy skin, beauty-filter smoothing, CGI, illustration, caricature, exaggerated facial features, extra fingers and distorted hands. Preserve all identity traits, hairstyle, body shape, clothing and colors from the supplied appearance references; do not blend identities. One person. No text, logo or watermark. Character description: '+description;
}
export function imageSettings(preset='standard'){
 if(preset==='standard')return {resolution:'2k',quality:'high',aspect_ratio:'3:4',enhance_prompt:false};
 if(preset==='maximum')return {resolution:'4k',quality:'max',aspect_ratio:'3:4',enhance_prompt:false};
 throw Error('Qualidade de imagem inválida.');
}
export const views={
 front:'Chest-up straight front portrait, entire hairstyle visible.',
 profile:'Chest-up right side profile portrait, entire head and hairstyle visible.',
 threequarter:'Chest-up three-quarter right portrait, entire head and hairstyle visible.',
 back:'Full body back view.',
 hair:'Close-up of head and hair, clear hairstyle detail.',
 body:'Full body straight front view, neutral standing pose, head and feet fully visible.'
};
export function viewPrompt(description,view){
 if(!views[view])throw Error('Vista inválida.');
 return realismGuidance()+'\nCreate a reference photograph of exactly the same adult character shown in the reference image. Preserve face, hairstyle, body shape, clothing and colors. Plain warm yellow studio background. '+views[view]+' No text or watermark. '+description;
}

