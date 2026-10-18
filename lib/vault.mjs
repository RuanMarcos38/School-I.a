import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
export function createVault(dir){
 const path=join(dir,'master.key');
 if(!existsSync(path))writeFileSync(path,randomBytes(32),{flag:'wx',mode:0o600});
 const master=readFileSync(path);
 if(master.length!==32)throw Error('Chave de armazenamento local inválida.');
 return {
  encrypt(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master,iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');},
  decrypt(value){const b=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',master,b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));return Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString('utf8');}
 };
}

