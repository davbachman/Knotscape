import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createEngine} from '../web/engine.mjs';
import {parseDT,validateDT,drawingDT,linkProjection,COUNTS} from '../web/core.mjs';
const engine=createEngine(p=>readFile(new URL('../web/'+p,import.meta.url)));
const trefoil={dt:[4,6,2],id:1};
const figureEight={dt:[4,6,8,2],id:1};
const compute=(action,knot=trefoil,options={})=>engine.execute(action,{knot,...options});

test('DT parser distinguishes bare codes from legacy records and rejects malformed input',()=>{
  assert.deepEqual(parseDT('4, 6, 8, 2')[0].dt,figureEight.dt);
  assert.deepEqual(parseDT('4 1 4 6 8 2','records')[0].dt,figureEight.dt);
  assert.throws(()=>parseDT('4 6 javascript:2'));
  for(const code of [[4,4,2],[2,3],[2,6],Array.from({length:50},(_,i)=>2*i+2)])assert.throws(()=>validateDT(code));
});
test('rejects nonplanar DT code before entering a computational engine',async()=>{
  await assert.rejects(compute('diagram',{dt:[4,6,8,10,2],id:1}),/not realizable/);
});
test('trefoil determinant and signature; mirror reverses signature',async()=>{
  const a=await compute('invariants'),b=await compute('invariants',{dt:trefoil.dt.map(v=>-v),id:1});
  assert.equal(a.determinant,3);assert.equal(b.determinant,3);assert.equal(a.signature,-b.signature);assert.equal(Math.abs(a.signature),2);
});
test('known Alexander, Jones, HOMFLY and Kauffman polynomials of the trefoil',async()=>{
  const p=await compute('polynomials');
  assert.equal(p.alexander,'t − 1 + t^-1');assert.equal(p.jones,'−t^4 + t^3 + t');
  assert.equal(p.homfly,'(−v^4 + 2v^2) + (v^2) z^2');
  const k=await compute('kauffman');assert.equal(k.polynomial,'(−2a^-2 − a^-4) + (a^-3 + a^-5) z + (a^-2 + a^-4) z^2');
});
test('figure-eight polynomial coefficients and achirality',async()=>{
  const p=await compute('polynomials',figureEight),mirror=await compute('polynomials',{dt:figureEight.dt.map(v=>-v),id:1});
  assert.equal(p.alexander,'−t + 3 − t^-1');assert.equal(p.jones,'t^2 − t + 1 − t^-1 + t^-2');assert.equal(p.jones,mirror.jones);
});
test('poly engines are reentrant through separate instances',async()=>{
  const a=await compute('polynomials');await compute('polynomials',figureEight);const b=await compute('polynomials');assert.deepEqual(a,b);
});
test('braid closure recovers trefoil, and detects multi-component closures',async()=>{
  assert.deepEqual((await engine.execute('braid',{word:'aaa'})).dt,trefoil.dt);
  const figure=await engine.execute('braid',{word:'aBaB'});assert.equal((await compute('invariants',figure)).determinant,5);
  await assert.rejects(engine.execute('braid',{word:'aa'}),/more than one component/);
});
test('original tables decode first and final entries through 16 crossings',async()=>{
  for(const [n,type] of [[3,'a'],[8,'n'],[12,'a'],[16,'a'],[16,'n']]){
    const last=COUNTS[type][n];const knots=await engine.execute('table',{crossings:n,type,first:last,last});
    assert.equal(knots.length,1);assert.equal(knots[0].id,last);assert.equal(knots[0].dt.length,n);validateDT(knots[0].dt);
  }
});
test('table lookup matches decoded knots in both tables',async()=>{
  for(const [n,type,id]of [[5,'a',2],[8,'n',2],[10,'a',123],[16,'n',1008906]]){
    const [k]=await engine.execute('table',{crossings:n,type,first:id,last:id});const located=await compute('locate',k);
    assert.equal(located.factors.length,1);assert.equal(located.factors[0].name,`${n}${type}${id}`);
  }
});
test('prime decomposition separates a connected sum',async()=>{
  const result=await compute('locate',{dt:[4,6,2,10,12,8],id:1});assert.equal(result.factors.length,2);assert.ok(result.factors.every(f=>f.name==='3a1'));
});
test('diagram paths have finite coordinates and the right crossing visits',async()=>{
  const d=await compute('diagram',figureEight);assert.equal(d.vertices.length,16);assert.equal(d.short.length,8);assert.equal(d.long.length,8);assert.ok(d.vertices.flat().every(Number.isFinite));
});
test('figure-eight hyperbolic invariants and cusp geometry match reference values',async()=>{
  const g=await compute('geometry',figureEight);assert.equal(g.solutionType,1);assert.ok(Math.abs(g.volume-2.029883212819307)<1e-10);assert.ok(Math.abs(g.cuspVolume-Math.sqrt(3))<1e-10);assert.ok(Math.abs(Math.hypot(...g.meridian)-1)<1e-10);
  const cusp=await compute('cusp',figureEight);assert.ok(cusp.horoballs.length>0);assert.ok(cusp.canonical.length>0);assert.ok(cusp.ford.length>0);assert.ok(cusp.horoballs.every(v=>v.every(Number.isFinite)&&v[2]>0));
});
test('figure-eight has D4 symmetry of order 8 and is amphicheiral',async()=>{
  const {symmetry:s}=await compute('symmetry',figureEight);assert.equal(s.order,8);assert.equal(s.linkOrder,8);assert.equal(s.dihedral,true);assert.equal(s.amphicheiral,true);assert.equal(s.invertible,true);assert.equal(s.isometries.length,8);
});
test('nonhyperbolic trefoil is not assigned a made-up volume',async()=>{
  const g=await compute('geometry');assert.equal(g.volume,undefined);assert.notEqual(g.solutionType,1);
});
test('fundamental group and triangulation export contain real data',async()=>{
  const group=await compute('group',figureEight);assert.equal(group.generators,2);assert.equal(group.relations.length,1);assert.ok(group.meridian.length);const tri=await compute('triangulation',figureEight);assert.ok(tri.startsWith('% Triangulation'));assert.match(tri,/geometric_solution/);assert.match(await compute('postscript'),/^%!PS-Adobe/);
});
test('S5 meridional representations and branched-cover homology execute',async()=>{
  const reps=await compute('representations',trefoil,{cycle:1,homology:true});assert.match(reps,/S3/);assert.match(reps,/3/);
});
test('polygonal trefoil converts to valid DT and changes when crossings switch',async()=>{
  const points=Array.from({length:7},(_,i)=>{const t=2*Math.PI*i/7;return[320+230*Math.cos(3*t),320+230*Math.sin(3*t)];});
  const code=drawingDT(points);validateDT(code);const projection=linkProjection([points]);assert.ok(projection.ewing);assert.ok(projection.crossings.length>0);
  const switched=drawingDT(points,new Set([projection.crossings[0].key]));assert.notDeepEqual(code,switched);
});
test('multi-component drawing exports linked and crossing-free components',async()=>{
  const loops=[[[120,240],[360,240],[360,480],[120,480]],[[240,120],[480,120],[480,360],[240,360]]];
  const p=linkProjection(loops,new Set(['0:0:1:3']));assert.equal(p.crossings.length,2);assert.equal(p.freeLoops,0);assert.ok(p.ewing);const tri=await engine.execute('link-triangulation',{klp:p.klp});assert.ok(tri.startsWith('% Triangulation'));assert.match(tri,/2 0/);
  const free=linkProjection([[[100,100],[200,100],[150,200]]]);assert.equal(free.freeLoops,1);assert.equal(free.ewing,null);const unknot=await engine.execute('link-triangulation',{klp:free.klp});assert.match(unknot,/% Triangulation/);
});
