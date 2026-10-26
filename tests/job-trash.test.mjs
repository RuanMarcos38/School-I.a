import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {emptyJobTrash} from '../lib/job-trash.mjs';
function setup(){const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE jobs(id TEXT PRIMARY KEY,user_id TEXT,status TEXT,hidden INTEGER);CREATE TABLE requests(id TEXT,job_id TEXT,status TEXT);CREATE TABLE media(id TEXT);INSERT INTO media VALUES('source');");return db;}
test('only confirmed trash for this user is emptied; new items, gallery, other users and media stay intact',()=>{
 const db=setup();try{
 for(const row of [['selected','u','completed',2],['new','u','failed',2],['gallery','u','completed',0],['archived','u','completed',1],['other','v','completed',2]])db.prepare('INSERT INTO jobs VALUES(?,?,?,?)').run(...row);
 assert.throws(()=>emptyJobTrash(db,'u',['selected'],'WRONG'),/Confirmação/);
 const result=emptyJobTrash(db,'u',['selected','gallery','archived','other'],'EMPTY_TRASH');
 assert.deepEqual(result,{count:1,ids:['selected']});
 assert.equal(db.prepare("SELECT hidden FROM jobs WHERE id='selected'").get().hidden,3);
 assert.equal(db.prepare("SELECT hidden FROM jobs WHERE id='new'").get().hidden,2);
 assert.equal(db.prepare("SELECT hidden FROM jobs WHERE id='other'").get().hidden,2);
 assert.equal(db.prepare('SELECT count(*) AS n FROM media').get().n,1);
 assert.equal(db.prepare("UPDATE jobs SET hidden=0 WHERE id='selected' AND hidden=2").run().changes,0);
 assert.equal(emptyJobTrash(db,'u',['selected'],'EMPTY_TRASH').count,0);
 }finally{db.close();}
});
test('pending job or request blocks the entire operation without partial changes',()=>{
 const db=setup();try{
 db.exec("INSERT INTO jobs VALUES('safe','u','completed',2),('pending','u','uncertain',2)");
 assert.throws(()=>emptyJobTrash(db,'u',['safe','pending'],'EMPTY_TRASH'),/pendentes/);
 assert.equal(db.prepare("SELECT hidden FROM jobs WHERE id='safe'").get().hidden,2);
 db.exec("UPDATE jobs SET status='completed' WHERE id='pending';INSERT INTO requests VALUES('r','pending','in_progress')");
 assert.throws(()=>emptyJobTrash(db,'u',['safe','pending'],'EMPTY_TRASH'),/pendentes/);
 assert.equal(db.prepare("SELECT hidden FROM jobs WHERE id='safe'").get().hidden,2);
 }finally{db.close();}
});
