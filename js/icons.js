'use strict';
/* ============================================================
   EDIFICIOS ILUSTRADOS (sin imágenes): cada pieza se dibuja como una
   pequeña estructura con sombra, volumen y animación propia.
   Espacio de dibujo: -10..10 centrado; y positivo = hacia el jugador.
   `an` = {t: ms, on: bool} activa las animaciones.
   ============================================================ */
const _hex=h=>{h=h.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]};
/* aclara (f>0) u oscurece (f<0) un color #rrggbb */
const shade=(hex,f)=>{const [r,g,b]=_hex(hex);const m=f>0?255:0,k=Math.abs(f);
  const c=v=>Math.round(v+(m-v)*k);return `rgb(${c(r)},${c(g)},${c(b)})`};

function drawIcon(g,c,x,y,s,an){
  g.save();g.translate(x,y);const u=s/20;g.scale(u,u);
  g.lineWidth=1;g.lineCap='round';g.lineJoin='round';
  const T=an?an.t/1000:0,on=!!(an&&an.on),id=c.id,acc=c.col;
  /* ---- herramientas de dibujo ---- */
  const lin=(x0,y0,x1,y1,stops)=>{const gr=g.createLinearGradient(x0,y0,x1,y1);stops.forEach(([o,col])=>gr.addColorStop(o,col));return gr};
  const rad=(cx,cy,r0,r1,stops)=>{const gr=g.createRadialGradient(cx,cy,r0,cx,cy,r1);stops.forEach(([o,col])=>gr.addColorStop(o,col));return gr};
  const F=(col)=>{g.fillStyle=col;g.fill()};
  const S=(col,w)=>{g.strokeStyle=col;if(w)g.lineWidth=w;g.stroke()};
  const RR=(px,py,w,h,r,fill,line)=>{g.beginPath();g.roundRect(px,py,w,h,r);if(fill)F(fill);if(line)S(line)};
  const poly=(pts,fill,line)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();if(fill)F(fill);if(line)S(line)};
  const circ=(cx,cy,r,fill,line)=>{g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);if(fill)F(fill);if(line)S(line)};
  const ell=(cx,cy,rx,ry,fill,line,rot=0)=>{g.beginPath();g.ellipse(cx,cy,rx,ry,rot,0,Math.PI*2);if(fill)F(fill);if(line)S(line)};
  const shadow=(cx,cy,rx,ry,a=.3)=>{ell(cx,cy,rx,ry,`rgba(0,0,0,${a})`)};
  const pad=(col='#8a909c')=>{RR(-9.6,-9.6,19.2,19.2,3,col);RR(-9.6,-9.6,19.2,19.2,3,null,'rgba(0,0,0,.4)');g.fillStyle='rgba(255,255,255,.14)';g.fillRect(-9,-9,18,1.1);g.fillStyle='rgba(0,0,0,.12)';g.fillRect(-9,8.2,18,.9)};
  const glow=(cx,cy,r,rgb,a)=>{circ(cx,cy,r,rad(cx,cy,0,r,[[0,`rgba(${rgb},${a})`],[1,`rgba(${rgb},0)`]]))};
  const box=(bx,by,w,h,dep,cf,ct,cs)=>{
    poly([[bx,by],[bx+dep,by-dep*.6],[bx+w+dep,by-dep*.6],[bx+w,by]],ct);
    poly([[bx+w,by],[bx+w+dep,by-dep*.6],[bx+w+dep,by+h-dep*.6],[bx+w,by+h]],cs);
    g.fillStyle=cf;g.fillRect(bx,by,w,h);
    g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=.6;g.strokeRect(bx,by,w,h);
  };
  const cyl=(cx,top,w,h,c1,c2,c3)=>{ // cilindro vertical con volumen
    g.fillStyle=lin(cx-w/2,0,cx+w/2,0,[[0,c1],[.45,c2],[1,c3||shade(c2,-.4)]]);
    g.beginPath();g.rect(cx-w/2,top,w,h);g.fill();
    ell(cx,top+h,w/2,w*.2,g.fillStyle);
    ell(cx,top,w/2,w*.2,shade(c1,.2),'rgba(0,0,0,.25)');
  };
  const smoke=(sx,sy,n,col,spd=.35,rise=9)=>{for(let k=0;k<n;k++){const q=(T*spd+k/n)%1;
    circ(sx+Math.sin(q*5+k*2)*1.8+q*3,sy-q*rise,1.1+q*2.8,`rgba(${col},${(1-q)*.5})`)}};
  const flame=(fx,fy,sc,flick)=>{ // llama
    g.save();g.translate(fx,fy);g.scale(sc*(1+.06*Math.sin(flick*11)),sc*(1+.12*Math.sin(flick*9)));
    g.beginPath();g.moveTo(0,-8);g.bezierCurveTo(5,-2,4,5,0,5);g.bezierCurveTo(-4,5,-5,0,-1.5,-3);g.bezierCurveTo(-1.5,-1,0,-1,0,-8);F('#ff8a2a');
    g.beginPath();g.moveTo(0,-2);g.bezierCurveTo(2.4,1,1.8,4.2,0,4.2);g.bezierCurveTo(-2.4,4.2,-2.4,1,0,-2);F('#ffe27a');g.restore();
  };
  const bolt=(bx,by,sc,col)=>{poly([[bx+1*sc,by-4*sc],[bx-2.4*sc,by+.4*sc],[bx-.2*sc,by+.4*sc],[bx-1.2*sc,by+4*sc],[bx+2.4*sc,by-.6*sc],[bx+.2*sc,by-.6*sc]],col,'rgba(0,0,0,.3)')};
  const win=(wx,wy,cols,rows,sx,sy,seed,wc,hc)=>{for(let r=0;r<rows;r++)for(let q=0;q<cols;q++){
    const lit=on?(Math.sin(T*1.6+r*1.9+q*2.7+seed)>-.4):true;g.fillStyle=lit?(wc||'#ffe58a'):(hc||'#3c4252');g.fillRect(wx+q*sx,wy+r*sy,1.5,1.7)}};
  const blades=(bx,by,n,len,wid,ang,col)=>{for(let k=0;k<n;k++){const a=ang+k*Math.PI*2/n;
    g.save();g.translate(bx,by);g.rotate(a);poly([[0,-.7],[len,-wid*.25],[len,wid*.25],[0,.7]],col,'rgba(0,0,0,.3)');g.restore()}};
  const trefoil=(tx,ty,r,col,bg,rot)=>{circ(tx,ty,r*1.2,bg);g.save();g.translate(tx,ty);g.rotate(rot||0);g.fillStyle=col;
    for(let k=0;k<3;k++){const a=k*2.0944-1.5708;g.beginPath();g.moveTo(0,0);g.arc(0,0,r,a-.5236,a+.5236);g.closePath();g.fill()}g.restore();circ(tx,ty,r*.22,bg)};
  const arc=(x0,y0,x1,y1,col,jit)=>{g.strokeStyle=col;g.lineWidth=.9;g.beginPath();g.moveTo(x0,y0);
    for(let k=1;k<5;k++){const q=k/5;g.lineTo(x0+(x1-x0)*q+Math.sin(T*40+k*3.1+x0)*jit,y0+(y1-y0)*q+Math.cos(T*37+k*2.3+y0)*jit)}g.lineTo(x1,y1);g.stroke()};

  switch(id){
  /* ---------------- generación de calor ---------------- */
  case 'windTurbine':{
    shadow(3.5,8.4,5.5,1.5,.28);
    ell(0,8.4,2.6,.9,'#9aa2ae');
    poly([[-1.4,8.3],[1.4,8.3],[.7,-2.2],[-.7,-2.2]],lin(-1,0,1,0,[[0,'#ffffff'],[.6,'#dfe5ec'],[1,'#aeb8c4']]),'rgba(0,0,0,.5)');
    RR(-1.7,-3.9,3.9,2.3,1,lin(0,-4,0,-1.6,[[0,'#ffffff'],[1,'#c4ccd6']]),'rgba(0,0,0,.3)');
    const sp=on?T*3.6:.4;
    if(on)circ(0,-2.7,8.4,'rgba(255,255,255,.1)');
    blades(0,-2.7,3,8.8,2.6,sp-1.5708,lin(0,0,8,0,[[0,'#ffffff'],[1,'#d4dce6']]));
    circ(0,-2.7,1.5,lin(-1,-3,1,0,[[0,'#ffffff'],[1,'#98a3b0']]),'rgba(0,0,0,.3)');
    break}
  case 'solarCell':{
    pad('#6f7886');
    for(let r=0;r<2;r++)for(let q=0;q<2;q++){
      const px=-8.6+q*8.7,py=-8.6+r*8.7;
      poly([[px+.6,py],[px+7.6,py],[px+7,py+7.6],[px,py+7.6]],lin(px,py,px+7,py+7.6,[[0,'#2f6fc4'],[.55,'#1d4a96'],[1,'#143672']]),'#0c1f40');
      g.strokeStyle='rgba(180,215,255,.45)';g.lineWidth=.45;g.beginPath();
      for(let k=1;k<3;k++){g.moveTo(px+.6*(1-k/3)+7*k/3,py);g.lineTo(px+7*k/3,py+7.6);g.moveTo(px+.6*(1-k/3),py+7.6*k/3);g.lineTo(px+7.6-.6*(1-k/3)*0-.6*k/3,py+7.6*k/3)}g.stroke();
      if(on){const k=((T*.5)+r*.25+q*.15)%1;g.save();g.beginPath();g.rect(px,py,7.6,7.6);g.clip();g.fillStyle=`rgba(255,255,255,${.32*(1-Math.abs(k-.5)*1.6)})`;g.fillRect(px-4+k*16,py,2.2,8);g.restore()}
    }
    if(on)glow(0,0,11,'255,210,90',.28+.1*Math.sin(T*3));
    break}
  case 'coalBurner':{
    pad('#7a7468');
    box(-8.2,-2.5,12.6,10.6,1.6,'#9a604a','#b4745c','#74483a');
    g.strokeStyle='rgba(60,30,20,.4)';g.lineWidth=.4;g.beginPath();for(let k=0;k<4;k++){g.moveTo(-8.2,-.4+k*2.4);g.lineTo(4.4,-.4+k*2.4)}g.stroke();
    RR(-8.8,-4.2,13.8,2,.6,'#4a3c3a');
    cyl(5.4,-9.6,3.4,8.2,'#a8644e','#8a5040','#5e382c');RR(4,-10.2,2.8,1.3,.4,'#2a2220');
    RR(-6.2,1.6,5.4,5,.8,'#150e0c');
    if(on){glow(-3.5,4.2,7,'255,120,30',.55+.2*Math.sin(T*8));RR(-5.4,2.4,3.8,3.5,.6,`rgb(255,${130+Math.sin(T*9)*40|0},40)`)}
    circ(6.4,7.2,1.5,'#222');circ(4.7,7.7,1.1,'#2c2c2c');circ(7.7,6.7,.9,'#1a1a1a');
    if(on)smoke(5.4,-10.2,3,'110,108,108',.3,10);
    break}
  case 'gasBurner':{
    pad('#7d8490');
    RR(-9,-1.4,9.4,4.6,2.3,lin(0,-1.4,0,3.2,[[0,'#e8eef4'],[.5,'#aab4c0'],[1,'#6c7684']]),'rgba(0,0,0,.4)');
    RR(-9,4,9.4,4.6,2.3,lin(0,4,0,8.6,[[0,'#e8eef4'],[.5,'#aab4c0'],[1,'#6c7684']]),'rgba(0,0,0,.4)');
    g.strokeStyle='#4a525c';g.lineWidth=1.2;g.beginPath();g.moveTo(.4,.9);g.lineTo(3,.9);g.moveTo(.4,6.3);g.lineTo(3,6.3);g.stroke();
    cyl(5.2,-3,3.4,11.5,'#d8dee6','#9aa4b0','#5a6470');
    g.strokeStyle='#4a525c';g.beginPath();g.moveTo(5.2,-3);g.lineTo(5.2,-5.6);g.stroke();
    if(on){glow(5.2,-6,7,'255,140,40',.5);flame(5.2,-6.2,.62,T)}else RR(4.3,-6,1.8,1.4,.4,'#333');
    circ(-4.3,1,.9,'#e04040');circ(-4.3,6.4,.9,'#e04040');
    break}
  case 'nuclearCell':{
    pad('#808a80');
    g.beginPath();g.moveTo(-5.6,8);g.bezierCurveTo(-3,3,-3.2,-3,-4.2,-8);g.lineTo(4.2,-8);g.bezierCurveTo(3.2,-3,3,3,5.6,8);g.closePath();
    F(lin(-5.6,0,5.6,0,[[0,'#eef0f2'],[.45,'#c8ccd0'],[1,'#8a9096']]));g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=.6;g.stroke();
    ell(0,-8,4.2,1.3,'#9aa0a6','rgba(0,0,0,.3)');ell(0,-8,3.3,.8,'#3a3e42');
    g.strokeStyle='rgba(0,0,0,.12)';g.beginPath();g.moveTo(-3.8,-4);g.lineTo(3.8,-4);g.moveTo(-3.3,1);g.lineTo(3.3,1);g.stroke();
    trefoil(0,3,3,'#1b1b1b','#f2cf3a',on?T*.9:0);
    RR(6,2,3.4,5.8,1.5,'#9aa09a','rgba(0,0,0,.3)');if(on)glow(7.7,5,4,'110,255,120',.5);RR(6.9,3.6,1.6,2,.5,on?'#8dff8d':'#2c4a2c');
    if(on)smoke(0,-8.6,3,'250,252,255',.28,11);
    break}
  case 'nuclearCell2':{
    pad('#7a7488');
    RR(-8,1.6,16,6.4,1.4,lin(0,1.6,0,8,[[0,'#b8b0cc'],[1,'#6a6480']]),'rgba(0,0,0,.4)');
    g.beginPath();g.arc(0,1.8,7.6,Math.PI,0);g.closePath();F(rad(-2.5,-3.5,1,9,[[0,'#f0ecfa'],[.55,'#b3a8d2'],[1,'#6c6288']]));S('rgba(0,0,0,.4)',.7);
    const pr=.5+.5*Math.sin(T*3);
    if(on)glow(0,1,11,'190,120,255',.3+.25*pr);
    g.beginPath();g.arc(0,1.8,8.6,Math.PI*1.06,Math.PI*1.94);g.lineWidth=1.2;g.strokeStyle=on?`rgba(205,150,255,${.55+.4*pr})`:'rgba(150,110,200,.5)';g.stroke();
    trefoil(0,-1.6,3.1,'#3a2060','#e2c8ff',on?T*.8:0);
    cyl(-6.6,-3,2.2,5,'#cfc8e0','#9e96b8');cyl(6.6,-3,2.2,5,'#cfc8e0','#9e96b8');
    if(on)smoke(-6.6,-3.4,2,'235,225,255',.3,8);
    break}
  case 'nuclearCell3':{
    pad('#6e5a60');
    shadow(1,5.5,9,2.6,.25);
    const rx=8.4,ry=6.2;
    ell(0,.4,rx,ry,'#3a3036','rgba(0,0,0,.5)');
    ell(0,.4,rx-1.3,ry-1.1,lin(0,-6,0,6,[[0,'#a8949c'],[1,'#6a5860']]));
    ell(0,.4,rx-3,ry-2.8,'#2a2026');
    const pl=.55+.45*Math.sin(T*5);
    g.lineWidth=2.3;g.strokeStyle=on?`rgba(255,${90+pl*80|0},70,${.7+.3*pl})`:'#a05048';g.beginPath();g.ellipse(0,.4,rx-2.1,ry-1.9,0,0,7);g.stroke();
    if(on){glow(0,.4,10,'255,90,60',.22+.12*pl);for(let k=0;k<2;k++){const a=T*3.2+k*Math.PI;circ(Math.cos(a)*(rx-2.1),.4+Math.sin(a)*(ry-1.9),1.3,'#fff4c8')}}
    g.strokeStyle='rgba(20,10,14,.55)';g.lineWidth=.8;g.beginPath();for(let k=0;k<12;k++){const a=k*Math.PI/6;g.moveTo(Math.cos(a)*(rx-1.2),.4+Math.sin(a)*(ry-1));g.lineTo(Math.cos(a)*(rx-3),.4+Math.sin(a)*(ry-2.8))}g.stroke();
    cyl(0,-1.8,3,4.4,'#c8b8c0','#9a8890');
    break}
  case 'nuclearCell4':{
    pad('#6c6482');
    for(const lx of[-3.4,0,3.4]){g.strokeStyle='#4a4260';g.lineWidth=1.3;g.beginPath();g.moveTo(lx*.4,0);g.lineTo(lx*1.7,8);g.stroke()}
    ell(0,8.2,6.4,1.6,'#4a4260');
    const bob=on?Math.sin(T*2)*.4:0;
    if(on)glow(0,-1+bob,10,'170,110,255',.4);
    circ(0,-1+bob,5.6,rad(-1.8,-3.2,.5,6,[[0,'#f0e6ff'],[.5,'#9a78e0'],[1,'#4a2a8a']]),'rgba(0,0,0,.4)');
    const ang=on?T*1.6:.4;
    for(let k=0;k<2;k++){g.save();g.translate(0,-1+bob);g.rotate(ang+k*1.5708);g.strokeStyle=`rgba(225,205,255,${.85})`;g.lineWidth=.9;g.beginPath();g.ellipse(0,0,8.6,2.6,0,0,7);g.stroke();
      if(on)circ(8.6*Math.cos(T*3+k*2),2.6*Math.sin(T*3+k*2),1.1,'#fff');g.restore()}
    circ(0,-1+bob,1.7,on?'#fff':'#e8d8ff');
    break}
  case 'nuclearCell5':{
    pad('#586080');
    poly([[-4,8],[4,8],[2.4,-2],[-2.4,-2]],lin(-4,0,4,0,[[0,'#a0b6f0'],[.5,'#5a7ad8'],[1,'#324a9a']]),'rgba(0,0,0,.4)');
    for(const [sx,h] of [[-4.6,7],[0,10],[4.6,7]])poly([[sx-1.5,-1.4],[sx,-h],[sx+1.5,-1.4]],lin(sx-1.5,0,sx+1.5,0,[[0,'#d8e4ff'],[1,'#6a88e0']]),'rgba(0,0,0,.3)');
    if(on){glow(0,-3,10,'120,170,255',.45);arc(-4.6,-6,0,-9,'rgba(200,225,255,.9)',.9);arc(4.6,-6,0,-9,'rgba(200,225,255,.9)',.9)}
    const ang=on?T*1.8:0;
    for(let k=0;k<3;k++){g.save();g.translate(0,3);g.rotate(ang+k*1.0472);g.strokeStyle='rgba(215,230,255,.8)';g.lineWidth=.8;g.beginPath();g.ellipse(0,0,6.8,2,0,0,7);g.stroke();g.restore()}
    circ(0,3,1.8,on?'#fff':'#dbe8ff');
    break}
  case 'nuclearCell6':{
    pad('#4a6a5c');
    const hex=(r,col,line)=>{g.beginPath();for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6;k?g.lineTo(Math.cos(a)*r,1+Math.sin(a)*r*.82):g.moveTo(Math.cos(a)*r,1+Math.sin(a)*r*.82)}g.closePath();if(col)F(col);if(line)S(line)};
    g.save();g.translate(0,1.6);hex(7.4,'#1f4036');g.restore();
    hex(7.4,lin(-7,-6,7,8,[[0,'#bfe8d4'],[.5,'#6ab090'],[1,'#3a7a60']]),'rgba(0,0,0,.4)');
    hex(4.6,'#1e3a30','rgba(0,0,0,.5)');
    const pl=.5+.5*Math.sin(T*4);
    if(on)glow(0,1,8,'110,255,170',.4+.3*pl);
    circ(0,1,2.7,rad(0,1,0,3,[[0,'#f2fff8'],[1,on?'#46d890':'#2a6a50']]));
    for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;const px=Math.cos(a)*8.2,py=1+Math.sin(a)*6.4;circ(px,py,1.3,'#d8f4e6','rgba(0,0,0,.4)');if(on&&k%2===0)arc(px,py,0,1,'rgba(170,255,210,.9)',.7)}
    break}
  case 'nuclearCell7':{
    pad('#3a6a74');
    ell(0,7.2,7.2,2.4,'#244a54');ell(0,6.6,5.6,1.8,'#4a8a98');ell(0,6.2,3.8,1.1,'#7ac0cc');
    const bob=on?Math.sin(T*2.2)*.9:0;
    if(on){glow(0,-.5+bob,11,'90,240,255',.5);for(const bx of[-3,0,3]){g.fillStyle=`rgba(150,250,255,${.16+.08*Math.sin(T*4+bx)})`;g.beginPath();g.moveTo(bx*.5,5);g.lineTo(bx*1.8-.8,-9);g.lineTo(bx*1.8+.8,-9);g.closePath();g.fill()}}
    shadow(0,8.2,4,1.1,.25);
    const cy=-.5+bob;
    poly([[0,cy-7.6],[5.4,cy-.8],[0,cy+7],[-5.4,cy-.8]],lin(-5,cy-7,5,cy+7,[[0,'#d8ffff'],[.5,'#4fdcf0'],[1,'#1a8aa8']]),'#e6ffff');
    poly([[0,cy-7.6],[2.2,cy-.8],[0,cy+7]],'rgba(255,255,255,.28)');
    g.strokeStyle='rgba(255,255,255,.65)';g.lineWidth=.6;g.beginPath();g.moveTo(-5.4,cy-.8);g.lineTo(5.4,cy-.8);g.moveTo(0,cy-7.6);g.lineTo(-2.2,cy-.8);g.lineTo(0,cy+7);g.stroke();
    if(on){const k=(T*1.1)%1;g.save();g.beginPath();g.moveTo(0,cy-7.6);g.lineTo(5.4,cy-.8);g.lineTo(0,cy+7);g.lineTo(-5.4,cy-.8);g.closePath();g.clip();g.fillStyle=`rgba(255,255,255,${.6*(1-k)})`;g.fillRect(-9+k*18,cy-9,2.4,18);g.restore()}
    break}
  /* ---------------- generadores (1 a 5) ---------------- */
  case 'generator':case 'generator2':case 'generator3':case 'generator4':case 'generator5':{
    const n=+c.n||1;
    pad('#7a808a');
    box(-9,-4.4,18,12.6,1.2,'#5a6270',shade('#5a6270',.25),shade('#5a6270',-.3));
    RR(-9,-9.2,18,5.4,1.2,lin(0,-9,0,-4,[[0,shade(acc,.4)],[1,shade(acc,-.15)]]),'rgba(0,0,0,.45)');
    bolt(-6.2,-6.5,.62,'#ffe94a');
    for(let k=0;k<n;k++){const bl=on&&Math.sin(T*(3+k)+k)>0;circ(-2.2+k*2.5,-6.5,.8,bl?'#9dff9d':'#33503a')}
    RR(-8,-3.4,16,10.8,1.4,'#222833','rgba(0,0,0,.5)');
    const layout={1:[[0,2]],2:[[-4,2],[4,2]],3:[[-5.2,2],[0,2],[5.2,2]],4:[[-4,-.6],[4,-.6],[-4,4.8],[4,4.8]],5:[[-5.4,-.8],[0,-.8],[5.4,-.8],[-2.7,4.8],[2.7,4.8]]}[n];
    const rr=[0,4.4,3.7,2.8,2.7,2.5][n];
    for(const [rx,ry] of layout){circ(rx,ry,rr+.5,shade(acc,-.1),'rgba(0,0,0,.5)');circ(rx,ry,rr,'#11151c');
      blades(rx,ry,3,rr*.92,rr*.9,on?T*(5+n)+rx:rx*.3,lin(0,0,rr,0,[[0,'#dfe6f0'],[1,'#8e9aaa']]));circ(rx,ry,rr*.22,'#f0f4f8')}
    if(on)glow(0,2,10,'255,230,90',.12+.08*Math.sin(T*6));
    break}
  /* ---------------- calor: transporte y almacenamiento ---------------- */
  case 'heatExchanger':{
    pad('#6c6460');
    const pipe=(x0,y0,w,h)=>{RR(x0,y0,w,h,1.2,w>h?lin(0,y0,0,y0+h,[[0,'#f0b070'],[.5,'#c4783a'],[1,'#7a4420']]):lin(x0,0,x0+w,0,[[0,'#f0b070'],[.5,'#c4783a'],[1,'#7a4420']]),'rgba(0,0,0,.4)')};
    pipe(-9,-1.6,18,3.2);pipe(-1.6,-9,3.2,18);
    for(const [fx,fy] of[[-6.5,0],[6.5,0],[0,-6.5],[0,6.5]]){RR(fx-.7*(fy?3:1),fy-.7*(fx?3:1),fy?3.6:1.4,fx?3.6:1.4,.5,'#8a5a30','rgba(0,0,0,.4)')}
    circ(0,0,5.2,rad(-1.5,-2,.5,6,[[0,'#ffd8a0'],[.6,'#d08a48'],[1,'#7a4a24']]),'rgba(0,0,0,.45)');
    circ(0,0,3.3,'#2a2420');
    const ang=on?T*2.4:0;
    g.save();g.rotate(ang);g.lineWidth=1.3;
    g.strokeStyle='#ff9a5a';g.beginPath();g.arc(0,0,2.1,.2,2.6);g.stroke();poly([[-1.3,1.8],[-3.2,.6],[-2.2,2.7]],'#ff9a5a');
    g.strokeStyle='#6ac8ff';g.beginPath();g.arc(0,0,2.1,3.34,5.74);g.stroke();poly([[1.3,-1.8],[3.2,-.6],[2.2,-2.7]],'#6ac8ff');g.restore();
    break}
  case 'heatInlet':{
    pad('#7a4a46');
    g.save();g.fillStyle='rgba(0,0,0,.18)';for(let k=0;k<8;k++){g.fillRect(-9.6+k*2.4,-9.6,1.2,19.2)}g.restore();
    circ(0,0,7.6,rad(0,0,2,8,[[0,'#2a0e0c'],[1,'#8a4a40']]),'rgba(0,0,0,.5)');
    circ(0,0,5.4,'#150605','rgba(255,140,90,.5)');
    if(on)glow(0,0,7,'255,90,40',.55+.2*Math.sin(T*6));
    for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;const q=on?((T*1.2+k*.25)%1):.3;const rr=7.2-q*5;
      poly([[Math.cos(a)*rr,Math.sin(a)*rr],[Math.cos(a+.45)*(rr+1.7),Math.sin(a+.45)*(rr+1.7)],[Math.cos(a-.45)*(rr+1.7),Math.sin(a-.45)*(rr+1.7)]],`rgba(255,${150+q*80|0},90,${on?.95:.55})`)}
    break}
  case 'heatOutlet':{
    pad('#44627e');
    g.save();g.fillStyle='rgba(0,0,0,.18)';for(let k=0;k<8;k++){g.fillRect(-9.6+k*2.4,-9.6,1.2,19.2)}g.restore();
    circ(0,0,7.6,rad(0,0,2,8,[[0,'#10233a'],[1,'#4a6a8a']]),'rgba(0,0,0,.5)');
    circ(0,0,5.4,'#08121e','rgba(140,200,255,.5)');
    if(on)glow(0,0,7,'80,170,255',.5);
    for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;const q=on?((T*1.2+k*.25)%1):.7;const rr=2+q*5;
      poly([[Math.cos(a)*rr,Math.sin(a)*rr],[Math.cos(a+.45)*(rr-1.7),Math.sin(a+.45)*(rr-1.7)],[Math.cos(a-.45)*(rr-1.7),Math.sin(a-.45)*(rr-1.7)]],`rgba(150,215,255,${on?.95:.55})`)}
    if(on)smoke(0,-2,2,'210,235,255',.35,7);
    break}
  case 'isolation':{
    pad('#76726a');
    box(-8.6,-2.6,15,10.8,2,'#e8a840','#f6cd78','#b57d22');
    g.strokeStyle='rgba(120,70,0,.4)';g.lineWidth=.5;g.beginPath();for(let k=1;k<4;k++){g.moveTo(-8.6+k*3.75,-2.6);g.lineTo(-8.6+k*3.75,8.2)}g.stroke();
    g.fillStyle='rgba(90,50,0,.25)';for(let k=0;k<6;k++)for(let r=0;r<3;r++)g.fillRect(-8+k*2.5,-1.4+r*3.4,1.1,.6);
    g.save();g.beginPath();g.rect(-8.6,5,15,3.2);g.clip();g.fillStyle='#2a2a2a';for(let k=-2;k<10;k++){poly([[-8.6+k*3,8.2],[-8.6+k*3+1.5,8.2],[-8.6+k*3+4.5,5],[-8.6+k*3+3,5]],'#2a2a2a')}g.restore();
    break}
  case 'heatBattery':{
    pad('#6a7480');
    box(-8.4,-3,14.6,11,2.2,'#5a8ca6','#9fd0e6','#3a6478');
    g.strokeStyle='rgba(10,40,60,.55)';g.lineWidth=.9;g.beginPath();for(let k=0;k<7;k++){g.moveTo(-7.4+k*2.1,-1.6);g.lineTo(-7.4+k*2.1,6.6)}g.stroke();
    g.strokeStyle='rgba(200,240,255,.5)';g.lineWidth=.4;g.beginPath();for(let k=0;k<7;k++){g.moveTo(-6.9+k*2.1,-1.6);g.lineTo(-6.9+k*2.1,6.6)}g.stroke();
    if(on||true){for(let k=0;k<3;k++){const q=(T*.7+k/3)%1;g.fillStyle=`rgba(255,255,255,${(1-q)*.8})`;g.fillRect(-6+k*5+Math.sin(k*3)*1,-2.6+q*8,.9,.9)}}
    break}
  case 'boilerHouse':{
    pad('#7a6a60');
    RR(-8.6,3.4,17,4.8,.8,'#8a5a46','rgba(0,0,0,.4)');
    RR(-8.6,-4,12.6,8.4,4.2,lin(0,-4,0,4.4,[[0,'#e4e8ec'],[.5,'#a4acb6'],[1,'#626c78']]),'rgba(0,0,0,.45)');
    g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.6;g.beginPath();g.moveTo(-4.8,-4);g.lineTo(-4.8,4.4);g.moveTo(-.6,-4);g.lineTo(-.6,4.4);g.stroke();
    cyl(6,-9.4,3,12,'#a8644e','#8a5040','#5e382c');RR(4.8,-9.9,2.4,1.1,.4,'#2a2220');
    circ(-3,-.4,1.7,'#f4f4f0','rgba(0,0,0,.5)');g.strokeStyle='#b03030';g.lineWidth=.7;g.beginPath();g.moveTo(-3,-.4);g.lineTo(-3+Math.cos(on?T*2:0.6)*1.2,-.4+Math.sin(on?T*2:.6)*1.2);g.stroke();
    RR(-6,4.4,4.4,2.6,.5,'#150e0c');if(on){glow(-3.8,5.6,5,'255,120,30',.55);RR(-5.4,4.9,3.2,1.6,.4,`rgb(255,${130+Math.sin(T*8)*40|0},40)`)}
    if(on)smoke(6,-9.9,3,'245,247,250',.34,10);
    break}
  case 'battery':{
    pad('#6e7a6e');
    for(let k=0;k<3;k++){const bx=-6.2+k*5;
      RR(bx-2.2,-5.6,4.4,13.2,1.4,lin(bx-2.2,0,bx+2.2,0,[[0,'#7adc7a'],[.5,'#3aa83a'],[1,'#1f6a1f']]),'rgba(0,0,0,.5)');
      RR(bx-1,-7.2,2,1.8,.5,'#d0d4d0','rgba(0,0,0,.4)');
      const lv=on?.4+.5*((Math.sin(T*1.4+k)+1)/2):.55;
      g.save();g.beginPath();g.roundRect(bx-1.6,-4.8,3.2,11.6,.8);g.clip();g.fillStyle='rgba(0,0,0,.45)';g.fillRect(bx-1.6,-4.8,3.2,11.6);g.fillStyle='#c8ff9a';g.fillRect(bx-1.6,6.8-11.6*lv,3.2,11.6*lv);g.restore()}
    bolt(0,-1,.65,'#fff6a0');
    break}
  /* ---------------- agua ---------------- */
  case 'waterPump':{
    pad('#667c92');
    RR(-8.4,-1.4,10.6,9.4,1.2,lin(0,-1.4,0,8,[[0,'#7aa6cc'],[1,'#3a6288']]),'rgba(0,0,0,.45)');
    RR(-8.4,-4.2,10.6,3,1,'#9ab8d4','rgba(0,0,0,.4)');
    circ(-3.1,3.2,2.8,'#1a2a3a','rgba(0,0,0,.5)');
    blades(-3.1,3.2,4,2.5,1.5,on?T*6:0,'#bcd6ea');circ(-3.1,3.2,.7,'#fff');
    g.strokeStyle='#8a9aa8';g.lineWidth=2.6;g.beginPath();g.moveTo(2.2,2);g.lineTo(5.6,2);g.lineTo(5.6,7.6);g.stroke();
    g.strokeStyle='#c4d4e0';g.lineWidth=.9;g.beginPath();g.moveTo(2.2,2);g.lineTo(5.6,2);g.lineTo(5.6,7.6);g.stroke();
    if(on){for(let k=0;k<3;k++){const q=(T*1.1+k/3)%1;circ(5.6+Math.sin(k)*.6,8-q*3,.9*(1-q)+.3,`rgba(120,200,255,${.9-q*.6})`)}}
    ell(5.6,8.5,2.3,.8,'#3f8fdc');
    break}
  case 'groundwaterPump':{
    pad('#6a7c8c');
    RR(-6.6,5.4,13.2,3,.8,'#505a64','rgba(0,0,0,.4)');
    poly([[-3.4,5.4],[3.4,5.4],[1.2,-3],[-1.2,-3]],lin(-3,0,3,0,[[0,'#8a96a4'],[1,'#505c68']]),'rgba(0,0,0,.4)');
    const rock=on?Math.sin(T*2.2)*.2:.05;
    g.save();g.translate(0,-3.4);g.rotate(rock);
    RR(-8,-1.2,15,2.4,1,'#d8a838','rgba(0,0,0,.45)');
    poly([[-8,-2.2],[-10,-.4],[-8,1.6],[-6.6,1.2],[-6.6,-1.6]],'#e8c050','rgba(0,0,0,.4)');
    circ(7.2,0,2.3,'#444a50','rgba(0,0,0,.5)');circ(7.2,0,.8,'#aab');g.restore();
    circ(0,-3.4,1.2,'#333');
    const dy=on?Math.sin(T*2.2)*1.2:0;
    g.strokeStyle='#cfd6dc';g.lineWidth=.7;g.beginPath();g.moveTo(-9.2,-3.4+dy*.5);g.lineTo(-9.2,5.4);g.stroke();
    ell(-7.2,7.6,2.6,.9,'#2f7fcf');
    if(on){const q=(T*1.2)%1;circ(-9.2,5.4+q*2,.8,`rgba(120,200,255,${.9-q*.7})`)}
    break}
  case 'waterPipe':{
    pad('#667a8a');
    const p=(x0,y0,w,h)=>{RR(x0,y0,w,h,1.4,w>h?lin(0,y0,0,y0+h,[[0,'#8acaf0'],[.5,'#3a86c4'],[1,'#1c4a78']]):lin(x0,0,x0+w,0,[[0,'#8acaf0'],[.5,'#3a86c4'],[1,'#1c4a78']]),'rgba(0,0,0,.45)')};
    p(-9.4,-2,18.8,4);p(-2,-9.4,4,18.8);
    circ(0,0,3.4,lin(-3,-3,3,3,[[0,'#b8e4ff'],[1,'#2a6a9a']]),'rgba(0,0,0,.45)');
    for(const [fx,fy,w,h] of[[-7,-2.7,1.6,5.4],[5.4,-2.7,1.6,5.4],[-2.7,-7,5.4,1.6],[-2.7,5.4,5.4,1.6]])RR(fx,fy,w,h,.4,'#aab8c6','rgba(0,0,0,.4)');
    if(on)for(let k=0;k<3;k++){const q=(T*.9+k/3)%1;const px=-9+q*18;circ(px,0,.9,'rgba(230,248,255,.9)');circ(0,px,.9,'rgba(230,248,255,.9)')}
    break}
  case 'circulator':{
    pad('#5a7c7c');
    circ(0,0,8,lin(-6,-6,6,6,[[0,'#8ae0d8'],[1,'#2a7a76']]),'rgba(0,0,0,.5)');
    circ(0,0,6.3,'#0f2a2a','rgba(0,0,0,.5)');
    blades(0,0,4,5.6,2.2,on?T*4:.5,lin(0,0,6,0,[[0,'#d8fffa'],[1,'#58c8be']]));
    circ(0,0,1.5,'#f0fffc','rgba(0,0,0,.4)');
    g.strokeStyle=on?'rgba(180,255,245,.9)':'rgba(180,255,245,.5)';g.lineWidth=.9;g.beginPath();g.arc(0,0,7.1,on?T*2:0,(on?T*2:0)+1.3);g.stroke();
    break}
  /* ---------------- oficinas y banco ---------------- */
  case 'office':{
    shadow(2,8.4,8,1.8,.28);
    box(-6.8,0,12.8,8,1.8,'#efe2bc','#f8eed0','#cbb98a');
    poly([[-8.2,.4],[-1.4,-7],[5.6,-7],[7.6,-3.2],[7.9,.4]],'#b4503a','rgba(0,0,0,.4)');
    poly([[-8.2,.4],[-1.4,-7],[-.6,-7],[-7.4,.4]],'#d6705a');
    RR(-2.2,3.6,3.2,4.4,.6,'#7a4c2a','rgba(0,0,0,.4)');
    win(-6,2.4,1,1,0,0,0);RR(2,2.4,2.8,2.4,.4,on?'#ffe58a':'#9ac0dc','rgba(0,0,0,.4)');
    cyl(3.4,-9.2,2,4.4,'#b46a4e','#94503a');
    if(on)smoke(3.4,-9.4,2,'200,200,205',.3,6);
    break}
  case 'office2':{
    shadow(2,8.4,9,1.9,.28);
    box(-8.2,-2.4,14.6,10.6,2,'#8a9cb0','#b2c2d4','#5e6e80');
    RR(-8.2,-3.6,14.6,1.6,.5,'#4a5666');
    g.fillStyle='#34475c';g.fillRect(-7.4,-.8,13,3.2);g.fillRect(-7.4,3.6,13,3.2);
    win(-6.8,-.4,5,1,2.6,0,1,'#bfe6ff','#1e2e40');win(-6.8,4,5,1,2.6,0,2,'#bfe6ff','#1e2e40');
    RR(-1.4,6.2,3,2,.4,'#2a3644');
    RR(2.6,-6.4,3.2,2.6,.5,'#c4ccd6','rgba(0,0,0,.4)');circ(4.2,-5.1,.9,'#6a7480');
    break}
  case 'office3':{
    shadow(2,8.4,9.4,2,.28);
    box(-9,-5,8.8,13.2,1.8,'#7a8cb4','#a8b8da','#53628a');
    box(-.2,-1,8.6,9.2,1.8,'#6c7ea8','#9aaace','#48567c');
    g.fillStyle='#223050';g.fillRect(-8.2,-4,7.2,10.4);g.fillRect(.6,0,7,6.6);
    win(-7.6,-3.4,3,4,2.2,2.6,3,'#cfe8ff','#1a2640');win(1.2,.6,3,3,2.2,2.2,4,'#cfe8ff','#1a2640');
    RR(-5.4,6,3.6,2.2,.4,'#1a2234');
    break}
  case 'office4':{
    shadow(2.4,8.4,8.4,2,.28);
    box(-5.8,-8,11,16.2,2.2,'#6a84b4','#9ab4de','#44588a');
    g.fillStyle='#1c2c4c';g.fillRect(-5,-7.2,9.4,14.4);
    win(-4.4,-6.4,4,6,2.2,2.2,5,'#d4ecff','#16223c');
    g.strokeStyle='#d8e0ea';g.lineWidth=.7;g.beginPath();g.moveTo(-.4,-8);g.lineTo(-.4,-10.4);g.stroke();
    circ(-.4,-10.4,.9,on&&Math.sin(T*4)>0?'#ff5a5a':'#8a2a2a');
    RR(-2,6,3.2,2.2,.4,'#121a2c');
    break}
  case 'office5':{
    shadow(2.4,8.4,9.6,2,.28);
    box(-9.6,-1,5.4,9.2,1.4,'#6e7eac','#98a8d4','#485684');
    box(-3.6,-8.4,6.4,16.6,1.8,'#8498c8','#b4c4ea','#566a9c');
    box(3.4,-4,5.4,12.2,1.4,'#6e7eac','#98a8d4','#485684');
    g.fillStyle='#1a2644';g.fillRect(-8.8,-.2,3.8,7.6);g.fillRect(-2.8,-7.6,4.8,15);g.fillRect(4.2,-3.2,3.8,10.4);
    win(-8.4,.4,2,3,2,2.2,6,'#d4ecff','#141e38');win(-2.4,-7,2,5,2.2,2.5,7,'#d4ecff','#141e38');win(4.6,-2.6,2,4,1.9,2.3,8,'#d4ecff','#141e38');
    g.strokeStyle='#e0e8f0';g.lineWidth=.6;g.beginPath();g.moveTo(-.4,-8.4);g.lineTo(-.4,-10.6);g.stroke();circ(-.4,-10.6,.8,on&&Math.sin(T*4)>0?'#ff5a5a':'#8a2a2a');
    break}
  case 'bank':{
    pad('#8a8472');
    RR(-9,6.2,18,2.6,.6,'#d8d2c0','rgba(0,0,0,.35)');RR(-8,4.6,16,1.8,.4,'#e8e2d0','rgba(0,0,0,.3)');
    RR(-7.4,-1.6,14.8,6.2,.4,'#f0ead8','rgba(0,0,0,.3)');
    for(let k=0;k<5;k++)RR(-6.6+k*3.2,-1.6,1.8,6.2,.3,lin(-6.6+k*3.2,0,-4.8+k*3.2,0,[[0,'#ffffff'],[1,'#c8c2b0']]),'rgba(0,0,0,.25)');
    poly([[-8.6,-1.6],[0,-8.4],[8.6,-1.6]],'#d8caa0','rgba(0,0,0,.4)');
    circ(0,-4.2,1.9,on?'#ffe066':'#d8b84a','rgba(0,0,0,.4)');g.fillStyle='#6a5a1a';g.font='bold 3px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('$',0,-4.1);
    break}
  /* ---------------- investigación ---------------- */
  case 'researchCenter':{
    pad('#6a8088');
    box(-7.6,-2,13.4,10.2,1.8,'#d8e4ea','#f0f6fa','#a4b4bc');
    RR(-7.6,-3.4,13.4,1.6,.4,'#4aa4be');
    g.fillStyle='#2a3c46';g.fillRect(-6.6,.2,4.6,3.8);g.fillRect(-.8,.2,4.6,3.8);
    RR(-3.4,5.4,3.4,2.8,.5,'#34505a');
    g.strokeStyle='#cfd8de';g.lineWidth=.7;g.beginPath();g.moveTo(3.8,-3.4);g.lineTo(3.8,-8);g.stroke();circ(3.8,-8.2,.9,on&&Math.sin(T*3)>0?'#ff6a6a':'#7a3a3a');
    g.beginPath();g.moveTo(-5.2,-1.2);g.lineTo(-5.2,.6);g.lineTo(-6.4,2.8);g.lineTo(-4,2.8);g.lineTo(-5.2,.6);g.fillStyle='#5ce0f0';g.fill();
    if(on){for(let k=0;k<2;k++){const q=(T*.8+k*.5)%1;circ(-5.2+k*.6,2.4-q*3,.5,`rgba(200,255,255,${1-q})`)}}
    break}
  case 'researchCenter2':{
    pad('#628270');
    box(-8.6,-2.4,14.4,10.6,2,'#d4e8da','#eef8f1','#9cb8a6');
    RR(-8.6,-3.8,14.4,1.6,.4,'#46b878');
    g.fillStyle='#24402e';g.fillRect(-7.4,.2,5,4);g.fillRect(-1.4,.2,5,4);g.fillRect(4.4,.2,2.4,4);
    RR(-4,5.6,3.6,2.6,.5,'#2e5a40');
    g.save();g.translate(3,-5.6);g.strokeStyle='#8a948e';g.lineWidth=.9;g.beginPath();g.moveTo(0,3);g.lineTo(0,0);g.stroke();
    g.rotate(on?Math.sin(T*1.2)*.5-.3:-.3);g.beginPath();g.ellipse(0,-.2,4.4,1.8,0,0,7);g.fillStyle='#eef2ee';g.fill();S('rgba(0,0,0,.4)',.6);circ(0,-.2,.8,'#d44');g.restore();
    if(on)glow(0,3,9,'110,255,170',.14+.06*Math.sin(T*4));
    break}
  case 'researchCenter3':{
    pad('#5a4a78');
    RR(-8.4,2.4,16.8,5.8,1,lin(0,2.4,0,8.2,[[0,'#b4a0d8'],[1,'#6a5a90']]),'rgba(0,0,0,.4)');
    g.beginPath();g.arc(0,2.6,7.6,Math.PI,0);g.closePath();F(rad(-2,-3,1,9,[[0,'rgba(240,230,255,.95)'],[.6,'rgba(170,150,230,.9)'],[1,'rgba(90,70,150,.95)']]));S('rgba(0,0,0,.4)',.7);
    if(on)glow(0,-1,9,'200,150,255',.35+.15*Math.sin(T*3));
    g.save();g.beginPath();g.arc(0,2.6,7,Math.PI,0);g.clip();
    for(let k=0;k<2;k++){g.beginPath();for(let q=0;q<=14;q++){const yy=2.4-q*.8,xx=Math.sin(q*.7+k*Math.PI+(on?T*2.4:0))*3;q?g.lineTo(xx,yy):g.moveTo(xx,yy)}g.strokeStyle=k?'#ff9ad8':'#8ad0ff';g.lineWidth=1.1;g.stroke()}
    g.lineWidth=.6;g.strokeStyle='rgba(255,255,255,.8)';for(let q=1;q<14;q+=2){const xx=Math.sin(q*.7+(on?T*2.4:0))*3;g.beginPath();g.moveTo(xx,2.4-q*.8);g.lineTo(-xx,2.4-q*.8);g.stroke()}
    g.restore();
    RR(-2.2,5.2,4.4,3,.6,'#3a2e58');
    break}
  default:{pad('#777');circ(0,0,5,'#aaa')}
  }
  g.restore();
}
const _iconCache={};
function iconURL(c,size=40){
  const k=c.id+size;if(_iconCache[k])return _iconCache[k];
  const cv=document.createElement('canvas');cv.width=cv.height=size;
  const g=cv.getContext('2d');
  g.fillStyle=g.createLinearGradient(0,0,size,size);
  const gr=g.createLinearGradient(0,0,size,size);gr.addColorStop(0,'#4a8a3c');gr.addColorStop(1,'#356a2c');
  g.fillStyle=gr;g.beginPath();g.roundRect(0,0,size,size,size/6);g.fill();
  g.strokeStyle=c.col;g.lineWidth=Math.max(1.5,size/16);g.beginPath();g.roundRect(1,1,size-2,size-2,size/6);g.stroke();
  drawIcon(g,c,size/2,size/2,size*.86);
  return _iconCache[k]=cv.toDataURL();
}
const iconImg=(c,px)=>`<img src="${iconURL(c)}" width="${px||26}" height="${px||26}" style="border-radius:5px;vertical-align:middle" alt="">`;
