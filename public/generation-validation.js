export function mcpVideoIssue({transport,duration,size}={}){
 if(transport!=='mcp')return '';
 if(Number.isFinite(duration)&&duration>30)return 'Este vídeo tem '+duration.toLocaleString('pt-BR',{maximumFractionDigits:1})+' s. O MCP aceita até 30 s. Envie um trecho de até 30 s ou selecione API Higgsfield para vídeos de até 60 s.';
 if(Number.isFinite(size)&&size>100*1024*1024)return 'O MCP aceita arquivos de até 100 MB. Comprima o vídeo ou selecione API Higgsfield.';
 return '';
}