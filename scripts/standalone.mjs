// Bundle a portable HTML document with all computation assets and sources.
import {build} from 'esbuild';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const data={};
async function collect(dir,prefix){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name),key=prefix+'/'+e.name;if(e.isDirectory())await collect(p,key);else if(!e.name.endsWith('.mjs'))data[key]=(await readFile(p)).toString('base64');}}
await collect(path.join(root,'web/wasm'),'wasm');
await collect(path.join(root,'web/data'),'data');
const worker=await build({entryPoints:[path.join(root,'web/worker.mjs')],bundle:true,write:false,format:'esm',platform:'browser',external:['node:*','module'],minify:true});
const app=await build({entryPoints:[path.join(root,'web/app.mjs')],bundle:true,write:false,format:'esm',platform:'browser',minify:true});
const workerSource='globalThis.KNOTSCAPE_ASSETS='+JSON.stringify(data)+';\n'+worker.outputFiles[0].text;
const sources=(await readFile(path.join(root,'dist/source.zip'))).toString('base64');
let bootstrap='globalThis.KNOTSCAPE_WORKER_URL=URL.createObjectURL(new Blob(['+JSON.stringify(workerSource)+'],{type:"text/javascript"}));\n';
bootstrap+='const sourceLink=document.querySelector(\'a[href="sources.html"]\');sourceLink.href=URL.createObjectURL(new Blob([Uint8Array.from(atob('+JSON.stringify(sources)+'),c=>c.charCodeAt(0))],{type:"application/zip"}));sourceLink.download="knotscape-source.zip";sourceLink.textContent="Download source code and licenses →";\n';
for(const name of ['Rolfsen_DT.html','DT_Rolfsen.html'])bootstrap+='document.querySelector(\'a[href="data/doc/'+name+'"]\').href=URL.createObjectURL(new Blob([Uint8Array.from(atob('+JSON.stringify(data['data/doc/'+name])+'),c=>c.charCodeAt(0))],{type:"text/html"}));\n';
let html=await readFile(path.join(root,'web/index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+await readFile(path.join(root,'web/style.css'),'utf8')+'</style>');
const icon='data:image/svg+xml;base64,'+(await readFile(path.join(root,'web/icon.svg'))).toString('base64');
html=html.replaceAll('"icon.svg"',JSON.stringify(icon));
// A function replacer preserves literal $& / $' sequences in generated code.
html=html.replace('<script type="module" src="app.mjs"></script>',()=>'<script type="module">'+(bootstrap+app.outputFiles[0].text).replaceAll('</script','<\\/script')+'\n</script>');
html=html.replace('<button id="offline-button">Make this app available offline</button>','<button id="offline-button" disabled>This file already works offline</button>');
html=html.replace('class="brand" href="./"','class="brand" href="#"');
await writeFile(path.join(root,'dist/knotscape.html'),html);
console.log('Standalone offline app: dist/knotscape.html ('+(Buffer.byteLength(html)/1048576).toFixed(1)+' MB)');
