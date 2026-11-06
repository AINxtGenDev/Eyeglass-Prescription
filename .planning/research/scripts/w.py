import math, numpy as np
def sag(c,r): return c*r*r/(1+math.sqrt(1-c*c*r*r))
def w(F,n,rho,ct,y=26):
    D1=F/2+6 if F<0 else F+6
    c1=D1/(1000*(n-1)); c2=(F-D1)/(1000*(n-1))
    rs=np.linspace(0,y,400); t=np.array([ct-sag(c1,r)+sag(-c2,r) for r in rs])
    return np.trapezoid(t*2*math.pi*rs,rs)/1000*rho
for F in (-0.5,-1,-2,-4):
    print(F, " ".join(f"{n}:{w(F,n,rho,1.5):.2f}g" for n,rho in ((1.502,1.32),(1.59,1.20),(1.598,1.30),(1.664,1.35),(1.738,1.47))))
