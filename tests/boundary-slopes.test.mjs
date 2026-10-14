import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {boundarySlopes} from '../web/boundary-slopes.mjs';
import {createEngine} from '../web/engine.mjs';

const reference=JSON.parse(await readFile(new URL('./fixtures/boundary-slopes.json',import.meta.url),'utf8'));
const engine=createEngine(path=>readFile(new URL('../web/'+path,import.meta.url)));
const compute=dt=>engine.execute('boundary-slopes',{knot:{dt,id:1}});

test('known essential boundary slopes, including torus knots and mirrors',()=>{
  for(const [p,q,slopes] of [[1,3,[0,6]],[1,5,[0,10]],[2,5,[-4,0,4]],[2,7,[-10,-4,0]],
    [-2,7,[0,4,10]],[2,9,[-8,0,4]],[-2,9,[-4,0,8]],[3,11,[-4,0,2,8]],[4,15,[-14,-8,0]]]) {
    assert.deepEqual(boundarySlopes(p,q).slopes,slopes,`${p}/${q}`);
  }
});

test('matches the independent Python reference across all reduced odd denominators through 61',()=>{
  for(const {p,q,slopes,surfaceCount,seifert} of reference.cases) {
    const actual=boundarySlopes(p,q),label=`${p}/${q}`;
    assert.deepEqual(actual.slopes,slopes,label);
    assert.equal(actual.surfaces.length,surfaceCount,label);
    assert.deepEqual(actual.surfaces.find(s=>s.seifert).expansion,seifert.map(String),label);
    assert.deepEqual(boundarySlopes(-p,q).slopes,slopes.map(s=>s===0?0:-s).reverse(),label+' mirror');
  }
});

test('every reported expansion represents the input fraction modulo one and has no unit coefficient',()=>{
  for(const {p,q} of reference.cases) {
    const result=boundarySlopes(p,q);
    assert.equal(result.surfaces.filter(s=>s.seifert).length,1);
    for(const surface of result.surfaces) {
      let numerator=0n,denominator=1n;
      for(const b of surface.expansion.toReversed().map(BigInt)) {
        assert.ok(b<=-2n||b>=2n);
        [numerator,denominator]=[denominator,b*denominator-numerator];
      }
      const delta=numerator*BigInt(q)-BigInt(p)*denominator;
      assert.equal(delta%(denominator*BigInt(q)),0n);
      assert.equal(Math.abs(surface.slope%2),0);
      if(surface.seifert) assert.equal(surface.slope,0);
    }
  }
});

test('exact arithmetic, reduction, validation and resource limits',()=>{
  assert.deepEqual(boundarySlopes('4','10'),boundarySlopes(2,5));
  assert.deepEqual(boundarySlopes('2000000000000000000000000000000000000','5000000000000000000000000000000000000'),boundarySlopes(2,5));
  for(const [p,q] of [[0,3],[3,3],[4,3],[1,0],[1,-3],['2x',5],['2.5',5],[1,4],[2,8],[1,Number.MAX_SAFE_INTEGER+1]])
    assert.throws(()=>boundarySlopes(p,q));
  assert.throws(()=>boundarySlopes(1,'1000000000000000000000000000000000001'),/No partial/);
});

test('DT recognition respects the exported SnapPea peripheral orientation and mirrors',async()=>{
  for(const [dt,expected] of [ [[4,6,2],[-6,0]], [[6,8,10,2,4],[-10,0]],
    [[4,6,8,2],[-4,0,4]], [[4,8,10,2,6],[-10,-4,0]] ]) {
    const result=await compute(dt),mirror=await compute(dt.map(x=>-x));
    assert.equal(result.recognized,true);
    assert.deepEqual(result.slopes,expected);
    assert.deepEqual(mirror.slopes,expected.map(x=>x===0?0:-x).reverse());
  }
});

test('a non-two-bridge knot has no fabricated slopes; fraction jobs need no engines or network',async()=>{
  const [knot]=await engine.execute('table',{crossings:8,type:'n',first:1});
  const unknown=await engine.execute('boundary-slopes',{knot});
  assert.equal(unknown.recognized,false);assert.equal(unknown.slopes,undefined);
  assert.match(unknown.message,/does not prove/);
  const offline=createEngine(()=>{throw new Error('Unexpected file or network access');});
  assert.deepEqual((await offline.execute('boundary-slopes-fraction',{p:'2',q:'5'})).slopes,[-4,0,4]);
});
