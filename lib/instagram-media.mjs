import {unlinkSync} from 'node:fs';
import ffmpeg from 'ffmpeg-static';
import {downloadMedia,inspectMedia,run,socialURL} from './media.mjs';

export function instagramMediaPacket(packet){
 const post=new URL(socialURL(packet.url));
 if(!['instagram.com','www.instagram.com'].includes(post.hostname)||!/^\/(p|reel|reels)\/[-_a-zA-Z0-9]+\/?$/.test(post.pathname))throw Error('Link de publicação Instagram inválido.');
 const sources=['video','audio'].map(kind=>{
  const u=new URL(packet[kind]);
  if(u.protocol!=='https:'||u.username||u.password||u.port||!(/(^|\.)cdninstagram\.com$/.test(u.hostname)||/^instagram\.[a-z0-9-]+\.fna\.fbcdn\.net$/.test(u.hostname))||!u.pathname.endsWith('.mp4'))throw Error('Arquivo Instagram inválido.');
  let meta;try{meta=JSON.parse(Buffer.from(u.searchParams.get('efg')||'','base64').toString());}catch{throw Error('Referência de mídia inválida.');}
  const tag=String(meta.vencode_tag||'');
  if(!meta.xpv_asset_id||!Number.isFinite(meta.duration_s)||meta.duration_s<4||meta.duration_s>60||!tag.startsWith('ig-xpvds.clips.')||(kind==='audio'?!tag.includes('audio'):tag.includes('audio')))throw Error('Referência de mídia incompatível.');
  u.searchParams.delete('bytestart');u.searchParams.delete('byteend');
  return {url:u.href,asset:String(meta.xpv_asset_id),duration:meta.duration_s};
 });
 if(sources[0].asset!==sources[1].asset)throw Error('Áudio e vídeo devem pertencer à mesma publicação.');
 return {url:'https://www.instagram.com/p/'+post.pathname.split('/')[2]+'/',sources};
}

export async function importInstagramMedia(packet,dest){
 const {sources}=instagramMediaPacket(packet),video=dest+'.video',audio=dest+'.audio';
 try{
  await downloadMedia(sources[0].url,video,290*1024*1024);
  await downloadMedia(sources[1].url,audio,10*1024*1024);
  await run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-i',video,'-i',audio,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','18','-c:a','aac','-b:a','192k','-movflags','+faststart',dest],{timeout:240000,maxBuffer:2e6,windowsHide:true});
  const info=await inspectMedia(dest,'video/mp4');
  if(Math.abs(info.duration-sources[0].duration)>2)throw Error('O arquivo recebido está incompleto.');
  await run(ffmpeg,['-hide_banner','-loglevel','error','-xerror','-nostdin','-i',dest,'-f','null','-'],{timeout:120000,maxBuffer:2e6,windowsHide:true});
  return info;
 }catch{try{unlinkSync(dest);}catch{}throw Error('Não foi possível importar o arquivo autorizado do Instagram. A referência pode ter expirado; abra novamente o vídeo.');}
 finally{for(const file of [video,audio])try{unlinkSync(file);}catch{}}
}
