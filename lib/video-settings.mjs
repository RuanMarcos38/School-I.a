export const videoResolutions=['480p','720p','1080p'];
export function videoResolution(value='1080p'){
 if(!videoResolutions.includes(value))throw Error('Escolha uma resolução de vídeo válida: 480p, 720p ou 1080p.');
 return value;
}
