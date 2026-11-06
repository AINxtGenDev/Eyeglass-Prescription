const sag=(c,k,r2)=>{const q=1-(1+k)*c*c*r2; if(q<0) return NaN; return c*r2/(1+Math.sqrt(q));};
function makeOutline(NA,A,B){const ox=new Float64Array(NA),oy=new Float64Array(NA);
 for(let i=0;i<NA;i++){const phi=2*Math.PI*i/NA,cx=Math.cos(phi),sy=Math.sin(phi),p=4;
 const R=1/Math.pow(Math.pow(Math.abs(cx)/(A/2),p)+Math.pow(Math.abs(sy)/(B/2),p),1/p); ox[i]=R*cx; oy[i]=R*sy;} return {ox,oy};}
const n=1.6, sph=-6, cyl=-2, ax=30*Math.PI/180, D1=3, dec=2.5, ca=Math.cos(ax), sa=Math.sin(ax), K=1000*(n-1);
function diffAt(x,y,c1){const r2=x*x+y*y; if(r2===0) return 0; const s=(y*ca-x*sa); const Dth=sph+cyl*s*s/r2; const c2=-(Dth-D1)/K; return sag(c1,0,r2)-sag(c2,0,r2);}
function lens(o,NR,NA){
  const c1=D1/K; let CT=1.5;
  for(let it=0;it<3;it++){ let m=-1e9; for(let i=0;i<NA;i++){const d=diffAt(o.ox[i]-dec,o.oy[i],c1); if(d>m)m=d;} CT=Math.max(1.5,1.2+m); }
  const pos=new Float32Array(NR*NA*3*2), t=new Float32Array(NR*NA); let vol=0;
  for(let j=1;j<=NR;j++){const f=j/NR; for(let i=0;i<NA;i++){const x=f*o.ox[i]-dec,y=f*o.oy[i],r2=x*x+y*y;
    const s=(y*ca-x*sa), Dth=sph+cyl*(r2?s*s/r2:0), c2=-(Dth-D1)/K;
    const sf=sag(c1,0,r2), sb=sag(c2,0,r2), idx=(j-1)*NA+i; t[idx]=CT-sf+sb; vol+=t[idx];
    pos[idx*6]=x;pos[idx*6+1]=y;pos[idx*6+2]=-sf;pos[idx*6+3]=x;pos[idx*6+4]=y;pos[idx*6+5]=-CT-sb;}}
  return CT+vol*1e-12;
}
for (const [NR,NA] of [[24,128],[48,256],[64,360]]){ const o=makeOutline(NA,54,40);
  for(let w=0;w<100;w++) lens(o,NR,NA);
  const N=500,t0=performance.now(); for(let i=0;i<N;i++) lens(o,NR,NA); const dt=(performance.now()-t0)/N;
  console.log(`grid ${NR}x${NA} = ${NR*NA} pts (front+back positions written): ${dt.toFixed(3)} ms per lens`);}
