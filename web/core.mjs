export const COUNTS = {
  a: {3:1,4:1,5:2,6:3,7:7,8:18,9:41,10:123,11:367,12:1288,13:4878,14:19536,15:85263,16:379799},
  n: {3:0,4:0,5:0,6:0,7:0,8:3,9:8,10:42,11:185,12:888,13:5110,14:27436,15:168030,16:1008906},
};
export function validateDT(dt) {
  if (!Array.isArray(dt) || dt.length < 1 || dt.length > 49) throw new Error('Enter a knot with 1–49 crossings.');
  if (dt.some(v => !Number.isSafeInteger(v) || !v || v % 2 || Math.abs(v) > dt.length * 2)) throw new Error('DT entries must be nonzero even integers, from ±2 through ±' + dt.length * 2 + '.');
  if (new Set(dt.map(Math.abs)).size !== dt.length) throw new Error('Every even crossing label must occur exactly once.');
  return dt;
}
export function parseDT(text, format = 'dt') {
  const lines = text.trim().split(/\n/).filter(s => s.trim());
  if (!lines.length) throw new Error('Enter a DT code first.');
  if (lines.length > 1100000) throw new Error('This file exceeds the workspace capacity.');
  return lines.map((line, index) => {
    if (!/^[\s\d,\[\](){}+\-]+$/.test(line)) throw new Error(`Line ${index + 1}: use integers separated by spaces or commas.`);
    const values = line.replace(/[\[\](){}]/g, '').trim().split(/[\s,]+/).map(Number);
    let id = index + 1, dt = values;
    if (format === 'records') {
      if (values[0] !== values.length - 2 || !Number.isSafeInteger(values[1]) || values[1] < 1 || values[1] > 9999999) throw new Error(`Line ${index + 1}: use “crossings ID DT-code”.`);
      id = values[1]; dt = values.slice(2);
    }
    validateDT(dt);
    return {dt, id, name: `Custom knot ${id}`};
  });
}
export function record(knot) {
  // The original drawing engine uses field widths %3d%8d.
  const id=knot.id||1;
  if(!Number.isSafeInteger(id)||id<1||id>9999999)throw new Error('Knot IDs must be positive integers with at most seven digits.');
  return `${String(knot.dt.length).padStart(3)}${String(id).padStart(8)}   ${knot.dt.join(' ')}\n`;
}
export function polynomial(coefficients, low = 0, variable = 't', step = 1) {
  return coefficients.map((c, i) => ({c, e: low + i * step})).filter(t => t.c).reverse().map(({c,e}, i) => {
    const sign = c < 0 ? (i ? ' − ' : '−') : (i ? ' + ' : '');
    return sign + ((Math.abs(c) !== 1 || e === 0) ? Math.abs(c) : '') + (e === 0 ? '' : variable + (e === 1 ? '' : `^${e}`));
  }).join('') || '0';
}
export function parsePolynomials(raw) {
  const a = raw.alexander.trim().split(/\s+/).map(Number).slice(2);
  const j = raw.jones.trim().split(/\s+/).map(Number);
  return {alexander: polynomial(a, -(a.length-1)/2), jones: polynomial(j.slice(4), j[2]), raw};
}
export function bivariate(raw, variable, zStep) {
  const rows = raw.trim().split('\n').slice(1).filter(s => s.trim());
  return rows.map((line, i) => {
    const [low, high, ...c] = line.trim().split(/\s+/).map(Number);
    const p = polynomial(c, low, variable, 2);
    return p === '0' ? '' : `(${p})${i ? ' z' + (i*zStep === 1 ? '' : '^' + i*zStep) : ''}`;
  }).filter(Boolean).join(' + ');
}

// Quadratic B-spline conversion reproduces Tk's smooth polygon/line drawing.
export function smoothPath(points, closed = false) {
  if (!points.length) return '';
  const mid = (a,b) => [(a[0]+b[0])/2,(a[1]+b[1])/2];
  const xy = p => p.map(v => Number(v.toFixed(3))).join(' ');
  if (closed) {
    let d = 'M ' + xy(mid(points.at(-1), points[0]));
    for (let i = 0; i < points.length; i++) d += ' Q ' + xy(points[i]) + ' ' + xy(mid(points[i], points[(i+1)%points.length]));
    return d + ' Z';
  }
  let d = 'M ' + xy(points[0]);
  for (let i = 1; i < points.length-1; i++) d += ' Q ' + xy(points[i]) + ' ' + xy(i === points.length-2 ? points.at(-1) : mid(points[i],points[i+1]));
  return points.length === 2 ? d + ' L ' + xy(points[1]) : d;
}
export function pairs(text) {
  const n = text.trim().split(/\s+/).map(Number);
  return Array.from({length:n.length/2}, (_,i) => [n[i*2], n[i*2+1]]);
}

// Polygonal LinkSmith-style drawing, with independently switchable crossings.
export function intersections(points) {
  const out = [], n = points.length;
  const cross = (a,b) => a[0]*b[1]-a[1]*b[0];
  const sub = (a,b) => [a[0]-b[0],a[1]-b[1]];
  for (let i=0;i<n;i++) for (let j=i+2;j<n;j++) {
    if (i===0 && j===n-1) continue;
    const a=points[i], b=points[(i+1)%n], c=points[j], d=points[(j+1)%n];
    const r=sub(b,a), s=sub(d,c), den=cross(r,s);
    if (Math.abs(den)<1e-9) continue;
    const t=cross(sub(c,a),s)/den, u=cross(sub(c,a),r)/den;
    if (t>1e-6 && t<1-1e-6 && u>1e-6 && u<1-1e-6) out.push({i,j,t,u,x:a[0]+t*r[0],y:a[1]+t*r[1],key:`${i}:${j}`});
  }
  return out;
}
export function drawingDT(points, switched = new Set()) {
  const xs = intersections(points);
  if (!xs.length) return [];
  for (let i=0;i<xs.length;i++) for(let j=i+1;j<xs.length;j++) if(Math.hypot(xs[i].x-xs[j].x,xs[i].y-xs[j].y)<0.01) throw new Error('Move the strands so that only two meet at each crossing.');
  const visits=xs.flatMap((x,index)=>[{at:x.i+x.t,index,over:!switched.has(x.key)},{at:x.j+x.u,index,over:switched.has(x.key)}]).sort((a,b)=>a.at-b.at);
  const labeled=new Map();
  visits.forEach((v,i)=>{v.label=i+1;(labeled.get(v.index)||labeled.set(v.index,[]).get(v.index)).push(v);});
  const dt=new Array(xs.length);
  for(const [a,b] of labeled.values()) {
    if(a.label%2===b.label%2) throw new Error('This drawing is degenerate. Move vertices away from other strands.');
    const odd=a.label%2?a:b, even=a.label%2?b:a;
    dt[(odd.label-1)/2]=even.label*(odd.over?1:-1);
  }
  return validateDT(dt);
}

export function linkProjection(components, switched = new Set()) {
  if (!components.length || components.some(c=>c.length<3)) throw new Error('Close every component before exporting.');
  const crossings=crossingGeometry(components,switched);
  const visits=components.map(()=>[]);
  crossings.forEach((x,index)=>{for(let side=0;side<2;side++){const edge=side===0?x.a:x.b;visits[edge.c].push({index,at:edge.i+(side===0?x.t:x.u),strand:side===x.xStrand?0:1,over:side===x.over});}});
  visits.forEach(v=>v.sort((a,b)=>a.at-b.at));
  const rows=crossings.map(x=>({handedness:x.sign===1?0:1,components:[x.xStrand===0?x.a.c:x.b.c,x.xStrand===0?x.b.c:x.a.c],neighbors:[[null,null],[null,null]],letters:{}}));
  visits.forEach(v=>v.forEach((visit,i)=>{
    const before=v[(i+v.length-1)%v.length],after=v[(i+1)%v.length];
    rows[visit.index].neighbors[visit.strand]=[[before.index,before.strand],[after.index,after.strand]];
    const depart=visit.over?'a':crossings[visit.index].sign===1?'d':'b';
    const arrive=after.over?'c':crossings[after.index].sign===1?'b':'d';
    rows[visit.index].letters[depart]=`${after.index+1}${arrive}`;
    rows[after.index].letters[arrive]=`${visit.index+1}${depart}`;
  }));
  const freeLoops=visits.filter(v=>!v.length).length;
  const klp=`${crossings.length} ${components.length} ${freeLoops}\n`+rows.map(row=>[row.handedness,...row.components,...row.neighbors.flat(2)].join(' ')).join('\n')+'\n';
  const ewing=freeLoops?null:`${String(crossings.length).padStart(2)}.      1:\n`+rows.map((r,i)=>`${i+1}${crossings[i].sign===1?'+':'-'}${['a','b','c','d'].map(l=>r.letters[l]).join('')}`).join('\n')+'\n\n';
  return {crossings,visits,klp,ewing,freeLoops};
}

export function crossingGeometry(components,switched=new Set(),closed=components.map(()=>true)){
  const edges=components.flatMap((points,c)=>points.slice(0,closed[c]?points.length:points.length-1).map((p,i)=>({c,i,a:p,b:points[(i+1)%points.length]}))), crossings=[];
  const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
  if(edges.some(e=>Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])<.01))throw new Error('An edge is too short. Move its vertices apart.');
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
    const a=edges[i],b=edges[j];if(a.c===b.c&&(Math.abs(a.i-b.i)===1||closed[a.c]&&Math.abs(a.i-b.i)===components[a.c].length-1))continue;
    const r=[a.b[0]-a.a[0],a.b[1]-a.a[1]],s=[b.b[0]-b.a[0],b.b[1]-b.a[1]],delta=[b.a[0]-a.a[0],b.a[1]-a.a[1]],den=cross(r,s);
    if(Math.abs(den)<1e-9){
      const axis=Math.abs(r[0])>Math.abs(r[1])?0:1;
      if(Math.abs(cross(delta,r))<1e-7&&Math.max(Math.min(a.a[axis],a.b[axis]),Math.min(b.a[axis],b.b[axis]))<=Math.min(Math.max(a.a[axis],a.b[axis]),Math.max(b.a[axis],b.b[axis]))+1e-6)throw new Error('Two strands overlap or touch. Move them apart.');
      continue;
    }
    const t=cross(delta,s)/den,u=cross(delta,r)/den;
    if(t<0||t>1||u<0||u>1)continue;
    if(t<1e-6||t>1-1e-6||u<1e-6||u>1-1e-6)throw new Error('A vertex touches another strand. Move it slightly before exporting.');
    const key=a.c===0&&b.c===0?`${a.i}:${b.i}`:`${a.c}:${a.i}:${b.c}:${b.i}`;
    const over=switched.has(key)?1:0,xStrand=den<0?0:1;
    crossings.push({key,a,b,t,u,x:a.a[0]+t*r[0],y:a.a[1]+t*r[1],over,xStrand,sign:over===xStrand?1:-1});
  }
  if(crossings.length>49)throw new Error('This drawing has more than 49 crossings.');
  for(let i=0;i<crossings.length;i++)for(let j=i+1;j<crossings.length;j++)if(Math.hypot(crossings[i].x-crossings[j].x,crossings[i].y-crossings[j].y)<.01)throw new Error('Only two strands may meet at a crossing.');
  return crossings;
}
