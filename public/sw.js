// No private media, credentials or API responses are stored in the offline cache.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.mode!=='navigate'||event.request.method!=='GET')return;
 event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fields IA · Sem conexão</title><body style="background:#0b0c0e;color:#eee;font:18px system-ui;padding:32px"><h1>Você está sem conexão</h1><p>Conecte-se à internet para acessar seus personagens e gerações.</p><a style="color:#efd441" href="/">Tentar novamente</a></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}})));
});
