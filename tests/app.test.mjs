import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,copyFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
import {createApp} from '../server.mjs';
import {run,inspectMedia,socialURL,concatenate,splitVideo} from '../lib/media.mjs';
import {createVault} from '../lib/vault.mjs';
import {createHash} from 'node:crypto';
let fixtures,png,short,long,small;
before(async()=>{
 fixtures=mkdtempSync(join(tmpdir(),'school-fixtures-'));png=join(fixtures,'reference.png');short=join(fixtures,'short.mp4');long=join(fixtures,'long.mp4');
 await sharp({create:{width:64,height:96,channels:3,background:'#e3c341'}}).png().toFile(png);
 small=join(fixtures,'small.mp4');
 for(const [file,duration,size]of [[short,6,'640x640'],[long,36,'640x640'],[small,4,'160x120']])await run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-f','lavfi','-i','color=c=blue:s='+size+':r=12','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t',String(duration),'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-shortest','-movflags','+faststart',file],{timeout:60000,windowsHide:true,maxBuffer:1e6});
});
after(()=>rmSync(fixtures,{recursive:true,force:true}));
async function instance(options={}){
 const dataDir=mkdtempSync(join(tmpdir(),'school-app-'));
 const server=createApp({dataDir,pollInterval:9999999,...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const post=(path,body={},cookie)=>fetch(base+'/api/'+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 const get=(path,cookie)=>fetch(base+path,{headers:cookie?{Cookie:cookie}:{}});
 const upload=async(file,type,cookie)=>{const response=await fetch(base+'/api/media',{method:'POST',headers:{Origin:base,'Content-Type':type,...(cookie?{Cookie:cookie}:{})},body:readFileSync(file)});assert.equal(response.status,201,await response.clone().text());return response.json();};
 const close=async()=>{await Promise.allSettled([...server.school.background]);await new Promise(r=>server.close(r));await new Promise(r=>setTimeout(r,20));rmSync(dataDir,{recursive:true,force:true});};
 return {server,base,post,get,upload,close,dataDir};
}
function mockProvider(){
 const uploads=new Map(),requests=new Map(),calls=[];let count=0,cancel=false;
 return {
  calls,uploads,requests,
  provider:async(path,method,input,credentials)=>{
   calls.push({path,method,input,key:credentials?.key});
   if(path.includes('/presets')){if(credentials?.key==='invalid-key-test')throw Error('Chave inválida.');return {items:[]};}
   if(path==='/files/generate-upload-url'){const id='upload-'+(++count);return {upload_url:'https://storage.example/'+id,public_url:'https://storage.example/'+id,upload_headers:{'Content-Type':input.content_type}};}
   if(path.includes('object-swap')||path.includes('/image/flare')){
    if(input.prompt.endsWith('force-definitive')){const e=Error('Input inválido no provedor.');e.definitive=true;throw e;}
    if(input.prompt.endsWith('force-uncertain'))throw Error('Timeout');
    const id='request-'+(++count);requests.set(id,{...input,kind:path.includes('object-swap')?'video':'image',status:'completed'});return {request_id:id};
   }
   const id=path.split('/')[2],request=requests.get(id);if(!request)throw Error('Solicitação não existe.');
   if(path.endsWith('/cancel')){request.status='canceled';return {ok:true};}
   return request.status==='completed'?{status:'completed',...(request.kind==='video'?{video:{url:'https://result.example/'+id}}:{images:[{url:'https://result.example/'+id}]})}:{status:request.status};
  },
  uploadFetch:async(url,options)=>{uploads.set(String(url),Buffer.from(options.body));return {ok:true};},
  download:async(url,path)=>{
   const request=requests.get(new URL(url).pathname.slice(1));
   if(!request)throw Error('Resultado desconhecido.');
   if(request.kind==='video')writeFileSync(path,uploads.get(request.video_url));
   else copyFileSync(png,path);
   return {size:readFileSync(path).length,type:request.kind==='video'?'video/mp4':'image/png'};
  }
 };
}
async function connect(a){const r=await a.post('provider/connect',{key:'test-key-do-not-use'});assert.equal(r.status,200,await r.clone().text());}
async function prepared(a){const image=await a.upload(png,'image/png');const r=await a.post('characters',{name:'Personagem <teste>',description:'Cabelo castanho e roupa azul',images:[image.id]});assert.equal(r.status,201);const character=await r.json();const video=await a.upload(short,'video/mp4');return {image,character,video};}
async function settle(a){
 await Promise.allSettled([...a.server.school.background]);await a.server.school.poll();
 return (await (await a.get('/api/state')).json()).jobs;
}
test('biblioteca própria, imagens reais, favoritos, pastas, capas e persistência',async()=>{
 const a=await instance();
 try{
  const p=await prepared(a);
  await a.post('folders',{name:'Pasta original'});
  const edit=await a.post('characters',{id:p.character.id,name:'Editado',folder:'Pasta original',description:'Texto',images:[p.image.id]});assert.equal(edit.status,201);
  await a.post('folders/rename',{oldName:'Pasta original',name:'Pasta nova'});
  await a.post('favorite',{id:p.character.id});
  const s=await (await a.get('/api/state')).json();assert.equal(s.characters[0].name,'Editado');assert.equal(s.characters[0].folder,'Pasta nova');assert.equal(s.characters[0].favorite,true);assert.deepEqual(s.folders,['Pasta nova']);
  const clone=await (await a.post('characters/clone',{id:p.character.id})).json();assert.ok(clone.id);
  assert.equal((await a.post('characters/archive',{id:clone.id})).status,200);
  assert.equal((await (await a.get('/api/archived')).json()).characters[0].id,clone.id);
  assert.equal((await a.post('characters/restore',{id:clone.id})).status,200);
  const imageResponse=await a.get('/media/'+p.image.id+'?download=1');assert.match(imageResponse.headers.get('content-disposition'),/attachment/);
  const range=await fetch(a.base+'/media/'+p.video.id,{headers:{Range:'bytes=0-31'}});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,32);
  const invalid=await fetch(a.base+'/media/'+p.video.id,{headers:{Range:'bytes=999999999999-'}});assert.equal(invalid.status,416);
  await new Promise(r=>a.server.close(r));await new Promise(r=>setTimeout(r,20));
  const reopened=createApp({dataDir:a.dataDir});await new Promise(r=>reopened.listen(0,'127.0.0.1',r));
  const final=await (await fetch('http://127.0.0.1:'+reopened.address().port+'/api/state')).json();assert.equal(final.characters.length,2);assert.equal(final.characters.find(c=>c.id===p.character.id).favorite,true);
  await new Promise(r=>reopened.close(r));
 }finally{if(a.server.listening)await a.close();else rmSync(a.dataDir,{recursive:true,force:true});}
});
test('origem, host, conteúdo falso e geração sem chave são bloqueados',async()=>{
 const a=await instance();const old=process.env.HF_API_KEY;delete process.env.HF_API_KEY;
 try{
  assert.equal((await fetch(a.base+'/',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,200);
  assert.equal((await fetch(a.base+'/api/state',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await fetch(a.base+'/api/folders',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(a.base+'/api/folders',{method:'POST',headers:{Origin:'not a URL','Content-Type':'application/json'},body:'{}'})).status,403);
  const {request}=await import('node:http');
  const hostStatus=await new Promise((resolve,reject)=>{const r=request(a.base+'/api/state',{headers:{Host:'evil.example'}},response=>{response.resume();resolve(response.statusCode);});r.on('error',reject);r.end();});
  assert.equal(hostStatus,403);
  const bad=await fetch(a.base+'/api/media',{method:'POST',headers:{Origin:a.base,'Content-Type':'image/png'},body:Buffer.from([137,80,78,71,13,10,26,10])});assert.equal(bad.status,400);
  assert.equal((await a.post('characters',{name:'Sem imagem',images:[]})).status,400);
  assert.equal((await a.post('generate',{characterId:'x',videoId:'x'})).status,503);
  assert.equal((await a.post('favorite',{id:'does-not-exist'})).status,404);
 }finally{if(old)process.env.HF_API_KEY=old;await a.close();}
});
test('chave é validada antes de salvar, cifrada no banco e omitida do estado',async()=>{
 const mock=mockProvider(),a=await instance(mock);
 try{
  assert.equal((await a.post('provider/connect',{key:'invalid-key-test'})).status,400);
  assert.equal((await (await a.get('/api/state')).json()).provider.configured,false);
  await connect(a);
  const stateText=await (await a.get('/api/state')).text();assert.ok(!stateText.includes('test-key-do-not-use'));
  const stored=a.server.school.db.prepare('SELECT credential FROM settings').get().credential;assert.ok(!stored.includes('test-key-do-not-use'));assert.equal(createVault(a.dataDir).decrypt(stored),'test-key-do-not-use');
  assert.equal((await a.post('provider/verify')).status,200);
  assert.equal((await a.post('provider/disconnect')).status,200);
  assert.equal((await (await a.get('/api/state')).json()).provider.configured,false);
 }finally{await a.close();}
});
test('geração de vídeo atravessa upload, provedor, resultado local e download',async()=>{
 const mock=mockProvider(),a=await instance(mock);
 try{
  await connect(a);const p=await prepared(a);
  assert.equal((await a.post('generate',{characterId:p.character.id,videoId:p.video.id})).status,202);
  assert.equal((await a.post('generate',{characterId:p.character.id,videoId:p.video.id})).status,400);
  const [job]=await settle(a);assert.equal(job.status,'completed',job.error);assert.match(job.result,/^\/media\//);
  const downloaded=await a.get(job.result+'?download=1');assert.equal(downloaded.status,200);assert.ok((await downloaded.arrayBuffer()).byteLength>1000);
  assert.equal(mock.calls.filter(c=>c.path.includes('object-swap')).length,1);
  assert.equal((await a.post('favorite',{id:job.id,kind:'job'})).status,200);
  assert.equal((await a.post('jobs/hide',{id:job.id})).status,200);
  assert.equal((await (await a.get('/api/state')).json()).jobs.length,0);
 }finally{await a.close();}
});
test('vídeo de 36 s é dividido, enviado em duas partes e reunido com áudio',async()=>{
 const mock=mockProvider(),a=await instance(mock);
 try{
  await connect(a);const p=await prepared(a),video=await a.upload(long,'video/mp4');
  const r=await a.post('generate',{characterId:p.character.id,videoId:video.id});assert.equal(r.status,202);
  const [job]=await settle(a);assert.equal(job.status,'completed',job.error);
  assert.equal(mock.calls.filter(c=>c.path.includes('object-swap')).length,2);
  const info=await inspectMedia(join(a.dataDir,'media',job.outputs[0]),'video/mp4');assert.ok(info.duration>=35.5&&info.duration<=36.5,info.duration);
 }finally{await a.close();}
});
test('opções de personagem e vistas geradas viram referências persistentes',async()=>{
 const mock=mockProvider(),a=await instance(mock);
 try{
  await connect(a);
  const result=await a.post('generate-images',{name:'Novo',description:'Homem adulto de jaqueta azul',options:2,references:[]});assert.equal(result.status,202);const batch=(await result.json()).batch;
  const jobs=await settle(a);assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.status==='completed'));assert.ok(jobs.every(j=>j.meta.batch===batch));
  const c=await (await a.post('characters',{name:'Novo',description:'Jaqueta azul',images:jobs[0].outputs})).json();
  assert.equal((await a.post('generate-view',{characterId:c.id,view:'profile'})).status,202);
  await settle(a);const state=await (await a.get('/api/state')).json(),character=state.characters.find(item=>item.id===c.id);
  assert.equal(character.images.length,2);assert.equal(character.labels[character.images[1]],'profile');
  assert.equal((await a.post('characters/cover',{id:c.id,imageId:character.images[1]})).status,200);
  assert.equal((await (await a.get('/api/state')).json()).characters[0].images[0],character.images[1]);
 }finally{await a.close();}
});
test('cancelamento chega ao provedor e falha incerta não é reenviada',async()=>{
 const mock=mockProvider(),a=await instance(mock);
 try{
  await connect(a);const p=await prepared(a);await a.post('generate',{characterId:p.character.id,videoId:p.video.id});
  await Promise.allSettled([...a.server.school.background]);const job=(await (await a.get('/api/state')).json()).jobs[0];
  assert.equal((await a.post('cancel',{id:job.id})).status,200);await a.server.school.poll();
  assert.equal((await (await a.get('/api/state')).json()).jobs[0].status,'canceled');
  await a.post('generate',{characterId:p.character.id,videoId:p.video.id,prompt:'force-uncertain'});await Promise.allSettled([...a.server.school.background]);await a.server.school.poll();
  const s=await (await a.get('/api/state')).json();assert.equal(s.jobs[0].status,'uncertain');
  const submits=mock.calls.filter(c=>c.path.includes('object-swap')).length;await a.server.school.poll();assert.equal(mock.calls.filter(c=>c.path.includes('object-swap')).length,submits);
 }finally{await a.close();}
});
test('login, logout e isolamento de arquivos e referências por usuário',async()=>{
 const a=await instance({localMode:false});
 try{
  assert.equal((await a.get('/api/state')).status,401);
  const token=readFileSync(join(a.dataDir,'setup-token.txt'),'utf8');
  const response=await a.post('auth/setup',{email:'admin@example.test',password:'Test-password-long-123',name:'Admin',token});assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie').split(';')[0],image=await a.upload(png,'image/png',cookie);
  assert.equal((await a.get('/media/'+image.id,cookie)).status,200);assert.equal((await a.get('/media/'+image.id)).status,401);
  const {scryptSync,randomBytes}=await import('node:crypto');const salt=randomBytes(16).toString('hex');
  a.server.school.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,0)').run('another','another@example.test','Outro',scryptSync('Other-password-long',salt,64).toString('hex'),salt);
  const second=await a.post('auth/login',{email:'another@example.test',password:'Other-password-long'});assert.equal(second.status,200);const secondCookie=second.headers.get('set-cookie').split(';')[0];
  assert.equal((await a.get('/media/'+image.id,secondCookie)).status,404);
  assert.equal((await a.post('characters',{name:'Sem acesso',images:[image.id]},secondCookie)).status,400);
  assert.equal((await a.post('auth/login',{email:'another@example.test',password:'wrong'})).status,401);
  await a.post('auth/logout',{},secondCookie);assert.equal((await a.get('/api/state',secondCookie)).status,401);
 }finally{await a.close();}
});
test('vídeo pequeno é recusado antes de upload pago ao provedor',async()=>{
 const mock=mockProvider(),a=await instance(mock);
 try{
  await connect(a);const {character}=await prepared(a),video=await a.upload(small,'video/mp4');
  const calls=mock.calls.length,response=await a.post('generate',{characterId:character.id,videoId:video.id});
  assert.equal(response.status,400);assert.match((await response.json()).error,/Vídeo pequeno/);
  assert.equal(mock.calls.length,calls);assert.equal((await (await a.get('/api/state')).json()).jobs.length,0);
 }finally{await a.close();}
});
test('importação aceita plataformas permitidas e valida o vídeo retornado',async()=>{
 assert.throws(()=>socialURL('https://localhost/private'));assert.throws(()=>socialURL('https://instagram.com.evil.example/a'));assert.throws(()=>socialURL('http://www.tiktok.com/x'));
 assert.match(socialURL('https://www.instagram.com/reel/example/'),/instagram/);
 const a=await instance({importer:async(raw,path)=>{socialURL(raw);copyFileSync(short,path);return inspectMedia(path,'video/mp4');}});
 try{assert.equal((await a.post('import-link',{url:'https://localhost/secret'})).status,400);const r=await a.post('import-link',{url:'https://www.instagram.com/reel/example/'});assert.equal(r.status,201);const video=await r.json();assert.ok(video.duration>=6);assert.equal((await a.get(video.url)).status,200);}
 finally{await a.close();}
});


test('qualidade máxima é encaminhada sem aceitar parâmetros arbitrários',async()=>{
 const mock=mockProvider(),a=await instance(mock);
 try{
  await connect(a);
  assert.equal((await a.post('generate-images',{name:'Teste',description:'Adulto',options:1,quality:'invalid'})).status,400);
  assert.equal((await a.post('generate-images',{name:'Teste',description:'Adulto',options:1,quality:'maximum'})).status,202);
  const [job]=await settle(a);assert.equal(job.status,'completed',job.error);
  const call=mock.calls.find(c=>c.path.includes('/image/flare'));assert.equal(call.input.resolution,'4k');assert.equal(call.input.quality,'max');assert.equal(call.input.enhance_prompt,false);assert.equal(job.meta.quality,'maximum');
 }finally{await a.close();}
});
test('app instalável tem recursos públicos válidos sem expor dados privados',async()=>{
 const a=await instance({localMode:false});
 try{
  const manifest=await a.get('/manifest.webmanifest');assert.equal(manifest.status,200);assert.match(manifest.headers.get('content-type'),/application\/manifest\+json/);
  const m=await manifest.json();assert.equal(m.display,'standalone');
  for(const icon of m.icons){const r=await a.get(icon.src);assert.equal(r.status,200);const info=await sharp(Buffer.from(await r.arrayBuffer())).metadata();assert.equal(info.width,Number(icon.sizes.split('x')[0]));}
  const sw=await a.get('/sw.js');assert.equal(sw.status,200);assert.match(sw.headers.get('content-type'),/javascript/);assert.equal((await a.get('/api/state')).status,401);
 }finally{await a.close();}
});
test('authenticated Instagram import removes session and reuses the same link for its owner',async()=>{
 let calls=0,cookiePath;
 const a=await instance({importer:async(raw,path,root,options)=>{calls++;cookiePath=options?.cookieFile;assert.ok(cookiePath);assert.match(readFileSync(cookiePath,'utf8'),/synthetic-session/);copyFileSync(short,path);return inspectMedia(path,'video/mp4');}});
 try{
  const cookies=[{domain:'.instagram.com',name:'sessionid',value:'synthetic-session',secure:true,httpOnly:true,path:'/',session:true}];
  assert.equal((await a.post('import-instagram-session',{url:'https://www.tiktok.com/x',cookies})).status,400);assert.equal(calls,0);
  const r=await a.post('import-instagram-session',{url:'https://www.instagram.com/p/DeBwwYiIO-F/',cookies});assert.equal(r.status,201,await r.clone().text());const imported=await r.json();assert.equal(existsSync(cookiePath),false);assert.ok(!JSON.stringify(imported).includes('synthetic-session'));
  const again=await a.post('import-link',{url:'https://instagram.com/reel/DeBwwYiIO-F/?igsh=abc'});assert.equal(again.status,200);const cached=await again.json();assert.equal(cached.id,imported.id);assert.equal(cached.cached,true);assert.equal(calls,1);assert.equal((await a.get(cached.url+'?download=1')).status,200);
  assert.equal(a.server.school.db.prepare('SELECT COUNT(*) AS n FROM imported_links').get().n,1);
 }finally{await a.close();}
});
test('admin library import preserves existing characters and rejects file replacement',async()=>{
 const a=await instance();try{
  const own=await prepared(a),id=createHash('sha256').update('fixture-reference').digest('hex');
  const packet={media:[{id,type:'image/png',data:readFileSync(png).toString('base64')}],characters:[{id:'library-'+'a'.repeat(32),name:'Library fixture',description:'Exact supplied description',images:[id],labels:{[id]:'Card'}}]};
  const result=await a.post('library/import',packet);assert.equal(result.status,201,await result.clone().text());
  assert.deepEqual(await result.json(),{characters:1,references:1});
  const state=await (await a.get('/api/state')).json();assert.ok(state.characters.some(c=>c.id===own.character.id));assert.ok(state.characters.some(c=>c.name==='Library fixture'));
  assert.equal((await a.post('library/import',packet)).status,201);assert.equal((await (await a.get('/api/state')).json()).characters.length,2);
  assert.equal((await a.post('library/descriptions',{characters:[{name:'Library fixture',description:'English description',descriptionPt:'Descrição original',images:[{path:'fixture-reference',label:'Frente'}]}]})).status,200);
  const libraryCharacter=(await (await a.get('/api/state')).json()).characters.find(c=>c.name==='Library fixture');assert.equal(libraryCharacter.description_pt,'Descrição original');assert.equal(libraryCharacter.labels[id],'Frente');
  const clone=await (await a.post('characters/clone',{id:libraryCharacter.id})).json();assert.equal((await (await a.get('/api/state')).json()).characters.find(c=>c.id===clone.id).description_pt,'Descrição original');
  packet.media[0].data=Buffer.from('invalid-image').toString('base64');assert.equal((await a.post('library/import',packet)).status,400);assert.ok(readFileSync(join(a.dataDir,'media',id)).equals(readFileSync(png)));
 }finally{await a.close();}
});

test('named API accounts switch safely without changing characters or exposing keys',async()=>{const mock=mockProvider(),a=await instance({provider:mock.provider});try{await a.post('provider/connect',{key:'personal-test-key',label:'Pessoal'});const first=(await (await a.get('/api/state')).json()).connections.find(c=>c.active);await a.post('provider/connect',{key:'company-test-key',label:'Empresa'});const before=await (await a.get('/api/state')).json();assert.equal(before.connections.length,2);assert.equal((await a.post('connections/select',{id:first.id})).status,200);await a.post('provider/verify');assert.equal(mock.calls.at(-1).key,'personal-test-key');const after=await (await a.get('/api/state')).json();assert.deepEqual(after.characters,before.characters);assert.ok(!JSON.stringify(after).includes('personal-test-key'));a.server.school.db.prepare("INSERT INTO jobs(id,character_id,name,status,created,user_id,meta) VALUES('switch-block','','test','assembling','today','local-owner','{}')").run();assert.equal((await a.post('connections/select',{id:before.connections.find(c=>c.id!==first.id).id})).status,400);assert.equal((await a.post('mcp/connect',{label:'Outra'})).status,400);}finally{await a.close();}});
