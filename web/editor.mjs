import {crossingGeometry,linkProjection,drawingDT} from './core.mjs';
const colors=['#27725a','#b38339','#776596','#3d7995','#ad5454'];
const svgNS='http://www.w3.org/2000/svg';
const svg=(tag,attrs={})=>{const n=document.createElementNS(svgNS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
const segmentKey=e=>[e.a.join(','),e.b.join(',')].sort().join('|');
export function normalizeDrawing(saved={}){
  const d=saved.version===2?structuredClone(saved):{version:2,components:[...(saved.components||[]).map(points=>({points,closed:true})),{points:saved.points||[],closed:!!saved.closed}],active:(saved.components||[]).length,switched:saved.switched||[]};
  if(!Array.isArray(d.components)||d.components.length>100||!Array.isArray(d.switched))throw new Error('Invalid drawing.');
  d.components.forEach((c,i)=>{if(!Array.isArray(c.points)||c.points.length>2000||c.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v))))throw new Error('Invalid drawing vertices.');c.color=/^#[a-f\d]{6}$/i.test(c.color)?c.color:colors[i%colors.length];c.width=Math.min(12,Math.max(1,Number(c.width)||4));c.closed=!!c.closed;});
  if(!d.components.length)d.components.push({points:[],closed:false,color:colors[0],width:4});
  d.active=Math.max(0,Math.min(d.components.length-1,Number.isInteger(d.active)?d.active:0));return d;
}
export function drawingCrossings(d){return crossingGeometry(d.components.map(c=>c.points),new Set(d.switched),d.components.map(c=>c.closed));}
// Preserve which physical segment is over when reversing/reindexing components.
export function editDrawing(d,mutate){
  const pairKey=x=>[segmentKey(x.a),segmentKey(x.b)].sort().join(' / ');
  let over=new Map();try{over=new Map(drawingCrossings(d).map(x=>[pairKey(x),segmentKey(x.over===0?x.a:x.b)]));}catch{}
  mutate(d);d.switched=[];
  try{d.switched=drawingCrossings(d).filter(x=>over.get(pairKey(x))===segmentKey(x.b)).map(x=>x.key);}catch{}
  return d;
}
export function closedDrawing(d){
  const result=normalizeDrawing(d);editDrawing(result,()=>{result.components=result.components.filter(c=>c.points.length);result.active=0;});
  if(!result.components.length||result.components.some(c=>!c.closed))throw new Error('Close every curve before exporting or calculating the link.');
  return result;
}
export function cutEdges(d,selected){
  return editDrawing(d,()=>{const result=[];d.components.forEach((c,index)=>{
    const n=c.points.length,cuts=new Set([...selected].filter(k=>Number(k.split(':')[0])===index).map(k=>Number(k.split(':')[1])));
    if(!cuts.size){result.push(c);return;}
    let run=[],start=c.closed?([...cuts][0]+1)%n:0;
    for(let step=0;step<n;step++){const i=(start+step)%n;run.push(c.points[i]);if(cuts.has(i)||step===n-1){if(run.length>=2)result.push({...c,points:run,closed:false});run=[];}}
  });d.components=result.length?result:[{points:[],closed:false,color:colors[0],width:4}];d.active=0;});
}
export function alternateDrawing(d){
  if(d.components.some(c=>!c.closed))throw new Error('Close all curves before making the diagram alternating.');
  const p=linkProjection(d.components.map(c=>c.points)),flips=new Map(),assignments=new Map();
  for(let c=0;c<p.visits.length;c++){if(flips.has(c))continue;flips.set(c,0);const queue=[c];
    while(queue.length){const component=queue.shift();p.visits[component].forEach((v,i)=>{
      const over=(i+flips.get(component))%2===0,previous=assignments.get(v.index);
      if(previous&&previous.over===over)throw new Error('This projection cannot be made alternating.');
      assignments.set(v.index,{over});const x=p.crossings[v.index],other=x.a.c===component?x.b.c:x.a.c;
      if(other!==component&&!flips.has(other)){const j=p.visits[other].findIndex(w=>w.index===v.index);flips.set(other,(j+(over?1:0))%2);queue.push(other);}
    });}
  }
  d.switched=p.crossings.filter((x,index)=>{const i=p.visits[x.a.c].findIndex(v=>v.index===index&&Math.floor(v.at)===x.a.i);return(i+flips.get(x.a.c))%2===1;}).map(x=>x.key);return d;
}

export class DrawingEditor{
  constructor(root,{get,set,change,use,report,isActive}){
    Object.assign(this,{root,get,set,change,use,report,isActive});this.selected=new Set();this.history=[];this.drag=null;
    const $=id=>document.getElementById(id);this.$=$;
    const action=(id,fn)=>$(id).onclick=()=>{try{this.remember();fn();this.changed();}catch(e){this.set(this.history.pop());this.changed();this.report(e);}};
    action('draw-clear',()=>{this.set(normalizeDrawing());this.selected.clear();});
    $('draw-undo').onclick=()=>{if(this.history.length){this.set(this.history.pop());this.selected.clear();this.changed();}};
    action('draw-component',()=>{const d=this.get();if(!d.components[d.active].points.length)return;d.components.push({points:[],closed:false,color:colors[d.components.length%colors.length],width:4});d.active=d.components.length-1;this.selected.clear();});
    action('draw-close',()=>{const c=this.current();if(c.points.length<3)throw new Error('Place at least three vertices.');c.closed=true;drawingCrossings(this.get());});
    action('draw-cut',()=>{if(!this.selected.size)throw new Error('Select one or more edges first. Shift-click to select several.');cutEdges(this.get(),this.selected);this.selected.clear();});
    action('draw-reflect',()=>{const d=this.get();d.switched=drawingCrossings(d).filter(x=>x.over===0).map(x=>x.key);});
    action('draw-alternate',()=>alternateDrawing(this.get()));
    action('draw-reverse',()=>editDrawing(this.get(),d=>{const chosen=this.selected.size?new Set([...this.selected].map(k=>Number(k.split(':')[0]))):new Set([d.active]);d.components.forEach((c,i)=>{if(chosen.has(i))c.points.reverse();});this.selected.clear();}));
    action('draw-reverse-all',()=>editDrawing(this.get(),d=>{d.components.forEach(c=>c.points.reverse());this.selected.clear();}));
    $('draw-use').onclick=()=>{try{const d=closedDrawing(this.get());if(d.components.length!==1)throw new Error('Submit one closed component for knot calculations.');drawingCrossings(d);const dt=drawingDT(d.components[0].points,new Set(d.switched));if(!dt.length)throw new Error('This crossing-free curve represents the unknot.');this.use(dt);}catch(e){this.report(e);}};
    $('draw-color').oninput=event=>{this.current().color=event.target.value;this.changed();};
    $('draw-width').onchange=event=>{this.current().width=Number(event.target.value);this.changed();};
    $('draw-selection').onchange=event=>{this.get().active=Number(event.target.value);this.selected.clear();this.changed();};
    root.addEventListener('pointerdown',e=>this.down(e));root.addEventListener('pointermove',e=>this.move(e));root.addEventListener('pointerup',e=>this.up(e));
    root.addEventListener('pointercancel',()=>{this.drag=null;});
    root.addEventListener('contextmenu',e=>{if(this.isActive()){e.preventDefault();$('draw-component').click();}});
    root.addEventListener('dblclick',e=>{if(!this.isActive())return;const v=e.target.dataset.vertex;if(v===undefined)return;const c=this.get().components[Number(e.target.dataset.component)];if(c.points.length<=(c.closed?3:2))return;this.remember();editDrawing(this.get(),()=>c.points.splice(Number(v),1));this.changed();});
  }
  current(){return this.get().components[this.get().active];}
  remember(){this.history.push(structuredClone(this.get()));if(this.history.length>80)this.history.shift();}
  changed(){this.change();}
  point(e){const p=this.root.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform((this.root.querySelector('[data-drawing-plane]')||this.root).getScreenCTM().inverse());return[Math.max(15,Math.min(625,q.x)),Math.max(15,Math.min(625,q.y))];}
  switchCrossing(key){this.remember();const d=this.get();d.switched=d.switched.includes(key)?d.switched.filter(v=>v!==key):[...d.switched,key];this.changed();}
  down(e){if(!this.isActive())return;const t=e.target,d=this.get();
    if(t.dataset.crossing!==undefined){this.switchCrossing(t.dataset.crossing);return;}
    if(t.dataset.vertex!==undefined){this.drag={c:Number(t.dataset.component),i:Number(t.dataset.vertex),start:this.point(e),moved:false,before:structuredClone(d)};this.root.setPointerCapture(e.pointerId);return;}
    if(t.dataset.edge!==undefined){if(!e.shiftKey)this.selected.clear();const k=t.dataset.edge;if(this.selected.has(k))this.selected.delete(k);else this.selected.add(k);d.active=Number(k.split(':')[0]);this.changed();return;}
    this.selected.clear();if(!this.current().closed){this.remember();this.current().points.push(this.point(e));try{drawingCrossings(d);}catch(error){this.set(this.history.pop());this.report(error);}this.changed();}
  }
  move(e){if(!this.drag)return;const p=this.point(e);if(Math.hypot(p[0]-this.drag.start[0],p[1]-this.drag.start[1])>2)this.drag.moved=true;if(this.drag.moved){this.get().components[this.drag.c].points[this.drag.i]=p;this.changed();}}
  up(){if(!this.drag)return;const drag=this.drag;this.drag=null;
    if(drag.moved){try{drawingCrossings(this.get());this.history.push(drag.before);}catch(error){this.set(drag.before);this.report(error);}this.changed();return;}
    const d=this.get(),target=d.components[drag.c],active=this.current();
    if(target.closed||drag.i!==0&&drag.i!==target.points.length-1){d.active=drag.c;this.changed();return;}
    this.remember();editDrawing(d,()=>{
      if(drag.c===d.active){if(drag.i===0&&target.points.length>=3)target.closed=true;return;}
      if(active.closed||!active.points.length){d.active=drag.c;if(drag.i===0)target.points.reverse();return;}
      const continuation=drag.i===0?target.points:[...target.points].reverse();active.points.push(...continuation);d.components.splice(drag.c,1);if(drag.c<d.active)d.active--;
    });try{drawingCrossings(d);}catch(error){this.set(this.history.pop());this.report(error);}this.changed();
  }
  render(root,labels=false){const d=this.get(),active=this.current();let xs=[],error='';try{xs=drawingCrossings(d);}catch(e){error=e.message;}
    d.components.forEach((c,index)=>{const n=c.points.length;
      for(let i=0;i<(c.closed?n:n-1);i++){const a=c.points[i],b=c.points[(i+1)%n],selected=this.selected.has(index+':'+i),attrs={x1:a[0],y1:a[1],x2:b[0],y2:b[1]};root.append(svg('line',{...attrs,stroke:selected?'#d09532':c.color,'stroke-width':selected?c.width+3:c.width,'stroke-linecap':'round'}));const hit=svg('line',{...attrs,stroke:'transparent','stroke-width':16,'data-edge':index+':'+i});hit.style.cursor='pointer';root.append(hit);
        if(labels){const length=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/length,dy=(b[1]-a[1])/length,x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;root.append(svg('polygon',{points:[[x+6*dx,y+6*dy],[x-5*dx+4*dy,y-5*dy-4*dx],[x-5*dx-4*dy,y-5*dy+4*dx]].map(p=>p.join(',')).join(' '),fill:c.color,'pointer-events':'none'}));}
      }
    });
    xs.forEach(x=>{const edge=x.over===0?x.a:x.b,c=d.components[edge.c],len=Math.hypot(edge.b[0]-edge.a[0],edge.b[1]-edge.a[1]),dx=(edge.b[0]-edge.a[0])/len*13,dy=(edge.b[1]-edge.a[1])/len*13;for(const [color,width]of [['#fdfefb',c.width+9],[c.color,c.width]])root.append(svg('line',{x1:x.x-dx,y1:x.y-dy,x2:x.x+dx,y2:x.y+dy,stroke:color,'stroke-width':width,'pointer-events':'none'}));const hit=svg('circle',{cx:x.x,cy:x.y,r:12,fill:'transparent','data-crossing':x.key,role:'button',tabindex:0,'aria-label':'Switch crossing '+x.key});hit.style.cursor='pointer';hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.switchCrossing(x.key);}});root.append(hit);});
    d.components.forEach((c,index)=>c.points.forEach((p,i)=>root.append(svg('circle',{cx:p[0],cy:p[1],r:!c.closed&&(i===0||i===c.points.length-1)?7:5,fill:!c.closed&&i===0?'#dfc687':'#fff',stroke:c.color,'stroke-width':2,'data-vertex':i,'data-component':index,style:'cursor:grab'}))));
    this.$('draw-hint').textContent=error||`${d.components.filter(c=>c.points.length).length} curve(s) · ${xs.length} crossings. Click crossings to switch; drag vertices to reshape.`;
    this.$('draw-close').disabled=active.closed||active.points.length<3;this.$('draw-use').disabled=d.components.filter(c=>c.points.length).length!==1||!d.components.find(c=>c.points.length)?.closed;
    this.$('draw-undo').disabled=!this.history.length;this.$('draw-cut').disabled=!this.selected.size;
    this.$('draw-color').value=active.color;this.$('draw-width').value=active.width;
    const select=this.$('draw-selection');select.replaceChildren();d.components.forEach((c,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`Curve ${i+1} · ${c.closed?'closed':'open'}`;option.selected=i===d.active;select.append(option);});
    this.$('diagram-caption').textContent='Select edges to cut. Click open endpoints to continue or join. Labels show orientation.';
  }
}
