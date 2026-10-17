import {providerFailure} from './lib/provider-failure.mjs';
import {videoResolution} from './lib/video-settings.mjs';
import {createNotifications} from './lib/notifications.mjs';
import {createBilling} from './lib/billing.mjs';
import {createBalanceReader} from './lib/balance.mjs';
import {createAdministration} from './lib/admin.mjs';
import {createConnections} from './lib/connections.mjs';
import {importLibrary,updateLibraryDescriptions} from './lib/library.mjs';
import {importInstagramMedia,instagramMediaPacket} from './lib/instagram-media.mjs';
import {withInstagramSession} from './lib/instagram-session.mjs';
import {videoPrompt} from './lib/realism.mjs';
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,existsSync,unlinkSync,statSync,copyFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createVault} from './lib/vault.mjs';
import {createAuth} from './lib/auth.mjs';
import {createMcpGateway} from './lib/mcp.mjs';
import {createMultipartMcp} from './lib/mcp-multipart.mjs';
import {createProvider,VIDEO_MODEL,IMAGE_MODEL,characterPrompt,viewPrompt,views,imageSettings} from './lib/provider.mjs';
import {types,toolsReady,inspectMedia,receiveMedia,downloadMedia,streamMedia,splitVideo,concatenate,importSocial,socialURL} from './lib/media.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const active=['uploading','submitting','queued','in_progress','assembling','uncertain'];
const terminal=['completed','failed','nsfw','canceled'];
function error(message,status=400){const e=Error(message);e.status=status;return e;}
export function createApp({dataDir=process.env.DATA_DIR||join(root,'data'),provider:customProvider,mcpGateway:gatewayOverride,billingFetch=fetch,emailFetch=fetch,uploadFetch=fetch,pollInterval=10000,localMode=process.env.LOCAL_MODE!=='false',inspect=inspectMedia,download=downloadMedia,split=splitVideo,concat=concatenate,importer=importSocial,testMode=false}={}){
 mkdirSync(join(dataDir,'media'),{recursive:true});mkdirSync(join(dataDir,'processing'),{recursive:true});
 const db=new DatabaseSync(join(dataDir,'school.sqlite'));
 db.exec('CREATE TABLE IF NOT EXISTS imported_links(user_id TEXT,url TEXT,media_id TEXT,PRIMARY KEY(user_id,url));');
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL,folder TEXT NOT NULL DEFAULT '',favorite INTEGER NOT NULL DEFAULT 0,images TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,type TEXT NOT NULL,size INTEGER NOT NULL,duration REAL NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,character_id TEXT,name TEXT,request_id TEXT,status TEXT,error TEXT,result TEXT,created TEXT,favorite INTEGER DEFAULT 0);
 CREATE TABLE IF NOT EXISTS folders(name TEXT PRIMARY KEY);
 CREATE TABLE IF NOT EXISTS settings(user_id TEXT PRIMARY KEY,credential TEXT,verified TEXT);
 CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,job_id TEXT,part INTEGER,status TEXT,local_media TEXT,error TEXT);
 CREATE TABLE IF NOT EXISTS favorites(user_id TEXT,kind TEXT,target TEXT,PRIMARY KEY(user_id,kind,target));
 CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY);`);
 function columns(table,fields){const names=db.prepare('PRAGMA table_info('+table+')').all().map(c=>c.name);for(const [name,sql]of Object.entries(fields))if(!names.includes(name))db.exec('ALTER TABLE '+table+' ADD COLUMN '+name+' '+sql);}
 columns('characters',{description_pt:"TEXT DEFAULT ''",user_id:"TEXT DEFAULT 'local-owner'",source:"TEXT DEFAULT 'created'",labels:"TEXT DEFAULT '{}'",deleted:"INTEGER DEFAULT 0"});
 columns('media',{user_id:"TEXT DEFAULT 'local-owner'",width:'INTEGER DEFAULT 0',height:'INTEGER DEFAULT 0'});
 columns('jobs',{user_id:"TEXT DEFAULT 'local-owner'",kind:"TEXT DEFAULT 'video'",outputs:"TEXT DEFAULT '[]'",meta:"TEXT DEFAULT '{}'",hidden:'INTEGER DEFAULT 0'});
 // Original folders table is kept for migration only.
 db.exec('CREATE TABLE IF NOT EXISTS user_folders(user_id TEXT,name TEXT,PRIMARY KEY(user_id,name));');
 if(!db.prepare("SELECT name FROM migrations WHERE name='v1-data'").get()){
  db.prepare("INSERT OR IGNORE INTO user_folders SELECT 'local-owner',name FROM folders").run();
  db.prepare("INSERT OR IGNORE INTO favorites SELECT user_id,'character',id FROM characters WHERE favorite=1").run();
  db.prepare("INSERT OR IGNORE INTO favorites SELECT user_id,'job',id FROM jobs WHERE favorite=1").run();
  db.exec("UPDATE characters SET favorite=0; UPDATE jobs SET favorite=0; INSERT INTO migrations VALUES('v1-data');");
 }
 db.prepare("INSERT OR IGNORE INTO requests(id,job_id,part,status) SELECT request_id,id,0,status FROM jobs WHERE request_id IS NOT NULL AND status IN ('queued','in_progress')").run();
 const vault=createVault(dataDir),auth=createAuth(db,dataDir,{localMode,allowPendingLogin:()=>billing.autoApproval()}),mcpGateway=createMcpGateway({db,vault,onIdentity:(user,email)=>connections.setEmail(user,'mcp',email,'provider'),isEnabled:user=>connections.isEnabled(user,'mcp'),beforeReplace:user=>{if(db.prepare('SELECT status FROM users WHERE id=?').get(user)?.status!=='approved')throw Error('O acesso desta conta não está aprovado.');assertAccountChange(user);connections.capture(user,'mcp');},afterReplace:(user,label)=>connections.save(user,'mcp',label)}),connections=createConnections(db),mcp=createMultipartMcp({gateway:gatewayOverride||mcpGateway,db,vault}),administration=createAdministration(db);
 function assertAccountChange(user){if(billing.central().enabled&&billing.central().ownerId===user&&db.prepare("SELECT id FROM jobs WHERE status IN ('uploading','submitting','queued','in_progress','assembling','uncertain')").get())throw Error('Há gerações usando a API central. Aguarde antes de trocar a chave.');if(db.prepare("SELECT id FROM jobs WHERE user_id=? AND status IN ('uploading','submitting','queued','in_progress','assembling','uncertain')").get(user))throw Error('Aguarde ou resolva as gerações pendentes antes de trocar a conta.');}
 const balance=createBalanceReader({identity:user=>mcp.state(user).connected?connections.list(user).find(p=>p.kind==='mcp'&&p.active):null,read:user=>mcp.call(user,'balance')});
 const notifications=createNotifications(db,vault,{request:emailFetch}),billing=createBilling(db,vault,{request:billingFetch,notify:notifications.enqueue});
 const usesCentral=userId=>billing.central().enabled&&!db.prepare('SELECT admin FROM users WHERE id=?').get(userId)?.admin;
 const getKey=userId=>{if(usesCentral(userId))return billing.centralKey();return personalKey(userId);};
 const personalKey=userId=>{if(!connections.isEnabled(userId,'api'))return ''; const s=db.prepare('SELECT credential FROM settings WHERE user_id=?').get(userId);return s?.credential?vault.decrypt(s.credential):process.env.HF_API_KEY||'';};
 const call=(userId,path,method,input)=>customProvider?customProvider(path,method,input,{key:getKey(userId),userId}):createProvider(()=>getKey(userId))(path,method,input);
 const findMedia=(id,userId)=>db.prepare("SELECT * FROM media WHERE id=? AND user_id IN (?, 'library')").get(id,userId);
 const findCharacter=(id,userId)=>db.prepare("SELECT * FROM characters WHERE id=? AND user_id IN (?, 'library') AND deleted=0").get(id,userId);
 const favorite=(user,kind,id)=>!!db.prepare('SELECT target FROM favorites WHERE user_id=? AND kind=? AND target=?').get(user,kind,id);
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 function saveMedia(path,info,userId,label){
  const id=randomUUID(),dest=join(dataDir,'media',id);if(path!==dest)copyFileSync(path,dest);
  db.prepare('INSERT INTO media(id,type,size,duration,user_id,width,height) VALUES(?,?,?,?,?,?,?)').run(id,info.type,statSync(dest).size,info.duration||0,userId,info.width||0,info.height||0);
  return {id,url:'/media/'+id,...info,label};
 }
 function state(user){if(user.status==='pending')return {user:auth.safe(user),billing:billing.summary(user),characters:[],jobs:[],connections:[],folders:[],provider:{configured:false,central:true},mcp:{connected:false},tools:{},testMode};
  const characters=db.prepare("SELECT * FROM characters WHERE user_id IN (?, 'library') AND deleted=0 ORDER BY name").all(user.id).map(c=>({...c,images:JSON.parse(c.images),labels:JSON.parse(c.labels),favorite:favorite(user.id,'character',c.id)||user.id==='local-owner'&&!!c.favorite}));
  const presentJob=j=>({...j,outputs:JSON.parse(j.outputs),meta:(()=>{const meta=JSON.parse(j.meta);delete meta.snapshot;return meta;})(),favorite:favorite(user.id,'job',j.id)||user.id==='local-owner'&&!!j.favorite});
  const jobs=db.prepare('SELECT * FROM jobs WHERE user_id=? AND hidden=0 ORDER BY created DESC').all(user.id).map(presentJob);
  const gallery=db.prepare("SELECT * FROM jobs WHERE user_id=? AND kind='video' AND status='completed' AND hidden IN (0,1) ORDER BY created DESC").all(user.id).map(presentJob);
  const setting=db.prepare('SELECT verified FROM settings WHERE user_id=?').get(user.id);
  return {billing:billing.summary(user),testMode,connections:usesCentral(user.id)?[]:connections.list(user.id),mcp:usesCentral(user.id)?{connected:false}:mcp.state(user.id),user:auth.safe(user),characters,jobs,gallery,folders:db.prepare('SELECT name FROM user_folders WHERE user_id=? ORDER BY name').all(user.id).map(f=>f.name),provider:{central:usesCentral(user.id),configured:!!getKey(user.id),verified:setting?.verified||null,videoModel:VIDEO_MODEL,imageModel:IMAGE_MODEL,videoPromptLimit:10000,videoPromptOverhead:videoPrompt('','x').length-1},tools:{...toolsReady(),importer:existsSync(process.env.YTDLP_PATH||join(root,'vendor',process.platform==='win32'?'yt-dlp.exe':'yt-dlp'))}};
 }

 function retryRecord(user,id){const j=db.prepare("SELECT * FROM jobs WHERE id=? AND user_id=? AND kind='video'").get(id,user.id);if(!j||!['failed','canceled'].includes(j.status))throw Error('Somente vídeos com falha ou cancelamento podem ser preparados para novo envio.');const parts=db.prepare('SELECT status FROM requests WHERE job_id=?').all(j.id);if(parts.some(p=>['queued','in_progress','materializing','completed','nsfw'].includes(p.status)))throw Error('Há partes em andamento, concluídas ou recusadas. Confira o provedor antes de repetir a geração.');const meta=JSON.parse(j.meta);if(db.prepare("SELECT id FROM jobs WHERE user_id=? AND status='nsfw' AND json_extract(meta,'$.videoId')=?").get(user.id,meta.videoId))throw Error('Este vídeo foi recusado pelo provedor. Escolha outro material.');return {job:j,meta};}
 function generationInput(user,c,v,prompt,source,resolution){resolution=videoResolution(resolution);if(!c||!v?.type.startsWith('video/'))throw Error('Selecione personagem e vídeo.');let snapshot=null;if(source){const old=retryRecord(user,String(source));if(old.job.character_id!==c.id||old.meta.videoId!==v.id)throw Error('O vídeo ou personagem foi alterado. Prepare o novo envio novamente.');snapshot=old.meta.snapshot;}
 const promptText=String(prompt||''),description=snapshot?.description??c.description,references=snapshot?.references??JSON.parse(c.images).slice(0,5);if(references.some(id=>!findMedia(id,user.id)))throw Error('Uma referência do envio original não está disponível.');return {resolution,promptText,description,references,prompt:snapshot&&promptText===snapshot.promptText?snapshot.prompt:videoPrompt(description,promptText)};}
 function mcpInput(c,v,prompt,withoutProject=false,resolved){
  if(!c||!v?.type.startsWith('video/'))throw Error('Selecione personagem e vídeo.');
  if(v.width*v.height<409600)throw Error('Vídeo pequeno para o Genjutsu. Use um arquivo em 720p ou maior.');
  prompt=resolved?.prompt||videoPrompt(c.description,prompt);
  return {resolution:videoResolution(resolved?.resolution),withoutProject,duration:v.duration,prompt,video:{path:join(dataDir,'media',v.id),type:v.type},...(v.duration>30?{parts:[0,1].map(i=>({duration:v.duration/2,video:{path:join(dataDir,'processing','mcp-'+v.id,'part-'+i+'.mp4'),type:'video/mp4'}}))}:{}),references:(resolved?.references||JSON.parse(c.images).slice(0,5)).map(id=>{const r=findMedia(id,c.user_id==='library'?'library':c.user_id);if(!r)throw Error('Referência indisponível.');return {path:join(dataDir,'media',r.id),type:r.type};})};
 }
 const mcpSplits=new Map();
 async function prepareMcpParts(input){if(!input.parts)return;
  const path=input.video.path,dir=dirname(input.parts[0].video.path);
  if(!mcpSplits.has(path)){mkdirSync(dir,{recursive:true});const work=split(path,dir,input.duration).then(files=>{if(files.length!==2)throw Error('Não foi possível preparar as duas partes do vídeo.');}).catch(e=>{mcpSplits.delete(path);throw e;});mcpSplits.set(path,work);}
  await mcpSplits.get(path);
 }
 async function submitMcp(job,quote){let sent=false;try{
  changeJob(job.id,'submitting');mcp.claimBatch(job.user_id,quote);
  const parts=quote.parts||[quote];
  for(let i=0;i<parts.length;i++){
   sent=true;const result=await mcp.generate(job.user_id,parts[i]);
   if(!/^[a-zA-Z0-9_-]{1,200}$/.test(result.request_id))throw Error('Identificador da solicitação inválido.');
   db.prepare('INSERT INTO requests(id,job_id,part,status) VALUES(?,?,?,?)').run(result.request_id,job.id,i,'queued');
   db.prepare('UPDATE jobs SET request_id=? WHERE id=?').run(result.request_id,job.id);
  }
  changeJob(job.id,'queued');
 }catch(e){const accepted=!!db.prepare('SELECT id FROM requests WHERE job_id=?').get(job.id);changeJob(job.id,accepted||sent&&!e.definitive?'uncertain':'failed',accepted||sent&&!e.definitive?'Resposta incompleta. Confira a conta Higgsfield antes de reenviar; partes já aceitas foram preservadas.':e.message);}}


 async function uploadPath(userId,path,type){
  const signed=await call(userId,'/files/generate-upload-url','POST',{content_type:type});
  if(!signed.upload_url||!signed.public_url)throw Error('Resposta de upload inválida.');
  const u=new URL(signed.upload_url),publicURL=new URL(signed.public_url);
  if(u.protocol!=='https:'||publicURL.protocol!=='https:')throw Error('URL de upload inválida.');
  const r=await uploadFetch(u,{method:'PUT',headers:signed.upload_headers||{'Content-Type':type},body:readFileSync(path),signal:AbortSignal.timeout(180000)});
  if(!r.ok)throw Error('Falha ao enviar mídia ao Higgsfield.');
  return signed.public_url;
 }
 async function uploadId(userId,id){const m=findMedia(id,userId);if(!m)throw Error('Referência não encontrada.');return uploadPath(userId,join(dataDir,'media',id),m.type);}
 const background=new Set();let closed=false;
 function launch(work){const p=Promise.resolve().then(work).catch(()=>{});background.add(p);p.finally(()=>background.delete(p));}
 function changeJob(id,status,message=null){if(!closed)db.prepare('UPDATE jobs SET status=?,error=? WHERE id=?').run(status,message,id);}
 async function submit(job,inputs){
  let submitted=false;
  try{
   const refs=[];
   for(const id of inputs.references||[])refs.push(await uploadId(job.user_id,id));
   let payloads;
   if(job.kind==='video'){
    const m=findMedia(inputs.videoId,job.user_id),dir=join(dataDir,'processing',job.id);mkdirSync(dir,{recursive:true});
    const files=await split(join(dataDir,'media',m.id),dir,m.duration);payloads=[];
    for(const file of files)payloads.push({video_url:await uploadPath(job.user_id,file,'video/mp4'),image_urls:refs,prompt:inputs.prompt,resolution:videoResolution(inputs.resolution)});
   }else payloads=[{prompt:inputs.prompt,image_urls:refs,...imageSettings(inputs.quality)}];
   changeJob(job.id,'submitting');
   for(let i=0;i<payloads.length;i++){
    submitted=true;
    const s=await call(job.user_id,'/'+(job.kind==='video'?VIDEO_MODEL:IMAGE_MODEL),'POST',payloads[i]);
    if(!s.request_id||!/^[a-zA-Z0-9_-]{1,200}$/.test(s.request_id))throw Error('Provedor não retornou um identificador válido.');
    db.prepare('INSERT INTO requests(id,job_id,part,status) VALUES(?,?,?,?)').run(s.request_id,job.id,i,'queued');
    db.prepare('UPDATE jobs SET request_id=? WHERE id=?').run(s.request_id,job.id);
   }
   changeJob(job.id,'queued');
  }catch(e){
   // Earlier accepted parts remain tracked; do not resubmit them automatically.
   const hasAccepted=!!db.prepare('SELECT id FROM requests WHERE job_id=?').get(job.id);if((!submitted||e.definitive)&&!hasAccepted)billing.release(job.id);
   changeJob(job.id,hasAccepted||submitted&&!e.definitive?'uncertain':'failed',hasAccepted||submitted&&!e.definitive?'Resposta incompleta. Confira o console do provedor antes de reenviar.':e.message);
  }
 }
 async function materialize(job,request,response){
  const urls=job.kind==='video'?[response.video?.url]:(response.images||[]).map(i=>i.url);
  if(!urls.length||urls.some(u=>typeof u!=='string'||!u.startsWith('https://')))throw Error('Provedor concluiu sem mídia válida.');
  const outputs=[];
  for(let index=0;index<urls.length;index++){
   const temp=join(dataDir,'processing',randomUUID());
   try{
    await download(urls[index],temp,job.kind==='video'?400*1024*1024:20*1024*1024);
    const info=await inspect(temp,job.kind==='video'?'video/mp4':'image/png');
    const m=saveMedia(temp,info,job.user_id,JSON.parse(job.meta).view||'Card');outputs.push(m.id);
   }finally{try{unlinkSync(temp);}catch{}}
  }
  db.prepare("UPDATE requests SET status='completed',local_media=? WHERE id=?").run(JSON.stringify(outputs),request.id);
 }
 async function finish(job){
  const requests=db.prepare('SELECT * FROM requests WHERE job_id=? ORDER BY part').all(job.id);
  if(!requests.length||requests.some(r=>r.status!=='completed')||(JSON.parse(job.meta).expectedParts&&requests.length!==JSON.parse(job.meta).expectedParts))return;
  let outputs=requests.flatMap(r=>JSON.parse(r.local_media||'[]'));
  if(job.kind==='video'&&outputs.length>1){
   changeJob(job.id,'assembling');const path=join(dataDir,'processing',job.id+'-final.mp4');
   if(existsSync(path))unlinkSync(path);
   await concat(outputs.map(id=>join(dataDir,'media',id)),path);
   const m=saveMedia(path,await inspect(path,'video/mp4'),job.user_id);outputs=[m.id];unlinkSync(path);
  }
  db.prepare("UPDATE jobs SET status='completed',error=NULL,outputs=?,result=? WHERE id=?").run(JSON.stringify(outputs),'/media/'+outputs[0],job.id);
  if(job.kind==='view'&&job.character_id){
   const c=findCharacter(job.character_id,job.user_id);
   if(c&&c.user_id===job.user_id){
    const ids=JSON.parse(c.images),labels=JSON.parse(c.labels),view=JSON.parse(job.meta).view;
    for(const id of outputs){if(ids.length<8&&!ids.includes(id)){ids.push(id);labels[id]=view;}}
    db.prepare('UPDATE characters SET images=?,labels=? WHERE id=?').run(JSON.stringify(ids),JSON.stringify(labels),c.id);
   }
  }
 }
 let polling=false;
 async function poll(){
  if(polling||closed)return;polling=true;
  try{
   const requests=db.prepare("SELECT requests.*,jobs.user_id,jobs.kind FROM requests JOIN jobs ON jobs.id=requests.job_id WHERE requests.status IN ('queued','in_progress','materializing')").all();
   for(const r of requests){
    const job=db.prepare('SELECT * FROM jobs WHERE id=?').get(r.job_id);if(!job)continue;
    try{
     const s=JSON.parse(job.meta).transport==='mcp'?await mcp.status(job.user_id,r.id):await call(job.user_id,'/requests/'+encodeURIComponent(r.id)+'/status');
     if(s.status==='completed'){
      db.prepare("UPDATE requests SET status='materializing' WHERE id=?").run(r.id);await materialize(job,r,s);
     }else if(['queued','in_progress'].includes(s.status)){db.prepare('UPDATE requests SET status=? WHERE id=?').run(s.status,r.id);if(job.status!=='uncertain')changeJob(job.id,s.status);}
     else if(['failed','nsfw','canceled'].includes(s.status)){const failure=providerFailure(s);db.prepare('UPDATE requests SET status=?,error=? WHERE id=?').run(s.status,failure.reason,r.id);changeJob(job.id,s.status,failure.reason);}
    }catch(e){
     db.prepare('UPDATE requests SET error=? WHERE id=?').run(e.message,r.id);
     db.prepare('UPDATE jobs SET error=? WHERE id=?').run('Acompanhamento pendente: '+e.message,job.id);
    }
   }
   for(const j of db.prepare("SELECT * FROM jobs WHERE status IN ('queued','in_progress','assembling')").all()){
    try{await finish(j);}catch(e){changeJob(j.id,'failed','Falha ao preparar resultado: '+e.message);}
   }
  }finally{polling=false;}
 }
 const timer=setInterval(()=>launch(poll),pollInterval);timer.unref();
 const emailTimer=setInterval(()=>launch(notifications.flush),10000);emailTimer.unref();
 async function body(req,max=64*1024){
  let size=0,parts=[];for await(const part of req){size+=part.length;if(size>max)throw error('Solicitação muito grande.',413);parts.push(part);}
  try{return JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{throw error('Dados inválidos.');}
 }
 function validateReferences(ids,userId,max=8){
  if(!Array.isArray(ids)||ids.length>max||ids.some(id=>typeof id!=='string'||!findMedia(id,userId)?.type.startsWith('image/')))throw Error('Imagens de referência inválidas.');
  return [...new Set(ids)];
 }
 function newJob(user,kind,name,characterId,meta){
  if(db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE user_id=? AND status IN ('uploading','submitting','queued','in_progress')").get(user.id).n>=8)throw Error('Aguarde as solicitações em andamento.');
  const j={id:randomUUID(),user_id:user.id,kind,name,character_id:characterId};
  const charge=usesCentral(user.id)&&meta?.transport!=='mcp';if(charge)billing.preflight(user,billing.cost(kind,meta||{}));
  db.exec('BEGIN IMMEDIATE');try{if(charge)billing.reserve(user,j.id,billing.cost(kind,meta||{}));
  db.prepare('INSERT INTO jobs(id,user_id,kind,name,character_id,status,created,meta) VALUES(?,?,?,?,?,?,?,?)').run(j.id,user.id,kind,name,characterId||null,'uploading',new Date().toISOString(),JSON.stringify({...meta,...(charge?{central:true,platformCredits:billing.cost(kind,meta||{})}:{})}));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  return j;
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const origin=process.env.PUBLIC_ORIGIN||'http://localhost:'+server.address().port,allowed=new Set([origin,'http://127.0.0.1:'+server.address().port]);
  const allowedHosts=new Set([...allowed].map(o=>new URL(o).host));
  administration.observe(res);
  const publicGet=req.method==='GET'&&['/','/app.js','/request.js','/generation-validation.js','/billing.js','/video-cost.js','/admin.js','/style.css','/manifest.webmanifest','/sw.js','/icon-192.png','/icon-512.png','/instagram-helper.zip'].includes(String(req.url||'').split('?')[0]);
  const oauthCallback=req.method==='GET'&&String(req.url||'').split('?')[0]==='/api/mcp/callback';
  const asaasWebhook=req.method==='POST'&&String(req.url||'').split('?')[0]==='/api/billing/webhook';
  if(!allowedHosts.has(req.headers.host)||(req.headers['sec-fetch-site']==='cross-site'&&!publicGet&&!oauthCallback&&!asaasWebhook)){json(res,403,{error:'Origem não autorizada.'});return;}
  if(!asaasWebhook&&!['GET','HEAD'].includes(req.method)&&!allowed.has(req.headers.origin)){json(res,403,{error:'Origem não autorizada.'});return;}
  try{
   const url=new URL(req.url,origin),path=url.pathname,user=auth.read(req);
   if(asaasWebhook){json(res,200,await billing.webhook(req.headers['asaas-access-token'],await body(req,256*1024)));launch(notifications.flush);return;}
   if(path==='/api/mcp/callback'&&req.method==='GET'){await mcp.complete(url.searchParams.get('state'),url.searchParams.get('code'),url.searchParams.get('iss'));res.writeHead(303,{Location:'/#/config','Cache-Control':'no-store'});res.end();return;}
   if(path==='/api/auth/me'&&req.method==='GET'){json(res,200,{user:auth.safe(user),setupRequired:!localMode&&!db.prepare('SELECT id FROM users WHERE password != ?').get(''),localMode});return;}
   if(path.startsWith('/api/auth/')&&req.method==='POST'){json(res,200,await auth.action(path,await body(req),req,res));return;}
   const staticFiles={'/':'index.html','/app.js':'app.js','/request.js':'request.js','/generation-validation.js':'generation-validation.js','/billing.js':'billing.js','/video-cost.js':'video-cost.js','/admin.js':'admin.js','/style.css':'style.css','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png','/instagram-helper.zip':'instagram-helper.zip'};
   if(req.method==='GET'&&staticFiles[path]){const type=path.endsWith('.zip')?'application/zip':path.endsWith('.png')?'image/png':path.endsWith('.webmanifest')?'application/manifest+json':path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html';res.writeHead(200,{'Content-Type':type+(type==='image/png'?'':'; charset=utf-8'),'Cache-Control':'no-cache'});res.end(readFileSync(join(root,'public',staticFiles[path])));return;}
   if(!user){json(res,401,{error:'Entre na sua conta.'});return;}
   if(user.status==='pending'&&!['/api/state','/api/billing/subscribe','/api/billing/sync','/api/billing/cancel'].includes(path))throw error('Conclua o pagamento para liberar o acesso.',403);
   if(path.startsWith('/api/admin/')){if(!user.admin)throw error('Acesso exclusivo do administrador.',403);if(path==='/api/admin/dashboard'&&req.method==='GET'){json(res,200,{...administration.dashboard(),billing:{...billing.admin(),email:notifications.status()}});return;}if(req.method==='POST'){const input=await body(req);if(path==='/api/admin/payment-automation'){billing.configureAutomation(input.enabled);json(res,200,{ok:true});return;}if(path==='/api/admin/email'){notifications.configure(input);json(res,200,{ok:true});launch(notifications.flush);return;}if(path==='/api/admin/email-test'){notifications.enqueue('test:'+randomUUID(),user,{test:true,plan:'Teste de configuração',credits:0,amountCents:0,expires:new Date().toISOString(),allowed:true,first:true});await notifications.flush();json(res,200,notifications.status());return;}if(path==='/api/admin/central'){if(db.prepare("SELECT id FROM jobs WHERE status IN ('uploading','submitting','queued','in_progress','assembling','uncertain')").get())throw Error('Resolva as gerações pendentes antes de alterar a API central.');billing.configureCentral(user.id,input);json(res,200,{ok:true});return;}if(path==='/api/admin/asaas'){json(res,200,await billing.configureAsaas(input));return;}if(path==='/api/admin/asaas-webhook'){json(res,200,await billing.webhookSetup(origin,user.email));return;}if(path==='/api/admin/access'){json(res,200,administration.access(user.id,String(input.id),input.status));return;}if(path==='/api/admin/payments'){json(res,201,administration.payment(user.id,input));return;}if(path==='/api/admin/payment-status'){json(res,200,administration.paymentStatus(user.id,String(input.id),input.status));return;}}throw error('Operação administrativa não encontrada.',404);}
   if(usesCentral(user.id)&&(path.startsWith('/api/connections/')||path.startsWith('/api/provider/')||path.startsWith('/api/mcp/')))throw error('As conexões da plataforma são gerenciadas pelo administrador.',403);
   if(path==='/api/mcp/catalog'&&req.method==='GET'){json(res,200,await mcp.catalog(user.id));return;}
   if(path==='/api/balance'&&req.method==='GET'&&usesCentral(user.id)){json(res,200,{platform:{available:billing.summary(user).available},mcp:{connected:false,status:'unavailable'},refreshSeconds:30});return;}
   if(path==='/api/balance'&&req.method==='GET'){json(res,200,{mcp:await balance(user.id,{force:url.searchParams.get('refresh')==='1'}),api:{status:getKey(user.id)?'console':'disconnected',url:'https://open.higgsfield.ai/billing'},refreshSeconds:30});return;}
   if(path==='/api/state'&&req.method==='GET'){json(res,200,state(user));return;}
   if(path==='/api/jobs/trash'&&req.method==='GET'){json(res,200,{jobs:db.prepare('SELECT id,name,status,created FROM jobs WHERE user_id=? AND hidden=2 ORDER BY created DESC').all(user.id)});return;}
   if(path==='/api/archived'&&req.method==='GET'){json(res,200,{characters:db.prepare('SELECT id,name FROM characters WHERE user_id=? AND deleted=1 ORDER BY name').all(user.id)});return;}
   if(path==='/api/health'&&req.method==='GET'){if(!user.admin)throw error('Acesso exclusivo do administrador.',403);json(res,200,{database:db.prepare('PRAGMA integrity_check').get().integrity_check==='ok',...state(user).tools,providerConfigured:!!getKey(user.id)});return;}
   if(path.startsWith('/media/')&&req.method==='GET'){
    const m=findMedia(path.slice(7),user.id);if(!m)throw error('Arquivo não encontrado.',404);
    streamMedia(req,res,join(dataDir,'media',m.id),m.type,{download:url.searchParams.has('download'),name:'school-'+m.id+'.'+(types[m.type]||'bin')});return;
   }
   if(path==='/api/media'&&req.method==='POST'){
    const type=(req.headers['content-type']||'').split(';')[0];if(!types[type])throw Error('Use JPG, PNG, WEBP, MP4, MOV ou WEBM.');
    const image=type.startsWith('image/'),temp=join(dataDir,'processing',randomUUID());
    try{
     await receiveMedia(req,temp,image?10*1024*1024:300*1024*1024);
     const info=await inspect(temp,type),m=saveMedia(temp,info,user.id);json(res,201,m);
    }finally{try{unlinkSync(temp);}catch{}}
    return;
   }
   if(path.startsWith('/api/')&&req.method==='POST'){
    const promptRoute=['/api/generate','/api/generate-images','/api/characters','/api/mcp/video-estimate','/api/library/descriptions'].includes(path);
    const b=await body(req,path==='/api/library/import'&&user.admin?40*1024*1024:promptRoute?8*1024*1024:64*1024);
    if(path==='/api/billing/subscribe'){json(res,201,await billing.subscribe(user,b));return;}
    if(path==='/api/billing/sync'){json(res,200,await billing.syncOrder(user,String(b.id)));launch(notifications.flush);return;}
    if(path==='/api/billing/cancel'){json(res,200,await billing.cancel(user,String(b.id)));return;}
    if(path==='/api/library/import'){if(!user.admin)throw error('Apenas o administrador pode importar a biblioteca.',403);json(res,201,await importLibrary(db,dataDir,b,inspect));return;}
    if(path==='/api/library/descriptions'){if(!user.admin)throw error('Apenas o administrador pode atualizar a biblioteca.',403);json(res,200,updateLibraryDescriptions(db,b.characters));return;}
    if(path==='/api/connections/email'){connections.setEmail(user.id,b.kind,b.email);json(res,200,{ok:true});return;}
    if(path==='/api/connections/select'){assertAccountChange(user.id);const result=connections.select(user.id,String(b.id));json(res,200,result);return;}
    if(path==='/api/mcp/connect'){assertAccountChange(user.id);if(String(b.label||'').length>80)throw Error('Nome da conta excede 80 caracteres.');json(res,200,await mcp.start(user.id,origin,b.label));return;}
    if(path==='/api/mcp/cancel'){mcp.cancelPending(user.id);json(res,200,{ok:true});return;}
    if(path==='/api/mcp/poll'){json(res,200,await mcp.pollAuth(user.id));return;}
    if(path==='/api/mcp/verify'){json(res,200,await mcp.verify(user.id));return;}
    if(path==='/api/mcp/disconnect'){assertAccountChange(user.id);if(db.prepare("SELECT id FROM jobs WHERE user_id=? AND json_extract(meta,'$.transport')='mcp' AND status IN ('uploading','submitting','queued','in_progress','assembling','uncertain')").get(user.id))throw Error('Resolva as gerações MCP pendentes antes de desconectar.');mcp.disconnect(user.id);connections.disconnect(user.id,'mcp');json(res,200,{ok:true});return;}
    if(path==='/api/mcp/video-estimate'){const c=findCharacter(b.characterId,user.id),v=findMedia(b.videoId,user.id),input=generationInput(user,c,v,b.prompt,b.retrySourceId,b.resolution);if(input.prompt.length>10000)throw Error('O prompt completo excede 10.000 caracteres. Revise antes de estimar; nenhuma mídia foi enviada.');const prepared=mcpInput(c,v,b.prompt,b.withoutProject===true,input);await prepareMcpParts(prepared);const quote=await mcp.estimate(user.id,prepared,{choiceId:b.choiceId,literal:b.literal===true});if(quote.choiceRequired&&b.supportsPresetChoice!==true)throw Error('O Higgsfield sugeriu o efeito '+quote.presetName+'. Seu prompt foi preservado. Atualize a página para escolher Manter meu prompt. Nenhuma geração foi iniciada.');json(res,200,quote);return;}
    if(path==='/api/provider/connect'){if(b.email&&(typeof b.email!=='string'||b.email.length>254||!/^\S+@\S+\.\S+$/.test(b.email.trim())))throw Error('Informe um email válido para identificar a conta.');
     assertAccountChange(user.id);if(String(b.label||'').length>80)throw Error('Nome da conta excede 80 caracteres.');
     if(typeof b.key!=='string'||b.key.length<10||b.key.length>1000||/[\r\n]/.test(b.key))throw Error('Cole a chave completa do console Higgsfield.');
     if(db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE user_id=? AND status IN ('uploading','submitting','queued','in_progress','uncertain')").get(user.id).n)throw Error('Aguarde ou resolva a fila antes de trocar a chave.');
     // Verification is a read-only API call; no generation is submitted.
     const check=createProvider(()=>b.key.trim());
     if(!customProvider)await check('/models/higgsfield/genjutsu/restyle/v1.0/presets');
     else await customProvider('/models/higgsfield/genjutsu/restyle/v1.0/presets','GET',undefined,{key:b.key});
     assertAccountChange(user.id);connections.capture(user.id,'api');
     db.prepare('INSERT INTO settings VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET credential=excluded.credential,verified=excluded.verified').run(user.id,vault.encrypt(b.key.trim()),new Date().toISOString());
     connections.save(user.id,'api',b.label||'Conta Higgsfield');if(b.email)connections.setEmail(user.id,'api',b.email);
     json(res,200,{ok:true,message:'Chave validada e armazenada. Acesso aos modelos e saldo seguem o provedor.'});return;
    }
    if(path==='/api/provider/disconnect'){assertAccountChange(user.id);
     if(db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE user_id=? AND status IN ('uploading','submitting','queued','in_progress','uncertain')").get(user.id).n)throw Error('Há solicitações pendentes. Resolva a fila antes de desconectar.');
     connections.disconnect(user.id,'api');json(res,200,{ok:true});return;
    }
    if(path==='/api/provider/verify'){if(!getKey(user.id))throw error('Conecte uma conta Higgsfield em Configurações.',503);await call(user.id,'/models/higgsfield/genjutsu/restyle/v1.0/presets');db.prepare('UPDATE settings SET verified=? WHERE user_id=?').run(new Date().toISOString(),user.id);json(res,200,{ok:true});return;}
    if(path==='/api/characters'){
     const name=String(b.name||'').trim(),description=String(b.description||'');if(!name||name.length>100)throw Error('Nome ou descrição inválidos.');
     const images=validateReferences(b.images,user.id);if(!images.length)throw Error('Adicione pelo menos uma imagem.');
     if(b.folder&&!db.prepare('SELECT name FROM user_folders WHERE user_id=? AND name=?').get(user.id,b.folder))throw Error('Pasta não encontrada.');
     const existing=b.id&&findCharacter(b.id,user.id);if(b.id&&(!existing||existing.user_id!==user.id))throw error('Personagem da biblioteca é somente leitura.',403);
     const id=b.id||randomUUID(),labels=existing?JSON.parse(existing.labels):{};
     db.prepare('INSERT INTO characters(id,user_id,name,description,folder,images,labels) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,folder=excluded.folder,images=excluded.images,labels=excluded.labels').run(id,user.id,name,description,b.folder||'',JSON.stringify(images),JSON.stringify(labels));
     json(res,201,{id});return;
    }
    if(path==='/api/characters/clone'){
     const c=findCharacter(b.id,user.id);if(!c)throw error('Personagem não encontrado.',404);
     const id=randomUUID();db.prepare("INSERT INTO characters(id,user_id,name,description,images,labels,description_pt) VALUES(?,?,?,?,?,?,?)").run(id,user.id,c.name+' (cópia)',c.description,c.images,c.labels,c.description_pt||'');json(res,201,{id});return;
    }
    if(path==='/api/characters/archive'||path==='/api/characters/restore'){
     const c=db.prepare('SELECT * FROM characters WHERE id=? AND user_id=?').get(b.id,user.id);if(!c)throw error('Personagem não encontrado.',404);
     if(path.endsWith('archive')&&db.prepare("SELECT id FROM jobs WHERE character_id=? AND status IN ('uploading','submitting','queued','in_progress','uncertain')").get(c.id))throw Error('Personagem com geração em andamento.');
     db.prepare('UPDATE characters SET deleted=? WHERE id=?').run(path.endsWith('archive')?1:0,c.id);json(res,200,{ok:true});return;
    }
    if(path==='/api/characters/cover'){
     const c=findCharacter(b.id,user.id);if(!c||c.user_id!==user.id)throw error('Personagem não editável.',403);
     const images=JSON.parse(c.images);if(!images.includes(b.imageId))throw Error('Imagem não pertence ao personagem.');
     db.prepare('UPDATE characters SET images=? WHERE id=?').run(JSON.stringify([b.imageId,...images.filter(i=>i!==b.imageId)]),c.id);json(res,200,{ok:true});return;
    }
    if(path==='/api/folders'){
     const name=String(b.name||'').trim();if(!name||name.length>100)throw Error('Informe um nome de até 100 caracteres.');
     db.prepare('INSERT OR IGNORE INTO user_folders VALUES(?,?)').run(user.id,name);json(res,201,{name});return;
    }
    if(path==='/api/folders/rename'){
     const name=String(b.name||'').trim();if(!name||name.length>100)throw Error('Nome inválido.');
     if(!db.prepare('SELECT name FROM user_folders WHERE user_id=? AND name=?').get(user.id,b.oldName))throw Error('Pasta não encontrada.');
     db.exec('BEGIN');try{db.prepare('UPDATE user_folders SET name=? WHERE user_id=? AND name=?').run(name,user.id,b.oldName);db.prepare('UPDATE characters SET folder=? WHERE user_id=? AND folder=?').run(name,user.id,b.oldName);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}json(res,200,{ok:true});return;
    }
    if(path==='/api/favorite'){
     const kind=b.kind==='job'?'job':'character',item=kind==='job'?db.prepare('SELECT id FROM jobs WHERE id=? AND user_id=?').get(b.id,user.id):findCharacter(b.id,user.id);
     if(!item)throw error('Item não encontrado.',404);
     if(favorite(user.id,kind,b.id))db.prepare('DELETE FROM favorites WHERE user_id=? AND kind=? AND target=?').run(user.id,kind,b.id);
     else db.prepare('INSERT INTO favorites VALUES(?,?,?)').run(user.id,kind,b.id);
     json(res,200,{ok:true});return;
    }
    if(path==='/api/import-instagram-media'){
     const packet=instagramMediaPacket(b),temp=join(dataDir,'processing',randomUUID()+'.mp4');
     try{
      const info=await importInstagramMedia(b,temp);
      if(statSync(temp).size>300*1024*1024)throw Error('Vídeo excede 300 MB.');
      const media=saveMedia(temp,info,user.id);
      db.prepare('INSERT INTO imported_links(user_id,url,media_id) VALUES(?,?,?) ON CONFLICT(user_id,url) DO UPDATE SET media_id=excluded.media_id').run(user.id,packet.url,media.id);
      json(res,201,media);
     }finally{try{unlinkSync(temp);}catch{}}
     return;
    }
    if(path==='/api/import-link'||path==='/api/import-instagram-session'){
     const link=new URL(socialURL(String(b.url||'')));link.search='';link.hash='';
     if(path==='/api/import-instagram-session'&&!['instagram.com','www.instagram.com'].includes(link.hostname))throw Error('A sessão só pode ser usada para links Instagram.');
     const canonical=link.hostname.includes('instagram.com')&&/^\/(?:p|reel|reels)\/[-_a-zA-Z0-9]+\/?$/.test(link.pathname)?'https://www.instagram.com/p/'+link.pathname.split('/')[2]+'/':link.href;
     const cached=db.prepare('SELECT media_id FROM imported_links WHERE user_id=? AND url=?').get(user.id,canonical);
     if(cached){const media=findMedia(cached.media_id,user.id);if(media&&existsSync(join(dataDir,'media',media.id))){json(res,200,{...media,url:'/media/'+media.id,cached:true});return;}}
     const temp=join(dataDir,'processing',randomUUID()+'.mp4');
     try{
      const info=path==='/api/import-instagram-session'?await withInstagramSession(b.cookies,cookieFile=>importer(canonical,temp,root,{cookieFile})):await importer(canonical,temp,root);
      if(statSync(temp).size>300*1024*1024)throw Error('Vídeo excede 300 MB.');
      const media=saveMedia(temp,info,user.id);db.prepare('INSERT INTO imported_links(user_id,url,media_id) VALUES(?,?,?) ON CONFLICT(user_id,url) DO UPDATE SET media_id=excluded.media_id').run(user.id,canonical,media.id);json(res,201,media);
     }finally{try{unlinkSync(temp);}catch{}}
     return;
    }
    if(path==='/api/jobs/diagnostic'){
     const j=db.prepare('SELECT * FROM jobs WHERE id=? AND user_id=?').get(b.id,user.id);if(!j)throw error('Solicitação não encontrada.',404);
     const parts=db.prepare('SELECT id,part,status FROM requests WHERE job_id=? ORDER BY part').all(j.id),results=[];
     for(const part of parts){try{const result=JSON.parse(j.meta).transport==='mcp'?await mcp.status(user.id,part.id):await call(user.id,'/requests/'+encodeURIComponent(part.id)+'/status');const failure=providerFailure(result);results.push({part:part.part+1,status:result.status,...(['failed','nsfw','canceled'].includes(result.status)?failure:{reason:'Situação atual consultada no provedor.',code:null})});if(['failed','nsfw','canceled'].includes(j.status)&&result.status===j.status){db.prepare('UPDATE requests SET error=? WHERE id=?').run(failure.reason,part.id);db.prepare('UPDATE jobs SET error=? WHERE id=? AND user_id=?').run(failure.reason,j.id,user.id);}}catch(e){results.push({part:part.part+1,status:'unavailable',reason:'Não foi possível consultar esta solicitação agora. Confira a conta conectada e tente consultar novamente.',code:null});}}
     json(res,200,{parts:results,message:parts.length?'Consulta de solicitações existentes; nenhuma geração ou cobrança nova foi iniciada.':'O envio não chegou a receber um identificador do provedor. Confira a mensagem do item.'});return;
    }
    if(path==='/api/jobs/reuse-video'){const old=retryRecord(user,String(b.id)),v=findMedia(old.meta.videoId,user.id),c=findCharacter(old.job.character_id,user.id);if(!v||!existsSync(join(dataDir,'media',v.id))||!c)throw Error('O vídeo ou personagem original não está mais disponível.');json(res,200,{sourceId:old.job.id,characterId:c.id,video:{id:v.id,type:v.type,duration:v.duration,width:v.width,height:v.height,size:v.size,url:'/media/'+v.id,name:'Vídeo do envio anterior'},promptText:old.meta.snapshot?.promptText??null,resolution:old.meta.resolution||old.meta.snapshot?.resolution||'1080p',transport:old.meta.transport||'api',withoutProject:old.meta.withoutProject===true,hasSnapshot:!!old.meta.snapshot});return;}
    if(path==='/api/generate'){
     const transport=b.transport||'api';if(!['api','mcp'].includes(transport))throw Error('Conexão inválida.');
     if(transport==='mcp'&&mcp.state(user.id).pending)throw Error('Conclua ou cancele a troca de conta MCP antes de gerar.');
     if(transport==='api'&&!getKey(user.id))throw error('Conecte sua chave Higgsfield em Configurações.',503);
     const c=findCharacter(b.characterId,user.id),v=findMedia(b.videoId,user.id);if(!c||!v?.type.startsWith('video/'))throw Error('Selecione personagem e vídeo.');
     if(v.width*v.height<409600)throw Error('Vídeo pequeno para o Genjutsu. Use um arquivo em 720p ou maior.');
     const input=generationInput(user,c,v,b.prompt,b.retrySourceId,b.resolution),prompt=input.prompt;if(prompt.length>10000)throw Error('O prompt completo tem '+prompt.length+' caracteres; o Genjutsu aceita até 10.000. Seu texto foi preservado. Revise antes de enviar; nenhuma geração foi iniciada.');
     if(db.prepare("SELECT id FROM jobs WHERE user_id=? AND character_id=? AND json_extract(meta,'$.videoId')=? AND status IN ('uploading','submitting','queued','in_progress','uncertain')").get(user.id,c.id,v.id))throw Error('Este personagem já tem geração em andamento com este vídeo.');
     const quote=transport==='mcp'?mcp.consumeQuote(user.id,b.quoteId,mcpInput(c,v,b.prompt,b.withoutProject===true,input),Number(b.maxCredits)):null;
     const j=newJob(user,'video',c.name,c.id,{duration:v.duration,resolution:input.resolution,videoId:v.id,transport,snapshot:input,withoutProject:b.withoutProject===true,...(b.retrySourceId?{sourceJobId:b.retrySourceId}:{}),...(quote?{credits:quote.cost,...(quote.parts?{expectedParts:quote.parts.length}:{})}:{})});
     launch(()=>quote?submitMcp(j,quote):submit(j,{references:input.references,videoId:v.id,prompt,resolution:input.resolution}));json(res,202,{id:j.id});return;
    }
    if(path==='/api/generate-images'){
     if(!getKey(user.id))throw error('Conecte sua chave Higgsfield em Configurações.',503);
     const name=String(b.name||'').trim(),description=String(b.description||'').trim(),options=Number(b.options||2);
     if(!name||name.length>100||!description||!Number.isInteger(options)||options<1||options>4)throw Error('Informe nome, descrição e de 1 a 4 opções.');
     if(db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE user_id=? AND status IN ('uploading','submitting','queued','in_progress')").get(user.id).n+options>8)throw Error('Aguarde a fila antes de gerar todas as opções.');
     const quality=b.quality||'standard',framing=b.framing||'portrait';imageSettings(quality);characterPrompt(description,framing);
     const references=validateReferences(b.references||[],user.id,3),batch=randomUUID(),ids=[];if(usesCentral(user.id))billing.preflight(user,options*billing.cost('image',{quality}));
     for(let i=0;i<options;i++){const j=newJob(user,'image',name,null,{batch,description,option:i+1,quality,framing});ids.push(j.id);launch(()=>submit(j,{references,prompt:characterPrompt(description,framing),quality}));}
     json(res,202,{ids,batch});return;
    }
    if(path==='/api/generate-view'){
     if(!getKey(user.id))throw error('Conecte sua chave Higgsfield em Configurações.',503);
     const c=findCharacter(b.characterId,user.id);if(!c||c.user_id!==user.id)throw error('Faça uma cópia do personagem da biblioteca para criar vistas.',403);
     if(JSON.parse(c.images).length>=8)throw Error('Limite de 8 referências por personagem.');
     const prompt=viewPrompt(c.description,b.view);
     if(db.prepare("SELECT id FROM jobs WHERE user_id=? AND character_id=? AND kind='view' AND status IN ('uploading','submitting','queued','in_progress','uncertain')").get(user.id,c.id))throw Error('Aguarde a vista em andamento.');
     const j=newJob(user,'view',c.name,c.id,{view:b.view});launch(()=>submit(j,{references:JSON.parse(c.images).slice(0,3),prompt}));json(res,202,{id:j.id});return;
    }
    if(path==='/api/cancel'){
     const j=db.prepare('SELECT * FROM jobs WHERE id=? AND user_id=?').get(b.id,user.id);if(!j||!['queued','in_progress'].includes(j.status))throw Error('Solicitação não pode ser cancelada neste estágio.');
     if(JSON.parse(j.meta).transport==='mcp')throw Error('Para interromper uma geração MCP, use o painel oficial Higgsfield.');
     const requests=db.prepare("SELECT * FROM requests WHERE job_id=? AND status IN ('queued','in_progress')").all(j.id);
     for(const r of requests)await call(user.id,'/requests/'+encodeURIComponent(r.id)+'/cancel','POST');
     json(res,200,{ok:true,message:'Cancelamento solicitado. Aguarde confirmação do provedor.'});return;
    }
    if(path==='/api/reconcile'){
     const j=db.prepare("SELECT * FROM jobs WHERE id=? AND user_id=? AND status='uncertain'").get(b.id,user.id);
     if(!j||!b.requestId||!/^[a-zA-Z0-9_-]{1,200}$/.test(b.requestId))throw Error('Solicitação ou identificador inválidos.');
     const tracked=db.prepare('SELECT job_id FROM requests WHERE id=?').get(b.requestId);
     if(tracked&&tracked.job_id!==j.id)throw error('Identificador já vinculado a outra solicitação.',403);
     if(!user.admin&&!db.prepare('SELECT credential FROM settings WHERE user_id=?').get(user.id)?.credential)throw error('Reconciliação com chave compartilhada exige o administrador.',403);
     await call(user.id,'/requests/'+encodeURIComponent(b.requestId)+'/status');
     db.prepare("INSERT OR IGNORE INTO requests(id,job_id,part,status) VALUES(?,?,0,'queued')").run(b.requestId,j.id);
     db.prepare("UPDATE jobs SET status='queued',error=NULL,request_id=? WHERE id=?").run(b.requestId,j.id);json(res,200,{ok:true});return;
    }
    if(path==='/api/jobs/delete'){
     const j=db.prepare('SELECT * FROM jobs WHERE id=? AND user_id=?').get(b.id,user.id);
     if(!j||!['failed','canceled','nsfw'].includes(j.status))throw error('Somente solicitações com erro, recusadas ou canceladas podem ser excluídas.',400);
     if(db.prepare("SELECT id FROM requests WHERE job_id=? AND status IN ('queued','in_progress','materializing')").get(j.id))throw error('Aguarde a conclusão das partes em andamento antes de excluir.',400);
     db.prepare('UPDATE jobs SET hidden=2 WHERE id=? AND user_id=?').run(j.id,user.id);json(res,200,{ok:true});return;
    }
    if(path==='/api/jobs/restore'){
     const restored=db.prepare('UPDATE jobs SET hidden=0 WHERE id=? AND user_id=? AND hidden=2').run(b.id,user.id);
     if(!restored.changes)throw error('Solicitação não encontrada na sua lixeira.',404);json(res,200,{ok:true});return;
    }
    if(path==='/api/jobs/hide'){
     const j=db.prepare('SELECT * FROM jobs WHERE id=? AND user_id=?').get(b.id,user.id);if(!j||active.includes(j.status))throw Error('Resolva a solicitação antes de arquivar.');
     db.prepare('UPDATE jobs SET hidden=1 WHERE id=?').run(j.id);json(res,200,{ok:true});return;
    }
    throw error('Operação não encontrada.',404);
   }
   throw error('Página não encontrada.',404);
  }catch(e){if(!res.headersSent)json(res,e.status&&e.status<600?e.status:400,{error:e.message||'Falha na operação.'});else res.destroy();}
 });
 // A restart never retries a billable submission automatically.
 db.prepare("UPDATE jobs SET status='uncertain',error='Processo interrompido. Confira a solicitação no console antes de reenviar.' WHERE status IN ('uploading','submitting')").run();
 server.on('close',()=>{closed=true;clearInterval(timer);clearInterval(emailTimer);Promise.allSettled([...background]).finally(()=>db.close());});
 server.school={db,poll,state,background};
 return server;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const port=Number(process.env.PORT||3038),localMode=process.env.LOCAL_MODE!=='false';
 if(!localMode&&!process.env.PUBLIC_ORIGIN)throw Error('PUBLIC_ORIGIN é obrigatório no modo com login.');
 createApp({localMode}).listen(port,localMode?'127.0.0.1':'0.0.0.0',()=>console.log('School IA: http://localhost:'+port+' · '+(localMode?'modo local':'modo com login')));
}