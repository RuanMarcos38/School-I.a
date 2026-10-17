import {createHash,randomUUID} from 'node:crypto';
// Aggregates existing per-part quotes without modifying OAuth or credential storage.
export function createMultipartMcp({gateway,db,vault,now=Date.now}){
 const signature=input=>createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const read=q=>JSON.parse(vault.decrypt(q.payload));
 const save=(user,input,payload,cost,expires)=>{const id=randomUUID();db.prepare('INSERT INTO mcp_quotes(id,user_id,signature,payload,cost,expires) VALUES(?,?,?,?,?,?)').run(id,user,signature(input),vault.encrypt(JSON.stringify(payload)),cost,expires);return id;};
 function validate(input){if(!Array.isArray(input.parts)||input.parts.length!==2||!Number.isFinite(input.duration)||input.duration<=30||input.duration>60.1||input.parts.some(p=>!Number.isFinite(p.duration)||p.duration<4||p.duration>30.05)||Math.abs(input.parts.reduce((n,p)=>n+p.duration,0)-input.duration)>0.1)throw Error('As partes do vídeo não correspondem à duração original. Estime novamente.');}
 async function estimate(user,input,decision={}){
  if(!input.parts)return gateway.estimate(user,input,decision);
  validate(input);
  const existing=db.prepare('SELECT * FROM mcp_quotes WHERE user_id=? AND signature=? AND used=0 AND expires>? ORDER BY expires DESC').all(user,signature(input),now());
  const cached=existing.find(q=>q.cost>=0);if(cached)return {quoteId:cached.id,credits:cached.cost,expires:cached.expires,parts:2};
  const pending=decision.choiceId?existing.find(q=>q.id===decision.choiceId&&q.cost<0):existing.find(q=>q.cost<0);
  if(decision.choiceId&&(!pending||decision.literal!==true))throw Error('A confirmação mudou ou expirou. Estime novamente.');
  if(pending&&!decision.choiceId)return {choiceRequired:true,choiceId:pending.id,presetName:read(pending).presetName,expires:pending.expires};
  const old=pending?read(pending):null,children=[];let expires=now()+600000;
  for(let i=0;i<input.parts.length;i++){
   const {parts,...base}=input,partInput={...base,...parts[i]};
   const choice=old?.children[i]?.quote;
   const quote=await gateway.estimate(user,partInput,choice?.choiceRequired?{choiceId:choice.choiceId,literal:true}:{});
   expires=Math.min(expires,quote.expires);children.push({input:partInput,quote});
  }
  const choices=children.filter(c=>c.quote.choiceRequired);
  if(choices.length){const presetName=[...new Set(choices.map(c=>c.quote.presetName))].join(' / ');const id=save(user,input,{children,presetName},-1,expires);if(pending)db.prepare('UPDATE mcp_quotes SET used=1 WHERE id=?').run(pending.id);return {choiceRequired:true,choiceId:id,presetName,expires};}
  const credits=children.reduce((sum,c)=>sum+c.quote.credits,0),balance=await gateway.call(user,'balance');
  if(!Number.isFinite(balance.credits)||credits>balance.credits)throw Error('Saldo da conta insuficiente para as duas partes: '+credits+' créditos necessários. Nenhuma geração foi iniciada.');
  const id=save(user,input,{children},credits,expires);if(pending)db.prepare('UPDATE mcp_quotes SET used=1 WHERE id=?').run(pending.id);
  return {quoteId:id,credits,expires,parts:2};
 }
 function consumeQuote(user,id,input,maxCredits){
  if(!input.parts)return gateway.consumeQuote(user,id,input,maxCredits);
  validate(input);const q=db.prepare('SELECT * FROM mcp_quotes WHERE id=? AND user_id=? AND used=0 AND expires>?').get(id,user,now());
  if(!q||q.cost<0||q.signature!==signature(input))throw Error('A estimativa mudou ou expirou. Confira o custo novamente.');
  if(!Number.isFinite(maxCredits)||maxCredits<q.cost)throw Error('Confirme o limite total de créditos das duas partes.');
  const parts=read(q).children.map(c=>gateway.consumeQuote(user,c.quote.quoteId,c.input,c.quote.credits));
  return {id:q.id,cost:q.cost,parts};
 }
 function claimBatch(user,quote){if(quote.parts&&db.prepare('UPDATE mcp_quotes SET used=1 WHERE id=? AND user_id=? AND used=0 AND expires>?').run(quote.id,user,now()).changes!==1)throw Object.assign(Error('Estimativa já utilizada ou expirada.'),{definitive:true});}
 return {...gateway,estimate,consumeQuote,claimBatch};
}
