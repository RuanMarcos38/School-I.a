export function mcpVideoIssue({transport,duration,size}={}){
 if(transport!=='mcp')return '';
 if(Number.isFinite(duration)&&duration>60.1)return 'Use vídeos de até 60 segundos. Vídeos longos são processados em duas partes e reunidos ao terminar.';
 if((!Number.isFinite(duration)||duration<=30)&&Number.isFinite(size)&&size>100*1024*1024)return 'Para vídeos de até 30 segundos, use arquivos de até 100 MB.';
 if(Number.isFinite(size)&&size>300*1024*1024)return 'O arquivo excede 300 MB. Comprima o vídeo antes de enviar.';
 return '';
}
