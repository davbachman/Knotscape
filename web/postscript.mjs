// Vector export of the actual displayed SVG (including cusp views and labels).
export function diagramPostScript(root) {
  const lines=['%!PS-Adobe-3.0 EPSF-3.0','%%BoundingBox: 0 0 640 640','%%EndComments','0 640 translate 1 -1 scale','1 setlinejoin 1 setlinecap'];
  const inverse=root.getCTM().inverse();
  const number=x=>Number(Number(x).toFixed(5));
  const rgb=color=>{const c=color.replace('#','');return c.length===3?[...c].map(v=>parseInt(v+v,16)/255):[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255);};
  for(const node of root.querySelectorAll('path,line,circle,polygon,polyline,text')){
    const tag=node.tagName,attr=name=>node.getAttribute(name),value=name=>Number(attr(name)),matrix=inverse.multiply(node.getCTM());
    const stroke=attr('stroke'),fill=attr('fill');
    if(fill==='transparent'||stroke==='transparent')continue;
    lines.push('gsave',`[${[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].map(number).join(' ')}] concat`);
    if(tag==='text'){
      const label=node.textContent.replace(/[^\x20-\x7e]/g,'?').replace(/[()\\]/g,'\\$&');
      lines.push(`${rgb(fill||'#20312d').map(number).join(' ')} setrgbcolor`,`${value('x')} ${value('y')} translate 1 -1 scale`, `/Helvetica findfont ${value('font-size')||12} scalefont setfont 0 0 moveto (${label}) show`);
    }else{
      lines.push('newpath');
      if(tag==='line')lines.push(`${value('x1')} ${value('y1')} moveto ${value('x2')} ${value('y2')} lineto`);
      else if(tag==='circle')lines.push(`${value('cx')} ${value('cy')} ${value('r')} 0 360 arc closepath`);
      else if(tag==='polygon'||tag==='polyline'){
        const values=attr('points').trim().split(/[ ,]+/).map(Number);
        for(let i=0;i<values.length;i+=2)lines.push(`${values[i]} ${values[i+1]} ${i?'lineto':'moveto'}`);
        if(tag==='polygon')lines.push('closepath');
      }else{
        const tokens=attr('d').match(/[MLQZ]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)||[];let i=0,x=0,y=0;
        while(i<tokens.length){const command=tokens[i++];if(command==='Z'){lines.push('closepath');continue;}const a=Number(tokens[i++]),b=Number(tokens[i++]);if(command==='Q'){const endX=Number(tokens[i++]),endY=Number(tokens[i++]);lines.push(`${[x+2*(a-x)/3,y+2*(b-y)/3,endX+2*(a-endX)/3,endY+2*(b-endY)/3,endX,endY].map(number).join(' ')} curveto`);x=endX;y=endY;}else{lines.push(`${a} ${b} ${command==='M'?'moveto':'lineto'}`);x=a;y=b;}}
      }
      if(fill&&fill!=='none')lines.push(`gsave ${rgb(fill).map(number).join(' ')} setrgbcolor fill grestore`);
      if(stroke&&stroke!=='none'){const dash=(attr('stroke-dasharray')||'').split(/[ ,]+/).filter(Boolean).map(Number);lines.push(`${rgb(stroke).map(number).join(' ')} setrgbcolor`,`${value('stroke-width')||1} setlinewidth [${dash.join(' ')}] 0 setdash stroke`);}
    }
    lines.push('grestore');
  }
  return lines.join('\n')+'\nshowpage\n%%EOF\n';
}
