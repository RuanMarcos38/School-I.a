import {randomBytes,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
import {existsSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const digest=v=>createHash('sha256').update(v).digest('hex');
export function createAuth(db,dir,{localMode=true}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,name TEXT,password TEXT,salt TEXT,admin INTEGER DEFAULT 0);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT,expires INTEGER);`);
 if(localMode)db.prepare("INSERT OR IGNORE INTO users VALUES('local-owner','local@school.invalid','Proprietário local','','',1)").run();
 const setupPath=join(dir,'setup-token.txt');
 if(!localMode&&!db.prepare('SELECT id FROM users WHERE password != ?').get('')&&!existsSync(setupPath))writeFileSync(setupPath,randomBytes(24).toString('hex'),{flag:'wx',mode:0o600});
 const attempts=new Map();
 function issue(user,res,secure){const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),user.id,Date.now()+86400000);res.setHeader('Set-Cookie','school_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400'+(secure?'; Secure':''));return user;}
 function safe(u){return u?{id:u.id,email:u.email,name:u.name,admin:!!u.admin,local:localMode&&u.id==='local-owner'}:null;}
 return {
  read(req){if(localMode)return db.prepare("SELECT * FROM users WHERE id='local-owner'").get();const token=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('school_session='))?.slice(15);if(!token)return null;return db.prepare('SELECT users.* FROM users JOIN sessions ON sessions.user_id=users.id WHERE sessions.token=? AND sessions.expires>?').get(digest(token),Date.now());},
  safe,
  async action(path,b,req,res){
   if(path==='/api/auth/logout'){const token=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('school_session='))?.slice(15);if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));res.setHeader('Set-Cookie','school_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return {ok:true};}
   const password=String(b.password||''),email=String(b.email||'').trim().toLowerCase();
   if(path==='/api/auth/setup'){
    if(localMode||db.prepare('SELECT id FROM users WHERE password != ?').get(''))throw Error('A configuração inicial já foi concluída.');
    const expected=readFileSync(setupPath,'utf8').trim(),provided=typeof b.token==='string'?b.token.trim():'';
    if(!/^[a-f0-9]{48}$/.test(provided))throw Error('Cole somente os 48 caracteres do token de instalação, sem o comando ou o texto do terminal.');
    if(!/^[a-f0-9]{48}$/.test(expected))throw Error('Arquivo de configuração inválido no servidor. Verifique a instalação no EasyPanel.');
    if(!timingSafeEqual(Buffer.from(digest(provided),'hex'),Buffer.from(digest(expected),'hex')))throw Error('O token não corresponde a esta instalação. Copie novamente do serviço fieldsia no EasyPanel.');
    if(password.length<12||!/^\S+@\S+\.\S+$/.test(email))throw Error('Informe email válido e senha com ao menos 12 caracteres.');
    const salt=randomBytes(16).toString('hex'),id=randomBytes(16).toString('hex');
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,1)').run(id,email,String(b.name||'Administrador').slice(0,100),scryptSync(password,salt,64).toString('hex'),salt);
    return safe(issue(db.prepare('SELECT * FROM users WHERE id=?').get(id),res,!!process.env.PUBLIC_ORIGIN?.startsWith('https:')));
   }
   if(path==='/api/auth/login'){
    const ip=req.socket.remoteAddress,count=attempts.get(ip)||{n:0,since:Date.now()};
    if(Date.now()-count.since>600000){count.n=0;count.since=Date.now();}
    if(count.n>=10){const e=Error('Muitas tentativas. Aguarde 10 minutos.');e.status=429;throw e;}
    const user=db.prepare('SELECT * FROM users WHERE email=?').get(email),actual=scryptSync(password,user?.salt||'invalid',64),expected=Buffer.from(user?.password||'00'.repeat(64),'hex');
    if(!user||actual.length!==expected.length||!timingSafeEqual(actual,expected)){count.n++;attempts.set(ip,count);const e=Error('Email ou senha inválidos.');e.status=401;throw e;}
    attempts.delete(ip);return safe(issue(user,res,!!process.env.PUBLIC_ORIGIN?.startsWith('https:')));
   }
   throw Error('Operação de acesso inválida.');
  }
 };
}

