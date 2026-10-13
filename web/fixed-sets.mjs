/**
 * Fixed loci of a simplicial automorphism of a (possibly ideal) triangulation.
 * Barycentric subdivision removes inversions: an invariant flag simplex is
 * fixed pointwise because its vertices have distinct original dimensions.
 * Face-gluing union-find identifies flags, not just their vertex sets; this
 * is essential for ideal triangulations with repeated vertices and edges.
 * Ideal vertices are truncated before counting the fixed components.
 */
const flags=[];
function chains(prefix=[],last=0){for(let s=1;s<16;s++)if(s!==last&&(s&last)===last){const next=[...prefix,s];flags.push(next);chains(next,s);}}
chains();
const flagIndex=new Map(flags.map((f,i)=>[f.join(','),i])),stride=flags.length;
const imageMask=(mask,permutation)=>{let out=0;for(let v=0;v<4;v++)if(mask&(1<<v))out|=1<<permutation[v];return out;};
class UnionFind{constructor(n){this.parent=Array.from({length:n},(_,i)=>i);}find(x){while(this.parent[x]!==x){this.parent[x]=this.parent[this.parent[x]];x=this.parent[x];}return x;}join(a,b){a=this.find(a);b=this.find(b);if(a!==b)this.parent[b]=a;}}

export function fixedLocus(triangulation, maps) {
  if(!triangulation?.length||maps.length!==triangulation.length)throw new Error('Missing canonical triangulation for fixed-point calculation.');
  const n=triangulation.length,uf=new UnionFind(n*stride);
  for(let t=0;t<n;t++)for(let i=0;i<stride;i++)for(let face=0;face<4;face++){
    const neighbor=triangulation[t].neighbors[face];if(neighbor<0)continue;
    if(flags[i].at(-1)&(1<<face))continue;
    const mapped=flags[i].map(mask=>imageMask(mask,triangulation[t].gluings[face]));
    uf.join(t*stride+i,neighbor*stride+flagIndex.get(mapped.join(',')));
  }
  const representatives=new Map();for(let id=0;id<n*stride;id++)representatives.set(uf.find(id),id);
  const fixed=new Map();
  for(const [root,id]of representatives){const t=Math.floor(id/stride),f=flags[id%stride],map=maps[t],image=map[0]*stride+flagIndex.get(f.map(mask=>imageMask(mask,map.slice(1))).join(','));if(uf.find(image)===root)fixed.set(root,{id,t,flag:f,dimension:f.length-1});}
  const boundary=cell=>cell.flag.map((_,i)=>uf.find(cell.t*stride+flagIndex.get(cell.flag.filter((_,j)=>i!==j).join(','))));
  for(const cell of fixed.values())if(cell.dimension>0)for(const face of boundary(cell))if(!fixed.has(face))throw new Error('Inconsistent fixed subcomplex.');
  const ideal=new Set([...fixed].filter(([,c])=>c.dimension===0&&(c.flag[0]&(c.flag[0]-1))===0&&triangulation[c.t].cusps[Math.log2(c.flag[0])]>=0).map(([r])=>r));
  const dimensions=[0,0,0,0];for(const c of fixed.values())dimensions[c.dimension]++;
  if(dimensions[3])return {dimension:3,type:'Entire complement',components:1,cells:dimensions};
  const vertices=new Map();
  for(const [r,c]of fixed)if(c.dimension===0&&!ideal.has(r))vertices.set('v'+r,vertices.size);
  const edges=[],triangles=[];
  for(const [r,c]of fixed)if(c.dimension===1){const ends=boundary(c);const endpoint=ends.map(v=>{const label=ideal.has(v)?'end'+r:'v'+v;if(!vertices.has(label))vertices.set(label,vertices.size);return vertices.get(label);});edges.push({r,ends:endpoint,boundary:ends.some(v=>ideal.has(v))});}else if(c.dimension===2)triangles.push({r,c});
  const connectivity=new UnionFind(vertices.size),edgeIndex=new Map(edges.map(e=>[e.r,e]));for(const edge of edges)connectivity.join(...edge.ends);
  const faceCounts=new Map();
  for(const {c}of triangles){const es=boundary(c).map(r=>edgeIndex.get(r));const root=connectivity.find(es[0].ends[0]);faceCounts.set(root,(faceCounts.get(root)||0)+1);}
  const components=new Map();
  for(const [label,v]of vertices){const root=connectivity.find(v);if(!components.has(root))components.set(root,{vertices:0,edges:0,faces:faceCounts.get(root)||0,ends:0});const c=components.get(root);c.vertices++;if(label.startsWith('end'))c.ends++;}
  for(const edge of edges)components.get(connectivity.find(edge.ends[0])).edges++;
  // A fixed triangle meeting an ideal vertex becomes a quadrilateral and adds
  // one truncation boundary edge. No extra 2-cell is introduced.
  for(const {c}of triangles){const es=boundary(c).map(r=>edgeIndex.get(r));if(es.some(e=>e.boundary))components.get(connectivity.find(es[0].ends[0])).edges++;}
  const parts=[...components.values()].map(c=>({...c,euler:c.vertices-c.edges+c.faces,type:c.faces?'Surface':c.edges?(c.ends||c.vertices-c.edges===1?'Arc':'Circle'):'Point'}));
  const summary=new Map();parts.forEach(p=>summary.set(p.type,(summary.get(p.type)||0)+1));
  const type=parts.length?[...summary].map(([type,count])=>count+' '+type.toLowerCase()+(count>1?'s':'')).join(', '):'Empty';
  return {dimension:parts.some(p=>p.faces)?2:parts.some(p=>p.edges)?1:parts.length?0:-1,type,components:parts.length,parts,cells:dimensions};
}

export function classifySymmetryFixedSets(symmetry){
  for(const iso of symmetry.isometries){
    iso.fixedComplement=fixedLocus(symmetry.triangulation,iso.tetrahedra);
    const f=iso.fixedComplement,m=iso.cuspAction;
    // For finite-order knot symmetries extending over S³, a nontrivial
    // orientation-preserving action has fixed set S¹ or empty (Smith theory).
    // The longitude action detects whether the knot itself has two fixed points.
    const reversesAmbient=m[0][0]*m[1][1]-m[0][1]*m[1][0]<0;
    if(iso.order===1)iso.fixedS3='Entire S³';
    else if(!iso.extendsToLink)iso.fixedS3='Does not extend over the knot';
    else if(!reversesAmbient)iso.fixedS3=f.dimension>=0||m[1][1]===-1?'Circle':'Empty';
    else if(f.dimension===2)iso.fixedS3='Sphere';
    else iso.fixedS3=f.dimension===0||m[1][1]===-1?'Two points':'Empty';
  }
  return symmetry;
}
