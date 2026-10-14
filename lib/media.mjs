import {createReadStream,createWriteStream,readFileSync,statSync,existsSync,unlinkSync} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Readable,Transform} from 'node:stream';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {join} from 'node:path';
import sharp from 'sharp';
import ffmpeg from 'ffmpeg-static';
import probe from 'ffprobe-static';
export const run=promisify(execFile);
export const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'};
export function toolsReady(){return {images:true,ffmpeg:!!ffmpeg&&existsSync(ffmpeg),ffprobe:existsSync(probe.path)};}
export async function inspectMedia(path,type){
 if(type.startsWith('image/')){
  const m=await sharp(path,{limitInputPixels:60e6,failOn:'error'}).metadata();
  if(!['jpeg','png','webp'].includes(m.format)||!m.width||!m.height)throw Error('Imagem inválida.');
  // Decode all pixels, not just a forged header.
  await sharp(path,{limitInputPixels:60e6,failOn:'error'}).resize(64,64).toBuffer();
  return {type:'image/'+(m.format==='jpeg'?'jpeg':m.format),width:m.width,height:m.height,duration:0};
 }
 if(!toolsReady().ffprobe)throw Error('Validador de vídeo não instalado.');
 const {stdout}=await run(probe.path,['-v','error','-show_format','-show_streams','-of','json',path],{timeout:45000,maxBuffer:2e6,windowsHide:true});
 const info=JSON.parse(stdout),v=info.streams?.find(s=>s.codec_type==='video'),duration=Number(info.format?.duration||v?.duration);
 if(!v||!Number.isFinite(duration)||duration<4||duration>60.1)throw Error('O vídeo precisa ter de 4 a 60 segundos.');
 if(v.width>8192||v.height>8192)throw Error('Resolução do vídeo excede o limite.');
 return {type,width:v.width,height:v.height,duration};
}
export async function receiveMedia(req,path,limit){
 let total=0;
 const counter=new Transform({transform(chunk,encoding,callback){total+=chunk.length;if(total>limit){const e=Error('Arquivo excede o limite permitido.');e.status=413;callback(e);}else callback(null,chunk);}});
 try{await pipeline(req,counter,createWriteStream(path,{flags:'wx'}));return total;}
 catch(e){try{unlinkSync(path);}catch{}throw e;}
}
function privateAddress(ip){
 if(isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a>=224||a===100&&b>=64&&b<=127;}
 if(isIP(ip)===6){const s=ip.toLowerCase();return s==='::'||s==='::1'||s.startsWith('fc')||s.startsWith('fd')||s.startsWith('fe80:')||s.startsWith('::ffff:');}
 return true;
}
export async function validateRemote(url){
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')throw Error('Use um endereço HTTPS público.');
 const addresses=await lookup(u.hostname,{all:true});if(!addresses.length||addresses.some(a=>privateAddress(a.address)))throw Error('Endereço privado não permitido.');
 return u;
}
export async function downloadMedia(url,path,limit,{mediaFetch=fetch}={}){
 // Provider result URLs only. User-supplied social URLs go through a separate host allowlist.
 await validateRemote(url);
 const r=await mediaFetch(url,{redirect:'error',signal:AbortSignal.timeout(180000)});
 if(!r.ok||!r.body)throw Error('Falha no download do resultado.');
 let total=0;const counter=new Transform({transform(chunk,enc,cb){total+=chunk.length;if(total>limit)cb(Error('Resultado excede o limite.'));else cb(null,chunk);}});
 try{await pipeline(Readable.fromWeb(r.body),counter,createWriteStream(path,{flags:'wx'}));return {size:total,type:(r.headers.get('content-type')||'').split(';')[0]};}
 catch(e){try{unlinkSync(path);}catch{}throw e;}
}
export function streamMedia(req,res,path,type,{download=false,name='arquivo'}={}){
 const size=statSync(path).size,range=req.headers.range;
 const headers={'Content-Type':type,'Accept-Ranges':'bytes','Cache-Control':'private, max-age=3600'};
 if(download)headers['Content-Disposition']='attachment; filename="'+name.replace(/[^a-zA-Z0-9._-]/g,'_')+'"';
 if(range){
  const m=/^bytes=(\d*)-(\d*)$/.exec(range);
  if(!m){res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return;}
  let start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2])),end=m[1]?(m[2]?Number(m[2]):size-1):size-1;
  end=Math.min(end,size-1);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size){res.writeHead(416,{'Content-Range':'bytes */'+size});res.end();return;}
  res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${size}`});createReadStream(path,{start,end}).pipe(res);
 }else{res.writeHead(200,{...headers,'Content-Length':size});createReadStream(path).pipe(res);}
}
export async function splitVideo(source,dir,duration){
 if(duration<=30)return [source];
 const count=Math.ceil(duration/30),length=duration/count,files=[];
 for(let i=0;i<count;i++){
  const dest=join(dir,'part-'+i+'.mp4');
  await run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-ss',String(i*length),'-i',source,'-t',String(length),'-map','0:v:0','-map','0:a?','-c:v','libx264','-preset','fast','-crf','18','-c:a','aac','-movflags','+faststart',dest],{timeout:240000,maxBuffer:2e6,windowsHide:true});
  if(statSync(dest).size>200*1024*1024)throw Error('Uma parte do vídeo excede 200 MB.');
  files.push(dest);
 }
 return files;
}
export async function concatenate(files,dest){
 if(!ffmpeg||!existsSync(ffmpeg))throw Error('Ferramenta de vídeo não instalada.');
 const args=['-hide_banner','-loglevel','error','-nostdin'];
 for(const file of files)args.push('-i',file);
 // Normalize video streams; preserve audio when all parts have it.
 const metadata=await Promise.all(files.map(async file=>JSON.parse((await run(probe.path,['-v','error','-show_streams','-of','json',file],{timeout:30000,maxBuffer:2e6,windowsHide:true})).stdout)));
 const audio=metadata.every(m=>m.streams.some(s=>s.codec_type==='audio'));
 const filters=files.map((_,i)=>'['+i+':v]setpts=PTS-STARTPTS[v'+i+']'+(audio?';['+i+':a]asetpts=PTS-STARTPTS[a'+i+']':'')).join(';');
 const inputs=files.map((_,i)=>'[v'+i+']'+(audio?'[a'+i+']':'')).join('');
 args.push('-filter_complex',filters+';'+inputs+'concat=n='+files.length+':v=1:a='+(audio?1:0)+'[v]'+(audio?'[a]':''),'-map','[v]');
 if(audio)args.push('-map','[a]');
 args.push('-c:v','libx264','-crf','18','-preset','fast','-c:a','aac','-movflags','+faststart',dest);
 await run(ffmpeg,args,{timeout:300000,maxBuffer:2e6,windowsHide:true});
}
export function socialURL(raw){
 const u=new URL(raw),host=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||u.port||!['www.tiktok.com','tiktok.com','vm.tiktok.com','vt.tiktok.com','www.instagram.com','instagram.com'].includes(host))throw Error('Cole um link público do TikTok ou Instagram.');
 return u.toString();
}
export async function importSocial(raw,path,root){
 const url=socialURL(raw),binary=process.env.YTDLP_PATH||join(root,'vendor',process.platform==='win32'?'yt-dlp.exe':'yt-dlp');
 if(!existsSync(binary))throw Error('Importador não instalado. Execute a configuração do aplicativo.');
 await run(binary,['--ignore-config','--no-playlist','--no-warnings','--restrict-filenames','--max-filesize','300M','--socket-timeout','20','--retries','1','--no-part','--no-mtime','--match-filter','duration >= 4 & duration <= 60','--ffmpeg-location',ffmpeg,'--merge-output-format','mp4','-f','bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b','-o',path,'--',url],{timeout:180000,maxBuffer:2e6,windowsHide:true,env:{...process.env,NO_COLOR:'1'}});
 if(!existsSync(path))throw Error('Link sem vídeo público compatível. Faça upload do arquivo.');
 return inspectMedia(path,'video/mp4');
}

