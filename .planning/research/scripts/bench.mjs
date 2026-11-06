// rough cost model: polar ring grid conforming to outline, per-lens field eval + CT solve + volume
const sag=(c,k,r2)=>{const q=1-(1+k)*c*c*r2; if(q<0) return NaN; return c*r2/(1+Math.sqrt(q));};
function lens(NR,NA,thickIter){
  const n=1.6, sph=-6, cyl=-2, ax=30*Math.PI/180, D1=3, A=54,B=40, dec=2.5;
  const pos=new Float32Array((NR*NA+1)*3), t=new Float32Array(NR*NA+1);
  let CT=1.5;
  for(let it=0;it<thickIter;it++){
    const c1=D1/(1000*(n-1));
    let maxDiff=-1e9, vol=0;
    for(let j=1;j<=NR;j++){ const f=j/NR;
      for(let i=0;i<NA;i++){ const phi=2*Math.PI*i/NA;
        // superellipse-ish outline radius
        const cx=Math.cos(phi), sy=Math.sin(phi), p=4;
        const R=1/Math.pow(Math.pow(Math.abs(cx)/(A/2),p)+Math.pow(Math.abs(sy)/(B/2),p),1/p);
        const x=f*R*cx-dec, y=f*R*sy, r2=x*x+y*y, th=Math.atan2(y,x);
        const s=Math.sin(th-ax), Dth=sph+cyl*s*s, D2=Dth-D1;
        const c2=-D2/(1000*(n-1));
        const sf=sag(c1,0,r2), sb=sag(c2,0,r2);
        const d=sf-sb; if(j===NR&&d>maxDiff) maxDiff=d;
        const idx=(j-1)*NA+i; t[idx]=d; pos[idx*3]=x; pos[idx*3+1]=y; pos[idx*3+2]=-sf;
      }}
    CT=Math.max(1.5, 1.2+maxDiff);
  }
  return CT;
}
for (const [NR,NA] of [[24,128],[48,256],[64,360]]){
  for(let w=0;w<50;w++) lens(NR,NA,3);
  const N=200, t0=performance.now(); for(let i=0;i<N;i++) lens(NR,NA,3); const dt=(performance.now()-t0)/N;
  console.log(`grid ${NR}x${NA} = ${NR*NA} pts, 3 thick-lens iters: ${dt.toFixed(3)} ms per lens`);
}
