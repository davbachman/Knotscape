// Hatcher–Thurston boundary slopes of two-bridge knots.
// Adapted from Nathan M. Dunfield's public-domain two_bridge.py, revision
// 252b55a2ec7f1cc5874416624b01b24ba7299d37 (1998 / Python 3 update 2020).
// https://github.com/NathanDunfield/montesinos
// See THIRD_PARTY.md. Fractions and coefficients use exact BigInt arithmetic.

const MAX_TERMS = 100000, MAX_SURFACES = 10000, MAX_PATHS = 200000;
const limitMessage = 'This fraction exceeds the browser limit (10,000 branched surfaces, 100,000 total coefficients, or 200,000 path-search steps). No partial slope list is returned.';
function integer(value) {
  const text = String(value).trim();
  if (!/^[+-]?\d{1,100}$/.test(text) || (typeof value === 'number' && !Number.isSafeInteger(value))) {
    throw new Error('Enter integers with at most 100 digits for p and q.');
  }
  return BigInt(text);
}
function gcd(a,b) { while(b) [a,b]=[b,a%b]; return a; }

export function boundarySlopes(numerator, denominator) {
  let p=integer(numerator), q=integer(denominator);
  if(q<=1n || p===0n || p<=-q || p>=q) throw new Error('Use a fraction p/q with q > 1 and 0 < |p| < q.');
  const divisor=gcd(p<0n?-p:p,q);
  p/=divisor; q/=divisor;
  if(q%2n===0n) throw new Error('The reduced denominator is even: this is a two-component link. This calculation is for two-bridge knots.');
  // p and p+q describe the same knot; negating p takes its mirror.
  if(p<0n) p+=q;
  const a=[];
  for(let x=p,y=q;x;){a.push(y/x);[x,y]=[y%x,x];}
  const k=a.length, stack=[[-1,0],[-1,1]], surfaces=[];
  let terms=0, visited=0;
  while(stack.length) {
    const path=stack.pop(), last=path.at(-1);
    if(++visited>MAX_PATHS) throw new Error(limitMessage);
    if(last!==k) {
      for(const step of [2,1]) {
        if(last+step>k) continue;
        // Consecutive edges cannot lie in a single Farey triangle.
        if(step===1 && last-path.at(-2)===1 && a[last]===1n) continue;
        stack.push([...path,last+step]);
      }
      continue;
    }
    if(surfaces.length>=MAX_SURFACES) throw new Error(limitMessage);
    const expansion=[];
    function add(value,count=1n) {
      if(count>BigInt(MAX_TERMS-terms)) throw new Error(limitMessage);
      for(let i=0;i<Number(count);i++) expansion.push(value);
      terms+=Number(count);
    }
    for(let i=1;i<path.length;i++) {
      const x=path[i-1],y=path[i],sign=y%2===0?1n:-1n;
      if(y-x===2) add(sign*2n,a[y-1]-1n);
      if(y!==k) add(sign*(a[y]+BigInt(y-x+path[i+1]-y-2)));
    }
    surfaces.push({expansion,twist:expansion.reduce((s,b)=>s+(b>0n?1:-1),0),seifert:expansion.every(b=>b%2n===0n)});
  }
  const seifert=surfaces.filter(s=>s.seifert);
  if(seifert.length!==1) throw new Error('Could not determine the unique even continued fraction.');
  const seifertTwist=seifert[0].twist;
  for(const surface of surfaces) {
    surface.slope=2*(surface.twist-seifertTwist);
    surface.expansion=surface.expansion.map(String);
  }
  surfaces.sort((a,b)=>a.slope-b.slope);
  const slopes=[...new Set(surfaces.map(s=>s.slope))];
  return {p:String(p),q:String(q),slopes,surfaces,seifertTwist,
    positiveContinuedFraction:a.map(String),
    convention:'Hatcher–Thurston K(p/q); slope r means r·meridian + longitude. 0 is the Seifert longitude. Negating p mirrors the knot and negates slopes.',
    algorithm:'Hatcher–Thurston minimal Farey edge paths; adapted from Nathan Dunfield.'};
}

// Recognize the standard reduced T(2,n) DT diagram, not just its invariants.
// The signed signature of the original diagram retains handedness if knotfind
// has replaced it with a canonical (unoriented) representative.
export function torusTwoBridgeFraction(dt,signature) {
  const n=dt.length;
  if(n<3 || n%2===0 || Math.abs(signature)!==n-1) return null;
  if(!dt.every(v=>Math.sign(v)===Math.sign(dt[0]))) return null;
  if(!dt.every((v,i)=>Math.abs(v)===2*((i+(n-1)/2)%n+1))) return null;
  // The legacy Goeritz signature is positive for the negative torus knot
  // in the orientation of decode_new_DT's exported SnapPea triangulation.
  return {p:signature>0?String(n-1):'1',q:String(n)};
}
