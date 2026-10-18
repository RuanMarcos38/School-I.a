import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {generationLabel} from '../public/video-cost.js';
import {mcpVideoIssue} from '../public/generation-validation.js';
function studio(){
 const listeners={},elements=new Map();
 const element=()=>({innerHTML:'',textContent:'',style:{},classList:{toggle(){},remove(){},add(){}},setAttribute(){},addEventListener(){},append(){},remove(){},querySelector(){return element();},querySelectorAll(){return [];}});
 const document={querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s);},querySelectorAll(){return [];},addEventListener(type,fn){listeners[type]=fn;},activeElement:null,createElement:element};
 const storage=new Map(),localStorage={getItem(key){return storage.get(key)||null;},setItem(key,value){storage.set(key,value);}};
 const context=vm.createContext({document,window:{addEventListener(){}},location:{hash:'#/'},navigator:{},localStorage,setTimeout(){},clearInterval(){},setInterval(){},Intl,console,generationLabel,mcpVideoIssue});
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').split('async function init()')[0];
 vm.runInContext(source+`;globalThis.testStudio={configure(duration,character='c'){video={id:'v',name:'Base',duration,url:'/media/v'};selected=character;},issue:generationIssue,setup(){authInfo={user:{name:'Teste',admin:false}};state={characters:[{id:'c',name:'Personagem',images:[],description:''}],jobs:[{id:'old',name:'Vídeo anterior',kind:'video',created:0,status:'in_progress',meta:{}}],folders:[],provider:{configured:true},tools:{},connections:[]};selected='c';video={id:'v',name:'Base',duration:6,url:'/media/v'};},render,get(){return {video,busy,selected,customPromptText,customPromptEnabled,tracked:[...studioResultIds]};},setApi(fn){api=fn;refresh=async()=>{};refreshBalance=()=>{};},disableRender(){render=()=>{};}};`,context);
 context.testStudio.setup();return {ui:context.testStudio,listeners,elements,context,storage};
}
test('studio keeps processing cards in the queue and hides technical connection names',()=>{
 const {ui,elements,context}=studio();ui.render();let html=elements.get('#app').innerHTML;
 assert.ok(!html.includes('Vídeo anterior'));assert.match(html,/Acompanhe as solicitações na/);assert.doesNotMatch(html,/>[^<]*\b(?:API|MCP)\b/);
 context.location.hash='#/fila';ui.render();html=elements.get('#app').innerHTML;assert.match(html,/Vídeo anterior/);assert.match(html,/Processando/);
});
test('accepted video clears all fields and allows another submission while jobs keep running',async()=>{
 const {ui,listeners,context,storage}=studio();let sends=0;ui.setApi(async path=>{assert.equal(path,'generate');sends++;return {id:'new-'+sends};});ui.disableRender();
 vm.runInContext("customPromptEnabled=true;customPromptText='Replace the driver';retrySourceId='previous';",context);
 const button={dataset:{action:'generate'},disabled:false};await listeners.click({target:{closest:()=>button}});
 assert.equal(sends,1);assert.equal(ui.get().video,null);assert.equal(ui.get().busy,false);assert.equal(ui.get().selected,null);
 assert.equal(ui.get().customPromptText,'');assert.equal(ui.get().customPromptEnabled,false);
 assert.equal(vm.runInContext('retrySourceId',context),null);
 assert.equal(ui.get().tracked[0],'new-1');
 assert.match(storage.get('fieldsia:studio-results:local-owner'),/new-1/);
 ui.setup();await listeners.click({target:{closest:()=>button}});assert.equal(sends,2);
});

test('completed video appears in Studio results and OK hides it only there after download',async()=>{
 const {ui,listeners,elements,context,storage}=studio();
 ui.setApi(async path=>{assert.equal(path,'generate');return {id:'studio-video-1'};});ui.disableRender();
 await listeners.click({target:{closest:()=>({dataset:{action:'generate'},disabled:false})}});
 vm.runInContext("state.gallery=[{id:'studio-video-1',name:'Vídeo finalizado',kind:'video',created:1,status:'completed',meta:{},result:'/media/final'}];",context);
 ui.render();let html=elements.get('#app').innerHTML;
 assert.match(html,/Vídeo finalizado/);assert.match(html,/data-action="studiodownload"/);
 assert.match(html,/\/media\/final\?download=1/);assert.match(html,/Acompanhe as solicitações|Resultados/);
 const modal=elements.get('#modal');modal.showModal=()=>{modal.open=true;};
 await listeners.click({target:{closest:()=>({dataset:{action:'studiodownload',id:'studio-video-1'}})}});
 assert.match(modal.innerHTML,/OK · limpar tela/);
 assert.match(modal.innerHTML,/Galeria/);
 modal.close=()=>{modal.open=false;};
 await listeners.click({target:{closest:()=>({dataset:{action:'ackstudioresult',id:'studio-video-1'}})}});
 ui.render();html=elements.get('#app').innerHTML;
 assert.doesNotMatch(html,/Vídeo finalizado/);assert.equal(ui.get().tracked.length,0);
 assert.equal(JSON.parse(storage.get('fieldsia:studio-results:local-owner')).length,0);
 context.location.hash='#/galeria';ui.render();assert.match(elements.get('#app').innerHTML,/Vídeo finalizado/);
});

test('studio only shows its own tracked completed result and keeps other jobs intact',async()=>{
 const {ui,listeners,elements,context}=studio();
 ui.setApi(async()=>({id:'fresh-id'}));ui.disableRender();
 await listeners.click({target:{closest:()=>({dataset:{action:'generate'}})}});
 vm.runInContext("state.gallery=[{id:'other-user-session',name:'Histórico antigo',kind:'video',status:'completed',meta:{},created:1,result:'/media/old'},{id:'fresh-id',name:'Resultado atual',kind:'video',status:'completed',meta:{},created:2,result:'/media/new'}];",context);
 ui.render();const html=elements.get('#app').innerHTML;
 assert.match(html,/Resultado atual/);assert.doesNotMatch(html,/Histórico antigo/);
 context.location.hash='#/galeria';ui.render();assert.match(elements.get('#app').innerHTML,/Histórico antigo/);
});

test('failed submission preserves the draft for recovery',async()=>{
 const {ui,listeners}=studio();ui.setApi(async()=>{throw Error('Serviço indisponível');});ui.disableRender();
 await listeners.click({target:{closest:()=>({dataset:{action:'generate'}})}});assert.equal(ui.get().video.id,'v');assert.equal(ui.get().busy,false);
});

for(const duration of [56.8,60])test(`studio permits a ${duration}s direct video after character selection`,async()=>{
 const {ui,elements,listeners}=studio();ui.configure(duration,null);ui.render();
 assert.match(elements.get('#app').innerHTML,/Selecione um personagem na etapa 1/);
 assert.match(elements.get('#app').innerHTML,/data-action="generate" disabled/);
 await listeners.click({target:{closest:()=>({dataset:{action:'select',id:'c'}})}});
 assert.equal(ui.issue(),'');const html=elements.get('#app').innerHTML;
 assert.doesNotMatch(html,/data-action="generate" disabled/);
 assert.match(html,/preservando a duração original/);
 let payload;ui.setApi(async(path,body)=>{payload=body;return {id:'new'};});ui.disableRender();
 await listeners.click({target:{closest:()=>({dataset:{action:'generate'}})}});
 assert.equal(payload.characterId,'c');assert.equal(payload.videoId,'v');assert.equal(payload.transport,'api');
});

test('gallery includes archived completed videos while the queue stays separate',()=>{
 const {ui,elements,context}=studio();
 vm.runInContext(`state.gallery=[{id:'archived',name:'Vídeo arquivado',kind:'video',created:0,status:'completed',hidden:1,meta:{},result:'/media/finished'}];`,context);
 context.location.hash='#/galeria';ui.render();let html=elements.get('#app').innerHTML;
 assert.match(html,/Vídeo arquivado/);assert.match(html,/Baixar/);assert.doesNotMatch(html,/data-action="hidejob"/);
 context.location.hash='#/fila';ui.render();assert.ok(!elements.get('#app').innerHTML.includes('Vídeo arquivado'));
});

test('gallery displays cinematic posters with readable controls and keeps queue layout separate',()=>{
 const {ui,elements,context}=studio();
 vm.runInContext(`state.gallery=[
  {id:'published',name:'Vídeo final de teste',kind:'video',created:'2026-10-17T23:00:00Z',status:'completed',meta:{},result:'/media/published',hidden:0,favorite:true},
  {id:'archived',name:'Arquivo guardado',kind:'video',created:'2026-10-16T23:00:00Z',status:'completed',meta:{},result:'/media/archived',hidden:1,favorite:false}
 ];`,context);
 context.location.hash='#/galeria';ui.render();
 const html=elements.get('#app').innerHTML;
 assert.match(html,/gallery-page/);assert.match(html,/gallery-grid/);
 assert.match(html,/gallery-poster/);assert.match(html,/Vídeo final de teste/);
 assert.match(html,/gallery-item-actions/);assert.match(html,/data-action="galleryplay"/);
 assert.match(html,/data-action="jobfavorite"/);assert.match(html,/data-action="reusevideo"/);
 assert.match(html,/data-compare="published"/);assert.match(html,/data-action="hidejob"/);
 assert.match(html,/Arquivado/);assert.match(html,/\/media\/published\?download=1/);
 context.location.hash='#/fila';ui.render();
 assert.doesNotMatch(elements.get('#app').innerHTML,/gallery-grid/);
 assert.match(elements.get('#app').innerHTML,/Vídeo anterior/);
});
test('gallery opens the original video in a separate full playback dialog',async()=>{
 const {ui,elements,context,listeners}=studio();
 vm.runInContext("state.gallery=[{id:'play',name:'Filme completo',kind:'video',created:0,status:'completed',meta:{},result:'/media/complete'}];",context);
 context.location.hash='#/galeria';ui.render();
 const modal=elements.get('#modal');modal.showModal=()=>{modal.open=true;};
 await listeners.click({target:{closest:()=>({dataset:{action:'galleryplay',id:'play'}})}});
 assert.match(modal.innerHTML,/gallery-player/);
 assert.match(modal.innerHTML,/video controls autoplay playsinline/);
 assert.match(modal.innerHTML,/src="\/media\/complete"/);
 assert.match(modal.innerHTML,/Baixar vídeo/);
 assert.match(modal.innerHTML,/data-action="reusevideo"/);
});

test('completed gallery videos offer editing without submitting a new generation',async()=>{
 const {ui,elements,context,listeners}=studio();vm.runInContext(`state.gallery=[{id:'done',name:'Vídeo concluído',kind:'video',created:0,status:'completed',hidden:1,meta:{},result:'/media/done'}];`,context);
 context.location.hash='#/galeria';ui.render();assert.match(elements.get('#app').innerHTML,/Editar e reenviar/);
 let calls=0;ui.setApi(async path=>{calls++;assert.equal(path,'jobs/reuse-video');return {sourceId:'done',characterId:'c',video:{id:'v',duration:6,url:'/media/v'},promptText:'Original',resolution:'720p',transport:'mcp',hasSnapshot:true};});
 elements.get('#modal').showModal=()=>{};await listeners.click({target:{closest:()=>({dataset:{action:'reusevideo',id:'done'}})}});
 assert.match(elements.get('#modal').innerHTML,/CORRIGIR PROMPT/);assert.match(elements.get('#modal').innerHTML,/Original/);assert.equal(calls,1);
 context.document.querySelector('#retry-prompt').value='Corrected instructions';elements.get('#modal').close=()=>{};
 await listeners.click({target:{closest:()=>({dataset:{action:'applyretry'}})}});
 assert.equal(ui.get().customPromptText,'Corrected instructions');assert.equal(ui.get().video.id,'v');assert.equal(calls,1);
});

test('gallery deletion requires confirmation and preserves the file until restored from trash',async()=>{
 const {ui,elements,context,listeners}=studio();
 vm.runInContext("state.gallery=[{id:'done',name:'Vídeo concluído',kind:'video',created:0,status:'completed',meta:{},result:'/media/done'}];",context);
 context.location.hash='#/galeria';ui.render();
 assert.match(elements.get('#app').innerHTML,/data-action="confirmdeletevideo"/);
 const modal=elements.get('#modal');modal.showModal=()=>{modal.open=true;};modal.close=()=>{modal.open=false;};
 const calls=[];ui.setApi(async(path,body)=>{calls.push({path,body});return {};});
 await listeners.click({target:{closest:()=>({dataset:{action:'confirmdeletevideo',id:'done'}})}});
 assert.equal(calls.length,0);assert.match(modal.innerHTML,/Lixeira/);assert.match(modal.innerHTML,/Cancelar/);
 await listeners.click({target:{closest:()=>({dataset:{action:'close'}})}});
 assert.equal(calls.length,0);
 await listeners.click({target:{closest:()=>({dataset:{action:'confirmdeletevideo',id:'done'}})}});
 await listeners.click({target:{closest:()=>({dataset:{action:'deletegalleryvideo',id:'done'}})}});
 assert.equal(calls.length,1);assert.equal(calls[0].path,'jobs/delete');assert.equal(calls[0].body.id,'done');
 assert.equal(modal.open,false);
});
