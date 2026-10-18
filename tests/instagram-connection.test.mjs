import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
function worker({keep=false,permission=true,session=true}={}){
 const events={},data={keepConnected:keep},reads=[];let removed=0;
 const chrome={runtime:{id:'own',getURL:p=>'chrome-extension://own/'+p,onMessage:{addListener:fn=>events.message=fn},onStartup:{addListener:fn=>events.startup=fn}},storage:{local:{get:async()=>data,set:async value=>Object.assign(data,value)}},permissions:{contains:async()=>permission,remove:async()=>{removed++;permission=false;}},alarms:{clear:async()=>{},create:async()=>{},onAlarm:{addListener:fn=>events.alarm=fn}},cookies:{get:async({name})=>{reads.push(name);return name==='sessionid'&&!session?null:{name,value:'test-only',domain:'.instagram.com'};}}};
 runInNewContext(readFileSync(new URL('../tools/instagram-helper/cleanup.js',import.meta.url),'utf8'),{chrome,URL,Date});
 const popup={id:'own',url:'chrome-extension://own/popup.html'},studio={id:'own',frameId:0,tab:{id:1},url:'https://fieldsia.r2rmarketingdigital.com.br/#/'};
 const send=(type,sender=popup,extra={})=>new Promise(resolve=>{if(!events.message({type,...extra},sender,resolve))resolve(undefined);});
 return {send,events,data,reads,popup,studio,removed:()=>removed};
}
test('explicit connection survives Chrome startup and disconnect revokes access',async()=>{const w=worker();assert.equal((await w.send('CONNECTION_STATUS')).connected,false);await w.send('KEEP_CONNECTED');await w.events.startup();assert.equal(w.removed(),0);assert.equal((await w.send('CONNECTION_STATUS')).connected,true);assert.deepEqual(w.reads,[]);await w.send('DISCONNECT');assert.equal(w.removed(),1);assert.equal(w.data.keepConnected,false);});
test('temporary imports and unconfigured startup still revoke permissions',async()=>{const w=worker();await w.events.startup();assert.equal(w.removed(),1);});
test('connection cannot be retained without browser permission',async()=>{const w=worker({permission:false});assert.match((await w.send('KEEP_CONNECTED')).error,/Autorize/);assert.equal(w.data.keepConnected,false);});
test('cookies restricted to top-level Fields IA content script and valid Instagram links',async()=>{const w=worker({keep:true});const url='https://www.instagram.com/reel/TEST/';for(const sender of [{...w.studio,url:'https://evil.example/'},{...w.studio,frameId:2},{...w.studio,id:'other'}])assert.equal(await w.send('INSTAGRAM_COOKIES',sender,{url}),undefined);assert.match((await w.send('INSTAGRAM_COOKIES',w.studio,{url:'https://instagram.com.evil.example/reel/TEST/'})).error,/Conecte/);assert.deepEqual(w.reads,[]);const result=await w.send('INSTAGRAM_COOKIES',w.studio,{url});assert.equal(result.cookies.length,3);assert.deepEqual(w.reads,['sessionid','csrftoken','ds_user_id']);assert.equal(w.data.sessionid,undefined);});
test('expired Instagram login produces actionable message without changing stored credentials',async()=>{const w=worker({keep:true,session:false});const result=await w.send('INSTAGRAM_COOKIES',w.studio,{url:'https://www.instagram.com/p/TEST/'});assert.match(result.error,/expirou/);assert.equal(w.data.keepConnected,true);});
function bridge({cached=true,connected=true}={}){
 const windowEvents={},documentEvents={},messages=[],requests=[],runtimeCalls=[];
 const button={disabled:false},window={postMessage:message=>messages.push(message),addEventListener:(name,fn)=>windowEvents[name]=fn};
 const context={window,document:{addEventListener:(name,fn)=>documentEvents[name]=fn,querySelector:()=>({value:'https://www.instagram.com/reel/TEST/'})},location:{origin:'https://fieldsia.r2rmarketingdigital.com.br'},URL,AbortSignal,chrome:{runtime:{sendMessage:async message=>{runtimeCalls.push(message.type);return message.type==='CONNECTION_STATUS'?{connected}:{cookies:[{name:'sessionid',value:'test-only'}]};}}},fetch:async(path,options)=>{requests.push({path,options});return {ok:path.endsWith('session')||cached,status:cached?200:400,json:async()=>({url:'/media/test',duration:6})};}};
 runInNewContext(readFileSync(new URL('../tools/instagram-helper/bridge.js',import.meta.url),'utf8'),context);
 const click=async trusted=>{await new Promise(r=>setImmediate(r));await documentEvents.click({isTrusted:trusted,target:{closest:()=>button},preventDefault(){},stopImmediatePropagation(){}});};
 return {click,messages,requests,runtimeCalls,button};
}
test('cached media import does not access Instagram session',async()=>{const b=bridge();await b.click(true);assert.equal(b.requests.length,1);assert.equal(b.runtimeCalls.includes('INSTAGRAM_COOKIES'),false);assert.ok(b.messages.some(m=>m.type==='FIELDS_IA_INSTAGRAM_IMPORTED'));assert.equal(b.button.disabled,false);});
test('new restricted video uses isolated session request and clears busy state',async()=>{const b=bridge({cached:false});await b.click(true);assert.equal(b.requests.length,2);assert.equal(b.requests[1].path,'/api/import-instagram-session');assert.ok(b.runtimeCalls.includes('INSTAGRAM_COOKIES'));assert.ok(b.messages.some(m=>m.type==='FIELDS_IA_INSTAGRAM_IMPORTED'));assert.ok(!JSON.stringify(b.messages).includes('test-only'));assert.equal(b.messages.at(-1).type,'FIELDS_IA_INSTAGRAM_IDLE');});
test('synthetic clicks and disconnected helper never read cookies or initiate downloads',async()=>{const b=bridge();await b.click(false);assert.equal(b.requests.length,0);const off=bridge({connected:false});await off.click(true);assert.equal(off.requests.length,0);});
