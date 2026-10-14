import {validateDT, record, pairs, parsePolynomials, bivariate, COUNTS} from './core.mjs';
import {classifySymmetryFixedSets} from './fixed-sets.mjs';
import {boundarySlopes,torusTwoBridgeFraction} from './boundary-slopes.mjs';

const fileCache = new Map();
export async function fetchBytes(path) {
  if(globalThis.KNOTSCAPE_ASSETS?.[path])return Uint8Array.from(atob(globalThis.KNOTSCAPE_ASSETS[path]),c=>c.charCodeAt(0));
  if (!fileCache.has(path)) fileCache.set(path, (async () => {
    const res = await fetch(new URL(path, import.meta.url));
    if (!res.ok) throw new Error(`Could not load ${path} (${res.status}). Reload when connected or install the offline app.`);
    return new Uint8Array(await res.arrayBuffer());
  })().catch(e => {fileCache.delete(path); throw e;}));
  return fileCache.get(path);
}
export function createEngine(load = fetchBytes) {
  async function run(name, args, files, outputs) {
    const {default: factory} = await import(`./wasm/${name}.mjs`);
    const diagnostics = [];
    // Supplying bytes still makes Emscripten resolve its binary URL. A Blob
    // worker has no relative URL base, so bypass that unused resolution.
    const instance = await factory({wasmBinary: await load(`wasm/${name}.wasm`), locateFile:path=>path, noInitialRun:true, noExitRuntime:false, print:s=>diagnostics.push(s), printErr:s=>diagnostics.push(s)});
    for (const [path, contents] of Object.entries(files)) {
      const parent = path.slice(0, path.lastIndexOf('/'));
      if (parent) instance.FS.mkdirTree(parent);
      instance.FS.writeFile(path, contents);
    }
    let status = instance.callMain(args);
    if (status && status !== 0) throw new Error(diagnostics.join('\n') || `${name} could not complete this calculation (code ${status}).`);
    const result = {};
    for (const path of outputs) {
      try {result[path] = instance.FS.readFile(path, {encoding:'utf8'});}
      catch {throw new Error(diagnostics.join('\n') || `${name} did not produce a result for this diagram.`);}
    }
    return result;
  }
  async function check(knot, allowComposite=false) {
    validateDT(knot.dt);
    const result = await run('checkknot',['/in','/out','/scratch'],{'/in':record(knot)},['/out']);
    const message=result['/out'].trim();
    if (message !== 'OK' && !(allowComposite && message.includes('prime diagram'))) throw new Error(message.replace(/^Line\s+\d+:\s*/, ''));
  }
  async function execute(action, payload) {
    if (action === 'boundary-slopes-fraction') return boundarySlopes(payload.p,payload.q);
    if (action === 'link-triangulation') {
      if(typeof payload.klp!=='string'||payload.klp.length>20000||!/^[\d\s]+$/.test(payload.klp))throw new Error('Invalid link projection.');
      return (await run('hyperbolic',['5','/in','/out'],{'/in':payload.klp},['/out']))['/out'];
    }
    if (action === 'table') {
      const {crossings:n,type,first=1,last=first}=payload;
      const max=COUNTS[type]?.[n];
      if (!max || !Number.isInteger(first) || !Number.isInteger(last) || first<1 || last>max || last<first) throw new Error('Select a valid range of table entries.');
      const out=await run(`decode_${type}`,['/table','/out',String(first),String(last)],{'/table':await load(`data/knotTable/${n}${type}.pak`)},['/out']);
      return out['/out'].trim().split('\n').map(s=>{const [n,id,...dt]=s.trim().split(/\s+/).map(Number);return {dt,id,name:`${n}${type}${id}`,type};});
    }
    if (action === 'braid') {
      const word=payload.word.trim();
      // KnotScape's braid input is alphabetic: a=sigma_1, A=sigma_1^-1.
      if (!/^[a-sA-S]+$/.test(word) || word.length>49) throw new Error('Use 1–49 letters a–s; capitals mean inverse generators.');
      const out=await run('braid2dt',['/in','/out'],{'/in':word+'\n'},['/out']);
      const nums=out['/out'].trim().split(/\s+/).map(Number);
      if(nums.some(v=>!Number.isFinite(v))) throw new Error(out['/out'].trim());
      const knot={dt:nums.slice(2),id:1,name:`Braid ${word}`};validateDT(knot.dt);return knot;
    }
    const knot=payload.knot;
    await check(knot,action==='locate');
    const input=record(knot);
    if (action === 'validate') return {valid:true};
    if (action === 'boundary-slopes') {
      const invariants=await execute('invariants',{knot});
      let fraction=torusTwoBridgeFraction(knot.dt,invariants.signature), recognition='Standard torus-knot diagram';
      if(!fraction && knot.dt.length<=30) {
        const out=await run('hyperbolic',['6','/in','/out'],{'/in':input},['/out']);
        fraction=JSON.parse(out['/out']).twoBridge;
        recognition='SnapPea canonical triangulation';
      }
      if(!fraction) {
        const reduced=(await run('knotfind',['/in','/out'],{'/in':input},['/out']))['/out'].trim();
        const parts=[...reduced.matchAll(/\{([^}]+)\}/g)];
        if(parts.length===1) fraction=torusTwoBridgeFraction(parts[0][1].trim().split(/\s+/).map(Number).slice(1),invariants.signature);
        recognition='Reduced torus-knot diagram';
      }
      if(!fraction) return {recognized:false,message:knot.dt.length>30
        ? 'Automatic hyperbolic recognition is limited to 30 crossings. Enter a known two-bridge fraction below.'
        : 'A two-bridge presentation was not recognized. This does not prove the knot is not two-bridge. Try Identify knot, or enter a known two-bridge fraction below.'};
      return {...boundarySlopes(fraction.p,fraction.q),recognized:true,recognition};
    }
    if (action === 'diagram' || action === 'postscript') {
      const out=await run('draw',['/in','/triang','/packing','/vertices','/segments'],{'/in':input},['/vertices','/segments']);
      if (action === 'postscript') return (await run('draw2ps',['/in','/segments','/out'],{'/in':input,'/segments':out['/segments']},['/out']))['/out'];
      const lines=out['/segments'].trim().split('\n').map(pairs), n=knot.dt.length*2;
      return {vertices:pairs(out['/vertices']),short:lines.slice(0,n),long:lines.slice(n)};
    }
    if (action === 'invariants') {
      const out=await run('glsig',['/in','/out'],{'/in':input},['/out']);
      const values=out['/out'].trim().split(/\s+/).map(Number);
      return {determinant:values.at(-2),signature:values.at(-1),raw:out['/out']};
    }
    if (action === 'polynomials' || action === 'kauffman' || action === 'ewing') {
      const translated=await run('mbt_ken',['/in','/ken','/state'],{'/in':input},['/ken','/state']);
      if(translated['/state'].trim()==='1')throw new Error('This diagram could not be converted to Ewing–Millett notation.');
      if(action==='ewing')return translated['/ken'];
      if(action==='kauffman') {
        const out=await run('poly2',['/ken','/out'],{'/ken':translated['/ken']},['/out']);
        return {polynomial:bivariate(out['/out'],'a',1),raw:out['/out']};
      }
      const out=await run('poly1',['/ken','/alex','/jones','/homfly'],{'/ken':translated['/ken']},['/alex','/jones','/homfly']);
      return {...parsePolynomials({alexander:out['/alex'],jones:out['/jones'],homfly:out['/homfly']}),homfly:bivariate(out['/homfly'],'v',2)};
    }
    if (['geometry','symmetry','cusp','triangulation','group'].includes(action)) {
      const mode={geometry:0,symmetry:1,cusp:2,triangulation:3,group:4}[action];
      const out=await run('hyperbolic',[String(mode),'/in','/out',String(payload.cutoff||0.15)],{'/in':input},['/out']);
      if(action==='triangulation')return out['/out'];
      const parsed=JSON.parse(out['/out']);
      if(action==='symmetry'&&parsed.symmetry)classifySymmetryFixedSets(parsed.symmetry);
      return parsed;
    }
    if (action === 'representations') {
      const cycle=Number(payload.cycle||1);
      if (!Number.isInteger(cycle)||cycle<1||cycle>6) throw new Error('Choose a cycle type.');
      const out=await run('knot_group_reps',['/hom','/cycles','/in','/out'],{'/hom':await load('data/lib/hom_data'),'/cycles':await load('data/lib/cyclenotation'),'/in':`1 ${cycle} ${payload.homology?1:0}\n${input}`},['/out']);
      return out['/out'].trim()||'No homomorphisms of this cycle type.';
    }
    if (action === 'locate') {
      const queue=[knot], factors=[];
      for(let steps=0;queue.length;steps++) {
        if(steps>100)throw new Error('The simplifier exceeded its decomposition limit.');
        const item=queue.shift();
        const result=(await run('knotfind',['/in','/out'],{'/in':record(item)},['/out']))['/out'].trim();
        if(result==='unknot')continue;
        const parts=[...result.matchAll(/\{([^}]+)\}/g)].map(m=>m[1].trim().split(/\s+/).map(Number));
        if(!parts.length)throw new Error('Could not simplify this diagram.');
        if(parts.length>1) {queue.push(...parts.map(v=>({dt:v.slice(2),id:1})));continue;}
        const dt=parts[0].slice(1),n=dt.length,type=dt.some(v=>v<0)?'n':'a';
        if(n>16){factors.push({dt,name:'Reduced diagram (outside the tables)'});continue;}
        if(!COUNTS[type][n]){factors.push({dt,name:'Reduced diagram; no table match'});continue;}
        const seq=n+' '+dt.join(' ')+'\n';
        if(n>=14&&type==='n') {
          const files={'/in':seq,'/duplicates':await load('data/knotTable/duplicates')};
          for(let k=13;k<=16;k++)files[`/knotTable/${k}n.pak`]=await load(`data/knotTable/${k}n.pak`);
          const duplicate=(await run('dupsearch',['/in','/duplicates','/out'],files,['/out']))['/out'].trim();
          if(duplicate){const [count,id,...code]=duplicate.split(/\s+/).map(Number);factors.push({dt:code,id,name:`${count}n${id}`});continue;}
        }
        const found=(await run(`locate_${type}`,['/table','/in','/out'],{'/table':await load(`data/knotTable/${n}${type}.pak`),'/in':seq},['/out']))['/out'].trim();
        const values=found.split(/\s+/).map(Number);
        factors.push({dt,id:values[0]||null,name:found?`${n}${type}${values[0]}`:'No table match',raw:found});
      }
      return {factors,unknot:!factors.length};
    }
    throw new Error('Unknown calculation: '+action);
  }
  return {execute,run,check};
}
