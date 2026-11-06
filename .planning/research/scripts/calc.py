import math
import numpy as np

def sag(c, r):
    # stable form, c in 1/mm
    return c*r*r/(1+math.sqrt(1-c*c*r*r))

print("== 1. Zeiss fixture check (sphere geometry, curves in 1.530 tool index) ==")
# (label, n_true, diam, F, front@1.53, back@1.53 (magnitude, concave), CT, ET_published)
rows = [
 ("1.74 -6.00", 1.738, 75, -6.00, 0.86, 5.22, 1.10, 7.1),
 ("1.74 -12.00", 1.738, 70, -12.00, 0.43, 9.02, 1.10, 14.3),
 ("1.74 -3.00", 1.738, 75, -3.00, 1.52, 3.70, 1.10, 4.1),
 ("1.67 -4.00", 1.664, 75, -4.00, 1.19, 4.35, 1.20, 5.10),
 ("1.67 -10.00", 1.664, 70, -10.00, 0.40, 8.31, 1.20, 10.80),
 ("1.67 +6.00", 1.664, 65, 6.00, 6.33, 1.58, 5.40, 1.05),
 ("1.67 +4.00", 1.664, 65, 4.00, 5.14, 1.98, 3.90, 1.05),
 ("1.67 +2.00", 1.664, 70, 2.00, 4.35, 2.77, 2.70, 1.10),
]
for lab, n, d, F, f153, b153, ct, et in rows:
    y = d/2
    c1 = f153/530.0; c2 = b153/530.0   # tool-index curves -> curvature
    et_calc = ct - sag(c1, y) + sag(c2, y)
    # what power do these curves give in true index, thin and thick?
    D1 = f153*(n-1)/0.53; D2 = -b153*(n-1)/0.53
    thin = D1 + D2
    bvp = D1/(1-(ct/1000)/n*D1) + D2
    # WRONG: interpreting tool-index curves as true-index radii
    c1w = f153/(1000*(n-1)); c2w = b153/(1000*(n-1))
    et_wrong = ct - sag(c1w, y) + sag(c2w, y)
    print(f"{lab:12s} ET pub {et:5.2f} calc {et_calc:5.2f} (diff {et_calc-et:+.2f}) | if curves misread as true-index: {et_wrong:5.2f} | power thin {thin:+.2f} BVP {bvp:+.2f}")

print("\n== 2. Thin vs thick (BVP) error when D2 = F - D1 is used ==")
# Build lens with Vogel base, solve CT for plus with ET 1.0 at 35mm radius (70 mm), n=1.5 and 1.67
def vogel(F):
    return F+6 if F > 0 else F/2+6
for n in (1.50, 1.67):
    for F in (2, 4, 6, 8, 10, 12, -4, -8, -12):
        D1 = vogel(F)
        D2 = F - D1  # thin assumption
        c1 = D1/(1000*(n-1)); c2 = D2/(1000*(n-1))
        y = 25.0  # 50 mm uncut, small frame
        if F > 0:
            if c1*y >= 1:
                print(f"n={n} F={F:+} Vogel D1={D1:.2f} -> R1={1/c1:.1f}mm < y: IMPOSSIBLE"); continue
            ct = 1.0 + sag(c1, y) - (sag(-c2, y) if c2 < 0 else -sag(c2, y))
        else:
            ct = 1.5
        t = ct/1000
        bvp = D1/(1-t/n*D1) + D2
        # exact D2 for target BVP
        D2x = F - D1/(1-t/n*D1)
        print(f"n={n} F={F:+5.1f} D1={D1:5.2f} CT={ct:5.2f}mm  BVP(thin design)={bvp:+6.3f} err={bvp-F:+.3f} D  exact D2={D2x:+.3f} vs thin {D2:+.3f}")

print("\n== 3. Toric models: meridional-radius vs biconic(true) vs torus ==")
n = 1.5
def toric_cmp(S, C, ax_deg, D1, rmax):
    # back principal powers: along axis meridian power S, perpendicular S+C
    Pa = S - D1; Pb = S + C - D1   # back surface powers (negative)
    ca = Pa/(1000*(n-1)); cb = Pb/(1000*(n-1))   # signed curvature, negative = concave
    worst = (0, None)
    worst_t = (0, None)
    for th in np.linspace(0, math.pi, 181):
        # local coords: u along axis, v perpendicular
        phi = th - math.radians(ax_deg)
        u = rmax*math.cos(phi); v = rmax*math.sin(phi)
        # meridional: curvature c(th)=ca cos^2 + cb sin^2  (Euler)
        cm = ca*math.cos(phi)**2 + cb*math.sin(phi)**2
        s_mer = -sag(-cm, rmax)
        # biconic (k=0): z = (ca u^2 + cb v^2)/(1+sqrt(1-ca^2u^2-cb^2v^2))
        s_bic = (ca*u*u+cb*v*v)/(1+math.sqrt(1-ca*ca*u*u-cb*cb*v*v))
        # torus: profile circle radius Ra=1/ca along u (the "rotation" circle), rotated about axis parallel to u?
        # Zemax toroidal: z_v(v) circle curvature cb in v-z plane, rotated about axis parallel to v at distance Ru=1/ca
        Ru = 1/ca
        zv = -sag(-cb, v)
        s_tor = Ru - math.copysign(1, Ru)*math.sqrt((Ru - zv)**2 - u*u)
        # alternative torus orientation (swap)
        Rv = 1/cb
        zu = -sag(-ca, u)
        s_tor2 = Rv - math.copysign(1, Rv)*math.sqrt((Rv - zu)**2 - v*v)
        d = max(abs(s_mer-s_tor), abs(s_mer-s_tor2), abs(s_mer - s_bic))
        if d > worst[0]:
            worst = (d, (math.degrees(th), s_mer, s_bic, s_tor, s_tor2))
    return worst
for S, C, rmax in ((0, -6, 30), (-6, -6, 30), (+4, -6, 30), (0, -2, 30), (-6, -6, 35)):
    D1 = vogel(S + C/2)
    w = toric_cmp(S, C, 0, D1, rmax)
    th, sm, sb, st, st2 = w[1]
    print(f"S={S:+} C={C} D1={D1:.2f} r={rmax}: max |diff| {w[0]:.3f} mm at th={th:.0f}deg  mer={sm:.3f} biconic={sb:.3f} torusA={st:.3f} torusB={st2:.3f}")

print("\n== 4. Vogel at range extremes (n-independent rule) ==")
for F in (-15, -14, -12, -10, 12, 9):
    D1 = vogel(F)
    for n in (1.5, 1.74):
        R = 1000*(n-1)/D1 if D1 != 0 else float('inf')
        print(f"SE={F:+} D1={D1:+.2f} n={n}: R1={R:.1f} mm")

print("\n== 5. Sag singularity: max usable radius for plus lens front ==")
for n in (1.5, 1.6, 1.67, 1.74):
    D1 = vogel(12)
    R = 1000*(n-1)/D1
    print(f"+12 Vogel D1={D1}: n={n} R1={R:.1f} mm; frame A62/B55 half-diagonal ~{math.hypot(31,27.5):.1f} mm + decentration")

print("\n== 6. float32 cancellation: R - sqrt(R^2-r^2) vs stable ==")
for R in (1e4, 1e5, 1e6):
    r = 30.0
    R32 = np.float32(R); r32 = np.float32(r)
    naive = R32 - np.sqrt(R32*R32 - r32*r32)
    stable = (r32*r32/R32)/(np.float32(1)+np.sqrt(np.float32(1)-(r32/R32)**2))
    exact = r*r/R/(1+math.sqrt(1-(r/R)**2))
    print(f"R={R:.0e}mm exact {exact:.6f} naive32 {float(naive):.6f} stable32 {float(stable):.6f}")
    # fp16 mediump
    R16 = np.float16(min(R, 6e4)); r16 = np.float16(r)
    print(f"   fp16 (R clamped to {float(R16)}): naive {float(R16 - np.sqrt(R16*R16 - r16*r16)) if float(R16)*float(R16)<65504 else 'overflow'}")

print("\n== 7. index nominal vs actual ==")
for nom, act in ((1.67, 1.664), (1.74, 1.738), (1.60, 1.598), (1.59, 1.590), (1.50, 1.502)):
    print(f"nominal {nom} vs ne {act}: (n-1) ratio err {(nom-act)/(act-1)*100:+.2f}%")

print("\n== 8. weight: -2.00 in 52x40 rect-ish (approx circle r=26 area) CR-39 CT2.0 vs 1.74 CT1.1 ==")
def vol_minus(F, n, ct, y, D1):
    c1 = D1/(1000*(n-1)); c2 = (F-D1)/(1000*(n-1))
    rs = np.linspace(0, y, 400)
    t = ct - np.array([sag(c1, r) for r in rs]) + np.array([sag(-c2, r) for r in rs])
    return np.trapezoid(t*2*math.pi*rs, rs)/1000  # cm3
for F in (-2, -4, -8):
    for n, rho, ct in ((1.502, 1.32, 2.0), (1.598, 1.30, 1.5), (1.664, 1.35, 1.2), (1.738, 1.47, 1.1)):
        D1 = vogel(F)
        v = vol_minus(F, n, ct, 26, D1)
        print(f"F={F} n={n} CT={ct}: vol {v:.2f} cm3 weight {v*rho:.2f} g")
    print()
