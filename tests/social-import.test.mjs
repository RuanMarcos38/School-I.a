import {test} from 'node:test';
import assert from 'node:assert/strict';
import {socialImportError} from '../lib/media.mjs';
test('Instagram audience restriction is explained without exposing command or paths',()=>{
 const error=socialImportError({message:'Command failed: /usr/local/bin/yt-dlp -o /app/data/private.mp4',stderr:"ERROR: This content isn't available to everyone: it can't be seen by certain audiences."});
 assert.equal(error.status,422);assert.match(error.message,/restringiu o acesso/);assert.match(error.message,/upload/);assert.doesNotMatch(error.message,/yt-dlp|\/app\/|Command failed/);
});
test('unknown extractor errors cannot disclose URLs or shell arguments',()=>{
 const error=socialImportError({message:'Command failed secret-session-url --cookies private.txt'});
 assert.match(error.message,/Não foi possível importar/);assert.doesNotMatch(error.message,/secret|cookies|private/);
 assert.match(socialImportError({stderr:'HTTP Error 429: Too Many Requests'}).message,/temporariamente/);
 assert.match(socialImportError({killed:true}).message,/demorou/);
});
