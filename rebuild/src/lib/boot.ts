// Runs in <head> before first paint. Picks the device tier and restores the visitor's choices,
// so the right layout is in place from the first frame (no layout shift).
//
// The full story is the default. Tiers:
//   full   desktops and laptops with a capable graphics chip
//   light  phones, tablets, laptops with integrated or software graphics, low memory or few cores
//   brief  only when: reduced motion is on, 3D is unavailable, or data saver is on. Every other visit opens with
//          the story playing (owner decision, 14 Nov 2026): there is no "Skip the story" and no remembered skip.
//          (The story also steps down by itself if a device cannot hold the frame rate:
//          full -> light -> light at lower resolution -> brief.)
//
// Address parameters for campaigns and testers: ?mode=story|brief (that visit only), ?tier=full|light, ?sector=public|private.
export const bootScript = `(window.__ktBoot=function(){var d=document.documentElement,m='brief',t='brief',can=0,why='no-3d';try{
var q=new URLSearchParams(location.search),c=q.get('mode');
try{localStorage.removeItem('kt-mode')}catch(e){}
var modest=false,gl=null;try{gl=document.createElement('canvas').getContext('webgl2');if(gl){var x=gl.getExtension('WEBGL_debug_renderer_info');var r=x?String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL)):'';modest=/swiftshader|llvmpipe|software|basic render|intel|mali|adreno|powervr|videocore/i.test(r)}}catch(e){}
can=gl?1:0;
var rm=matchMedia('(prefers-reduced-motion: reduce)').matches,n=navigator.connection,sd=!!(n&&n.saveData);
var small=matchMedia('(max-width: 900px), (pointer: coarse)').matches,low=(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
why=!can?'no-3d':c==='brief'?'choice':c==='story'?'':rm?'reduced-motion':sd?'data-saver':'';
if(can&&!why){m='story';t=(small||low||modest)?'light':'full';var o=q.get('tier');if(o==='full'||o==='light')t=o}
var s=q.get('sector');if(s==='public'||s==='private'){try{sessionStorage.setItem('kt-sector',s)}catch(e){}}else{try{s=sessionStorage.getItem('kt-sector')}catch(e){s=null}}
if(s==='public'||s==='private')d.dataset.sector=s;
}catch(e){}
if(!(d.hasAttribute('data-home')||location.pathname==='/'))m='brief';
d.dataset.mode=m;d.dataset.tier=m==='story'?t:'brief';d.dataset.canStory=String(can);d.dataset.briefWhy=m==='brief'?why:'';})();`;
