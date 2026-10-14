import {test} from 'node:test';
import assert from 'node:assert/strict';
import {videoPrompt,HUMAN_REALISM,VIDEO_REALISM} from '../lib/realism.mjs';
import {characterPrompt,viewPrompt} from '../lib/provider.mjs';
test('realism guidance reaches cards, views and custom video instructions',()=>{
 for(const p of [characterPrompt('adult with freckles'),viewPrompt('adult with freckles','profile'),videoPrompt('adult with freckles','Replace the foreground dancer only')])assert.ok(p.includes(HUMAN_REALISM));
 const video=videoPrompt('adult','Replace the foreground dancer only');
 assert.ok(video.includes(VIDEO_REALISM));assert.ok(video.endsWith('Replace the foreground dancer only'));
 assert.ok(viewPrompt('adult','profile').includes('right side profile'));
 assert.throws(()=>videoPrompt('adult','x'.repeat(10001)),/10.000/);
});
test('feature switch restores the previous video prompt without altering scene text',()=>{
 const previous=process.env.HUMAN_REALISM_ENABLED;
 try{process.env.HUMAN_REALISM_ENABLED='false';assert.equal(videoPrompt('adult','Preserve the source camera'),'Preserve the source camera');}
 finally{if(previous===undefined)delete process.env.HUMAN_REALISM_ENABLED;else process.env.HUMAN_REALISM_ENABLED=previous;}
});
