import {test} from 'node:test';import assert from 'node:assert/strict';
import {videoCost,generationLabel} from '../public/video-cost.js';
import {createProvider,providerError} from '../lib/provider.mjs';
test('cost includes separately rounded parts and separates platform credits, MCP credits and API USD',()=>{
 assert.deepEqual(videoCost(32.5,'480p'),{parts:2,seconds:34,usd:10.82});
 assert.equal(videoCost(30,'720p').usd,20.43);assert.equal(videoCost(0,'480p'),null);assert.equal(videoCost(10,'4k'),null);
 assert.match(generationLabel({duration:32.5,resolution:'480p'}),/US\$/);
 assert.equal(generationLabel({duration:32.5,central:true,rate:20}),'Gerar · 660 créditos Fields IA');
 assert.equal(generationLabel({transport:'mcp',quote:{credits:12.5}}),'Gerar · 12,5 créditos Higgsfield');
 assert.match(generationLabel({transport:'mcp'}),/estimar/);
});
test('provider failures are classified without disclosing response secrets, URLs or input text',async()=>{
 const secret='session-secret https://private.example/media';
 for(const [body,pattern] of [['prompt max length 10000','10.000'],['insufficient balance','saldo da API'],['invalid video dimensions','mídia'],['invalid resolution','resolução'],[secret,'HTTP 400']]){
  const e=providerError(400,body+' '+secret);assert.match(e.message,new RegExp(pattern,'i'));assert.equal(e.definitive,true);assert.ok(!e.message.includes(secret));
 }
 const call=createProvider(()=> 'synthetic-key',{fetcher:async()=>new Response(JSON.stringify({detail:'prompt too long max length 10000',secret}),{status:400})});
 await assert.rejects(call('/higgsfield/genjutsu/object-swap/v1.0','POST',{}),/10.000/);
 assert.equal(providerError(500,'server failure').definitive,false);
});
