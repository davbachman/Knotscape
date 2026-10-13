import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createEngine} from '../web/engine.mjs';
import {fixedLocus} from '../web/fixed-sets.mjs';
import {readLinkSmith,writeLinkSmith} from '../web/drawing-files.mjs';
import {normalizeDrawing,editDrawing,cutEdges,alternateDrawing,drawingCrossings} from '../web/editor.mjs';
import {linkProjection,drawingDT} from '../web/core.mjs';
const engine=createEngine(p=>readFile(new URL('../web/'+p,import.meta.url)));
const tetrahedron=[{neighbors:[-1,-1,-1,-1],cusps:[-1,-1,-1,-1],gluings:Array(4).fill([0,1,2,3])}];
test('fixed loci distinguish identity, reflection, rotation axis and isolated point',()=>{
 assert.equal(fixedLocus(tetrahedron,[[0,0,1,2,3]]).dimension,3);
 const reflection=fixedLocus(tetrahedron,[[0,1,0,2,3]]);assert.equal(reflection.type,'1 surface');assert.equal(reflection.parts[0].euler,1);
 const rotation=fixedLocus(tetrahedron,[[0,1,2,0,3]]);assert.equal(rotation.type,'1 arc');assert.equal(rotation.parts[0].euler,1);
 assert.equal(fixedLocus(tetrahedron,[[0,1,2,3,0]]).type,'1 point');
});
test('figure-eight fixed loci include strong inversions, a periodic axis and isolated fixed points',async()=>{
 const {symmetry:s}=await engine.execute('symmetry',{knot:{dt:[4,6,8,2],id:1}});
 assert.deepEqual(s.isometries.map(i=>i.fixedComplement.type).sort(),['Entire complement','1 circle','2 arcs','2 arcs','2 points','2 points','Empty','Empty'].sort());
 for(const iso of s.isometries){if(iso.fixedComplement.type==='2 arcs')assert.equal(iso.fixedS3,'Circle');if(iso.fixedComplement.type==='2 points')assert.equal(iso.fixedS3,'Two points');}
});
test('isometry maps respect the exact canonical face identifications',async()=>{
 for(const dt of [[4,6,8,2],[6,8,10,12,14,16,2,4]]){
  const {symmetry:s}=await engine.execute('symmetry',{knot:{dt,id:1}});
  for(const iso of s.isometries)for(let t=0;t<s.triangulation.length;t++)for(let f=0;f<4;f++){
   const source=s.triangulation[t],map=iso.tetrahedra[t],target=s.triangulation[map[0]],neighborMap=iso.tetrahedra[source.neighbors[f]],targetFace=map[f+1];
   assert.equal(target.neighbors[targetFace],neighborMap[0]);
   for(let v=0;v<4;v++)assert.equal(target.gluings[targetFace][map[v+1]],neighborMap[source.gluings[f][v]+1]);
  }
 }
});
test('imports original LinkSmith files and preserves crossings on round trip',async()=>{
 for(const filename of ['trefoil.lsd','link.lsd']){
  const original=readLinkSmith(await readFile(new URL('fixtures/'+filename,import.meta.url),'utf8'));
  const loops=original.components.map(c=>c.points),projection=linkProjection(loops,new Set(original.switched));
  const restored=readLinkSmith(writeLinkSmith(loops,new Set(original.switched)));
  assert.equal(linkProjection(restored.components.map(c=>c.points),new Set(restored.switched)).klp,projection.klp);
  if(filename==='trefoil.lsd')assert.equal((await engine.execute('invariants',{knot:{dt:drawingDT(original.components[0].points,new Set(original.switched)),id:1}})).determinant,3);
 }
});
test('does not evaluate Tcl or accept incomplete LinkSmith crossing records',()=>{
 assert.throws(()=>readLinkSmith('exec rm -rf /\n0\n0'));
 assert.throws(()=>readLinkSmith('1 0 0 1 1 navy 1 2 1 1 1\n0\n0'),/connections/);
});

test('LinkSmith open arcs, widths and colors survive file round trips',()=>{
 const d=normalizeDrawing({version:2,components:[{points:[[100,100],[400,400]],closed:false,color:'#ff0000',width:6},{points:[[100,400],[400,100]],closed:false,color:'#000080',width:2}],active:0,switched:['0:0:1:0']});
 const restored=readLinkSmith(writeLinkSmith(d));assert.equal(restored.components.length,2);assert.ok(restored.components.every(c=>!c.closed));assert.equal(restored.components[0].color,'#ff0000');assert.equal(restored.components[0].width,6);assert.deepEqual(restored.switched,d.switched);
});
test('reversing a drawn component preserves its knot and cutting creates open arcs',async()=>{
 const d=readLinkSmith(await readFile(new URL('fixtures/trefoil.lsd',import.meta.url),'utf8'));
 const invariant=async()=>engine.execute('polynomials',{knot:{dt:drawingDT(d.components[0].points,new Set(d.switched)),id:1}});
 const before=await invariant();editDrawing(d,()=>d.components[0].points.reverse());assert.equal((await invariant()).jones,before.jones);
 cutEdges(d,new Set(['0:1']));assert.equal(d.components.length,1);assert.equal(d.components[0].closed,false);
});
test('alternation gives alternating over/under visits on a closed projection',async()=>{
 const d=readLinkSmith(await readFile(new URL('fixtures/trefoil.lsd',import.meta.url),'utf8'));alternateDrawing(d);
 const p=linkProjection(d.components.map(c=>c.points),new Set(d.switched));for(const visits of p.visits)for(let i=0;i<visits.length;i++)assert.notEqual(visits[i].over,visits[(i+1)%visits.length].over);
});
test('degenerate drawing edges are rejected before triangulation',()=>{
 assert.throws(()=>linkProjection([[[100,100],[100,100],[200,200]]]),/too short/);
 assert.throws(()=>linkProjection([[[100,100],[300,100],[200,300]],[[200,100],[400,100],[400,400]]]),/overlap|touch/);
});
