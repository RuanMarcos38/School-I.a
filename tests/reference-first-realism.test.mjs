import {test} from 'node:test';
import assert from 'node:assert/strict';
import {videoPrompt,HUMAN_REALISM,VIDEO_REALISM,realismGuidance} from '../lib/realism.mjs';
test('reference identity and original footage rules are present',()=>{
 assert.match(HUMAN_REALISM,/exact distinctive nose/);
 assert.match(HUMAN_REALISM,/Unusual, eccentric or asymmetric natural traits/);
 assert.match(VIDEO_REALISM,/Replace ONLY the person explicitly targeted/);
 assert.match(VIDEO_REALISM,/frame rate, length, audio/);
});
test('character details are included even with custom scene and never overwritten',()=>{
 const scene='Replace ONLY the driver in blue, never the passenger.';
 const output=videoPrompt('Very long nose, copper curls, olive plaid jacket',scene);
 assert.ok(output.includes('copper curls'));
 assert.ok(output.includes(HUMAN_REALISM));
 assert.ok(output.includes(VIDEO_REALISM));
 assert.ok(output.endsWith(scene));
 assert.equal((output.match(/Replace ONLY the driver/g)||[]).length,1);
});
test('custom directions and long prompts never truncated',()=>{
 const long='Cena autoral, com movimento. '.repeat(11000)+'FIM SEM CORTE';
 assert.ok(videoPrompt('adult',long).endsWith(long));
});
test('disabled mode preserves legacy behavior',()=>{
 const previous=process.env.HUMAN_REALISM_ENABLED;
 try{
  process.env.HUMAN_REALISM_ENABLED='false';
  assert.equal(realismGuidance({video:true}),'');
  assert.equal(videoPrompt('adult','Preserve the camera'),'Preserve the camera');
  assert.equal(videoPrompt('adult'),'Replace only the person with the referenced character. Preserve movement, camera, background, scene lighting and audio. adult');
 }finally{if(previous===undefined)delete process.env.HUMAN_REALISM_ENABLED;else process.env.HUMAN_REALISM_ENABLED=previous;}
});
test('UI budget formula matches backend for enabled and disabled variants',()=>{
 const prev=process.env.HUMAN_REALISM_ENABLED;
 try{for(const enabled of [true,false]){
  process.env.HUMAN_REALISM_ENABLED=enabled?'true':'false';
  const desc='Huge nose and curly hair';
  const overhead=videoPrompt('','x').length-1;
  const extra=videoPrompt('d','x').length-videoPrompt('','x').length;
  for(const scene of ['Replace ONLY the person wearing blue. ','']){
   const custom=scene.length>0;
   const defaultScene='Replace only the person with the referenced character. Preserve movement, camera, background, scene lighting and audio. ';
   const predicted=overhead+(custom?scene:defaultScene).length+(custom?extra*desc.length:desc.length);
   assert.equal(predicted,videoPrompt(desc,scene).length);
  }
 }}finally{if(prev===undefined)delete process.env.HUMAN_REALISM_ENABLED;else process.env.HUMAN_REALISM_ENABLED=prev;}
});
