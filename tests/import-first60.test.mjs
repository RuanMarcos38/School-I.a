import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,copyFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ffmpeg from 'ffmpeg-static';
import probe from 'ffprobe-static';
import {run,importSocial,inspectMedia} from '../lib/media.mjs';
test('link imports keep short videos and automatically cut long public and authenticated videos to the first 60 seconds with audio',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'fieldsia-first60-')),previous=process.env.YTDLP_PATH;process.env.YTDLP_PATH=ffmpeg;
 try{
  for(const [duration,cookieFile] of [[6,undefined],[66.875,undefined],[66.875,'synthetic-session-path']]){
   const input=join(dir,'input-'+duration+'.mp4'),dest=join(dir,'result-'+duration+'-'+!!cookieFile+'.mp4');
   if(!existsSync(input))await run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-f','lavfi','-i','color=c=blue:s=160x240:r=8','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t',String(duration),'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac','-shortest',input],{timeout:60000,windowsHide:true});
   let target;
   const info=await importSocial('https://www.instagram.com/p/TEST/',dest,dir,{cookieFile,runner:async(binary,args)=>{assert.ok(!args.includes('duration >=? 4 & duration <=? 60'));assert.ok(args.includes('300M'));if(cookieFile)assert.equal(args[args.indexOf('--cookies')+1],cookieFile);target=args[args.indexOf('-o')+1];copyFileSync(input,target);return {stdout:''};}});
   assert.ok(!existsSync(target));assert.ok(info.duration<=60.1);assert.ok(info.duration>=Math.min(duration,60)-0.15);
   if(duration>60){assert.equal(info.trimmed,true);assert.ok(info.originalDuration>60);assert.ok((await inspectMedia(dest,'video/mp4')).duration<=60.1);}else{assert.ok(readFileSync(input).equals(readFileSync(dest)));assert.equal(info.trimmed,undefined);}
   const metadata=JSON.parse((await run(probe.path,['-v','error','-show_streams','-of','json',dest],{timeout:30000,windowsHide:true})).stdout);assert.ok(metadata.streams.some(s=>s.codec_type==='audio'));
  }
 }finally{if(previous===undefined)delete process.env.YTDLP_PATH;else process.env.YTDLP_PATH=previous;rmSync(dir,{recursive:true,force:true});}
});
