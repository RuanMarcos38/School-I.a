// Genjutsu public list rates checked 2026-10-15. Estimates exclude account discounts.
export const videoListRates={'480p':0.318,'720p':0.681,'1080p':1.632};
export function videoCost(duration,resolution='1080p'){
 if(!Number.isFinite(duration)||duration<4||duration>60.1||!Object.hasOwn(videoListRates,resolution))return null;
 const parts=Math.ceil(duration/30),seconds=parts*Math.ceil(duration/parts);
 return {parts,seconds,usd:Math.ceil(seconds*Math.round(videoListRates[resolution]*1000)/10)/100};
}
export function generationLabel({duration,resolution,central=false,rate=0,transport='api',quote}={}){
 if(transport==='mcp')return quote?'Gerar · '+new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(quote.credits)+' créditos MCP':'Gerar · estimar créditos MCP';
 if(central)return Number.isFinite(duration)?'Gerar · '+Math.ceil(duration)*rate+' créditos Fields IA':'Gerar';
 const cost=videoCost(duration,resolution);return cost?'Gerar · ~'+new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD'}).format(cost.usd):'Gerar';
}
