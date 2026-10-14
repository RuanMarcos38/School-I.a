import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
test('biblioteca, validação, origem, configuração e persistência',async()=>{
 const dataDir=mkdtempSync(join(tmpdir(),'school-test-'));
 let app=createApp({dataDir});await new Promise(r=>app.listen(0,'127.0.0.1',r));
 let base='http://127.0.0.1:'+app.address().port;
 const post=async(p,b)=>fetch(base+p,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(b)});
 try{
  assert.equal((await fetch(base+'/api/state')).status,200);
  assert.equal((await fetch(base+'/api/folders',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"name":"x"}'})).status,403);
  assert.equal((await post('/api/characters',{name:'Inválido',images:[]})).status,400);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBfsAAAAASUVORK5CYII=','base64');
  const r=await fetch(base+'/api/media',{method:'POST',headers:{Origin:base,'Content-Type':'image/png'},body:png});
  assert.equal(r.status,201);const m=await r.json();
  assert.equal((await fetch(base+'/media/'+m.id)).status,200);
  const fake=await fetch(base+'/api/media',{method:'POST',headers:{Origin:base,'Content-Type':'image/png'},body:'not-an-image'});assert.equal(fake.status,400);
  await post('/api/folders',{name:'Pasta'});
  const c=await (await post('/api/characters',{name:'Meu personagem',description:'Descrição',folder:'Pasta',images:[m.id]})).json();
  await post('/api/favorite',{id:c.id});
  const old=process.env.HF_API_KEY;delete process.env.HF_API_KEY;
  assert.equal((await post('/api/generate',{characterId:c.id,videoId:'missing'})).status,503);
  if(old)process.env.HF_API_KEY=old;
  await new Promise(r=>app.close(r));
  app=createApp({dataDir});await new Promise(r=>app.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.address().port;
  const s=await (await fetch(base+'/api/state')).json();
  assert.equal(s.characters.length,1);assert.equal(s.characters[0].favorite,1);assert.deepEqual(s.folders,['Pasta']);assert.equal(s.jobs.length,0);
 }finally{await new Promise(r=>app.close(r));rmSync(dataDir,{recursive:true,force:true});}
});

test('envio ao provedor, conclusão e galeria com provedor de teste',async()=>{
 const dataDir=mkdtempSync(join(tmpdir(),'school-generation-'));
 const calls=[];const old=process.env.HF_API_KEY;process.env.HF_API_KEY='test-only';
 const provider=async(path,method,input)=>{
  calls.push({path,method,input});
  if(path==='/files/generate-upload-url')return {upload_url:'https://storage.example/upload',public_url:'https://storage.example/media',upload_headers:{'Content-Type':input.content_type}};
  if(path.includes('object-swap'))return {request_id:'test-request',status:'queued'};
  if(path.endsWith('/status'))return {status:'completed',video:{url:'https://cdn.example/output.mp4'}};
  throw new Error('Unexpected provider route');
 };
 const app=createApp({dataDir,provider,uploadFetch:async()=>({ok:true}),pollInterval:50});await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.address().port;
 const post=async(p,b)=>fetch(base+p,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(b)});
 try{
  const upload=async(type,body,duration)=>{const r=await fetch(base+'/api/media',{method:'POST',headers:{Origin:base,'Content-Type':type,'X-Duration':String(duration||0)},body});assert.equal(r.status,201);return r.json();};
  const image=await upload('image/png',Buffer.from([137,80,78,71,13,10,26,10]));
  const video=await upload('video/mp4',Buffer.from([0,0,0,16,102,116,121,112,105,115,111,109]),5);
  const c=await (await post('/api/characters',{name:'Teste',images:[image.id]})).json();
  const r=await post('/api/generate',{characterId:c.id,videoId:video.id});assert.equal(r.status,202);
  let job;
  for(let i=0;i<50;i++){job=(await (await fetch(base+'/api/state')).json()).jobs[0];if(job.status==='completed')break;await new Promise(r=>setTimeout(r,20));}
  assert.equal(job.status,'completed');assert.equal(job.result,'https://cdn.example/output.mp4');
  const submit=calls.find(c=>c.path.includes('object-swap'));assert.equal(submit.input.resolution,'1080p');assert.equal(submit.input.image_urls.length,1);
  assert.equal(calls.filter(c=>c.path.includes('object-swap')).length,1);
 }finally{await new Promise(r=>app.close(r));if(old)process.env.HF_API_KEY=old;else delete process.env.HF_API_KEY;rmSync(dataDir,{recursive:true,force:true});}
});
