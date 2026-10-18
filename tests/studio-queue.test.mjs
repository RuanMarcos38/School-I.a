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
 const context=vm.createContext({document,window:{addEventListener(){}},location:{hash:'#/'},navigator:{},setTimeout(){},clearInterval(){},setInterval(){},Intl,console,generationLabel,mcpVideoIssue});
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').split('async function init()')[0];
 vm.runInContext(source+`;globalThis.testStudio={configure(duration,character='c'){video={id:'v',name:'Base',duration,url:'/media/v'};selected=character;},issue:generationIssue,setup(){authInfo={user:{name:'Teste',admin:false}};state={characters:[{id:'c',name:'Personagem',images:[],description:''}],jobs:[{id:'old',name:'Vídeo anterior',kind:'video',created:0,status:'in_progress',meta:{}}],folders:[],provider:{configured:true},tools:{},connections:[]};selected='c';video={id:'v',name:'Base',duration:6,url:'/media/v'};},render,get(){return {video,busy,selected,customPromptText};},setApi(fn){api=fn;refresh=async()=>{};refreshBalance=()=>{};},disableRender(){render=()=>{};}};`,context);
 context.testStudio.setup();return {ui:context.testStudio,listeners,elements,context};
}
test('studio keeps processing cards in the queue and hides technical connection names',()=>{
 const {ui,elements,context}=studio();ui.render();let html=elements.get('#app').innerHTML;
 assert.ok(!html.includes('Vídeo anterior'));assert.match(html,/Abrir fila/);assert.doesNotMatch(html,/>[^<]*\b(?:API|MCP)\b/);
 context.location.hash='#/fila';ui.render();html=elements.get('#app').innerHTML;assert.match(html,/Vídeo anterior/);assert.match(html,/Processando/);
});
test('accepted video clears only the submitted draft and permits another submission while a job runs',async()=>{
 const {ui,listeners}=studio();let sends=0;ui.setApi(async path=>{assert.equal(path,'generate');sends++;return {id:'new'};});ui.disableRender();
 const button={dataset:{action:'generate'},disabled:false};await listeners.click({target:{closest:()=>button}});
 assert.equal(sends,1);assert.equal(ui.get().video,null);assert.equal(ui.get().busy,false);assert.equal(ui.get().selected,'c');
 ui.setup();await listeners.click({target:{closest:()=>button}});assert.equal(sends,2);
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
