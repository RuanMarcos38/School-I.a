import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {instagramCookies,withInstagramSession} from '../lib/instagram-session.mjs';
const cookies=[{domain:'.instagram.com',name:'sessionid',value:'synthetic-session-for-test',path:'/',secure:true,httpOnly:true,session:true}];
test('temporary session is removed after success and failure',async()=>{
 let path;
 assert.equal(await withInstagramSession(cookies,async file=>{path=file;assert.match(readFileSync(file,'utf8'),/#HttpOnly_\.instagram.com\tTRUE\t\/\tTRUE\t0\tsessionid/);return 42;}),42);
 assert.equal(existsSync(path),false);
 await assert.rejects(withInstagramSession(cookies,async file=>{path=file;throw Error('Synthetic failure');}),/Synthetic failure/);
 assert.equal(existsSync(path),false);
});
test('only required Instagram cookies are accepted; other domains and injected rows are rejected',()=>{
 assert.throws(()=>instagramCookies([{...cookies[0],domain:'.example.com'}]),/inválida/);
 assert.throws(()=>instagramCookies([{...cookies[0],value:'secret\ninjected'}]),/inválida/);
 assert.throws(()=>instagramCookies([{...cookies[0],name:'unrelated_cookie'}]),/inválida/);
 assert.throws(()=>instagramCookies([{...cookies[0],name:'csrftoken'}]),/Entre no Instagram/);
});
