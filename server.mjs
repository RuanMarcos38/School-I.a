import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const root=dirname(fileURLToPath(import.meta.url));
export function createApp({dataDir=join(root,'data'),provider=providerRequest,uploadFetch=fetch,pollInterval=10000}={}) {
 mkdirSync(join(dataDir,'media'),{recursive:true});
 const db=new DatabaseSync(join(dataDir,'school.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,folder TEXT NOT NULL DEFAULT '',favorite INTEGER NOT NULL DEFAULT 0,images TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,type TEXT NOT NULL,size INTEGER NOT NULL,duration REAL NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,character_id TEXT,name TEXT,request_id TEXT,status TEXT,error TEXT,result TEXT,created TEXT,favorite INTEGER DEFAULT 0);
 CREATE TABLE IF NOT EXISTS folders(name TEXT PRIMARY KEY);`);
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const parseCharacters=()=>db.prepare('SELECT * FROM characters ORDER BY name').all().map(c=>({...c,images:JSON.parse(c.images)}));
 const media=id=>db.prepare('SELECT * FROM media WHERE id=?').get(id);
 async function upload(id) {
  const m=media(id); if(!m)throw new Error('Arquivo não encontrado.');
  const signed=await provider('/files/generate-upload-url','POST',{content_type:m.type});
  if(!signed.upload_url||!signed.public_url)throw new Error('Resposta de upload inválida.');
  const u=new URL(signed.upload_url);
  if(u.protocol!=='https:')throw new Error('Destino de upload inválido.');
  const r=await uploadFetch(u,{method:'PUT',headers:signed.upload_headers||{'Content-Type':m.type},body:readFileSync(join(dataDir,'media',id)),signal:AbortSignal.timeout(120000)});
  if(!r.ok)throw new Error('Falha ao enviar a mídia ao provedor.');
  return signed.public_url;
 }
 let polling=false;
 async function poll(){
  if(polling)return;polling=true;
  try{for(const j of db.prepare("SELECT * FROM jobs WHERE request_id IS NOT NULL AND status IN ('queued','in_progress')").all()){
   try{
    const s=await provider('/requests/'+encodeURIComponent(j.request_id)+'/status');
    const allowed=['queued','in_progress','completed','failed','nsfw','canceled'];
    if(!allowed.includes(s.status))continue;
    const output=s.video?.url;
    if(s.status==='completed'&&(!output||!output.startsWith('https://'))){db.prepare("UPDATE jobs SET status='failed',error=? WHERE id=?").run('Provedor concluiu sem vídeo válido.',j.id);continue;}
    db.prepare('UPDATE jobs SET status=?,error=?,result=? WHERE id=?').run(s.status,['failed','nsfw','canceled'].includes(s.status)?'A geração terminou em '+s.status:null,output||null,j.id);
   }catch{ /* Preserve accepted requests during transient polling failures. */ }
  }}finally{polling=false;}
 }
 const timer=setInterval(poll,pollInterval);timer.unref();
 async function body(req,limit=65536){
  let size=0,parts=[];for await(const p of req){size+=p.length;if(size>limit){const e=new Error('Arquivo excede o limite.');e.status=413;throw e;}parts.push(p);}
  return Buffer.concat(parts);
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  const expected=new Set(['127.0.0.1:'+server.address().port,'localhost:'+server.address().port]);
  if(!expected.has(req.headers.host)){json(res,403,{error:'Host inválido.'});return;}
  let validOrigin=false;try{validOrigin=expected.has(new URL(req.headers.origin).host);}catch{}
  if(!['GET','HEAD'].includes(req.method)&&!validOrigin){json(res,403,{error:'Origem inválida.'});return;}
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   if(path==='/api/state'&&req.method==='GET'){json(res,200,{characters:parseCharacters(),folders:db.prepare('SELECT name FROM folders ORDER BY name').all().map(f=>f.name),jobs:db.prepare('SELECT * FROM jobs ORDER BY created DESC').all(),provider:{configured:!!process.env.HF_API_KEY,model:'higgsfield/genjutsu/object-swap/v1.0',verified:false}});return;}
   if(path==='/api/media'&&req.method==='POST'){
    const type=(req.headers['content-type']||'').split(';')[0];
    const image=['image/jpeg','image/png','image/webp'].includes(type),video=['video/mp4','video/quicktime','video/webm'].includes(type);
    if(!image&&!video)throw new Error('Formato não suportado.');
    const duration=Number(req.headers['x-duration']||0);
    if(video&&(!Number.isFinite(duration)||duration<4||duration>30))throw new Error('Use vídeos de 4 a 30 segundos para a API pública.');
    const b=await body(req,image?10*1024*1024:200*1024*1024);
    const signature=type==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?b[0]===255&&b[1]===216:type==='image/webp'?b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP':type==='video/webm'?b.subarray(0,4).equals(Buffer.from([26,69,223,163])):b.toString('ascii',4,8)==='ftyp';
    if(!signature)throw new Error('Conteúdo incompatível com o formato informado.');
    const id=randomUUID();writeFileSync(join(dataDir,'media',id),b);db.prepare('INSERT INTO media VALUES(?,?,?,?)').run(id,type,b.length,duration);json(res,201,{id,url:'/media/'+id,type,duration});return;
   }
   if(path.startsWith('/media/')&&req.method==='GET'){
    const id=path.slice(7),m=media(id);if(!m){json(res,404,{error:'Arquivo não encontrado.'});return;}
    const b=readFileSync(join(dataDir,'media',id));res.writeHead(200,{'Content-Type':m.type,'Content-Length':b.length,'Cache-Control':'private, max-age=3600'});res.end(b);return;
   }
   if(path.startsWith('/api/')&&req.method==='POST'){
    const b=JSON.parse((await body(req)).toString()||'{}');
    if(path==='/api/characters'){
     const name=String(b.name||'').trim().slice(0,100),description=String(b.description||'').slice(0,10000),images=b.images;
     if(!name||!Array.isArray(images)||images.length<1||images.length>5||images.some(i=>!media(i)?.type.startsWith('image/')))throw new Error('Informe nome e de 1 a 5 imagens válidas.');
     if(b.id&&!db.prepare('SELECT id FROM characters WHERE id=?').get(b.id))throw new Error('Personagem não encontrado.');
     const id=b.id||randomUUID();
     db.prepare('INSERT INTO characters(id,name,description,folder,images) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,folder=excluded.folder,images=excluded.images').run(id,name,description,String(b.folder||'').slice(0,100),JSON.stringify(images));
     json(res,201,{id});return;
    }
    if(path==='/api/folders'){
     const name=String(b.name||'').trim().slice(0,100);if(!name)throw new Error('Informe um nome.');
     db.prepare('INSERT OR IGNORE INTO folders VALUES(?)').run(name);json(res,201,{name});return;
    }
    if(path==='/api/favorite'){
     const table=b.kind==='job'?'jobs':'characters';db.prepare('UPDATE '+table+' SET favorite=1-favorite WHERE id=?').run(String(b.id));json(res,200,{ok:true});return;
    }
    if(path==='/api/generate'){
     if(!process.env.HF_API_KEY){json(res,503,{error:'Configure HF_API_KEY no arquivo .env para gerar. Nenhuma cobrança foi feita.'});return;}
     const c=db.prepare('SELECT * FROM characters WHERE id=?').get(b.characterId),v=media(b.videoId);
     if(!c||!v?.type.startsWith('video/'))throw new Error('Selecione um personagem e um vídeo.');
     if(String(b.prompt||'').length>10000)throw new Error('Prompt excede 10.000 caracteres.');
     if(db.prepare("SELECT id FROM jobs WHERE character_id=? AND status IN ('uploading','submitting','queued','in_progress','uncertain')").get(c.id))throw new Error('Este personagem já tem uma geração em andamento.');
     const id=randomUUID();db.prepare('INSERT INTO jobs(id,character_id,name,status,created) VALUES(?,?,?,?,?)').run(id,c.id,c.name,'uploading',new Date().toISOString());
     json(res,202,{id});
     (async()=>{
      let submitted=false;
      try{
       const video_url=await upload(b.videoId),image_urls=[];
       for(const image of JSON.parse(c.images))image_urls.push(await upload(image));
       db.prepare("UPDATE jobs SET status='submitting' WHERE id=?").run(id);submitted=true;
       const s=await provider('/higgsfield/genjutsu/object-swap/v1.0','POST',{video_url,image_urls,prompt:String(b.prompt||'')||'Replace only the person with the referenced character. Preserve movement, camera, background and lighting. '+c.description,resolution:'1080p'});
       if(!s.request_id)throw new Error('Provedor não retornou identificador.');
       db.prepare("UPDATE jobs SET status='queued',request_id=? WHERE id=?").run(s.request_id,id);
      }catch(e){db.prepare('UPDATE jobs SET status=?,error=? WHERE id=?').run(submitted&&!e.definitive?'uncertain':'failed',submitted&&!e.definitive?'Resposta incerta. Confira o console Higgsfield antes de tentar novamente.':e.message,id);}
     })();return;
    }
    if(path==='/api/cancel'){
     const j=db.prepare('SELECT * FROM jobs WHERE id=?').get(b.id);
     if(!j?.request_id||!['queued','in_progress'].includes(j.status))throw new Error('Solicitação não pode ser cancelada.');
     await provider('/requests/'+encodeURIComponent(j.request_id)+'/cancel','POST');
     // A successful cancel call does not guarantee cancellation; next polling confirms final state.
     json(res,200,{ok:true,message:'Cancelamento solicitado. Aguarde confirmação do provedor.'});return;
    }
    json(res,404,{error:'Rota não encontrada.'});return;
   }
   const staticFiles={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};
   if(req.method==='GET'&&staticFiles[path]){
    const type=path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html';
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' https: data:; media-src 'self' https: blob:; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(readFileSync(join(root,'public',staticFiles[path])));return;
   }
   json(res,404,{error:'Rota não encontrada.'});
  }catch(e){json(res,e.status||400,{error:e instanceof SyntaxError?'Dados inválidos.':e.message});}
 });
 // Never resubmit an ambiguous charge after restart.
 db.prepare("UPDATE jobs SET status='uncertain',error='Processo interrompido. Confira o console do provedor antes de reenviar.' WHERE status IN ('uploading','submitting')").run();
 server.on('close',()=>{clearInterval(timer);db.close();});
 return server;
}
async function providerRequest(path,method='GET',input){
 const r=await fetch('https://api.higgsfield.ai'+path,{method,headers:{Authorization:'Key '+process.env.HF_API_KEY,'Content-Type':'application/json'},body:input?JSON.stringify(input):undefined,signal:AbortSignal.timeout(60000)});
 if(!r.ok){const e=new Error(r.status===401?'Chave Higgsfield inválida.':r.status===429?'Limite do provedor atingido.':'Higgsfield recusou a solicitação (HTTP '+r.status+').');e.definitive=r.status>=400&&r.status<500;throw e;}
 return r.json();
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const port=Number(process.env.PORT||3038);
 createApp().listen(port,'127.0.0.1',()=>console.log('School IA: http://localhost:'+port));
}
