// Shared production guidance derived from the two user-supplied studio standards.
// Instructions guide the provider; they do not constitute a visual quality score.
export const REALISM_VERSION='human-realism-v1';
export const HUMAN_REALISM=`Prioritize reference identity, plausible anatomy, natural human texture, coherent lighting, natural motion and temporal consistency, in that order. Treat supplied appearance references as the authoritative identity; preserve facial geometry and asymmetry, nose, eyes and iris color, hairline, hairstyle, complexion, distinctive marks, facial hair and body proportions. Do not blend identities or apply unrequested beautification, rejuvenation or face redesign.
Render organic skin with naturally varied pores, fine wrinkles, pigmentation, lip texture and subtle facial hairs; never invent exaggerated pores. Use realistic eyes, moisture, corneal reflections and authentic teeth. Preserve individual hair strands, natural density, flyaways, fabric weave, seams and material weight. Match environmental light direction, softness, color temperature, contact shadows, reflections and natural skin reflectance. Match the source camera perspective, exposure, focus, white balance, grain and motion blur instead of adding cinematic grading.
Avoid CGI, cartoon or illustration appearance, waxy or plastic skin, beauty filters, excessive HDR, artificial glow, sharpening or smoothing, generic faces, unnatural symmetry, malformed hands, extra fingers or limbs, impossible joints, mismatched lighting, visible cutout edges and distorted backgrounds.`;
export const VIDEO_REALISM=`Maintain the same recognizable identity, facial structure, hair, skin details, proportions, clothing and accessories across every frame, including profiles, rapid motion and occlusion. Use plausible biomechanics, coordinated expressions and blinking, weight transfer, gravity, inertia, foot contact and secondary hair and fabric motion. Avoid identity drift, facial morphing, flicker, texture crawling, robotic motion, floating feet and unstable clothing patterns.
For character replacement, the driving video controls performance timing, choreography, camera, composition, environment and duration. Replace only the selected person; preserve other people, surrounding objects and background. Match source lighting, perspective and camera characteristics. Preserve source audio when supported. Keep authorized scene-specific wardrobe or action exceptions explicit.`;
export function realismGuidance({video=false}={}){
 return process.env.HUMAN_REALISM_ENABLED==='false'?'':HUMAN_REALISM+(video?'\n'+VIDEO_REALISM:'');
}
export function videoPrompt(description,scene=''){
 const instruction=String(scene||'')||'Replace only the person with the referenced character. Preserve movement, camera, background, scene lighting and audio. '+String(description||'');
 const guidance=realismGuidance({video:true});
 const result=guidance?guidance+'\nSCENE-SPECIFIC INSTRUCTIONS: '+instruction:instruction;
 return result;
}
