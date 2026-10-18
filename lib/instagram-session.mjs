import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
export function instagramCookies(cookies){
 if(!Array.isArray(cookies)||!cookies.length||cookies.length>3)throw Error('Sessão Instagram inválida.');
 const lines=['# Netscape HTTP Cookie File'];let session=false;
 for(const c of cookies){
  if(!c||!['sessionid','csrftoken','ds_user_id'].includes(c.name)||!['.instagram.com','instagram.com','www.instagram.com'].includes(c.domain)||typeof c.value!=='string'||c.value.length>12000||/[\r\n\t\0]/.test(c.name+c.value+String(c.path||'')))throw Error('Sessão Instagram inválida.');
  if(c.name==='sessionid'&&c.value)session=true;
  const expires=c.session?0:Math.floor(Number(c.expirationDate)||0);
  lines.push((c.httpOnly?'#HttpOnly_':'')+c.domain+'\t'+(c.domain.startsWith('.')?'TRUE':'FALSE')+'\t'+(c.path||'/')+'\t'+(c.secure?'TRUE':'FALSE')+'\t'+expires+'\t'+c.name+'\t'+c.value);
 }
 if(!session)throw Error('Entre no Instagram neste perfil do Chrome antes de importar.');
 const result=lines.join('\n')+'\n';if(Buffer.byteLength(result)>65536)throw Error('Sessão Instagram excede o limite.');return result;
}
export async function withInstagramSession(cookies,operation){
 const text=instagramCookies(cookies);
 // Linux production uses memory-backed storage, outside the persistent volume.
 const base=process.platform==='linux'&&existsSync('/dev/shm')?'/dev/shm':tmpdir();
 const dir=mkdtempSync(join(base,'fieldsia-instagram-')),path=join(dir,'session.txt');
 try{writeFileSync(path,text,{mode:0o600,flag:'wx'});return await operation(path);}
 finally{try{unlinkSync(path);}finally{rmdirSync(dir);}}
}
