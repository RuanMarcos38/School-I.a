import {readFileSync,copyFileSync,existsSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createApp} from '../server.mjs';
import {inspectMedia} from '../lib/media.mjs';
const metaPath=process.argv[2],assetsPath=process.argv[3],dataDir=resolve(process.argv[4]||'data');
if(!metaPath||!assetsPath)throw Error('Informe os arquivos de biblioteca visível e assets.');
const characters=JSON.parse(readFileSync(metaPath,'utf8')),bundle=JSON.parse(readFileSync(assetsPath,'utf8'));
const assets=new Map(bundle.assets.map(a=>[a.url,a])),base=resolve(bundle.directoryPath);
const server=createApp({dataDir,localMode:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const db=server.school.db;
let total=0;
try{
 for(const c of characters){
  const ids=[],labels={};
  for(const image of c.images){
   const asset=assets.get(image.url);if(!asset)throw Error('Referência não encontrada: '+c.name);
   const path=resolve(asset.path);if(!path.startsWith(base+'\\')&&!path.startsWith(base+'/'))throw Error('Arquivo fora do pacote exportado.');
   const id=createHash('sha256').update(new URL(image.url).pathname).digest('hex'),dest=join(dataDir,'media',id);
   if(!existsSync(dest))copyFileSync(path,dest);
   const info=await inspectMedia(dest,'image/jpeg');
   db.prepare("INSERT OR IGNORE INTO media(id,type,size,duration,user_id,width,height) VALUES(?,?,?,0,'library',?,?)").run(id,info.type,statSync(dest).size,info.width,info.height);
   ids.push(id);labels[id]=image.label;total++;
  }
  const id='library-'+createHash('sha256').update(c.name).digest('hex').slice(0,32);
  db.prepare("INSERT INTO characters(id,user_id,name,description,images,labels,source) VALUES(?,'library',?,?,?,?,'library') ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,images=excluded.images,labels=excluded.labels").run(id,c.name,c.description,JSON.stringify(ids),JSON.stringify(labels));
 }
 console.log('Biblioteca importada: '+characters.length+' personagens, '+total+' referências.');
}finally{await new Promise(r=>server.close(r));}

