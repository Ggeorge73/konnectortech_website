// Runs in <head> before first paint. Picks the device tier and restores the visitor's choices,
// so the right layout is in place from the first frame (no layout shift).
//   brief: reduced motion on, 3D unavailable, data saver on, software graphics, or by choice
//   light: phones, tablets and modest laptops
//   full:  desktops and laptops with a capable graphics chip
// ?mode=story|brief and ?sector=public|private let campaigns and testers link straight to a state.
export const bootScript = `(window.__ktBoot=function(){var d=document.documentElement,m='brief',t='brief',can=0;try{
var q=new URLSearchParams(location.search),c=q.get('mode');
if(c==='story'||c==='brief'){try{localStorage.setItem('kt-mode',c)}catch(e){}}else{try{c=localStorage.getItem('kt-mode')}catch(e){}}
var soft=false,gl=null;try{gl=document.createElement('canvas').getContext('webgl2');if(gl){var x=gl.getExtension('WEBGL_debug_renderer_info');var r=x?String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL)):'';soft=/swiftshader|llvmpipe|software|basic render/i.test(r)}}catch(e){}
can=gl?1:0;
var rm=matchMedia('(prefers-reduced-motion: reduce)').matches,n=navigator.connection,sd=!!(n&&(n.saveData||/(^|-)2g$/.test(n.effectiveType||'')));
var small=matchMedia('(max-width: 900px), (pointer: coarse)').matches,low=(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
if(can&&c!=='brief'&&(c==='story'||(!rm&&!sd&&!soft))){m='story';t=(small||low||soft)?'light':'full'}
var s=q.get('sector');if(s==='public'||s==='private'){try{sessionStorage.setItem('kt-sector',s)}catch(e){}}else{try{s=sessionStorage.getItem('kt-sector')}catch(e){s=null}}
if(s==='public'||s==='private')d.dataset.sector=s;
}catch(e){}
if(!(d.hasAttribute('data-home')||location.pathname==='/'))m='brief';
d.dataset.mode=m;d.dataset.tier=m==='story'?t:'brief';d.dataset.canStory=String(can);})();`;
