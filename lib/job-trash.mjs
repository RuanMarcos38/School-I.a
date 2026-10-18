// Clear only the confirmed user's terminal trash entries. Media and audit records stay intact.
const terminal=new Set(['completed','failed','canceled','nsfw']);
export function emptyJobTrash(db,userId,ids,confirmation){
 if(confirmation!=='EMPTY_TRASH'||!Array.isArray(ids)||!ids.length||ids.length>1000||ids.some(id=>typeof id!=='string'||!id))throw Error('Confirmação inválida. Abra a lixeira e tente novamente.');
 const unique=[...new Set(ids)];
 db.exec('BEGIN IMMEDIATE');
 try{
  const rows=unique.map(id=>db.prepare('SELECT id,status FROM jobs WHERE id=? AND user_id=? AND hidden=2').get(id,userId)).filter(Boolean);
  for(const row of rows){
   if(!terminal.has(row.status)||db.prepare("SELECT id FROM requests WHERE job_id=? AND status NOT IN ('completed','failed','canceled','nsfw')").get(row.id))throw Error('Há solicitações pendentes na lixeira. Resolva o processamento antes de esvaziar.');
  }
  for(const row of rows)db.prepare('UPDATE jobs SET hidden=3 WHERE id=? AND user_id=? AND hidden=2').run(row.id,userId);
  db.exec('COMMIT');return {count:rows.length,ids:rows.map(row=>row.id)};
 }catch(e){db.exec('ROLLBACK');throw e;}
}
