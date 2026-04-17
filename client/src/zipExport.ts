import JSZip from 'jszip';
import type { Presentation, SlideElement } from './types';
import { createPresentation, savePresentation, uploadFile } from './api';

/** Collect all unique media src paths from a presentation */
function collectMediaPaths(pres: Presentation): string[] {
  const paths = new Set<string>();
  for (const slide of pres.slides) {
    for (const el of slide.elements) {
      if ((el.type === 'video' || el.type === 'image') && el.src) {
        paths.add(el.src);
      }
    }
  }
  return [...paths];
}

/** Extract just the filename from a src path like /uploads/{id}/filename */
function srcToFilename(src: string): string {
  return src.split('/').pop() || src;
}

/** Export a presentation as a .zip file and trigger download */
export async function exportPresentation(pres: Presentation): Promise<void> {
  const zip = new JSZip();
  const mediaPaths = collectMediaPaths(pres);

  // Fetch all media files and add to zip
  const mediaFolder = zip.folder('media')!;
  for (const src of mediaPaths) {
    try {
      const res = await fetch(src);
      if (res.ok) {
        const blob = await res.blob();
        mediaFolder.file(srcToFilename(src), blob);
      }
    } catch { /* skip missing files */ }
  }

  // Remap src paths in presentation JSON: /uploads/{id}/file → media/file
  const exportPres = JSON.parse(JSON.stringify(pres)) as Presentation;
  for (const slide of exportPres.slides) {
    for (const el of slide.elements) {
      if ((el.type === 'video' || el.type === 'image') && el.src) {
        (el as any).src = `media/${srcToFilename(el.src)}`;
      }
    }
  }

  zip.file('presentation.json', JSON.stringify(exportPres, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pres.title || 'presentation'}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import a .zip file and create a new presentation. Returns the new presentation ID. */
export async function importPresentation(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);

  // Read presentation.json
  const presFile = zip.file('presentation.json');
  if (!presFile) throw new Error('No presentation.json found in zip');
  const presJson = await presFile.async('string');
  const importedPres = JSON.parse(presJson) as Presentation;

  // Create a new presentation on the server
  const newPres = await createPresentation(importedPres.title);
  const newId = newPres.id;

  // Upload all media files and build a path mapping
  const pathMap = new Map<string, string>(); // media/filename → /uploads/{newId}/newFilename
  const mediaFolder = zip.folder('media');
  if (mediaFolder) {
    const mediaFiles: { name: string; file: JSZip.JSZipObject }[] = [];
    mediaFolder.forEach((relativePath, fileObj) => {
      if (!fileObj.dir) {
        mediaFiles.push({ name: relativePath, file: fileObj });
      }
    });

    for (const { name, file: fileObj } of mediaFiles) {
      const blob = await fileObj.async('blob');
      const f = new File([blob], name, { type: guessMimeType(name) });
      const result = await uploadFile(newId, f);
      pathMap.set(`media/${name}`, result.path);
    }
  }

  // Remap src paths back: media/file → /uploads/{newId}/uploaded-file
  for (const slide of importedPres.slides) {
    // Generate new IDs
    slide.id = crypto.randomUUID();
    for (const el of slide.elements) {
      el.id = crypto.randomUUID();
      if ((el.type === 'video' || el.type === 'image') && el.src) {
        const mapped = pathMap.get(el.src);
        if (mapped) (el as any).src = mapped;
      }
    }
  }

  // Save the imported presentation with remapped paths
  importedPres.id = newId;
  importedPres.createdAt = newPres.createdAt;
  importedPres.updatedAt = new Date().toISOString();
  await savePresentation(importedPres);

  return newId;
}

/** Export a presentation as a self-contained HTML zip (index.html + media/) */
export async function exportHtmlPresentation(pres: Presentation): Promise<void> {
  const zip = new JSZip();
  const mediaPaths = collectMediaPaths(pres);

  // Fetch all media files and add to zip
  const mediaFolder = zip.folder('media')!;
  for (const src of mediaPaths) {
    try {
      const res = await fetch(src);
      if (res.ok) {
        const blob = await res.blob();
        mediaFolder.file(srcToFilename(src), blob);
      }
    } catch { /* skip missing files */ }
  }

  // Remap src paths
  const exportPres = JSON.parse(JSON.stringify(pres)) as Presentation;
  for (const slide of exportPres.slides) {
    for (const el of slide.elements) {
      if ((el.type === 'video' || el.type === 'image') && el.src) {
        (el as any).src = `media/${srcToFilename(el.src)}`;
      }
    }
  }

  zip.file('index.html', generateHtml(exportPres));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pres.title || 'presentation'}-html.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

function generateHtml(pres: Presentation): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(pres.title || 'Presentation')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Roboto&family=Open+Sans&family=Lato&family=Montserrat&family=Oswald&family=Playfair+Display&family=Pacifico&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:system-ui,sans-serif}
#stage{position:absolute;width:960px;height:540px;transform-origin:top left;overflow:hidden}
.el{position:absolute}
.el img{width:100%;height:100%;object-fit:cover;display:block}
.el video{width:100%;height:100%;object-fit:cover;display:block}
.el svg{width:100%;height:100%;display:block}
#dots{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:10}
.dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.25);transition:background .2s;cursor:pointer}
.dot.active{background:rgba(255,255,255,0.8)}
#nav-left,#nav-right{position:fixed;top:0;height:100%;width:30%;z-index:5;cursor:pointer}
#nav-left{left:0}
#nav-right{right:0}
</style>
</head>
<body>
<div id="stage"></div>
<div id="dots"></div>
<div id="nav-left"></div>
<div id="nav-right"></div>
<script>
const PRES=${JSON.stringify(pres).replace(/<\//g, '<\\/')};
let idx=0;
const stage=document.getElementById('stage');
const dots=document.getElementById('dots');

function escHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}

function strokeToPath(s){
  if(!s.points||!s.points.length)return'';
  return s.points.map((p,i)=>(i===0?'M':'L')+' '+p.x+' '+p.y).join(' ');
}

function initChromaKey(canvas,video,keyColor,tolerance){
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false});
  if(!gl)return;
  function mkS(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s;}
  const prog=gl.createProgram();
  gl.attachShader(prog,mkS(gl.VERTEX_SHADER,'attribute vec2 a;varying vec2 v;void main(){v=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}'));
  gl.attachShader(prog,mkS(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D u;uniform vec3 k;uniform float t;varying vec2 v;void main(){vec4 c=texture2D(u,v);gl_FragColor=distance(c.rgb,k)<t?vec4(0.):c;}'));
  gl.linkProgram(prog);gl.useProgram(prog);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const aLoc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(aLoc);gl.vertexAttribPointer(aLoc,2,gl.FLOAT,false,0,0);
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(p=>gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE));
  [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER].forEach(p=>gl.texParameteri(gl.TEXTURE_2D,p,gl.LINEAR));
  const uKey=gl.getUniformLocation(prog,'k'),uTol=gl.getUniformLocation(prog,'t');
  gl.uniform3f(uKey,parseInt(keyColor.slice(1,3),16)/255,parseInt(keyColor.slice(3,5),16)/255,parseInt(keyColor.slice(5,7),16)/255);
  gl.uniform1f(uTol,tolerance);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  var raf;
  (function draw(){
    if(video.readyState>=2){
      if(video.videoWidth>0&&canvas.width!==video.videoWidth){canvas.width=video.videoWidth;canvas.height=video.videoHeight;gl.viewport(0,0,canvas.width,canvas.height);}
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
    raf=requestAnimationFrame(draw);
  })();
  return raf;
}

var activeRafs=[];

function renderSlide(i){
  idx=i;
  activeRafs.forEach(function(r){cancelAnimationFrame(r)});
  activeRafs=[];
  const slide=PRES.slides[i];
  stage.style.background=slide.background;
  stage.innerHTML='';
  slide.elements.forEach(el=>{
    const div=document.createElement('div');
    div.className='el';
    div.style.cssText='left:'+el.x+'px;top:'+el.y+'px;width:'+el.width+'px;height:'+el.height+'px;';
    if(el.type==='image'){
      div.innerHTML='<img src="'+el.src+'" alt="">';
    }else if(el.type==='video'){
      const v=document.createElement('video');
      v.src=el.src;v.loop=!!el.loop;v.muted=!!el.muted;v.playsInline=true;
      if(el.autoplay)v.autoplay=true;
      if(el.chromaKey){
        v.style.display='none';
        const c=document.createElement('canvas');
        c.width=el.naturalWidth||el.width;c.height=el.naturalHeight||el.height;
        c.style.cssText='width:100%;height:100%;display:block;';
        div.appendChild(v);div.appendChild(c);
        activeRafs.push(initChromaKey(c,v,el.chromaKey.color,el.chromaKey.tolerance));
      }else{
        v.controls=true;
        div.appendChild(v);
      }
    }else if(el.type==='text'){
      div.style.fontSize=el.fontSize+'px';
      div.style.color=el.color;
      div.style.fontFamily=el.fontFamily??'Arial, sans-serif';
      div.style.lineHeight='1.3';
      div.innerHTML=el.content;
    }else if(el.type==='drawing'){
      const ns='http://www.w3.org/2000/svg';
      const svg=document.createElementNS(ns,'svg');
      svg.setAttribute('viewBox','0 0 '+el.width+' '+el.height);
      (el.strokes||[]).forEach(s=>{
        const p=document.createElementNS(ns,'path');
        p.setAttribute('d',strokeToPath(s));
        p.setAttribute('fill','none');
        p.setAttribute('stroke',s.color);
        p.setAttribute('stroke-width',String(s.width));
        p.setAttribute('stroke-linecap','round');
        p.setAttribute('stroke-linejoin','round');

        svg.appendChild(p);
      });
      div.appendChild(svg);
    }
    stage.appendChild(div);
  });
  updateDots();
  resize();
}

function updateDots(){
  dots.innerHTML='';
  PRES.slides.forEach((_,i)=>{
    const d=document.createElement('div');
    d.className='dot'+(i===idx?' active':'');
    d.onclick=()=>renderSlide(i);
    dots.appendChild(d);
  });
}

function resize(){
  const s=Math.min(innerWidth/960,innerHeight/540);
  stage.style.transform='scale('+s+')';
  stage.style.left=(innerWidth-960*s)/2+'px';
  stage.style.top=(innerHeight-540*s)/2+'px';
}

function next(){if(idx<PRES.slides.length-1)renderSlide(idx+1)}
function prev(){if(idx>0)renderSlide(idx-1)}

window.addEventListener('resize',resize);
window.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key===' ')next();
  else if(e.key==='ArrowLeft'||e.key==='ArrowUp')prev();
});
document.getElementById('nav-right').onclick=next;
document.getElementById('nav-left').onclick=prev;

// Touch swipe
let tx=0;
document.addEventListener('touchstart',e=>{tx=e.touches[0].clientX});
document.addEventListener('touchend',e=>{
  const dx=e.changedTouches[0].clientX-tx;
  if(dx<-50)next();else if(dx>50)prev();
});

renderSlide(0);
</scr` + `ipt>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', mov: 'video/quicktime', avi: 'video/x-msvideo',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}
