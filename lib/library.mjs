import {writeFileSync,readFileSync,existsSync,unlinkSync,copyFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
export async function importLibrary(db,dataDir,payload,inspect){
 if(!Array.isArray(payload.characters)||payload.characters.length>100||!Array.isArray(payload.media)||payload.media.length>500)throw Error('Pacote de biblioteca inválido.');
 const validated=[],temps=[];
 try{
  for(const m of payload.media){
   if(!/^[a-f0-9]{64}$/.test(m.id)||!['image/jpeg','image/png','image/webp'].includes(m.type)||typeof m.data!=='string'||m.data.length>14e6||!/^[A-Za-z0-9+/]*={0,2}$/.test(m.data))throw Error('Referência da biblioteca inválida.');
   const bytes=Buffer.from(m.data,'base64');if(!bytes.length||bytes.length>10*1024*1024)throw Error('Referência excede o limite.');
   const previous=db.prepare('SELECT user_id FROM media WHERE id=?').get(m.id);if(previous&&previous.user_id!=='library')throw Error('Identificador pertence a outro usuário.');
   const temp=join(dataDir,'processing','library-'+randomUUID());temps.push(temp);writeFileSync(temp,bytes,{flag:'wx'});const info=await inspect(temp,m.type);
   const dest=join(dataDir,'media',m.id);if(existsSync(dest)&&!readFileSync(dest).equals(bytes))throw Error('Referência existente difere do pacote. Nenhum arquivo foi substituído.');
   validated.push({id:m.id,temp,dest,size:bytes.length,...info});
  }
  const ids=new Set(validated.map(m=>m.id));
  for(const c of payload.characters){if(!/^library-[a-f0-9]{32}$/.test(c.id)||typeof c.name!=='string'||!c.name||c.name.length>100||typeof c.description!=='string'||!Array.isArray(c.images)||!c.images.length||c.images.length>8||c.images.some(id=>!ids.has(id)))throw Error('Ficha da biblioteca inválida.');const old=db.prepare('SELECT user_id FROM characters WHERE id=?').get(c.id);if(old&&old.user_id!=='library')throw Error('Ficha pertence a outro usuário.');}
  for(const m of validated)if(!existsSync(m.dest))copyFileSync(m.temp,m.dest);
  db.exec('BEGIN');try{
   for(const m of validated)db.prepare("INSERT OR IGNORE INTO media(id,type,size,duration,user_id,width,height) VALUES(?,?,?,0,'library',?,?)").run(m.id,m.type,m.size,m.width,m.height);
   for(const c of payload.characters)db.prepare("INSERT INTO characters(id,user_id,name,description,images,labels,source) VALUES(?,'library',?,?,?,?,'library') ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,images=excluded.images,labels=excluded.labels").run(c.id,c.name,c.description,JSON.stringify(c.images),JSON.stringify(c.labels||{}));
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  return {characters:payload.characters.length,references:validated.length};
 }finally{for(const temp of temps)try{unlinkSync(temp);}catch{}}
}
export function updateLibraryDescriptions(db,characters){
 if(!Array.isArray(characters)||characters.length>100)throw Error('Descrições inválidas.');
 db.exec('BEGIN');try{
  for(const c of characters){
   const row=db.prepare("SELECT id,images FROM characters WHERE user_id='library' AND name=?").get(c.name);if(!row||typeof c.description!=='string'||typeof c.descriptionPt!=='string'||!Array.isArray(c.images))throw Error('Descrição da biblioteca inválida.');
   const ids=JSON.parse(row.images),labels={};
   for(const image of c.images){const id=createHash('sha256').update(String(image.path)).digest('hex');if(!ids.includes(id)||typeof image.label!=='string'||image.label.length>100)throw Error('Referência da ficha não corresponde ao arquivo importado.');labels[id]=image.label;}
   db.prepare('UPDATE characters SET description=?,description_pt=?,labels=? WHERE id=?').run(c.description,c.descriptionPt,JSON.stringify(labels),row.id);
  }
  db.exec('COMMIT');return {updated:characters.length};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
