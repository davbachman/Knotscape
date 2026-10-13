import {crossingGeometry} from './core.mjs';
import {normalizeDrawing} from './editor.mjs';
const colorNames={navy:'#000080',red:'#ff0000',orange:'#ffa500',orange1:'#ffA500',purple:'#800080',magenta:'#ff00ff',blue:'#0000ff',green:'#008000',black:'#000000',MediumAquamarine:'#66cdaa',cyan:'#00ffff',gold:'#ffd700',brown:'#a52a2a',yellow:'#ffff00'};
// Tcl lists are data here. Never evaluate an imported drawing as a script.
export function readLinkSmith(text){
 const sections=text.trim().split(/^\s*0\s*$/m);
 if(sections.length<3)throw new Error('A LinkSmith file needs edge and crossing sections.');
 const edges=new Map(),edgeLocations=new Map(),components=[];
 for(const line of sections[0].trim().split('\n').filter(Boolean)){
  const v=line.trim().split(/\s+/),id=Number(v[0]),p=v.slice(1,5).map(Number);
  if(v.length!==11||!Number.isSafeInteger(id)||id<1||edges.has(id)||p.some(x=>!Number.isFinite(x)))throw new Error('Invalid LinkSmith edge record.');
  edges.set(id,{id,p,next:Number(v[7]),previous:Number(v[6]),color:colorNames[v[5]]||v[5],width:Number(v[10])});
 }
 if(edges.size>2000)throw new Error('Drawings can contain up to 2,000 edges.');
 const visited=new Set(),ordered=[...edges.values()].sort((a,b)=>Number(b.previous===-1)-Number(a.previous===-1));
 for(const start of ordered){
  if(visited.has(start.id))continue;
  const points=[];let edge=start,closed=false;
  while(true){
   if(!edge||visited.has(edge.id))throw new Error('Inconsistent LinkSmith component.');
   visited.add(edge.id);edgeLocations.set(edge.id,[components.length,points.length]);points.push(edge.p.slice(0,2));
   if(edge.next===-1){points.push(edge.p.slice(2));break;}
   const next=edges.get(edge.next);
   if(!next||next.previous!==edge.id||Math.hypot(edge.p[2]-next.p[0],edge.p[3]-next.p[1])>.01)throw new Error('Inconsistent LinkSmith edge connections.');
   if(next.id===start.id){closed=true;break;}edge=next;
  }
  if(points.length<(closed?3:2))throw new Error('A component has too few vertices.');
  components.push({points,closed,color:start.color,width:start.width});
 }
 if(!components.length)return normalizeDrawing();
 const all=components.flatMap(c=>c.points),min=[0,1].map(i=>Math.min(...all.map(p=>p[i]))),max=[0,1].map(i=>Math.max(...all.map(p=>p[i]))),scale=520/Math.max(max[0]-min[0],max[1]-min[1],1);
 components.forEach(c=>c.points.forEach(p=>p.forEach((v,i)=>p[i]=320+(v-(max[i]+min[i])/2)*scale)));
 const crossings=crossingGeometry(components.map(c=>c.points),new Set(),components.map(c=>c.closed)),switched=[],seen=new Set();
 const crossingMap=new Map(crossings.map(x=>[[`${x.a.c}:${x.a.i}`,`${x.b.c}:${x.b.i}`].sort().join('|'),x]));
 for(const line of sections[1].trim().split('\n').filter(Boolean)){
  const v=line.match(/\{[^}]*\}|[^\s]+/g)||[],first=edgeLocations.get(Number(v[3])),second=edgeLocations.get(Number(v[7]));
  if(!first||!second||!['firstOnTop','secondOnTop'].includes(v[11]))throw new Error('Invalid LinkSmith crossing record.');
  const x=crossingMap.get([first.join(':'),second.join(':')].sort().join('|'));
  if(!x||seen.has(x.key))throw new Error('A saved crossing does not match the drawing.');
  seen.add(x.key);const over=v[11]==='firstOnTop'?first:second;
  if(over[0]!==x.a.c||over[1]!==x.a.i)switched.push(x.key);
 }
 if(seen.size!==crossings.length)throw new Error('The drawing has missing crossing records.');
 return normalizeDrawing({version:2,components,active:0,switched});
}
export function writeLinkSmith(input,switched=new Set()){
 const d=Array.isArray(input)?normalizeDrawing({version:2,components:input.map(points=>({points,closed:true})),active:0,switched:[...switched]}):normalizeDrawing(input);
 const crossings=crossingGeometry(d.components.map(c=>c.points),new Set(d.switched),d.components.map(c=>c.closed)),offsets=[];let offset=0;const lines=[];
 d.components.forEach((c,index)=>{
  const points=c.points,n=c.closed?points.length:Math.max(0,points.length-1);offsets.push(offset);
  for(let i=0;i<n;i++){const a=points[i],b=points[(i+1)%points.length],id=offset+i+1,previous=i===0&&!c.closed?-1:offset+(i+n-1)%n+1,next=i===n-1&&!c.closed?-1:offset+(i+1)%n+1;lines.push([id,...a,...b,c.color,previous,next,index+1,id,c.width].join(' '));}offset+=n;
 });
 lines.push('0');
 crossings.forEach((x,i)=>{
  const arc=edge=>{const length=Math.hypot(edge.b[0]-edge.a[0],edge.b[1]-edge.a[1]),dx=(edge.b[0]-edge.a[0])/length*5,dy=(edge.b[1]-edge.a[1])/length*5;return `{${[x.x-dx,x.y-dy,x.x+dx,x.y+dy].join(' ')}}`;};
  lines.push([i+1,x.x,x.y,offsets[x.a.c]+x.a.i+1,x.t,d.components[x.a.c].color,arc(x.a),offsets[x.b.c]+x.b.i+1,x.u,d.components[x.b.c].color,arc(x.b),x.over===0?'firstOnTop':'secondOnTop',offset+i*2+1,offset+i*2+2,x.sign].join(' '));
 });
 return lines.join('\n')+'\n0\n';
}
