import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const pnpm=process.env.PNPM_PATH||'pnpm';
if(!existsSync(join(root,'node_modules','sharp'))){
 const r=spawnSync(pnpm,['install','--frozen-lockfile'],{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
 if(r.status!==0)throw Error('Instale as dependências com pnpm install.');
}
if(!existsSync(join(root,'node_modules','ffmpeg-static',process.platform==='win32'?'ffmpeg.exe':'ffmpeg'))){
 const r=spawnSync(process.execPath,[join(root,'node_modules','ffmpeg-static','install.js')],{cwd:root,stdio:'inherit'});
 if(r.status!==0)throw Error('Falha ao instalar FFmpeg.');
}
if(process.platform==='win32'&&!existsSync(join(root,'vendor','yt-dlp.exe'))){
 const base='https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
 const response=await fetch(base+'yt-dlp.exe',{signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error('Falha ao baixar o importador oficial.');
 const binary=Buffer.from(await response.arrayBuffer());
 const sums=await fetch(base+'SHA2-256SUMS',{signal:AbortSignal.timeout(30000)});
 if(!sums.ok)throw Error('Falha ao obter checksum.');
 const line=(await sums.text()).split('\n').find(l=>l.trimEnd().endsWith('  yt-dlp.exe'));
 if(!line||createHash('sha256').update(binary).digest('hex')!==line.split(' ')[0])throw Error('Checksum do importador incompatível.');
 mkdirSync(join(root,'vendor'),{recursive:true});writeFileSync(join(root,'vendor','yt-dlp.exe'),binary);
}
if(!existsSync(join(root,'.env')))writeFileSync(join(root,'.env'),'PORT=3038\nLOCAL_MODE=true\nHF_API_KEY=\n');
console.log('Configuração local concluída. Execute pnpm start.');

