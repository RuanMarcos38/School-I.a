import {randomBytes,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
import {existsSync,writeFileSync,readFileSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
const digest=v=>createHash('sha256').update(v).digest('hex');
export function createAuth(db,dir,{localMode=true,allowPendingLogin=()=>false}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE,name TEXT,password TEXT,salt TEXT,admin INTEGER DEFAULT 0);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT,expires INTEGER);`);
 const columns=db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);
 const backup=join(dir,'before-access-approval.sqlite');if(!localMode&&!columns.includes('status')&&db.prepare('SELECT COUNT(*) n FROM users').get().n&&!existsSync(backup)){db.exec("VACUUM INTO '"+backup.replace(/'/g,"''")+"'");chmodSync(backup,0o600);}
 for(const [name,sql]of Object.entries({status:"TEXT DEFAULT 'pending'",created:"TEXT DEFAULT ''",last_seen:"TEXT DEFAULT ''"}))if(!columns.includes(name))db.exec('ALTER TABLE users ADD COLUMN '+name+' '+sql);
 db.prepare("UPDATE users SET status='approved' WHERE admin=1").run();
 if(localMode)db.prepare("INSERT OR IGNORE INTO users(id,email,name,password,salt,admin,status) VALUES('local-owner','local@school.invalid','Proprietário local','','',1,'approved')").run();
 const setupPath=join(dir,'setup-token.txt');
 if(!localMode&&!db.prepare('SELECT id FROM users WHERE password != ?').get('')&&!existsSync(setupPath))writeFileSync(setupPath,randomBytes(24).toString('hex'),{flag:'wx',mode:0o600});
 const attempts=new Map();
 function issue(user,res,secure){const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),user.id,Date.now()+86400000);res.setHeader('Set-Cookie','school_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400'+(secure?'; Secure':''));return user;}
 function safe(u){return u?{id:u.id,email:u.email,name:u.name,admin:!!u.admin,status:u.status,local:localMode&&u.id==='local-owner'}:null;}
 return {
  read(req){if(localMode)return db.prepare("SELECT * FROM users WHERE id='local-owner'").get();const token=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('school_session='))?.slice(15);if(!token)return null;const user=db.prepare("SELECT users.* FROM users JOIN sessions ON sessions.user_id=users.id WHERE sessions.token=? AND sessions.expires>? AND (users.status='approved' OR (users.status='pending' AND ?=1))").get(digest(token),Date.now(),allowPendingLogin()?1:0);if(user)db.prepare('UPDATE users SET last_seen=? WHERE id=? AND last_seen<?').run(new Date().toISOString(),user.id,new Date(Date.now()-60000).toISOString());return user;},
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
    db.prepare("INSERT INTO users(id,email,name,password,salt,admin,status,created) VALUES(?,?,?,?,?,1,'approved',?)").run(id,email,String(b.name||'Administrador').slice(0,100),scryptSync(password,salt,64).toString('hex'),salt,new Date().toISOString());
    return safe(issue(db.prepare('SELECT * FROM users WHERE id=?').get(id),res,!!process.env.PUBLIC_ORIGIN?.startsWith('https:')));
   }
   if(path==='/api/auth/register'){
    if(localMode||!db.prepare('SELECT id FROM users WHERE admin=1 AND password!=?').get(''))throw Error('Cadastro indisponível nesta instalação.');
    const name=String(b.name||'').trim();if(!name||name.length>100||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||password.length<12||password.length>256)throw Error('Informe nome, email válido e senha de 12 a 256 caracteres.');
    const ip=req.socket.remoteAddress,limit=attempts.get('register:'+ip)||{n:0,since:Date.now()};if(Date.now()-limit.since>3600000){limit.n=0;limit.since=Date.now();}if(limit.n>=20){const e=Error('Muitos cadastros. Tente novamente mais tarde.');e.status=429;throw e;}limit.n++;attempts.set('register:'+ip,limit);
    if(!db.prepare('SELECT id FROM users WHERE email=?').get(email)){const salt=randomBytes(16).toString('hex');db.prepare("INSERT INTO users(id,email,name,password,salt,admin,status,created) VALUES(?,?,?,?,?,0,'pending',?)").run(randomBytes(16).toString('hex'),email,name,scryptSync(password,salt,64).toString('hex'),salt,new Date().toISOString());}
    return {ok:true,pending:true,message:allowPendingLogin()?'Cadastro registrado. Entre para escolher um plano; o pagamento confirmado libera seu acesso.':'Solicitação registrada. O administrador precisa aprovar seu acesso. Se você já tem uma conta, faça login.'};
   }
   if(path==='/api/auth/login'){
    const ip=req.socket.remoteAddress,count=attempts.get(ip)||{n:0,since:Date.now()};
    if(Date.now()-count.since>600000){count.n=0;count.since=Date.now();}
    if(count.n>=10){const e=Error('Muitas tentativas. Aguarde 10 minutos.');e.status=429;throw e;}
    const user=db.prepare('SELECT * FROM users WHERE email=?').get(email),actual=scryptSync(password,user?.salt||'invalid',64),expected=Buffer.from(user?.password||'00'.repeat(64),'hex');
    if(!user||actual.length!==expected.length||!timingSafeEqual(actual,expected)){count.n++;attempts.set(ip,count);const e=Error('Email ou senha inválidos.');e.status=401;throw e;}
    if(user.status!=='approved'&&!(user.status==='pending'&&allowPendingLogin())){const e=Error(user.status==='pending'?'Seu acesso aguarda aprovação do administrador.':'Seu acesso não está liberado. Entre em contato com o administrador.');e.status=403;throw e;}
    attempts.delete(ip);return safe(issue(user,res,!!process.env.PUBLIC_ORIGIN?.startsWith('https:')));
   }
   throw Error('Operação de acesso inválida.');
  }
 };
}

