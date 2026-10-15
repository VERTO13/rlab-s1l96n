'use strict';
/* ============================================================
   INTERFAZ
   ============================================================ */
const $=s=>document.querySelector(s);
const viewEl=$('#view');
const TS=30,HORIZON=40;
let curReactor=null,selComp=null,paused=false,playFast=false,view='reactors';
let mode='build',paint=false,showHeatView=true,showNums=false,hover=null;
let sel=null,clip=null,stepMode=false,stepAuto=null,lastPhase=null,previewOk=null;
const curR=()=>G.reactors[curReactor];
const isReal=R=>!R.meta.sandbox;
const anyComp=id=>Object.values(G.reactors).some(R=>isReal(R)&&R.tiles.some(t=>t.c&&t.c.id===id));
Object.assign(G.stats,{sells:0,slow:0,hoverCell:0,placeInfo:0});
G.tut=0;G.tutHidden=false;G.unl={};
const rnd=(a,b)=>a+Math.random()*(b-a);
const mq=window.matchMedia('(max-width:760px)');
const isMobile=()=>mq.matches;
function applyMobileClass(){document.body.classList.toggle('mobile',isMobile());if(!isMobile())document.body.classList.remove('sheet-open')}
applyMobileClass();
mq.addEventListener('change',()=>{applyMobileClass();if(view==='game'&&curReactor)renderGame()});

/* ---- preferencias de interfaz y revelado progresivo ---- */
const UIKEY='reactorIdleUI';
const uiPrefs={advanced:false,resFilter:'pending',resGroup:'all',resQ:'',upFilter:'all',upGroup:'all',upQ:'',upSort:'orig',palCat:'all',upRows:false,zoomHint:false,events:'all',fuel:null};
try{Object.assign(uiPrefs,JSON.parse(localStorage.getItem(UIKEY)||'{}'))}catch(e){}
const saveUI=()=>{try{localStorage.setItem(UIKEY,JSON.stringify(uiPrefs))}catch(e){}};
BUILD.fuel=FUELS[uiPrefs.fuel]?uiPrefs.fuel:null;   // se valida al dibujar (puede que aún no esté investigado)
EVCFG.mode=['all','fav','off'].includes(uiPrefs.events)?uiPrefs.events:'all';
EVCFG.tps=()=>1000/tickInterval();
// cada herramienta aparece cuando el jugador la necesita (o todo desde el inicio con el «modo avanzado»)
const heatUnlocked=R=>uiPrefs.advanced||isFree(R)||gres('solarCell')>0||R.tiles.some(t=>t.c&&t.c.maxHeat);
const advTools=R=>uiPrefs.advanced||isFree(R)||G.stats.built>=8;
const menuUnlocked=()=>uiPrefs.advanced||G.stats.sells>=1||Object.keys(G.research).length>0||G.totalTicks>=300;
function applyMenu(){
  const on=menuUnlocked();
  ['research','upgrades'].forEach(v=>{const b=document.querySelector('#menu [data-v="'+v+'"]');if(b)b.style.display=on?'':'none'});
  if(on&&!G.unl.menu){G.unl.menu=1;if(!uiPrefs.advanced)toast('🔓 <b>Investigación y Mejoras</b> ya están disponibles en el menú.')}
}
let palCount=-1;
const availComps=R=>COMPS.filter(c=>compAvailable(R,c)&&!(R.meta.researchComponentsDisabled&&c.type==='researchCenter'));
function applyDisclosure(R){
  if(view!=='game'||!curReactor)return;R=R||curR();
  if(paletteEl&&availComps(R).length!==palCount)buildPalette(); // al desbloquear piezas nuevas la paleta se actualiza sola
  const vis=(sel,on)=>{const e=$(sel);if(e)e.style.display=on?'':'none'};
  const heat=heatUnlocked(R),adv=advTools(R);
  ['#bHeatView','#bNums','#bSlow','#bDemoTb','#chip'].forEach(x=>vis(x,heat));
  ['#mSel','#mPaint','#bUndo','#bRedo'].forEach(x=>vis(x,adv));
  const hasTerra=!isFree(R)&&R.tiles.some(t=>t.orig==='water'||t.orig==='mountain');
  ['#mTerr','#mbTerr'].forEach(x=>vis(x,adv&&hasTerra));
  if(mode==='terrain'&&!(adv&&hasTerra))mode='build';
  vis('#bRestore',adv||R.tiles.some(t=>t.c&&t.c.lifetime>0&&t.life<=0));
  const lg=$('#legend');if(lg)lg.style.display=(heat&&showHeatView)?'flex':'none';
  if(heat&&!G.unl.heat){G.unl.heat=1;if(!uiPrefs.advanced)toast('🔓 <b>Calor desbloqueado</b><br><span class="small">Vista de calor, cámara lenta y calculadora ya están en la barra del mapa.</span>')}
  if(adv&&!G.unl.adv){G.unl.adv=1;if(!uiPrefs.advanced)toast('🔓 <b>Herramientas avanzadas</b><br><span class="small">Seleccionar, pintar, deshacer y rehacer.</span>')}
}

/* ============================================================
   GUARDADO
   ============================================================ */
const SAVEKEY='reactorIdleClone1',TPLKEY='reactorIdleTemplates';
function getSave(){
  const d={v:2,money:G.money,totalMoney:G.totalMoney,totalTicks:G.totalTicks,rp:G.rp,research:G.research,bonusTicks:G.bonusTicks,savedAt:Date.now(),cur:curReactor,
    ach:G.ach,stats:G.stats,tut:G.tut,tutHidden:G.tutHidden,unl:G.unl,ev:{next:G.ev.next,lastAdv:G.ev.lastAdv},reactors:{}};
  for(const id in G.reactors){const R=G.reactors[id];
    d.reactors[id]={bought:R.bought,power:R.power,auto:R.auto,ups:R.ups,terra:R.tiles.reduce((a,t,i)=>{if(t.terrain!==t.orig)a.push(i);return a},[]),tiles:R.tiles.map(t=>t.c?[t.c.id,t.heat,t.water,t.life,t.fuel||null]:null)}}
  return d;
}
function saveGame(){try{localStorage.setItem(SAVEKEY,JSON.stringify(getSave()))}catch(e){}}
function loadSave(d,offline){
  if(!d||(d.v!==1&&d.v!==2))return false;
  G.money=d.money;G.totalMoney=d.totalMoney||0;G.totalTicks=d.totalTicks||0;G.rp=d.rp||0;G.research=d.research||{};G.bonusTicks=d.bonusTicks||0;
  evReset(d.ev&&typeof d.ev.next==='number'?d.ev.next:null);G.ev.lastAdv=!!(d.ev&&d.ev.lastAdv);   // los eventos activos no se guardan
  G.ach=d.ach||{};G.tut=d.tut||0;G.tutHidden=!!d.tutHidden;G.unl=d.unl||{heat:true,adv:true,menu:true};
  G.stats=Object.assign({explosions:0,sold:0,built:0,sells:0,slow:0,hoverCell:0,placeInfo:0},d.stats||{});
  for(const id in G.reactors){const R=G.reactors[id],s=d.reactors[id];if(!s)continue;
    R.bought=!!s.bought;R.power=s.power||0;R.auto=s.auto!==false;R.ups=s.ups||{};R.ubDirty=true;
    R.tiles.forEach(t=>{t.terrain=t.orig});
    (s.terra||[]).forEach(i=>{const t=R.tiles[i];if(t&&(t.orig==='water'||t.orig==='mountain'))t.terrain='grass'});
    s.tiles.forEach((a,i)=>{const t=R.tiles[i];if(!t)return;if(a&&CBY[a[0]]){t.c=CBY[a[0]];t.heat=a[1]||0;t.water=a[2]||0;t.life=a[3];t.fuel=(a[4]&&FUELS[a[4]]&&fuelable(t.c))?a[4]:null}else{t.c=null;t.heat=0;t.water=0;t.life=null;t.fuel=null}});
  }
  curReactor=(d.cur&&G.reactors[d.cur])?d.cur:null;   // por si el guardado menciona un reactor que ya no existe
  if(offline&&d.savedAt){
    const tps=1000/tickInterval();
    let n=Math.round((Date.now()-d.savedAt)/(1000*OFFLINE_SLOWER)*tps);
    const mx=TICKS_MAXBONUS*tps;if(n>mx)n=mx;if(n<TICKS_MINBONUS)n=0;
    G.bonusTicks+=n;
  }
  return true;
}
const tickInterval=()=>Math.round(1000/(1+gres('chronometer')));
const loadTemplates=()=>{try{return JSON.parse(localStorage.getItem(TPLKEY)||'[]')}catch(e){return[]}};
const saveTemplates=a=>{try{localStorage.setItem(TPLKEY,JSON.stringify(a))}catch(e){}};

/* ============================================================
   AVISOS, LOGROS Y TUTORIAL
   ============================================================ */
/* los avisos del juego aparecen como etiquetas que se desvanecen sobre el mapa */
function logMsg(m){
  const el=$('#feed');if(!el||!m)return;
  const d=document.createElement('div');d.className='ev';d.textContent=m;el.append(d);
  while(el.children.length>5)el.firstChild.remove();
  setTimeout(()=>d.remove(),6700);
}
function toast(html){
  const el=document.createElement('div');el.className='toast';el.innerHTML=html;$('#toasts').append(el);
  setTimeout(()=>el.remove(),5500);
}
const realReactors=()=>Object.values(G.reactors).filter(isReal);
const ACH=[
 {id:'first_sale',n:'Primer negocio',d:'Vende energía por primera vez.',ok:()=>G.stats.sells>=1},
 {id:'builder',n:'Constructor',d:'Construye 50 piezas.',ok:()=>G.stats.built>=50},
 {id:'researcher',n:'Científico',d:'Completa tu primera investigación.',ok:()=>Object.keys(G.research).some(k=>G.research[k]>0)},
 {id:'boom',n:'¡Boom!',d:'Haz explotar algo.',ok:()=>G.stats.explosions>=1},
 {id:'converter',n:'Calor útil',d:'Convierte calor en energía con un generador.',ok:()=>realReactors().some(R=>(R.last.heatToPower||0)>0)},
 {id:'exch',n:'Equilibrista',d:'Usa un intercambiador de calor.',ok:()=>anyComp('heatExchanger')},
 {id:'hour',n:'Maratón',d:'Juega 1 000 ticks.',ok:()=>G.totalTicks>=1000},
 {id:'rich',n:'Millonario',d:'Gana $1 M en total.',ok:()=>G.totalMoney>=1e6},
 {id:'nuclear',n:'Era atómica',d:'Investiga las celdas nucleares.',ok:()=>gres('nuclearCell')>=1},
 {id:'island2',n:'Expansión',d:'Compra tu segunda central.',ok:()=>realReactors().filter(R=>R.bought).length>=2},
 {id:'node',n:'Buen ojo',d:'Construye una celda sobre un nodo especial.',ok:()=>realReactors().some(R=>R.tiles.some(t=>t.c&&t.node&&t.c.st.type==='Cell'))},
 {id:'terra',n:'Ingeniero civil',d:'Modifica 10 casillas de terreno (montañas o agua).',ok:()=>(G.stats.terra||0)>=10},
 {id:'planner',n:'Previsor',d:'Usa la calculadora previa 10 veces.',ok:()=>G.stats.placeInfo>=10}
];
function checkAch(){
  for(const a of ACH){
    if(G.ach[a.id])continue;
    let ok=false;try{ok=a.ok()}catch(e){}
    if(ok){G.ach[a.id]=Date.now();toast('🏆 <b>'+a.n+'</b><br><span class="small">'+a.d+'</span>');sfx.ach()}
  }
}
const solarNextToGen=()=>realReactors().some(R=>R.tiles.some(t=>t.c&&t.c.id==='solarCell'&&near(R,t,N4).some(n=>n.c&&n.c.st.type==='HeatToPowerConverter')));
const TUT=[
 {t:'Construye una <b>turbina eólica</b>: elígela en <i>Construcción</i> (en el celular, botón <i>Piezas</i>) y toca un cuadro de pasto.',ok:()=>G.stats.built>=1},
 {t:'Espera unos segundos y pulsa <b>Vender toda la energía</b>.',ok:()=>G.stats.sells>=1},
 {t:'Con unos $100 ve a <b>Investigación</b> y compra <b>Centro de investigación</b>.',ok:()=>gres('researchCenter')>=1},
 {t:'Construye un <b>Centro de investigación</b> en el mapa: te da puntos para nuevas tecnologías.',ok:()=>anyComp('researchCenter')},
 {t:'Investiga <b>Celdas solares</b> (2 500 puntos). Mientras tanto, sigue vendiendo energía.',ok:()=>gres('solarCell')>=1},
 {t:'Una celda solar produce <b>calor</b>, no energía. Construye una <b>Celda solar</b> con un <b>Generador</b> pegado.',ok:()=>solarNextToGen()},
 {t:'Pasa el mouse sobre la celda: verás a quién reparte su calor. Prueba también <b>Vista de calor</b> o <b>Cámara lenta</b>.',ok:()=>G.stats.slow>0||G.stats.hoverCell>2},
 {t:'Con una pieza elegida, pasa el mouse sobre un cuadro vacío: la <b>calculadora previa</b> te dice si aguantaría el calor.',ok:()=>G.stats.placeInfo>=3}
];
function tutCheck(){
  if(G.tut>=TUT.length)return;
  let adv=false;
  while(G.tut<TUT.length&&(()=>{try{return TUT[G.tut].ok()}catch(e){return false}})()){G.tut++;adv=true}
  if(adv){sfx.ach();renderTut()}
}
function renderTut(){
  const el=$('#tut');if(!el)return;
  if(G.tutHidden){el.style.display='none';return}
  el.style.display='';
  if(G.tut>=TUT.length){el.innerHTML='<b>🎓 Tutorial completado.</b> Ya conoces lo básico: sigue creciendo, investigando y mejorando tus reactores. <button class="sm" id="tutX">Ocultar</button>';
    $('#tutX').onclick=()=>{G.tutHidden=true;renderTut()};return}
  el.innerHTML=`<div style="display:flex;gap:10px;align-items:center"><div style="flex:1"><div class="small">Tutorial · paso ${G.tut+1} de ${TUT.length}</div><div>${TUT[G.tut].t}</div>
   <div class="st">${TUT.map((_,i)=>`<i class="${i<G.tut?'dn':i===G.tut?'cu':''}"></i>`).join('')}</div></div>
   <button class="sm" id="tutX">Ocultar</button></div>`;
  $('#tutX').onclick=()=>{G.tutHidden=true;renderTut()};
}
function updateAlert(){
  const el=$('#alert');let msg='',rid=null;
  for(const R of realReactors()){if(R.bought&&R.hotCount>0){msg=`🔥 <b>${R.meta.name}</b>: ${R.hotCount} pieza(s) al 85 % o más de su calor máximo. Haz clic para ir allí.`;rid=R.meta.id;break}}
  if(msg){
    if(el.style.display!=='block')sfx.warn();
    el.style.display='block';el.innerHTML=msg;el.onclick=()=>setView('game',rid);
    document.title=(Math.floor(performance.now()/800)%2?'🔥 ':'⚠ ')+'¡Calor! · Reactor Lab';
  }else{el.style.display='none';document.title='Reactor Lab'}
}
let lastTickAt=performance.now();
hooks.log=logMsg;
hooks.onBoom=(R,t)=>{
  sfx.boom();
  if(view==='game'&&R===curR()){
    const x=t.x*TS+TS/2,y=t.y*TS+TS/2;
    fxBurst(x,y,'#ffb040',26,150,.7);fxBurst(x,y,'#ff5030',14,90,.9);fxBurst(x,y,'#ccc',10,45,1.1);fxRing(x,y,'rgba(255,140,60,.9)',.6);
    fx.shake=performance.now()+450;
  }
};
hooks.onBuild=(R,t)=>{if(view==='game'&&R===curR())fxRing(t.x*TS+TS/2,t.y*TS+TS/2,'rgba(160,240,160,.9)',.4)};
hooks.onSell=(R,t)=>{if(view==='game'&&R===curR())fxBurst(t.x*TS+TS/2,t.y*TS+TS/2,'#c8c8d4',9,70,.45)};
hooks.onTick=()=>{
  lastTickAt=performance.now();
  renderEvents();refreshHud();tutCheck();updateAlert();applyMenu();
  if(view==='game'&&curReactor)spawnTickFx(curR());
  if(G.totalTicks%10===0)checkAch();
};

/* ============================================================
   VISTAS
   ============================================================ */
function setView(v,id){
  view=v;if(id)curReactor=id;
  showInfoText('');applyMenu();
  document.querySelectorAll('#menu button[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  if((v==='game'||v==='upgrades')&&!curReactor)view=v='reactors';
  ({reactors:renderReactors,game:renderGame,research:renderResearch,upgrades:renderUpgrades})[view]();
}
document.querySelectorAll('#menu button[data-v]').forEach(b=>b.onclick=()=>setView(b.dataset.v));

function renderReactors(){
  let h=`<div id="tut" class="box"></div><div class="box">Tienes <b class="money">$${nf(G.money)}</b> para gastar. Compra más tierra para construir un imperio energético aún más grande.</div>`;
  let shownLocked=0,hiddenLand=0;
  for(const m of REACTORS){
    const R=G.reactors[m.id];
    if(!uiPrefs.advanced){
      if(!R.bought){if(shownLocked>=1){hiddenLand++;continue}shownLocked++}
    }
    h+=`<div class="card"><div class="nm">${m.name}</div><div class="small">${m.w}×${m.h}</div>`;
    if(R.bought)h+=`<div class="small">Dinero <span class="money" data-inc="${m.id}">${nf(R.last.money||0)}</span>/tick<br>Inv. <span class="research" data-rinc="${m.id}">${nf(R.last.research||0)}</span>/tick</div><button data-sel="${m.id}">Abrir</button>`;
    else h+=`<div class="small">Precio<br><b class="money">${m.price?'$'+nf(m.price):'Gratis'}</b></div><button data-buy="${m.id}" class="${afford(G.money,m.price)?'':'cant'}">${afford(G.money,m.price)?'COMPRAR':'MUY CARO'}</button>`;
    h+='</div>';
  }
  if(hiddenLand)h+=`<div class="card" style="opacity:.6"><div class="nm">???</div><div class="small">${hiddenLand} tierra${hiddenLand>1?'s':''} más por descubrir cuando compres la siguiente.</div></div>`;
  viewEl.innerHTML=h;renderTut();
  viewEl.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>setView('game',b.dataset.sel));
  viewEl.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{
    const m=REACTORS.find(r=>r.id===b.dataset.buy);
    if(afford(G.money,m.price)){addMoney(-m.price,false);G.reactors[m.id].bought=true;sfx.cash();setView('game',m.id)}});
}

/* ============================================================
   VISTA DE REACTOR
   ============================================================ */
let cv,g2,paletteEl,tipEl=null;
const lastMouse={x:0,y:0};
const disp={money:0,rp:0,power:0};
function renderGame(){
  const R=curR();
  disp.money=G.money;disp.rp=G.rp;disp.power=R.power;lastMoney=G.money;
  viewEl.innerHTML=`
  <div class="cols">
   <div class="left">
    <div class="box" id="overview">
      <div class="res">Dinero <b class="money">$<span id="vMoney"></span></b> <span class="money small" id="vInc"></span></div>
      <div class="res">Investigación <b class="research" id="vRp"></b> <span class="research small" id="vRinc"></span></div>
      <div class="res">Energía <b class="power" id="vPow"></b> <span class="power small" id="vPinc"></span></div>
      <div class="small">Máx. <span id="vMax"></span> · Almacenada <span id="vPct"></span>%</div>
      <div class="bar"><i id="vBar"></i></div>
      <button id="bSell">Vender toda la energía</button>
    </div>
    <div class="box" id="toolbox">
      <h4>Construcción${isFree(R)?' · todo desbloqueado':''}</h4>
      <div class="row" style="margin-top:0">
        <button id="mBuild">Construir</button><button id="mSell">Vender</button><button id="mSel">Seleccionar</button><button id="mTerr" title="Despejar montañas y rellenar agua (tecla T)">⛏ Terreno</button>
        <button id="mPaint" title="Arrastra para repetir la acción (en móvil)">Pintar</button>
      </div>
      <div id="terraBox" class="small" style="display:none;margin:0 0 6px"></div>
      <div id="fuelBox" style="display:none;margin:0 0 6px"></div>
      <div id="palcats" class="fbar" style="margin:0 0 6px"></div><div id="palette"></div>
      <div class="row">
        <button id="bUndo" class="sm" title="Solo mientras no pase un tick (pausa el juego para tener más margen).">↶ Deshacer</button><button id="bRedo" class="sm" title="Solo mientras no pase un tick">↷ Rehacer</button>
        <button id="bRestore" class="sm" title="Tecla R">Reponer agotados</button>
      </div>
      <div class="small" id="expInfo"></div>
    </div>
    <div class="box" id="selBox"></div>
   </div>
   <div class="right">
    <div id="tut" class="box"></div>
    <div class="toolbar">
      <button id="bPause"></button>
      <button id="bFast" style="display:none">Rápido ≫</button>
      <button id="bHeatView">Vista de calor</button>
      <button id="bNums">Números</button>
      <button id="bSlow" title="Ejecuta el tick fase por fase">Cámara lenta</button>
      <button id="bDemoTb" title="Demostración animada de cómo se reparte el calor">?</button>
      <span class="grow"></span>
      <span class="small" id="bonus"></span>
      <button id="bAuto" style="display:none"></button>
      <button id="chip" class="chip good" title="Calculadora: simula los próximos ${HORIZON} ticks">…</button>
      <div class="pop" id="calcPop">
        <h4 style="margin:0 0 6px;font-size:11px;color:var(--mute);text-transform:uppercase">Calculadora · próximos ${HORIZON} ticks</h4>
        <div id="analysis" class="small">…</div>
        <div class="row"><button class="sm" id="bLong">Simular 300 ticks</button></div><div id="longRes" class="small"></div>
      </div>
    </div>
    <div class="box" id="stepBox" style="display:none"></div>
    <div id="mapwrap"><canvas id="cv"></canvas>
      <div class="ov" id="feed"></div>
      <div class="ov legend" id="legend"><span>frío</span><i></i><span>máx.</span></div>
      <div class="ov" id="tickbar"><i></i></div>
      <div class="ov zoomctl" id="zoomctl"><button id="zIn" title="Acercar (+)">＋</button><button id="zOut" title="Alejar (−)">－</button><button id="zReset" title="Vista normal (0)">⌂</button><span id="zLvl">1.0×</span></div>
    </div>
   </div>
  </div>
  <div id="mbar">
    <button id="mbMove" data-m="pan"><span>✋</span><small>Mover</small></button>
    <button id="mbBuild" data-m="build"><span>🔨</span><small>Construir</small></button>
    <button id="mbSell" data-m="sell"><span>🗑</span><small>Vender</small></button>
    <button id="mbTerr" data-m="terrain"><span>⛏</span><small>Terreno</small></button>
    <button id="mbPiece"><span id="mbIcon"></span><small id="mbName">Piezas</small></button>
  </div>`;
  cv=$('#cv');g2=cv.getContext('2d');paletteEl=$('#palette');
  setupCanvas(R);buildPalette();renderTut();updateButtons();refreshHud();renderSelBox();renderStepBox();
  $('#bSell').onclick=sellAllPower;
  $('#mBuild').onclick=()=>setMode('build');$('#mSell').onclick=()=>setMode('sell');$('#mSel').onclick=()=>setMode('select');$('#mTerr').onclick=()=>setMode('terrain');
  $('#mPaint').onclick=()=>{paint=!paint;updateButtons()};
  $('#bUndo').onclick=()=>{if(undoLast()){sfx.sell();refreshHud()}};$('#bRedo').onclick=()=>{if(redoLast()){sfx.build();refreshHud()}};
  $('#bRestore').onclick=doRestore;
  $('#bPause').onclick=()=>{if(stepMode)return;paused=!paused;restartLoop();updateButtons()};
  $('#bFast').onclick=()=>{if(G.bonusTicks>0&&!EVX.noFast){playFast=!playFast;restartLoop();refreshHud()}};
  $('#bAuto').onclick=()=>{R.auto=!R.auto;refreshHud()};
  $('#bHeatView').onclick=()=>{showHeatView=!showHeatView;updateButtons()};
  $('#bNums').onclick=()=>{showNums=!showNums;updateButtons()};
  $('#bSlow').onclick=toggleStep;
  $('#bDemoTb').onclick=openDemo;
  $('#chip').onclick=e=>{e.stopPropagation();const p=$('#calcPop');p.style.display=p.style.display==='block'?'none':'block'};
  $('#calcPop').onclick=e=>e.stopPropagation();
  $('#bLong').onclick=()=>{const r=simulate(R,300);
    $('#longRes').innerHTML=r.booms.length?`<span class="bad">💥 ${r.booms.length} pieza(s) explotarían en 300 ticks. La primera: ${r.booms[0].name} (${r.booms[0].x+1},${r.booms[0].y+1}) en ${r.booms[0].tick} ticks.</span>`:`<span class="good">✓ Estable 300 ticks.</span> Energía media ${nf(r.avgPower)}/tick · dinero ${nf(r.avgMoney)}/tick.`};
  camReset();bindZoomUI();bindCanvas(R);bindMobileBar(R);
  getBase(R,true);applyDisclosure(R);
}
document.addEventListener('click',()=>{const p=$('#calcPop');if(p)p.style.display='none'});
function setupCanvas(R){
  const dpr=window.devicePixelRatio||1;
  cv.width=R.meta.w*TS*dpr;cv.height=R.meta.h*TS*dpr;
  // el mapa ocupa todo el ancho disponible (hasta 46 px por casilla)
  cv.style.width='100%';cv.style.maxWidth=R.meta.w*46+'px';
  const mw=$('#mapwrap');if(mw)mw.style.maxWidth=R.meta.w*46+'px'; // el marco se ajusta al mapa (sin franja negra)
  g2.setTransform(dpr,0,0,dpr,0,0);
}
function renderTerraBox(){
  const el=$('#terraBox');if(!el)return;
  if(mode!=='terrain'||view!=='game'){el.style.display='none';return}
  const R=curR(),base=terraBase(R)*Math.pow(TERRA_GROW,terraCount(R)),done=terraCount(R);
  el.style.display='';
  el.innerHTML=`<b>⛏ Terreno</b> · toca una <b>montaña</b> para despejarla (<b class="money">$${nf(Math.round(base))}</b>) o el <b>agua</b> para rellenarla (<b class="money">$${nf(Math.round(base*TERRA_WATER))}</b>). Es permanente y cada casilla modificada encarece la siguiente un 6 %. Modificadas: <b>${done}</b>.`;
}
function setMode(m){mode=m;if(m!=='select')sel=null;updateButtons();renderSelBox()}
function updateButtons(){
  if(view!=='game')return;
  const set=(id,on)=>{const e=$(id);if(e)e.classList.toggle('on',!!on)};
  set('#mBuild',mode==='build');set('#mSell',mode==='sell');set('#mTerr',mode==='terrain');renderTerraBox();set('#mSel',mode==='select'||mode==='paste');set('#mPaint',paint);
  set('#bHeatView',showHeatView);set('#bNums',showNums);set('#bSlow',stepMode);
  const p=$('#bPause');if(p)p.textContent=paused?'▶ Continuar':'⏸ Pausa';
  const mb=(id,on)=>{const e=$(id);if(e)e.classList.toggle('on',!!on)};
  mb('#mbMove',mode==='pan');mb('#mbBuild',mode==='build'||mode==='paste');mb('#mbSell',mode==='sell');mb('#mbTerr',mode==='terrain');
  updateMbPiece();
  applyDisclosure();
}
function sellAllPower(){
  const R=curR();
  if(R.power>0){
    const v=R.power;addMoney(v);R.power=0;G.stats.sells++;sfx.cash();refreshHud();tutCheck();
    fxText(R.meta.w*TS/2,22,'+$'+nf(v),'#f5d84a');
  }
}
function doRestore(){const R=curR();beginGroup();const m=G.money;restoreAllExpired(R);endGroup();if(G.money!==m)sfx.build();refreshHud()}

/* ---- paleta (con categorías cuando hay muchas piezas) ---- */
const PAL_CATS=[['all','Todo'],['a','Celdas'],['heat','Calor'],['water','Agua'],['eco','Energía y $']];
const palCat=c=>c.group==='a'?'a':['b','b2','c'].includes(c.group)?'heat':c.group==='ee'?'water':'eco';
/* selector de combustible: aparece al elegir un quemador o una celda nuclear, cuando hay algún combustible investigado */
let fuelSig='';
function renderFuelBox(force){
  const el=$('#fuelBox');if(!el)return;
  const R=curR();if(!R)return;
  const av=Object.values(FUELS).filter(f=>isFree(R)||gres(f.req));
  if(BUILD.fuel&&!av.some(f=>f.id===BUILD.fuel))BUILD.fuel=null;
  const show=!!(selComp&&fuelable(selComp)&&av.length);
  const sig=(show?selComp.id:'-')+'|'+av.map(f=>f.id).join(',')+'|'+BUILD.fuel;
  if(!force&&sig===fuelSig)return;fuelSig=sig;
  if(!show){el.style.display='none';el.innerHTML='';return}
  const cur=FUELS[BUILD.fuel];
  el.style.display='';
  el.innerHTML='<div class="fbar" style="margin:0"><span class="small">Combustible:</span>'+fchip('Estándar',!BUILD.fuel,'data-f=""')+av.map(f=>fchip(f.name,BUILD.fuel===f.id,'data-f="'+f.id+'"')).join('')+'</div>'+
    '<div class="small d" style="margin-top:3px">'+(cur?`<b>${cur.full}</b>: calor ×${cur.heat}, vida ×${cur.life}, precio ×${cur.price}. ${cur.id==='dense'?'Concentra el calor en menos casillas; cuesta 20 % más por calor y hay que reconstruirlo seguido.':'Sale 33 % más barato por calor, pero necesitas más celdas y más generadores para la misma energía.'}`:'Calor, vida y precio normales.')+'</div>';
  el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{BUILD.fuel=b.dataset.f||null;uiPrefs.fuel=BUILD.fuel;saveUI();fuelSig='';buildPalette();showCompInfo(curR(),selComp);sfx.click()});
}
function buildPalette(){
  const R=curR();
  const avail=availComps(R);palCount=avail.length;
  // las categorías solo aparecen cuando hay muchas piezas (más adelante en la partida)
  const showCats=uiPrefs.advanced||avail.length>12;
  const cat=showCats?uiPrefs.palCat:'all';
  const catsEl=$('#palcats');
  if(catsEl){
    catsEl.style.display=showCats?'':'none';
    catsEl.innerHTML=showCats?PAL_CATS.filter(([k])=>k==='all'||avail.some(c=>palCat(c)===k)).map(([k,l])=>fchip(l+(k==='all'?'':' '+avail.filter(c=>palCat(c)===k).length),cat===k,`data-pc="${k}"`)).join(''):'';
    catsEl.querySelectorAll('[data-pc]').forEach(b=>b.onclick=()=>{uiPrefs.palCat=b.dataset.pc;saveUI();buildPalette()});
  }
  let h='',lastG=null;
  for(const c of avail){
    if(cat!=='all'&&palCat(c)!==cat)continue;
    if(lastG&&c.group!==lastG)h+='<hr>';lastG=c.group;
    h+=`<div class="comp${selComp&&selComp.id===c.id?' sel':''}" data-id="${c.id}">${iconImg(c,30)}<small>${isFree(R)?'&nbsp;':nf(buildPrice(c))}</small></div>`;
  }
  paletteEl.innerHTML=h;
  paletteEl.onmouseleave=()=>showInfoText('');
  paletteEl.querySelectorAll('.comp').forEach(el=>{
    el.onclick=()=>{selComp=CBY[el.dataset.id];if(mode!=='build'&&mode!=='paste')setMode('build');buildPalette();if(isMobile()){document.body.classList.remove('sheet-open');updateButtons()}else showCompInfo(R,selComp);sfx.click()};
    el.onmouseover=()=>showCompInfo(R,CBY[el.dataset.id]);
  });
  updatePaletteDim();renderFuelBox();
}
function updatePaletteDim(){
  if(!paletteEl)return;const R=curR();
  paletteEl.querySelectorAll('.comp').forEach(el=>el.style.opacity=(isFree(R)||afford(G.money,buildPrice(CBY[el.dataset.id])))?1:.4);
  renderFuelBox();
}

/* ---- tooltip flotante (sustituye al panel de información) ---- */
let tipTimer=null;
function showInfoText(t){
  if(!tipEl){tipEl=document.createElement('div');tipEl.id='tip';document.body.append(tipEl)}
  clearTimeout(tipTimer);
  if(!t){tipEl.style.display='none';return}
  tipEl.innerHTML=t;tipEl.style.display='block';placeTip();
  if(isMobile())tipTimer=setTimeout(()=>{tipEl.style.display='none'},5500);
}
function placeTip(){
  if(!tipEl||tipEl.style.display==='none')return;
  const w=tipEl.offsetWidth,h=tipEl.offsetHeight;
  let x=lastMouse.x+18,y=lastMouse.y+18;
  if(x+w>innerWidth-6)x=lastMouse.x-w-14;
  if(y+h>innerHeight-6)y=innerHeight-h-6;
  tipEl.style.left=Math.max(4,x)+'px';tipEl.style.top=Math.max(4,y)+'px';
}
document.addEventListener('pointermove',e=>{lastMouse.x=e.clientX;lastMouse.y=e.clientY;placeTip()});
document.addEventListener('pointerdown',e=>{lastMouse.x=e.clientX;lastMouse.y=e.clientY});

/* ---- textos de información ---- */
function stratInfo(R,c,t){
  const s=c.st,u=UB(R,c);let h='';
  switch(s.type){
    case 'Cell':
      if(s.powerProduction>0)h+=`Produce energía: <b class="power">${nf(powerProdOf(R,c))}</b> `;
      if(s.heatProduction>0)h+=`Produce calor: <b class="heat">${nf(t?heatProdOf(R,t):s.heatProduction*u.heatProductionMultiplayer*(fuelable(c)&&FUELS[BUILD.fuel]?FUELS[BUILD.fuel].heat:1))}</b>${!t&&fuelable(c)&&FUELS[BUILD.fuel]?` <span class="small">(${FUELS[BUILD.fuel].full})</span>`:''} `;break;
    case 'PowerToMoneyConverter':h+=`Vende <b class="power">${nf(s.maxSellPower*u.powerSellAmountMultiplayer*(t&&t.b?t.b.powerToMoneyMultiplayer:1))}</b> de energía.`;break;
    case 'HeatToPowerConverter':{let n=convAmount(R,c),w='';
      if(t){const x=t.wc*s.waterEffectiveness;if(x>0){n+=x;w=` Bono de agua: <b class="heat">${nf(x)}</b>`}}
      h+=`Convierte <b class="heat">${nf(n)}</b> de calor en energía.${w}`;break}
    case 'MaxPowerIncrease':h+=`Aumenta la energía máx. del reactor en <b class="power">${nf(s.maxPowerIncrease*u.maxPowerMultiplayer)}</b>`;break;
    case 'HeatAbsorber':h+=`Pierde <b>${nf(s.loseHeat*100)}%</b> del calor absorbido cada tick.`;break;
    case 'CellHeatProductionAmplifier':h+=`Aumenta el calor de las celdas adyacentes un <b>${Math.round(100*s.heatProductionBonus*u.isolationMultiplayer)}%</b>`;break;
    case 'ResearchCenter':h+=`Suma investigación cada tick: <b class="research">${nf(s.researchProduction*u.researchPointsProductionMultiplayer)}</b>`;break;
    case 'BulkHeatToMoneyConverter':h+=`Toma calor de las casillas adyacentes si supera <b class="heat">${nf(s.convertHeatToMoney*u.bulkHeatSellMultiplayer)}</b> y lo vende todo junto. Puede tomar calor de disipadores y generadores.`;break;
    case 'Bank':h+=`Multiplica por <b>${nf(1+s.sellAmountBonus*u.powerToMoneyAmountBonusMultiplayer)}</b> la venta de las oficinas adyacentes.`;break;
    case 'WaterPump':h+=`Produce agua: <b class="power">${nf(s.waterProduction*u.waterProductionMultiplayer)}</b>`;break;
    case 'Circulator':h+=`Aumenta el agua máx. de los generadores adyacentes un <b>${Math.round(100*s.maxWaterBonus*u.circulatorMaxPowerMultiplayer)}%</b>. No se acumula con otros circuladores.`;break;
    case 'HeatInlet':h+=`Transfiere <b class="heat">${nf(s.transferHeat*u.heatInletMaxTransferMultiplayer)}</b> de calor por tick a las salidas.`;break;
  }
  return h;
}
function showCompInfo(R,c){
  const u=UB(R,c);
  let h=`<div style="float:right;margin-left:8px">${iconImg(c,40)}</div><b>${c.name}</b><br><span class="d">${c.desc}</span><br>Precio: <b class="money">${nf(buildPrice(c))}</b>${EVX.price!==1?` <span class="small ${EVX.price<1?'good':'bad'}">(${EVX.price<1?'oferta':'inflación'})</span>`:''}<br>`;
  if(c.lifetime)h+=`Ticks de vida: <b>${nf(c.lifetime*u.lifetimeMultiplayer*(fuelable(c)&&FUELS[BUILD.fuel]?FUELS[BUILD.fuel].life:1))}</b><br>`;
  if(c.maxHeat)h+=`Calor máx.: <b class="heat">${nf(c.maxHeat*u.maxHeatMultiplayer)}</b><br>`;
  if(c.maxWater&&(gres('waterPump')||isFree(R)))h+=`Agua máx.: <b class="power">${nf(c.maxWater*u.maxWaterMultiplayer)}</b><br>`;
  h+=stratInfo(R,c,null);
  if(c.st.type==='Cell'&&c.st.heatProduction)h+=`<br><span class="d">Reparte su calor entre las casillas que aceptan calor ${c.st.distributeType==='diagonal'?'en sus diagonales':'a su alcance'} (hasta ${patternFor(c).length}).</span>`;
  showInfoText(h);
}
let plCache={key:'',html:''};
function placementHtml(R,t,c){
  const base=getBase(R);
  const key=`${R.meta.id}|${t.x},${t.y}|${c.id}|${base.stamp}`;
  if(plCache.key===key){previewOk=plCache.ok;return plCache.html}
  G.stats.placeInfo++;tutCheck();
  const a=analyzePlacement(R,t,c,HORIZON,base.res);
  let h='<hr style="border:0;border-top:1px solid #2a3547;margin:6px 0">',ok=true;
  if(a.self){ok=false;h+=`<span class="bad">✗ Esta pieza <b>explotaría en ${a.self.tick} tick${a.self.tick>1?'s':''}</b> (${a.self.why}).</span><br>`}
  else h+=`<span class="good">✓ Aguantaría ${HORIZON} ticks.</span><br>`;
  if(a.extra.length){ok=false;h+=`<span class="bad">⚠ Haría explotar: ${a.extra.slice(0,4).map(b=>`${b.name} (${b.x+1},${b.y+1}) en ${b.tick}`).join(', ')}${a.extra.length>4?'…':''}</span><br>`}
  if(Math.abs(a.dPower)>1e-9||Math.abs(a.dMoney)>1e-9)h+=`<span class="d">Efecto medio: ${a.dPower?`energía ${a.dPower>0?'+':''}${nf(a.dPower)}/tick `:''}${a.dMoney?`dinero ${a.dMoney>0?'+':''}${nf(a.dMoney)}/tick`:''}</span>`;
  if(c.st.type==='Cell'&&c.st.heatProduction){
    const rec=receiversOf(R,t.x,t.y,c);
    h+=rec.length?`<br>Repartiría su calor entre <b>${rec.length}</b> casilla(s): <b class="heat">${nf(c.st.heatProduction*UB(R,c).heatProductionMultiplayer/rec.length)}</b> a cada una.`:'';
  }
  plCache={key,html:h,ok};previewOk=ok;return h;
}
/* texto de un nodo; con una pieza, dice si le sirve */
function nodeInfo(t,c){
  const nd=NODES[t.node];if(!nd)return '';
  let h=`<b style="color:${nd.col}">${nd.icon} ${nd.name}</b><br><span class="d">${nd.desc}</span>`;
  if(c){
    const yes='<br><span class="good">✔ Le aplica a esta pieza.</span>',no=t=>`<br><span class="small">${t}</span>`;
    if(t.node==='geo')h+=c.st.type==='Cell'?yes:no('Solo sirve para celdas.');
    else if(t.node==='uranium')h+=nuclear(c)?yes:no('Solo sirve para celdas nucleares.');
    else if(t.node==='spring')h+=(c.acceptsWater&&c.maxWater)?yes:no('Las piezas de al lado que usen agua la recibirán.');
  }
  return h;
}
function showTileInfo(R,t){
  previewOk=null;
  if(t.terrain!=='grass'&&mode==='terrain'){
    const why=terraWhy(R,t);
    if(why){showInfoText('<span class="bad">'+why+'</span>');return}
    const c=terraCost(R,t),ok=afford(G.money,c);
    showInfoText('<b>'+(t.terrain==='water'?'Rellenar agua':'Despejar montaña')+'</b> · <b class="money">$'+nf(c)+'</b>'+(ok?'':' <span class="bad">(te faltan $'+nf(Math.round(c-G.money))+')</span>'));return;
  }
  if(t.terrain!=='grass'){showInfoText(t.terrain==='water'?'Agua':t.terrain==='mountain'?'Montaña: no se puede construir.':'No se puede construir aquí.');return}
  if(!t.c){
    // sin pieza elegida no hay nada que explicar: no se muestra nada
    if(!(selComp&&mode==='build')){showInfoText(t.node?nodeInfo(t):'');return}
    let h='';
    if(!canBuild(R,t,selComp))h+=`<span class="bad">${!isFree(R)&&!afford(G.money,buildPrice(selComp))?`No tienes dinero para ${selComp.name} (${nf(buildPrice(selComp))}).`:'No se puede construir aquí.'}</span>`;
    h+=placementHtml(R,t,selComp)+(t.node?'<br>'+nodeInfo(t,selComp):'');
    showInfoText(`<b>${selComp.name}</b> ${h}`);return;
  }
  const c=t.c;
  let h=`<div style="float:right;margin-left:8px">${iconImg(c,40)}</div><b>${c.name}</b><br><span class="d">${c.desc}</span><br>`;
  if(c.maxHeat>0)h+=`Calor: <b class="heat">${nf(t.heat)} / ${nf(maxHeat(R,t))}</b><br>`;
  if(c.maxWater>0&&(gres('waterPump')||isFree(R)))h+=`Agua: <b class="power">${nf(t.water)} / ${nf(maxWater(R,t))}</b><br>`;
  if(c.lifetime>0)h+=`Ticks: <b>${t.node==='geo'?'∞ (fuente geotérmica)':nf(t.life)+' / '+nf(maxLife(R,t))}</b><br>`;
  if(t.fuel)h+=`Combustible: <b>${FUELS[t.fuel].full}</b> <span class="small">(calor ×${FUELS[t.fuel].heat}, vida ×${FUELS[t.fuel].life})</span><br>`;
  if(t.node)h+=nodeInfo(t,c)+'<br>';
  h+=stratInfo(R,c,t)+'<br>';
  if(t.dump&&c.st.type==='Cell'){h+=`<span class="d">Repartió su calor entre ${t.dump.length} casilla(s): ${nf(t.dump[0].amt)} a cada una.</span><br>`;G.stats.hoverCell++;}
  if(t.dump&&c.st.type==='HeatInlet')h+=`<span class="d">Mandó ${nf(t.dump[0].amt*t.dump.length)} a ${t.dump.length} salida(s).</span><br>`;
  if(c.maxHeat&&t.inHeat>0)h+=`<span class="d">Calor recibido este tick: ${nf(t.inHeat)}</span><br>`;
  if(c.st.type==='HeatToPowerConverter'&&t.heatOut>0)h+=`<span class="d">Convirtió ${nf(t.heatOut)} de calor en energía.</span><br>`;
  const v=R.verdict&&R.verdict.get(t.y*R.meta.w+t.x);
  if(v)h+=`<span class="bad">⚠ Con el diseño actual explotaría en ~${v.tick} tick${v.tick>1?'s':''} (${v.why}).</span><br>`;
  else if(c.maxHeat)h+=`<span class="good">✓ Aguanta los próximos ${HORIZON} ticks.</span><br>`;
  h+=`Precio de venta: <b class="money">${nf(sellPrice(R,t))}</b>`;
  showInfoText(h);
}

/* ---- calculadora (análisis del diseño actual) ---- */
const an={t:0,rid:null,res:null,stamp:0};
function getBase(R,force){
  const now=performance.now();
  if(!force&&an.rid===R.meta.id&&an.res&&now-an.t<1500)return an;
  an.res=simulate(R,HORIZON);an.t=now;an.rid=R.meta.id;an.stamp++;
  R.verdict=new Map();an.res.booms.forEach(b=>R.verdict.set(b.y*R.meta.w+b.x,b));
  renderAnalysis(R);
  return an;
}
function renderAnalysis(R){
  const r=an.res,n=R.tiles.filter(t=>t.c).length;
  const chip=$('#chip');
  if(chip){
    if(!n){chip.className='chip';chip.textContent='Sin piezas'}
    else if(r.booms.length){chip.className='chip bad';chip.textContent='⚠ '+r.booms.length+' explotaría'+(r.booms.length>1?'n':'')}
    else{chip.className='chip good';chip.textContent='✓ Estable'}
  }
  const el=$('#analysis');if(!el)return;
  if(!n){el.innerHTML='Sin piezas todavía.';return}
  let h='';
  if(r.booms.length){h+=`<span class="bad">💥 ${r.booms.length} pieza(s) explotarían:</span><br>`+r.booms.slice(0,5).map(b=>`• ${b.name} (${b.x+1},${b.y+1}) en ${b.tick} tick${b.tick>1?'s':''}<br><span class="d">&nbsp;&nbsp;${b.why}</span>`).join('<br>')+(r.booms.length>5?'<br>…':'')}
  else h+=`<span class="good">✓ Estable durante ${HORIZON} ticks.</span>`;
  h+=`<br>Energía generada: <b class="power">${nf(r.avgPower)}</b>/tick<br>Dinero: <b class="money">${nf(r.avgMoney)}</b>/tick<br>Calor más alto: ${Math.round(100*r.maxRatio)} %`;
  el.innerHTML=h;
}

/* ---- cámara lenta (fase por fase) ---- */
function toggleStep(){
  const R=curR();stepMode=!stepMode;
  if(stepMode){paused=true;R.stepIdx=0;lastPhase=null;G.stats.slow++;tutCheck()}
  else{while(R.stepIdx!==0)stepPhase(R);paused=false;clearInterval(stepAuto);stepAuto=null;lastPhase=null}
  restartLoop();updateButtons();renderStepBox();
}
function renderStepBox(){
  const el=$('#stepBox');if(!el)return;
  el.style.display=stepMode?'':'none';
  if(!stepMode)return;
  const R=curR();
  el.innerHTML=`<div style="display:flex;gap:6px;flex-wrap:wrap">`+PHASES.map((p,i)=>`<div class="phase ${i===R.stepIdx?'cur':(lastPhase&&PHASES.indexOf(lastPhase)===i?'dn':'')}">${p.name}</div>`).join('')+`</div>
   <div style="margin:6px 0">${lastPhase?'<b>Acaba de ocurrir:</b> '+lastPhase.desc:'Pulsa «Siguiente fase» para ejecutar el tick paso a paso.'}</div>
    <div class="row" style="margin:0"><button id="bNext" class="sm">Siguiente fase ▶</button><button id="bStepAuto" class="sm ${stepAuto?'on':''}">Auto</button></div>`;
  $('#bNext').onclick=()=>doStep();
  $('#bStepAuto').onclick=()=>{if(stepAuto){clearInterval(stepAuto);stepAuto=null}else stepAuto=setInterval(doStep,900);renderStepBox()};
}
function doStep(){const R=curR();lastPhase=stepPhase(R);renderStepBox();refreshHud();if(hover)showTileInfo(R,hover)}

/* ---- selección y plantillas ---- */
function copySel(){
  if(!sel)return;const R=curR();const x0=Math.min(sel.x0,sel.x1),x1=Math.max(sel.x0,sel.x1),y0=Math.min(sel.y0,sel.y1),y1=Math.max(sel.y0,sel.y1);
  const cells=[];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const t=tileAt(R,x,y);if(t&&t.c)cells.push([x-x0,y-y0,t.c.id])}
  clip={w:x1-x0+1,h:y1-y0+1,cells};
  toast(`📋 Copiadas ${cells.length} pieza(s).`);renderSelBox();
}
function pasteAt(R,t){
  if(!clip)return;
  beginGroup();let placed=0,skipped=0;
  for(const [dx,dy,id] of clip.cells){
    const q=tileAt(R,t.x+dx,t.y+dy),c=CBY[id];
    if(!q||!c||!compAvailable(R,c)){skipped++;continue}
    if(buyOrRestoreOne(R,q,c,false))placed++;else skipped++;
  }
  endGroup();
  if(placed)sfx.build();
  logMsg(`📋 Pegadas ${placed} pieza(s)${skipped?`, ${skipped} omitidas (ocupado, sin dinero o no disponible)`:''}.`);
  refreshHud();
}
function selTiles(R){
  if(!sel)return [];const x0=Math.min(sel.x0,sel.x1),x1=Math.max(sel.x0,sel.x1),y0=Math.min(sel.y0,sel.y1),y1=Math.max(sel.y0,sel.y1);
  const a=[];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const t=tileAt(R,x,y);if(t)a.push(t)}return a;
}
function renderSelBox(){
  const el=$('#selBox');if(!el)return;
  const show=mode==='select'||mode==='paste'||sel||clip;
  el.style.display=show?'':'none';if(!show)return;
  const tpls=loadTemplates();
  el.innerHTML=`<h4>Selección y plantillas</h4>
   <div class="small">${mode==='paste'?'Haz clic en el mapa para pegar. Esc cancela.':'En modo Seleccionar, arrastra un rectángulo en el mapa.'}</div>
   <div class="row"><button class="sm" id="sCopy" ${sel?'':'disabled'}>Copiar (Ctrl+C)</button><button class="sm" id="sPaste" ${clip?'':'disabled'}>Pegar (Ctrl+V)</button>
   <button class="sm" id="sSell" ${sel?'':'disabled'}>Vender selección</button><button class="sm" id="sSave" ${clip?'':'disabled'}>Guardar plantilla</button></div>
   ${tpls.map((p,i)=>`<div class="tpl"><span title="${p.cells.length} piezas">${p.name} <span class="small">(${p.w}×${p.h}, ${p.cells.length})</span></span><button class="sm" data-tp="${i}">Usar</button><button class="sm" data-td="${i}">✕</button></div>`).join('')}`;
  const R=curR();
  $('#sCopy').onclick=copySel;
  $('#sPaste').onclick=()=>{if(clip){mode='paste';updateButtons();renderSelBox()}};
  $('#sSell').onclick=()=>{beginGroup();selTiles(R).forEach(t=>{if(t.c)sell(R,t)});endGroup();sfx.sell();refreshHud()};
  $('#sSave').onclick=()=>{const n=prompt('Nombre de la plantilla:','Diseño '+(tpls.length+1));if(n){tpls.push({name:n,w:clip.w,h:clip.h,cells:clip.cells});saveTemplates(tpls);renderSelBox()}};
  el.querySelectorAll('[data-tp]').forEach(b=>b.onclick=()=>{const p=tpls[+b.dataset.tp];clip={w:p.w,h:p.h,cells:p.cells};mode='paste';updateButtons();renderSelBox()});
  el.querySelectorAll('[data-td]').forEach(b=>b.onclick=()=>{tpls.splice(+b.dataset.td,1);saveTemplates(tpls);renderSelBox()});
}

/* ---- HUD ---- */
function refreshHud(){
  updatePaletteDim();
  if(view==='game'&&curReactor){
    const R=curR();if(!$('#vInc'))return;applyDisclosure(R);
    $('#vInc').textContent='+'+nf(R.last.money||0);$('#vRinc').textContent='+'+nf(R.last.research||0);$('#vPinc').textContent='+'+nf(R.last.powerMax||0);
    const mp=getMaxPower(R),pc=Math.round(100*R.power/mp);
    $('#vMax').textContent=nf(mp);$('#vPct').textContent=Math.min(100,pc);
    const b=$('#vBar');b.style.width=Math.min(100,pc)+'%';b.className=pc>=90?'w2':pc>=70?'w1':'';
    const fast=$('#bFast');
    fast.style.display=(G.bonusTicks>0&&!EVX.noFast)?'':'none';fast.textContent=playFast?'Normal':'Rápido ≫';
    $('#bonus').textContent=G.bonusTicks>0?'Ticks extra: '+nf(G.bonusTicks):'';
    const ab=$('#bAuto');ab.style.display=(gres('windTurbineAutoRebuild')&&!isFree(R))?'':'none';ab.innerHTML='Reconstrucción auto: '+(R.auto?'<b class="good">SÍ</b>':'<b class="bad">NO</b>');
    let soon=0,gone=0;R.tiles.forEach(t=>{if(t.c&&t.c.lifetime>0){if(t.life<=0)gone++;else if(t.life<=maxLife(R,t)*.1)soon++}});
    $('#expInfo').innerHTML=(soon||gone)?`⏳ ${soon} por agotarse · <b class="${gone?'bad':''}">${gone} agotadas</b>`:'';
    $('#bUndo').disabled=!hist.undo.length;$('#bRedo').disabled=!hist.redo.length;
    $('#bRestore').classList.toggle('cant',!gone);
    if(hover&&!mouseDownNow)showTileInfoThrottled(R,hover);
  }else if(view==='reactors'){
    for(const id in G.reactors){const R=G.reactors[id];
      const a=viewEl.querySelector(`[data-inc="${id}"]`);if(a)a.textContent=nf(R.last.money||0);
      const b=viewEl.querySelector(`[data-rinc="${id}"]`);if(b)b.textContent=nf(R.last.research||0)}
  }
}
let lastInfoT=0;
function showTileInfoThrottled(R,t){const n=performance.now();if(n-lastInfoT>250){lastInfoT=n;showTileInfo(R,t)}}
let lastMoney=0,lastBump=0;
function bump(sel){const e=$(sel);if(!e)return;e.classList.remove('bump');void e.offsetWidth;e.classList.add('bump')}
function animateNumbers(now){
  if(view!=='game'||!$('#vMoney'))return;
  const R=curR();
  // los números se muestran siempre con su valor real e inmediato (sin efecto de conteo)
  const lerp=(k,v)=>{disp[k]=v};
  lerp('money',G.money);lerp('rp',G.rp);lerp('power',R.power);
  const set=(id,t)=>{const e=$(id);if(e&&e.textContent!==t)e.textContent=t};
  set('#vMoney',nf(disp.money));set('#vRp',nf(disp.rp));set('#vPow',nf(disp.power));
  if(G.money>lastMoney+1e-9&&now-lastBump>350){lastBump=now;bump('#vMoney')}
  lastMoney=G.money;
  const sb=$('#bSell');if(sb)sb.classList.toggle('pulse',R.power>=1&&(G.money<=1||R.power>=.8*getMaxPower(R)));
  const tb=$('#tickbar i');if(tb)tb.style.width=(paused?0:Math.min(100,(now-lastTickAt)/tickInterval()*100))+'%';
}

/* ============================================================
   EFECTOS (partículas, textos flotantes, anillos)
   ============================================================ */
const fx={p:[],txt:[],ring:[],shake:0};
function fxBurst(x,y,col,n,spd,life){for(let i=0;i<n;i++){const a=Math.random()*6.283,s=spd*rnd(.35,1.2);fx.p.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:life,m:life,c:col,r:rnd(1.2,3),g:0})}}
function fxRing(x,y,col,life=.55){fx.ring.push({x,y,l:life,m:life,c:col})}
function fxText(x,y,t,col){fx.txt.push({x,y,t,c:col,l:1.2,m:1.2})}
function spawnTickFx(R){
  const items=[];
  for(const t of R.tiles){
    if(!t.c)continue;const cx=t.x*TS+TS/2,cy=t.y*TS+TS/2,ty=t.c.st.type;
    if(ty==='Cell'&&t.life>0){
      if(t.c.st.powerProduction>0)items.push([cx,cy-8,'+'+nf(powerProdOf(R,t.c)),'#9cc4ff']);
      if(t.dump)fxRing(cx,cy,'rgba(255,160,60,.85)');
    }else if(ty==='HeatToPowerConverter'&&t.heatOut>0)items.push([cx,cy-8,'+'+nf(t.heatOut),'#ffe27a']);
  }
  if(items.length>14){items.sort(()=>Math.random()-.5);items.length=14}
  for(const i of items)fxText(i[0],i[1],i[2],i[3]);
}
function updateFx(g,R,now,dt){
  // brasas de piezas calientes y chispas de generadores
  for(const t of R.tiles){
    if(!t.c)continue;const c=t.c,x=t.x*TS,y=t.y*TS;
    if(c.maxHeat){
      const r=t.heat/maxHeat(R,t);
      if(r>.4&&Math.random()<r*.06*dt*60)fx.p.push({x:x+rnd(6,TS-6),y:y+8,vx:rnd(-6,6),vy:-rnd(18,36),l:.9,m:.9,c:r>.75?'#ff6a3a':'#ffb050',r:rnd(1,2.2),g:-4});
    }
    if(c.st.type==='HeatToPowerConverter'&&t.heatOut>0&&Math.random()<.07*dt*60)fx.p.push({x:x+rnd(8,TS-8),y:y+rnd(6,TS-8),vx:rnd(-40,40),vy:rnd(-40,10),l:.3,m:.3,c:'#fff27a',r:1.4,g:60});
    if(c.st.type==='Cell'&&c.st.heatProduction&&t.life>0&&Math.random()<.02*dt*60)fx.p.push({x:x+rnd(6,TS-6),y:y+6,vx:rnd(-5,5),vy:-rnd(14,26),l:.8,m:.8,c:'#ffa040',r:rnd(1,1.8),g:-3});
  }
  for(const p of fx.p){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.g*dt;p.l-=dt;
    g.globalAlpha=Math.max(0,p.l/p.m);g.fillStyle=p.c;g.beginPath();g.arc(p.x,p.y,p.r,0,7);g.fill()}
  g.globalAlpha=1;
  fx.p=fx.p.filter(p=>p.l>0);if(fx.p.length>600)fx.p.splice(0,fx.p.length-600);
  for(const r of fx.ring){r.l-=dt;const q=1-r.l/r.m;g.globalAlpha=Math.max(0,(1-q)*.8);g.strokeStyle=r.c;g.lineWidth=2.2*(1-q)+.4;
    g.beginPath();g.arc(r.x,r.y,4+q*TS*.9,0,7);g.stroke()}
  g.globalAlpha=1;fx.ring=fx.ring.filter(r=>r.l>0);
  g.font='bold 11px sans-serif';g.textAlign='center';g.textBaseline='middle';
  for(const t of fx.txt){t.l-=dt;t.y-=24*dt;g.globalAlpha=Math.max(0,Math.min(1,t.l/t.m*1.6));
    g.lineWidth=3;g.strokeStyle='#000b';g.strokeText(t.t,t.x,t.y);g.fillStyle=t.c;g.fillText(t.t,t.x,t.y)}
  g.globalAlpha=1;fx.txt=fx.txt.filter(t=>t.l>0);if(fx.txt.length>60)fx.txt.splice(0,fx.txt.length-60);
}

/* ============================================================
   DIBUJO DEL MAPA
   ============================================================ */
const TCOL={grass:['#3f8a35','#448f39','#3b8431','#468f3c'],sand:['#d6c27a','#d2be76'],water:['#3d8fcb','#4296d2'],mountain:['#3f8a35']};
function heatCol(r,a){r=Math.max(0,Math.min(1,r));const hue=60-60*r;return `hsla(${hue},95%,${52-8*r}%,${a})`}
/* marcador de un nodo especial (debajo de las piezas) */
function drawNode(g,t,now,anim){
  const x=t.x*TS,y=t.y*TS,cx=x+TS/2,cy=y+TS/2,k=t.node,ph=now/500+t.x+t.y,nd=NODES[k];
  g.save();
  if(k==='geo'){
    g.fillStyle='#3a1f10';g.beginPath();g.ellipse(cx,cy+3,TS*.34,TS*.24,0,0,7);g.fill();
    g.fillStyle='rgb(255,'+Math.round(110+40*Math.sin(ph))+',30)';g.beginPath();g.ellipse(cx,cy+3,TS*.22,TS*.13,0,0,7);g.fill();
    if(anim)for(let i=0;i<3;i++){const q=((now/1400+i/3)%1);g.fillStyle='rgba(255,255,255,'+(.4*(1-q))+')';g.beginPath();g.arc(cx+Math.sin(q*6+i*2)*3,cy-q*15,2+q*3,0,7);g.fill()}
  }else if(k==='uranium'){
    const gl=.5+.3*Math.sin(ph);
    g.fillStyle='rgba(90,224,90,'+(.18+.12*gl)+')';g.beginPath();g.arc(cx,cy,TS*.42,0,7);g.fill();
    for(const [dx,dy,s] of [[-6,3,.9],[2,-1,1.2],[8,4,.75]]){
      g.fillStyle='rgb('+Math.round(60+60*gl)+',220,'+Math.round(80+50*gl)+')';
      g.beginPath();g.moveTo(cx+dx,cy+dy-9*s);g.lineTo(cx+dx+4.5*s,cy+dy);g.lineTo(cx+dx,cy+dy+7*s);g.lineTo(cx+dx-4.5*s,cy+dy);g.closePath();g.fill();
      g.strokeStyle='#1d5a1d';g.lineWidth=1;g.stroke();
    }
  }else{
    g.fillStyle='#2a78b8';g.beginPath();g.ellipse(cx,cy+1,TS*.34,TS*.26,0,0,7);g.fill();
    g.fillStyle='#74c8ff';g.beginPath();g.ellipse(cx,cy+1,TS*.24,TS*.17,0,0,7);g.fill();
    if(anim)for(let i=0;i<2;i++){const q=((now/1100+i/2)%1);g.strokeStyle='rgba(255,255,255,'+(.7*(1-q))+')';g.lineWidth=1.2;g.beginPath();g.ellipse(cx,cy+1,TS*(.1+.3*q),TS*(.07+.22*q),0,0,7);g.stroke()}
  }
  g.strokeStyle=nd.col;g.globalAlpha=.85;g.lineWidth=1.5;g.setLineDash([3,3]);g.strokeRect(x+2.5,y+2.5,TS-5,TS-5);
  g.restore();
}
function drawMap(g,R,now,o){
  const W=R.meta.w,H=R.meta.h;
  g.clearRect(0,0,W*TS,H*TS);
  for(const t of R.tiles){
    const x=t.x*TS,y=t.y*TS;
    const cols=TCOL[t.terrain];g.fillStyle=cols[(t.x+t.y)%cols.length];g.fillRect(x,y,TS,TS);
    if(t.terrain==='mountain'){g.fillStyle='#6a6258';g.beginPath();g.moveTo(x+4,y+TS-5);g.lineTo(x+TS/2,y+5);g.lineTo(x+TS-4,y+TS-5);g.fill();
      g.fillStyle='#8a8378';g.beginPath();g.moveTo(x+TS/2,y+5);g.lineTo(x+TS-4,y+TS-5);g.lineTo(x+TS/2+2,y+TS-5);g.fill()}
    if(t.terrain==='water'){
      g.fillStyle='#9bd4f0';
      for(const [dx,dy] of N4){const n=tileAt(R,t.x+dx,t.y+dy);if(n&&n.terrain!=='water'){
        if(dx)g.fillRect(x+(dx>0?TS-2:0),y,2,TS);else g.fillRect(x,y+(dy>0?TS-2:0),TS,2)}}
      if(o.anim){ // olas suaves
        const ph=now/900+t.x*.7+t.y*1.3;
        g.strokeStyle=`rgba(255,255,255,${.1+.1*Math.sin(ph)})`;g.lineWidth=1.2;
        g.beginPath();g.moveTo(x+6,y+TS/2+Math.sin(ph)*3);g.quadraticCurveTo(x+TS/2,y+TS/2-4+Math.sin(ph+1)*3,x+TS-6,y+TS/2+Math.sin(ph+2)*3);g.stroke();
      }
    }
    if(t.node&&t.terrain==='grass')drawNode(g,t,now,o.anim);
    g.strokeStyle='rgba(0,0,0,.08)';g.lineWidth=1;g.strokeRect(x+.5,y+.5,TS-1,TS-1);
  }
  if(o.anim){ // sombras de nubes que pasan lentamente
    g.fillStyle='rgba(0,0,20,.04)';
    for(let k=0;k<3;k++){
      const cx=((now/70+k*W*TS/3)%(W*TS+260))-130,cy=H*TS*(.2+.3*k);
      g.beginPath();g.ellipse(cx,cy,90,34,0,0,7);g.ellipse(cx+50,cy+10,60,26,0,0,7);g.fill();
    }
  }
  for(const t of R.tiles){
    if(!t.c)continue;const c=t.c,x=t.x*TS,y=t.y*TS,cx=x+TS/2,cy=y+TS/2;
    const expired=c.lifetime>0&&t.life<=0;
    const ty=c.st.type;
    const on=expired?false:ty==='Cell'?t.life>0:ty==='HeatToPowerConverter'?t.heatOut>0:true;
    let sc=1;
    if(t.born){const age=now-t.born;if(age<280){const q=age/280;sc=.4+.6*(1+2.70158*Math.pow(q-1,3)+1.70158*Math.pow(q-1,2))}}
    g.save();
    if(sc!==1){g.translate(cx,cy);g.scale(sc,sc);g.translate(-cx,-cy)}
    g.globalAlpha=expired?.3:1;
    // resplandor de piezas calientes y celdas activas
    if(o.anim){
      let glow=0,gc='255,90,40';
      if(c.maxHeat){const r=t.heat/maxHeat(R,t);if(r>.5)glow=Math.min(1,(r-.4)*1.5)*(.65+.35*Math.sin(now/180))}
      else if(ty==='Cell'&&c.st.heatProduction&&t.life>0){glow=.35+.2*Math.sin(now/300+t.x);gc='255,160,40'}
      if(glow>0){g.save();const gr=g.createRadialGradient(cx,cy,2,cx,cy,TS*.85);gr.addColorStop(0,`rgba(${gc},${glow*.6})`);gr.addColorStop(1,`rgba(${gc},0)`);g.fillStyle=gr;g.fillRect(x-8,y-8,TS+16,TS+16);g.restore()}
    }
    drawIcon(g,c,cx,cy,TS*.98,o.anim?{t:now,on}:null);
    if(t.node){g.fillStyle=NODES[t.node].col;g.beginPath();g.arc(x+TS-6,y+6,3.5,0,7);g.fill();g.strokeStyle='#000b';g.lineWidth=1;g.stroke()}
    if(t.fuel){g.fillStyle=FUELS[t.fuel].col;g.fillRect(x+TS-9,y+12,6,6);g.strokeStyle='#000b';g.lineWidth=1;g.strokeRect(x+TS-9,y+12,6,6)}
    if(o.heat&&c.maxHeat){ // el calor «llena» el edificio de abajo hacia arriba
      const r=t.heat/maxHeat(R,t);
      if(r>0){g.save();g.beginPath();g.roundRect(x+1,y+1,TS-2,TS-2,4);g.clip();
        const hh=(TS-2)*Math.min(1,r);g.fillStyle=heatCol(r,.5);g.fillRect(x+1,y+TS-1-hh,TS-2,hh);g.fillStyle=heatCol(r,.95);g.fillRect(x+1,y+TS-1-hh,TS-2,1.6);g.restore()}
    }
    let pc=0,bc='#e8553a';
    if(c.maxHeat>0){pc=t.heat/maxHeat(R,t);bc='#e8553a'}
    else if(c.lifetime>0){pc=t.node==='geo'?1:t.life/maxLife(R,t);bc=t.node==='geo'?'#e07a2a':'#5fc84a'}
    else if(c.maxWater>0){pc=t.water/maxWater(R,t);bc='#4aa0e8'}
    g.fillStyle='#000a';g.fillRect(x+3,y+TS-6,TS-6,3);
    g.fillStyle=bc;g.fillRect(x+3,y+TS-6,(TS-6)*Math.min(1,pc),3);
    if(c.maxHeat&&pc>.85){g.strokeStyle=Math.sin(now/90)>0?'#ff2a2a':'#fff';g.lineWidth=2;g.strokeRect(x+2,y+2,TS-4,TS-4)}
    if(c.lifetime>0&&t.life>0&&t.life<=maxLife(R,t)*.1){g.fillStyle='#ffc040';g.beginPath();g.moveTo(x+3,y+3);g.lineTo(x+11,y+3);g.lineTo(x+3,y+11);g.fill()}
    g.restore();
    if(o.nums&&c.maxHeat&&t.heat>=.5){
      g.font='bold 9px sans-serif';g.textAlign='right';g.textBaseline='alphabetic';
      g.lineWidth=3;g.strokeStyle='#000c';g.strokeText(nf(t.heat),x+TS-3,y+11);g.fillStyle='#fff';g.fillText(nf(t.heat),x+TS-3,y+11);
    }
  }
  g.globalAlpha=1;
  if(o.heat){
    g.save();g.shadowColor='#ff9020';g.shadowBlur=6;
    const dots=(a,b)=>{
      const ax=a.x*TS+TS/2,ay=a.y*TS+TS/2,bx=b.x*TS+TS/2,by=b.y*TS+TS/2;
      for(let k=0;k<3;k++){const q=((now/700)+k/3)%1;g.fillStyle='#ffc060';g.beginPath();g.arc(ax+(bx-ax)*q,ay+(by-ay)*q,2.4,0,7);g.fill()}
    };
    for(const t of R.tiles){
      if(!t.c)continue;
      if(t.dump)for(const d of t.dump)if(d.amt>0)dots(t,d.to);
      if(t.c.st.type==='HeatExchanger'){
        for(const n of near(R,t,N4)){
          if(!n.c||!(n.c.acceptsHeat||n.c.givesHeatOut)||!n.c.maxHeat)continue;
          const eps=1e-6*n.c.maxHeat;
          if(n.delta>eps)dots(t,n);else if(n.delta<-eps)dots(n,t);
        }
      }
    }
    g.restore();
  }
  if(o.verdict&&o.heat){
    g.save();g.setLineDash([4,3]);g.strokeStyle='#ff4040';g.lineWidth=2;g.font='bold 9px sans-serif';g.textAlign='left';g.textBaseline='top';
    o.verdict.forEach((v,i)=>{const x=(i%W)*TS,y=Math.floor(i/W)*TS;g.strokeRect(x+1,y+1,TS-2,TS-2);g.fillStyle='#ff4040';g.fillText('💥'+v.tick,x+2,y+2)});
    g.restore();
  }
  if(o.sel){
    const x0=Math.min(o.sel.x0,o.sel.x1),x1=Math.max(o.sel.x0,o.sel.x1),y0=Math.min(o.sel.y0,o.sel.y1),y1=Math.max(o.sel.y0,o.sel.y1);
    g.fillStyle='rgba(80,200,255,.15)';g.fillRect(x0*TS,y0*TS,(x1-x0+1)*TS,(y1-y0+1)*TS);
    g.save();g.setLineDash([5,3]);g.strokeStyle='#50c8ff';g.lineWidth=2;g.strokeRect(x0*TS+1,y0*TS+1,(x1-x0+1)*TS-2,(y1-y0+1)*TS-2);g.restore();
  }
  if(o.paste&&o.hover){
    const c0=o.paste;g.globalAlpha=.55;
    for(const [dx,dy,id] of c0.cells){const q=tileAt(R,o.hover.x+dx,o.hover.y+dy);if(q)drawIcon(g,CBY[id],q.x*TS+TS/2,q.y*TS+TS/2,TS*.98)}
    g.globalAlpha=1;g.save();g.setLineDash([4,3]);g.strokeStyle='#fff';g.strokeRect(o.hover.x*TS+1,o.hover.y*TS+1,c0.w*TS-2,c0.h*TS-2);g.restore();
  }
  if(o.hover&&!o.paste){
    const t=o.hover;let targets=[];
    if(t.c&&t.c.st.type==='Cell'&&t.c.st.heatProduction)targets=receiversOf(R,t.x,t.y,t.c);
    else if(!t.c&&o.selComp&&o.selComp.st.type==='Cell'&&o.selComp.st.heatProduction&&t.terrain==='grass')targets=receiversOf(R,t.x,t.y,o.selComp);
    else if(t.c&&t.c.st.type==='HeatExchanger')targets=near(R,t,N5).filter(n=>n.c&&(n.c.acceptsHeat||n.c.givesHeatOut));
    else if(t.c&&t.c.st.type==='HeatInlet')targets=R.tiles.filter(n=>n.c&&n.c.st.type==='HeatOutlet');
    g.lineWidth=2;
    for(const n of targets){g.strokeStyle='#40e0ff';g.strokeRect(n.x*TS+1,n.y*TS+1,TS-2,TS-2)}
    const col=(o.terra&&t.terrain!=='grass')?(canTerraform(R,t)?'#6fe06f':'#ff5a4d'):(!t.c&&o.selComp&&t.terrain==='grass'&&o.previewOk!==null)?(o.previewOk?'#6fe06f':'#ff5a4d'):'#fff';
    g.strokeStyle=col;g.lineWidth=2.5;g.strokeRect(t.x*TS+1,t.y*TS+1,TS-2,TS-2);
    if(!t.c&&o.selComp&&t.terrain==='grass'){g.globalAlpha=.55;drawIcon(g,o.selComp,t.x*TS+TS/2,t.y*TS+TS/2,TS*.98);g.globalAlpha=1}
  }
  R.expl=R.expl.filter(e=>now-e.t<800);
  for(const e of R.expl){const q=(now-e.t)/800;
    g.fillStyle=`rgba(255,200,80,${.7*(1-q)})`;g.beginPath();g.arc(e.x*TS+TS/2,e.y*TS+TS/2,4+q*20,0,7);g.fill()}
}
let lastFrame=performance.now();
function frame(now){
  const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
  animateNumbers(now);
  if(view==='game'&&g2&&curReactor){
    const R=curR();
    if(!stepMode)getBase(R);
    stepCam();
    drawMap(g2,R,now,{heat:showHeatView,nums:showNums,anim:true,hover,terra:mode==='terrain',selComp:mode==='build'?selComp:null,sel,paste:mode==='paste'?clip:null,verdict:R.verdict,previewOk});
    updateFx(g2,R,now,dt);
    if(now<fx.shake)cv.style.transform=`translate(${rnd(-3,3).toFixed(1)}px,${rnd(-3,3).toFixed(1)}px)`;
    else if(cv.style.transform)cv.style.transform='';
  }
  if(demo.on)drawDemo(now);
  requestAnimationFrame(frame);
}

/* ---- zoom y desplazamiento del mapa ---- */
const cam={z:1,x:0,y:0,tz:1,tx:0,ty:0};   // z = zoom actual, tz = zoom destino (se suaviza); x,y = esquina visible (unidades del mapa)
let spaceDown=false,mouseDownNow=false,ptr=null,lastTile=null,pinch=null;
const touches=new Map();
window.addEventListener('keyup',e=>{if(e.key===' ')spaceDown=false});
function mapUnits(e){const R=curR(),r=cv.getBoundingClientRect();return {mx:(e.clientX-r.left)/r.width*R.meta.w*TS,my:(e.clientY-r.top)/r.height*R.meta.h*TS,rw:r.width,rh:r.height}}
function evtTile(e){const R=curR(),m=mapUnits(e);return tileAt(R,Math.floor((cam.x+m.mx/cam.z)/TS),Math.floor((cam.y+m.my/cam.z)/TS))}
function clampCam(){const R=curR(),W=R.meta.w*TS,H=R.meta.h*TS;
  cam.tx=Math.max(0,Math.min(W*(1-1/cam.tz),cam.tx));cam.ty=Math.max(0,Math.min(H*(1-1/cam.tz),cam.ty))}
function camHome(){cam.tz=1;cam.tx=0;cam.ty=0}                       // vuelve a la vista normal (con animación)
function camReset(){cam.z=cam.tz=1;cam.x=cam.tx=cam.y=cam.ty=0}      // instantáneo (al abrir un reactor)
function camZoomAt(mx,my,z){
  z=Math.max(1,Math.min(4,z));
  const wx=cam.tx+mx/cam.tz,wy=cam.ty+my/cam.tz;   // el punto bajo el cursor se queda quieto
  cam.tz=z;cam.tx=wx-mx/z;cam.ty=wy-my/z;clampCam();
  if(!uiPrefs.zoomHint&&z>1.05){uiPrefs.zoomHint=true;saveUI();toast(isMobile()?'🔎 <b>Zoom</b><br><span class="small">Pellizca con dos dedos para acercar y mover. Con el modo ✋ Mover arrastras con un dedo.</span>':'🔎 <b>Zoom</b><br><span class="small">Rueda del mouse: acercar/alejar · mantén el botón central o Espacio + arrastrar para moverte · tecla 0: vista normal</span>')}
}
function zoomBtn(f){const R=curR();camZoomAt(R.meta.w*TS/2,R.meta.h*TS/2,cam.tz*f)}
function panKey(k){
  const st=TS*3/cam.tz;
  if(k==='arrowleft')cam.tx-=st;else if(k==='arrowright')cam.tx+=st;else if(k==='arrowup')cam.ty-=st;else cam.ty+=st;
  clampCam();
}
function stepCam(){
  const k=.35;
  cam.z+=(cam.tz-cam.z)*k;cam.x+=(cam.tx-cam.x)*k;cam.y+=(cam.ty-cam.y)*k;
  if(Math.abs(cam.tz-cam.z)<.002)cam.z=cam.tz;
  if(Math.abs(cam.tx-cam.x)<.05)cam.x=cam.tx;
  if(Math.abs(cam.ty-cam.y)<.05)cam.y=cam.ty;
  const dpr=window.devicePixelRatio||1;
  g2.setTransform(1,0,0,1,0,0);g2.clearRect(0,0,cv.width,cv.height);
  g2.setTransform(dpr*cam.z,0,0,dpr*cam.z,-cam.x*dpr*cam.z,-cam.y*dpr*cam.z);
  const zl=$('#zLvl');if(zl){const t=cam.tz.toFixed(1)+'×';if(zl.textContent!==t)zl.textContent=t}
}
function updateMbPiece(){
  const ic=$('#mbIcon'),nm=$('#mbName');if(!ic)return;
  ic.innerHTML=selComp?iconImg(selComp,28):'🧱';
  nm.textContent=selComp?nf(buildPrice(selComp)):'Piezas';
}
function bindMobileBar(R){
  const q=id=>$(id);
  q('#mbMove').onclick=()=>setMode('pan');
  q('#mbBuild').onclick=()=>{setMode('build');if(!selComp)document.body.classList.add('sheet-open')};
  q('#mbSell').onclick=()=>setMode('sell');
  q('#mbTerr').onclick=()=>setMode('terrain');
  q('#mbPiece').onclick=()=>document.body.classList.toggle('sheet-open');
  updateMbPiece();
  if(!isMobile())return;
  // zoom inicial para poder tocar casillas con precisión, centrado en tus piezas (o en la tierra firme)
  let pts=R.tiles.filter(t=>t.c);if(!pts.length)pts=R.tiles.filter(t=>t.terrain==='grass');
  const mx=pts.reduce((a,t)=>a+t.x,0)/Math.max(1,pts.length)+.5,my=pts.reduce((a,t)=>a+t.y,0)/Math.max(1,pts.length)+.5;
  const z=Math.min(3,Math.max(1.8,R.meta.w*TS*.5/ (TS*7)));
  const zh=uiPrefs.zoomHint;uiPrefs.zoomHint=true;   // el zoom inicial no debe mostrar el aviso
  camZoomAt(R.meta.w*TS/2,R.meta.h*TS/2,z);
  uiPrefs.zoomHint=zh;
  cam.tx=mx*TS-R.meta.w*TS/(2*cam.tz);cam.ty=my*TS-R.meta.h*TS/(2*cam.tz);clampCam();
  cam.z=cam.tz;cam.x=cam.tx;cam.y=cam.ty;
  mode=selComp?'build':'pan';document.body.classList.remove('sheet-open');updateButtons();
}
function bindZoomUI(){
  $('#zIn').onclick=()=>zoomBtn(1.3);$('#zOut').onclick=()=>zoomBtn(1/1.3);$('#zReset').onclick=camHome;
}
function startPinch(){
  endGroup();ptr=null;mouseDownNow=false;
  const [a,b]=[...touches.values()];
  pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,z:cam.tz,mx:(a.x+b.x)/2,my:(a.y+b.y)/2};
}
function doPinch(){
  const [a,b]=[...touches.values()];
  const d=Math.hypot(a.x-b.x,a.y-b.y)||1,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  const R=curR(),r=cv.getBoundingClientRect();
  const u=(cx,cy)=>({x:(cx-r.left)/r.width*R.meta.w*TS,y:(cy-r.top)/r.height*R.meta.h*TS});
  const p1=u(mx,my),p0=u(pinch.mx,pinch.my);
  camZoomAt(p1.x,p1.y,pinch.z*d/pinch.d);
  cam.tx-=(p1.x-p0.x)/cam.tz;cam.ty-=(p1.y-p0.y)/cam.tz;clampCam();
  cam.x=cam.tx;cam.y=cam.ty;cam.z=cam.tz;pinch.mx=mx;pinch.my=my;
}

/* ---- eventos del mapa (mouse y táctil) ---- */
function applyAction(R,t,act,ctrl,drag){
  if(act==='sell'){
    if(!t.c)return;
    if(ctrl&&!drag)sellMany(R,t);else sell(R,t);
    sfx.sell();
  }else if(act==='terrain'){
    if(t.terrain==='grass'){return}
    const why=terraWhy(R,t),cost=terraCost(R,t);
    if(why){logMsg(why);return}
    if(!afford(G.money,cost)){logMsg('Te faltan $'+nf(Math.round(cost-G.money))+' para '+(t.terrain==='water'?'rellenar esta agua':'despejar esta montaña')+'.');return}
    if(terraform(R,t)){sfx.build();renderTerraBox();checkAch()}
  }else if(act==='build'){
    if(!selComp)return;
    let ok=false;
    if(ctrl&&!drag){const m=G.money;restoreMany(R,selComp);ok=G.money!==m}
    else ok=buyOrRestoreOne(R,t,selComp,drag);
    if(ok)sfx.build();
  }
}
function bindCanvas(R){
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault()});   // evita el autoscroll del botón central
  cv.addEventListener('wheel',e=>{
    e.preventDefault();
    const m=mapUnits(e);
    camZoomAt(m.mx,m.my,cam.tz*Math.exp(-e.deltaY*.0018));
    hover=evtTile(e);if(hover)showTileInfo(R,hover);
  },{passive:false});
  cv.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){startPinch();return}}
    if(e.button===1||spaceDown||(mode==='pan'&&e.button===0)){   // mover el mapa
      ptr={act:'pan',lx:e.clientX,ly:e.clientY,sx:e.clientX,sy:e.clientY,moved:false};cv.style.cursor='grabbing';
      try{cv.setPointerCapture(e.pointerId)}catch(_){}
      e.preventDefault();return;
    }
    const t=evtTile(e);if(!t)return;
    try{cv.setPointerCapture(e.pointerId)}catch(_){}
    mouseDownNow=true;hover=t;lastTile=t;
    const right=e.button===2;
    ptr={act:right?'sell':mode,ctrl:e.ctrlKey||e.metaKey,paint:paint||e.shiftKey};
    if(ptr.act==='select'){sel={x0:t.x,y0:t.y,x1:t.x,y1:t.y};renderSelBox();return}
    if(ptr.act==='paste'){pasteAt(R,t);ptr=null;return}
    beginGroup();applyAction(R,t,ptr.act,ptr.ctrl,false);
    refreshHud();showTileInfo(R,t);
  });
  cv.addEventListener('pointermove',e=>{
    if(touches.has(e.pointerId)){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2&&pinch){doPinch();return}}
    if(ptr&&ptr.act==='pan'){
      const m=mapUnits(e);
      cam.tx-=(e.clientX-ptr.lx)/m.rw*R.meta.w*TS/cam.z;cam.ty-=(e.clientY-ptr.ly)/m.rh*R.meta.h*TS/cam.z;
      clampCam();cam.x=cam.tx;cam.y=cam.ty;ptr.lx=e.clientX;ptr.ly=e.clientY;
      if(Math.hypot(e.clientX-ptr.sx,e.clientY-ptr.sy)>7)ptr.moved=true;
      return;
    }
    const t=evtTile(e);hover=t;if(!t){showInfoText('');return}
    if(ptr&&ptr.act==='select'&&sel){sel.x1=t.x;sel.y1=t.y;return}
    if(ptr&&ptr.paint&&t!==lastTile&&(ptr.act==='sell'||ptr.act==='build'||ptr.act==='terrain')){lastTile=t;applyAction(R,t,ptr.act,false,true);refreshHud()}
    if(!mouseDownNow||!ptr)showTileInfo(R,t);
  });
  const up=e=>{
    if(e&&e.pointerId!==undefined){touches.delete(e.pointerId);if(touches.size<2)pinch=null}
    if(ptr&&ptr.act==='select'){renderSelBox()}
    if(ptr&&ptr.act==='pan'){cv.style.cursor='';if(!ptr.moved&&e&&e.clientX!==undefined){const t=evtTile(e);if(t){hover=t;showTileInfo(R,t)}}}
    endGroup();mouseDownNow=false;ptr=null;lastTile=null;refreshHud();
  };
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv.addEventListener('pointerleave',()=>{if(!mouseDownNow){hover=null;showInfoText('')}});
}
window.addEventListener('keydown',e=>{
  if(view!=='game'||/INPUT|TEXTAREA/.test((document.activeElement||{}).tagName||'')||document.querySelector('.modal'))return;
  const ctrl=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
  if(e.key===' '){spaceDown=true;e.preventDefault();return}
  if(!ctrl&&k==='0'){camHome();return}
  if(!ctrl&&(k==='+'||k==='=')){zoomBtn(1.25);return}
  if(!ctrl&&(k==='-'||k==='_')){zoomBtn(1/1.25);return}
  if(k.startsWith('arrow')&&cam.tz>1){e.preventDefault();panKey(k);return}
  if(ctrl&&k==='z'&&!e.shiftKey){e.preventDefault();if(undoLast()){sfx.sell();refreshHud()}}
  else if(ctrl&&(k==='y'||(k==='z'&&e.shiftKey))){e.preventDefault();if(redoLast()){sfx.build();refreshHud()}}
  else if(ctrl&&k==='c'){if(sel){e.preventDefault();copySel()}}
  else if(ctrl&&k==='v'){if(clip){e.preventDefault();mode='paste';updateButtons();renderSelBox()}}
  else if(!ctrl&&k==='r')doRestore();
  else if(!ctrl&&k==='b')setMode('build');
  else if(!ctrl&&k==='x')setMode('sell');
  else if(!ctrl&&k==='s')setMode('select');
  else if(!ctrl&&k==='t'&&$('#mTerr')&&$('#mTerr').style.display!=='none')setMode('terrain');
  else if(k==='escape'){sel=null;if(mode==='paste'||mode==='select')setMode('build');else renderSelBox()}
});

/* ============================================================
   INVESTIGACIÓN
   ============================================================ */
function resPrice(r){let p=r.rp||0;for(let i=0;i<gres(r.id);i++)p*=r.inc;return p}
function resMoney(r){let p=r.money||0;for(let i=0;i<gres(r.id);i++)p*=r.inc;return p}
const RES_GROUPS={'1':'Economía y ciencia','c':'Tecnología','a':'Celdas y gestores'};
const UP_GROUPS={'1':'Economía y ciencia','d':'Piezas','a':'Celdas'};
const escAttr=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const fchip=(label,on,attr)=>`<button class="fc ${on?'on':''}" ${attr}>${label}</button>`;
function renderResearch(){
  let done=0,total=0;RES.forEach(r=>{total+=r.max;done+=gres(r.id)});
  viewEl.innerHTML=`<div id="tut" class="box"></div>
   <div class="box" style="display:flex;gap:18px;flex-wrap:wrap;align-items:center">
     <div>Puntos de investigación <b class="research" style="font-size:16px" id="rpv"></b></div>
     <div>Dinero <b class="money" style="font-size:16px" id="rmv"></b></div>
     <div class="small">Tecnologías ${done}/${total}</div>
     <div class="bar" style="flex:1;min-width:120px;margin:0"><i style="width:${100*done/total}%;background:var(--research)"></i></div>
   </div>
   <div class="fbar"><input id="fq" type="search" placeholder="Buscar investigación…" value="${escAttr(uiPrefs.resQ)}"><span id="fchips" class="fbar" style="margin:0"></span></div>
   <div class="grid" id="glist"></div>`;
  renderTut();
  $('#fq').oninput=e=>{uiPrefs.resQ=e.target.value;saveUI();fillResList()};
  fillResList();
}
function fillResList(){
  const visible=RES.filter(r=>!r.req||gres(r.req));
  const stat=r=>gres(r.id)>=r.max?'done':(afford(G.rp,resPrice(r))&&afford(G.money,resMoney(r)))?'afford':'pending';
  const cnt={pending:0,afford:0,done:0};visible.forEach(r=>{const s=stat(r);if(s==='done')cnt.done++;else{cnt.pending++;if(s==='afford')cnt.afford++}});
  const q=uiPrefs.resQ.trim().toLowerCase(),f=uiPrefs.resFilter,gsel=uiPrefs.resGroup;
  const list=visible.filter(r=>{
    const s=stat(r);
    if(f==='pending'&&s==='done')return false;
    if(f==='afford'&&s!=='afford')return false;
    if(f==='done'&&s!=='done')return false;
    if(gsel!=='all'&&r.group!==gsel)return false;
    if(q&&!(r.name+' '+r.desc).toLowerCase().includes(q))return false;
    return true;
  });
  $('#rpv').textContent=nf(G.rp);$('#rmv').textContent='$'+nf(G.money);
  const groups=[...new Set(visible.map(r=>r.group))];
  $('#fchips').innerHTML=
    fchip('Pendientes '+cnt.pending,f==='pending','data-f="pending"')+fchip('Al alcance '+cnt.afford,f==='afford','data-f="afford"')+
    fchip('Completadas '+cnt.done,f==='done','data-f="done"')+fchip('Todas',f==='all','data-f="all"')+
    (groups.length>1?'<span class="small">·</span>'+fchip('Todo',gsel==='all','data-g="all"')+groups.map(g=>fchip(RES_GROUPS[g]||g,gsel===g,`data-g="${g}"`)).join(''):'');
  let h='',lastG=null;
  for(const r of list){
    if(gsel==='all'&&lastG!==r.group)h+=`<div class="gh">${RES_GROUPS[r.group]||''}</div>`;lastG=r.group;
    const lv=gres(r.id),maxed=lv>=r.max,c=CBY[r.icon]||CBY[r.id],rp=resPrice(r),mn=resMoney(r),ok=stat(r)==='afford';
    h+=`<div class="gc ${maxed?'done':ok?'ok':''}"><div class="gtop">${c?iconImg(c,34):'<div style="width:34px"></div>'}
      <div><div class="nm">${r.name}${r.max>1?` <span class="small">${lv}/${r.max}</span>`:''}</div><div class="small">${r.desc}</div></div></div>
      <div class="gbot"><span>${maxed?'<span class="small">✓ Completada</span>':`${rp?`<b class="research">${nf(rp)}</b> `:''}${mn?`<b class="money">$${nf(mn)}</b>`:''}`}</span>
      ${maxed?'':`<button data-r="${r.id}" class="${ok?'':'cant'}">Investigar</button>`}</div></div>`;
  }
  if(!list.length)h=`<div class="small" style="grid-column:1/-1;padding:14px">${cnt.pending===0&&f==='pending'?'🎉 No queda nada pendiente por ahora: investiga lo que ya tienes para desbloquear más.':'Nada coincide con el filtro.'}</div>`;
  $('#glist').innerHTML=h;
  document.querySelectorAll('#fchips [data-f]').forEach(b=>b.onclick=()=>{uiPrefs.resFilter=b.dataset.f;saveUI();fillResList()});
  document.querySelectorAll('#fchips [data-g]').forEach(b=>b.onclick=()=>{uiPrefs.resGroup=b.dataset.g;saveUI();fillResList()});
  document.querySelectorAll('#glist [data-r]').forEach(b=>b.onclick=()=>{
    const r=RESBY[b.dataset.r];if(gres(r.id)>=r.max)return;
    if(afford(G.rp,resPrice(r))&&afford(G.money,resMoney(r))){addMoney(-resMoney(r),false);G.rp-=resPrice(r);G.research[r.id]=gres(r.id)+1;
      sfx.research();if(r.id==='chronometer')restartLoop();tutCheck();checkAch();applyMenu();renderResearch()}});
}

/* ============================================================
   MEJORAS
   ============================================================ */
const upLevel=(R,u)=>R.ups[u.id]||0;
function upPrice(R,u,sellMode){
  if(isFree(R))return 0;let p=u.price;const n=upLevel(R,u)-(sellMode?1:0);for(let i=0;i<n;i++)p*=u.inc;
  const ev=EVX.price*(EVX.upId===u.id?EVX.upMult:1);   // eventos: precio temporal. Al vender nunca se devuelve más de lo pagado
  return p*(sellMode?Math.min(1,ev):ev);
}
function renderUpgrades(){
  const R=curR();if(!R){setView('reactors');return}
  viewEl.innerHTML=`<div class="box" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">
    <div>Mejoras de <b>${R.meta.name}</b></div><div>Dinero <b class="money" style="font-size:16px" id="umv"></b></div>
    <span style="flex:1"></span><button id="bBack">← Volver al reactor</button></div>
   <div class="fbar"><input id="fq" type="search" placeholder="Buscar mejora…" value="${escAttr(uiPrefs.upQ)}"><span id="fchips" class="fbar" style="margin:0"></span>
    <select id="usort" title="Orden"><option value="orig">Orden del juego</option><option value="price">Precio: menor a mayor</option><option value="level">Nivel: mayor a menor</option></select></div>
   <div class="grid" id="glist"></div>`;
  $('#usort').value=uiPrefs.upSort;
  $('#usort').onchange=e=>{uiPrefs.upSort=e.target.value;saveUI();fillUpList()};
  $('#bBack').onclick=()=>setView('game');
  $('#fq').oninput=e=>{uiPrefs.upQ=e.target.value;saveUI();fillUpList()};
  fillUpList();
}
/* ---- vista previa de una mejora: qué piezas afecta y cómo cambia cada una (nivel actual → siguiente) ---- */
const UPSTAT={
 powerProduction:{v:(c,u)=>c.st.powerProduction*u.powerProductionMultiplayer,s:' energía/tick'},
 heatProduction:{v:(c,u)=>c.st.heatProduction*u.heatProductionMultiplayer,s:' calor/tick'},
 lifetime:{v:(c,u)=>c.lifetime*u.lifetimeMultiplayer,s:' ticks de vida'},
 maxHeatMultiplayer:{v:(c,u)=>c.maxHeat*u.maxHeatMultiplayer,s:' calor máx.'},
 powerToMoneyAmountBonusMultiplayer:{v:(c,u)=>1+c.st.sellAmountBonus*u.powerToMoneyAmountBonusMultiplayer,pre:'×',s:' a las oficinas'},
 heatSellAmount:{v:(c,u)=>c.st.convertHeatToMoney*u.bulkHeatSellMultiplayer,s:' calor por venta'},
 researchPointsProduction:{v:(c,u)=>c.st.researchProduction*u.researchPointsProductionMultiplayer,s:' inv./tick'},
 powerSellAmount:{v:(c,u)=>c.st.maxSellPower*u.powerSellAmountMultiplayer,s:' energía vendida/tick'},
 heatToPower:{v:(c,u)=>c.st.convertHeatToPower*u.heatToPowerConversionMultiplayer,s:' calor→energía/tick'},
 maxPower:{v:(c,u)=>c.st.maxPowerIncrease*u.maxPowerMultiplayer,s:' de capacidad'},
 isolationEffectiveness:{v:(c,u)=>c.st.heatProductionBonus*u.isolationMultiplayer*100,s:'% de calor extra'},
 waterProduction:{v:(c,u)=>c.st.waterProduction*u.waterProductionMultiplayer,s:' agua/tick'},
 maxWater:{v:(c,u)=>c.maxWater*u.maxWaterMultiplayer,s:' agua máx.'},
 circulatorEffectiveness:{v:(c,u)=>c.st.maxWaterBonus*u.circulatorMaxPowerMultiplayer*100,s:'% de agua máx.'},
 heatInletMaxTransferMultiplayer:{v:(c,u)=>c.st.transferHeat*u.heatInletMaxTransferMultiplayer,s:' calor/tick'},
 refundCells:{v:(c,u)=>c.price*Math.min(1,u.refundBonus),pre:'$',s:' de reembolso por una celda nueva'},
 refundHeat:{v:(c,u)=>c.price*c.refund*(1-.5*(1-Math.min(1,u.heatRefundMitigation))),pre:'$',s:' de reembolso si la pieza lleva 50% de calor'}
};
function upPreview(R,u){
  const cur=upLevel(R,u);
  const A={ups:Object.assign({},R.ups)},B={ups:Object.assign({},R.ups,{[u.id]:cur+1})};
  computeUB(A);computeUB(B);
  const d=UPSTAT[u.bonus.type];
  const targets=upTargets(u).filter(c=>compAvailable(R,c));
  return targets.map(c=>({c,a:d.v(c,A.ub[c.id]),b:d.v(c,B.ub[c.id]),d})).filter(r=>isFinite(r.a)&&isFinite(r.b)); // sin las piezas que no tienen esa característica
}
const fmtTotal=f=>f>=10?'×'+nf(f):'+'+nf(Math.round((f-1)*1000)/10)+'%';
const fmtAbs=f=>Math.round(f*100)+'%';
function upTotals(R,u){
  const cur=upLevel(R,u),first=upTargets(u)[0];
  const A={ups:Object.assign({},R.ups)},B={ups:Object.assign({},R.ups,{[u.id]:cur+1})};
  computeUB(A);computeUB(B);
  const f=UPFIELD[u.bonus.type];
  return {a:A.ub[first.id][f],b:B.ub[first.id][f]};
}
function upTipHtml(R,u){
  const lv=upLevel(R,u),t=upTotals(R,u),rows=upPreview(R,u).slice(0,12);
  const FT=u.abs?fmtAbs:fmtTotal;
  let h=`<b>${u.name}</b><br><span class="d">Nivel ${lv}${u.max?'/'+u.max:''} → ${lv+1} · ${u.abs?'valor':'efecto total'} ${FT(t.a)} → </span><b class="good">${FT(t.b)}</b>`;
  if(rows.length){
    const pre=rows[0].d.pre||'';
    h+=`<table class="pt"><tr><th>Pieza</th><th>Ahora</th><th>Con la mejora</th></tr>`+rows.map(r=>{
      const pct=r.a>0?Math.round((r.b/r.a-1)*1000)/10:0;
      return `<tr><td>${iconImg(r.c,16)} ${r.c.name}</td><td>${pre}${nf(r.a)}</td><td class="good">${pre}${nf(r.b)}${pct?` <span class="d">(+${nf(pct)}%)</span>`:''}</td></tr>`}).join('')+
      `</table><div class="d" style="margin-top:4px">${rows[0].d.s.trim()} · incluye todas tus mejoras actuales</div>`;
  }else h+='<div class="d" style="margin-top:4px">Aún no tienes desbloqueada ninguna pieza afectada.</div>';
  return h;
}
function fillUpList(){
  const R=curR();
  const visible=UPS.filter(u=>isFree(R)||!u.req||gres(u.req));
  const aff=u=>isFree(R)||afford(G.money,upPrice(R,u));
  const q=uiPrefs.upQ.trim().toLowerCase(),gsel=uiPrefs.upGroup,f=uiPrefs.upFilter;
  const nAff=visible.filter(aff).length,nOwn=visible.filter(u=>upLevel(R,u)>0).length;
  let list=visible.filter(u=>{
    if(f==='afford'&&!aff(u))return false;
    if(f==='owned'&&!(upLevel(R,u)>0))return false;
    if(gsel!=='all'&&u.group!==gsel)return false;
    if(q&&!(u.name+' '+UPTXT[u.bonus.type](u.bonus)).toLowerCase().includes(q))return false;
    return true;
  });
  if(uiPrefs.upSort==='price')list=list.slice().sort((a,b)=>upPrice(R,a)-upPrice(R,b));
  else if(uiPrefs.upSort==='level')list=list.slice().sort((a,b)=>upLevel(R,b)-upLevel(R,a));
  $('#umv').textContent='$'+nf(G.money);
  const groups=[...new Set(visible.map(u=>u.group))];
  $('#fchips').innerHTML=fchip('Todas '+visible.length,f==='all','data-f="all"')+fchip('Asequibles '+nAff,f==='afford','data-f="afford"')+fchip('Con nivel '+nOwn,f==='owned','data-f="owned"')+
    (groups.length>1?'<span class="small">·</span>'+fchip('Todo',gsel==='all','data-g="all"')+groups.map(g=>fchip(UP_GROUPS[g]||g,gsel===g,`data-g="${g}"`)).join(''):'');
  let h='',lastG=null;const grouped=gsel==='all'&&uiPrefs.upSort==='orig';
  for(const u of list){
    if(grouped&&lastG!==u.group)h+=`<div class="gh">${UP_GROUPS[u.group]||''}</div>`;lastG=u.group;
    const lv=upLevel(R,u),p=upPrice(R,u),maxed=!!(u.max&&lv>=u.max),ok=aff(u)&&!maxed;
    const tc=upTargets(u)[0];
    h+=`<div class="gc ${ok?'ok':''}" data-uid="${u.id}"><div class="gtop">${iconImg(tc,34)}
      <div><div class="nm">${u.name} <span class="small">nivel ${lv}${u.max?'/'+u.max:''}</span></div><div class="small">${UPTXT[u.bonus.type](u.bonus)}</div></div></div>
      <div class="gbot"><b class="money">${maxed?'<span class="small">Nivel máximo</span>':isFree(R)?'gratis':'$'+nf(p)}</b><span>
      ${(u.sell||isFree(R))&&lv>0?`<button class="sm" data-s="${u.id}" title="${isFree(R)?'Quitar un nivel':'Vender el último nivel'}">${isFree(R)?'−':`Vender +$${nf(.8*upPrice(R,u,true))}`}</button> `:''}
      ${maxed?'':`<button data-u="${u.id}" class="${ok?'':'cant'}">Comprar</button>`}</span></div></div>`;
  }
  if(!list.length)h='<div class="small" style="grid-column:1/-1;padding:14px">Nada coincide con el filtro.</div>';
  $('#glist').innerHTML=h;
  document.querySelectorAll('#fchips [data-f]').forEach(b=>b.onclick=()=>{uiPrefs.upFilter=b.dataset.f;saveUI();fillUpList()});
  document.querySelectorAll('#fchips [data-g]').forEach(b=>b.onclick=()=>{uiPrefs.upGroup=b.dataset.g;saveUI();fillUpList()});
  document.querySelectorAll('#glist .gc[data-uid]').forEach(el=>{
    el.onmouseenter=()=>showInfoText(upTipHtml(R,UPBY[el.dataset.uid]));
    el.onmouseleave=()=>showInfoText('');
  });
  document.querySelectorAll('#glist [data-u]').forEach(b=>b.onclick=()=>{
    const u=UPBY[b.dataset.u],p=upPrice(R,u);if(u.max&&upLevel(R,u)>=u.max)return;if(!isFree(R)&&!afford(G.money,p))return;
    const go=()=>{if(!isFree(R))addMoney(-p,false);R.ups[u.id]=upLevel(R,u)+1;R.ubDirty=true;sfx.research();showInfoText('');fillUpList()};
    if(u.warn&&upLevel(R,u)===0&&!isFree(R)){if(confirm(u.warn))go()}else go()});
  document.querySelectorAll('#glist [data-s]').forEach(b=>b.onclick=()=>{
    const u=UPBY[b.dataset.s];if(upLevel(R,u)<1)return;
    if(!isFree(R))addMoney(.8*upPrice(R,u,true),false);R.ups[u.id]=upLevel(R,u)-1;R.ubDirty=true;fillUpList()});
}

/* ============================================================
   MODALES: ayuda, ajustes, logros, demo
   ============================================================ */
function modal(html){
  const m=document.createElement('div');m.className='modal';m.innerHTML='<div>'+html+'</div>';
  m.onclick=e=>{if(e.target===m){m.remove();if(demo.on)stopDemo()}};document.body.append(m);return m;
}
$('#bHelp').onclick=()=>{
  const m=modal(`<button style="float:right" id="cls">Cerrar</button><h3>¿Cómo empezar?</h3>
  <p>Empieza <b>construyendo turbinas eólicas</b>: producen energía que debes vender a mano con <b>Vender toda la energía</b>. Más adelante habrá oficinas que la venden solas y gestores que reponen las turbinas.</p>
  <p>Lo primero suele ser un <b>centro de investigación</b> (pestaña Investigación) para desbloquear componentes más avanzados.</p>
  <p>Las turbinas, celdas solares, etc. tienen <b>vida útil</b>: solo producen mientras les quedan ticks. Cuando se agotan, vuelve a comprarlas (tecla <b>R</b> repone todo lo agotado).</p>
  <h3>Controles</h3><ul>
  <li><u>Clic izquierdo</u>: construir / reponer · <u>clic derecho</u>: vender</li>
  <li><u>Ctrl + clic izquierdo</u>: reponer todos los del mismo tipo agotados · <u>Ctrl + clic derecho</u>: vender todos los del mismo tipo</li>
  <li><u>Shift + arrastrar</u>: pintar o vender varias casillas (en móvil: botón «Pintar»)</li>
  <li><u>Rueda del mouse</u>: acercar / alejar el mapa (hasta 4×) · <u>botón central o Espacio + arrastrar</u>: mover · <u>0</u>: vista normal · flechas: mover con zoom · en táctil: pellizcar y arrastrar con dos dedos</li>
  <li><u>Ctrl+Z / Ctrl+Y</u>: deshacer / rehacer (solo antes del siguiente tick) · <u>B / X / S</u>: construir / vender / seleccionar</li>
  <li><u>Seleccionar</u> + <u>Ctrl+C / Ctrl+V</u>: copiar y pegar zonas; puedes guardarlas como plantillas</li></ul>
  <h3>¿Cómo se reparte el calor?</h3><ol style="padding-left:18px">
   <li><b>Las celdas</b> (turbina, solar, carbón, nuclear…) producen calor cada tick y lo reparten <i>todo de golpe</i>, en partes iguales, entre las casillas vecinas que <b>aceptan calor</b>. Si no tienen ninguna vecina que lo acepte, <b>explotan</b>.</li>
   <li><b>Generadores</b> convierten calor en energía (hasta su límite por tick). Lo que no convierten se acumula; si supera su <b>calor máximo</b>, explotan.</li>
   <li><b>Intercambiadores</b> promedian el calor con las 4 casillas vecinas (se repite 6 veces por tick).</li>
   <li><b>Entradas/Salidas</b>: la entrada manda calor a <i>todas</i> las salidas del mapa, sin tuberías.</li>
   <li><b>Disipador</b>: guarda calor, nunca lo devuelve y pierde 5 % por tick. La <b>caldera</b> lo vende en bloque.</li>
   <li><b>Aislamiento</b> no acepta calor: sube un +5 % la producción de las celdas adyacentes.</li></ol>
  <p>La <b>Vista de calor</b> muestra el relleno de calor y las flechas por donde viaja. El botón <b>Calculadora</b> (✓ Estable / ⚠) simula los próximos ${HORIZON} ticks y avisa de lo que explotaría; con una pieza elegida, el cuadro que aparece junto al mouse te dice si aguantaría en esa casilla.</p>
  <div class="row"><button id="bDemo2">Ver demostración animada del calor</button></div>
  <p>Tiempo sin jugar: se acumulan <b>ticks extra</b> que puedes gastar con el botón Rápido.</p>
  <p><b>Nodos especiales:</b> las casillas marcadas del mapa dan ventajas: <b>♨ fuente geotérmica</b> (la celda de encima no se desgasta), <b>💠 veta de uranio</b> (+50 % de calor a una celda nuclear) y <b>💧 manantial</b> (agua gratis a las piezas de al lado). Pasa el ratón para ver qué hace cada una. <b>Combustibles:</b> al elegir un quemador o una celda nuclear puedes cambiar el combustible (tras investigarlo): <i>denso</i> concentra mucho calor en una celda, <i>ciclo largo</i> sale más barato por calor.</p>
  <p><b>Terreno:</b> con el botón ⛏ <b>Terreno</b> (tecla T) puedes despejar montañas o rellenar agua para convertirlas en pasto y construir ahí. Es permanente, cada casilla modificada encarece la siguiente un 6 %, y no puedes tapar el agua que una bomba necesita.</p>
  <p><b>Eventos aleatorios:</b> cada 4–8 minutos puede pasar algo: un bono (favorable), una decisión que tú aceptas o rechazas, o un contratiempo (te avisa 10 s antes). Los premios y castigos son proporcionales a tu producción y ninguno destruye piezas. Puedes quitar los adversos o todos en Ajustes.</p>`);
  m.querySelector('#cls').onclick=()=>m.remove();
  m.querySelector('#bDemo2').onclick=()=>{m.remove();openDemo()};
};
$('#bSettings').onclick=()=>{
  const m=modal(`<button style="float:right" id="cls">Cerrar</button><h3>Ajustes</h3>
  <p class="small">Datos de guardado (cópialos para respaldar o pégalos para cargar). También puedes descargar un archivo.</p>
  <div id="syncBox" class="box"></div>
  <label style="display:block;margin:8px 0"><b>Eventos aleatorios:</b> <select id="evMode"><option value="all">Todos (favorables, decisiones y adversos)</option><option value="fav">Sin adversos</option><option value="off">Desactivados</option></select></label>
  <label style="display:block;margin:8px 0"><input type="checkbox" id="adv"> <b>Modo avanzado:</b> mostrar todas las opciones desde el inicio <span class="small">(por defecto la interfaz se va revelando según avanzas)</span></label>
  <div class="box" style="margin:8px 0"><label><input type="checkbox" id="musOn"> <b>Música ambiental</b></label> <span class="small">volumen</span> <input type="range" id="musVol" min="0" max="100" style="vertical-align:middle;width:120px"></div>
  <textarea id="sd"></textarea>
  <div class="row"><button id="ld">Cargar texto</button><button id="lf">Cargar archivo…</button><input type="file" id="lfi" accept=".txt,text/plain" style="display:none"><button id="dl">Descargar archivo</button><button id="rs" style="border-color:#ff5a4d">Reiniciar todo</button></div>`);
  const enc=()=>btoa(unescape(encodeURIComponent(JSON.stringify(getSave()))));
  m.querySelector('#sd').value=enc();
  renderSyncBox(m.querySelector('#syncBox'));
  m.querySelector('#musOn').checked=music.on;m.querySelector('#musVol').value=Math.round(music.vol*100);
  m.querySelector('#musOn').onchange=e=>music.setOn(e.target.checked);
  m.querySelector('#musVol').oninput=e=>music.setVol(e.target.value/100);
  m.querySelector('#evMode').value=EVCFG.mode;
  m.querySelector('#evMode').onchange=e=>{EVCFG.mode=uiPrefs.events=e.target.value;saveUI()};
  m.querySelector('#adv').checked=uiPrefs.advanced;
  m.querySelector('#adv').onchange=e=>{uiPrefs.advanced=e.target.checked;saveUI();applyMenu();if(view==='game'){buildPalette();applyDisclosure()}else setView(view)};
  m.querySelector('#cls').onclick=()=>m.remove();
  m.querySelector('#ld').onclick=()=>{
    try{const d=JSON.parse(decodeURIComponent(escape(atob(m.querySelector('#sd').value.trim()))));
      if(loadSave(d,false)){saveGame();m.remove();setView(view==='game'?'reactors':view)}else alert('Guardado inválido')}catch(e){alert('Guardado inválido')}};
  m.querySelector('#lf').onclick=()=>m.querySelector('#lfi').click();
  m.querySelector('#lfi').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{m.querySelector('#sd').value=String(r.result).trim();m.querySelector('#ld').click()};r.readAsText(f)};
  m.querySelector('#dl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([enc()],{type:'text/plain'}));a.download='reactor-idle-guardado.txt';a.click()};
  m.querySelector('#rs').onclick=()=>{if(confirm('¿Seguro? Se borrará todo el progreso.')){localStorage.removeItem(SAVEKEY);location.reload()}};
};
$('#bAch').onclick=()=>{
  const n=ACH.filter(a=>G.ach[a.id]).length;
  const m=modal(`<button style="float:right" id="cls">Cerrar</button><h3>Logros (${n}/${ACH.length})</h3><div class="grid">`+ACH.map(a=>`<div class="gc ${G.ach[a.id]?'ok':'done'}"><div class="gtop"><div style="font-size:24px">${G.ach[a.id]?'🏆':'🔒'}</div><div><div class="nm">${a.n}</div><div class="small">${a.d}</div></div></div></div>`).join('')+'</div>');
  m.querySelector('#cls').onclick=()=>m.remove();
};
$('#bMore').onclick=()=>{
  const m=modal(`<button style="float:right" id="cls">Cerrar</button><h3>Más</h3>
   <div class="row"><button id="mrAch">Logros</button><button id="mrHelp">Ayuda</button><button id="mrMute">${sfx.muted?'🔇 Activar sonido':'🔊 Silenciar'}</button></div>`);
  m.querySelector('#cls').onclick=()=>m.remove();
  m.querySelector('#mrAch').onclick=()=>{m.remove();$('#bAch').click()};
  m.querySelector('#mrHelp').onclick=()=>{m.remove();$('#bHelp').click()};
  m.querySelector('#mrMute').onclick=()=>{$('#bMute').click();m.remove()};
};
const bMute=$('#bMute');
bMute.textContent=sfx.muted?'🔇':'🔊';
bMute.onclick=()=>{bMute.textContent=sfx.toggle()?'🔇':'🔊';sfx.click();music.sync()};

/* ---- demostración animada del calor ---- */
const demo={on:false,R:null,timer:null,caption:'',phaseIdx:0,cv:null,g:null,ticks:0};
function demoBuild(){
  const R=makeReactor({id:'demo',name:'demo',price:0,maxPower:1e12,w:7,h:5,sandbox:true,layout:' '.repeat(35)});
  R.dry={booms:[],tick:0};
  const put=(x,y,id)=>setComp(R,R.tiles[y*7+x],CBY[id]);
  put(3,2,'coalBurner');put(2,2,'generator3');put(4,2,'heatExchanger');put(5,2,'generator3');put(3,3,'heatBattery');put(3,1,'heatExchanger');put(3,0,'generator3');
  demo.R=R;demo.ticks=0;demo.phaseIdx=0;
}
function openDemo(){
  const m=modal(`<button style="float:right" id="cls">Cerrar</button><h3>Así se reparte el calor</h3>
   <p class="small">Un <b>quemador de carbón</b> (centro) produce 380 de calor por tick. Mira cada fase del tick en cámara lenta: reparte el calor en partes iguales (380 ÷ 4 = 95) entre las 4 casillas vecinas que lo aceptan, los intercambiadores lo reenvían a los generadores, y los generadores lo convierten en energía.</p>
   <div id="mapwrap" style="max-width:${7*TS*1.6}px;margin:6px auto"><canvas id="dcv" style="width:100%"></canvas></div>
   <div id="dcap" style="min-height:48px"></div>
   <p class="small">Los números son el calor de cada pieza. Los puntos naranjas muestran por dónde se mueve.</p>`);
  m.querySelector('#cls').onclick=()=>{m.remove();stopDemo()};
  demo.cv=m.querySelector('#dcv');demo.g=demo.cv.getContext('2d');
  const dpr=window.devicePixelRatio||1;demo.cv.width=7*TS*dpr;demo.cv.height=5*TS*dpr;demo.g.setTransform(dpr,0,0,dpr,0,0);
  demoBuild();demo.on=true;
  clearInterval(demo.timer);
  demo.timer=setInterval(()=>{
    const p=PHASES[demo.phaseIdx];p.run(demo.R);
    demo.caption=`<b>${p.name}</b><br>${p.desc}`;
    demo.phaseIdx++;
    if(demo.phaseIdx>=PHASES.length){demo.phaseIdx=0;demo.ticks++;if(demo.ticks>=14)demoBuild()}
    const e=document.getElementById('dcap');if(e)e.innerHTML=demo.caption;
  },1500);
}
function stopDemo(){demo.on=false;clearInterval(demo.timer);demo.timer=null}
function drawDemo(now){
  if(!demo.g||!demo.R||!document.getElementById('dcv')){stopDemo();return}
  drawMap(demo.g,demo.R,now,{heat:true,nums:true,anim:true});
}

/* ============================================================
   EVENTOS ALEATORIOS (interfaz; la lógica está en events.js)
   ============================================================ */
const evBox=$('#evbox');let evSig='';
const evSecs=left=>Math.max(0,Math.ceil(left*tickInterval()/1000));
function evCard(cls,icon,name,body,id,extra){
  return `<div class="evc ${cls}" data-card="${id}"><div class="evh"><span>${icon}</span><b>${name}</b><span class="evt" data-t="${id}"></span></div>${body?`<div class="evd">${body}</div>`:''}<div class="evbar"><i data-b="${id}"></i></div>${extra||''}</div>`;
}
function renderEvents(){
  if(!evBox)return;
  const E=G.ev;
  const sig=E.active.map(e=>e.id).join(',')+'|'+(E.warn?E.warn.id:'')+'|'+(E.offer?E.offer.id:'');
  if(sig!==evSig){
    evSig=sig;let h='';
    if(E.offer){const d=EVBY[E.offer.id];
      h+=evCard('dec',d.icon,d.name+' <span class="small">· decisión</span>',d.desc(null,E.offer.data),'offer',
        '<div class="row"><button data-ans="1">Aceptar</button><button data-ans="0">Rechazar</button></div>')}
    if(E.warn){const d=EVBY[E.warn.id];h+=evCard('adv',d.icon,'⚠ '+d.name,d.desc?d.desc():'Algo va a pasar en breve…','warn')}
    for(const e of E.active)h+=evCard((e.def.kind==='dec'?'dec':e.def.kind)+' mini',e.def.icon,e.def.name,e.def.desc?e.def.desc(e,e.data):'',e.id);
    evBox.innerHTML=h;
  }
  const upd=(id,left,total,suffix)=>{
    const t=evBox.querySelector('[data-t="'+id+'"]'),b=evBox.querySelector('[data-b="'+id+'"]');
    if(t)t.textContent=(suffix||'')+evSecs(left)+' s';if(b)b.style.width=Math.max(0,100*left/total)+'%';
  };
  if(E.offer)upd('offer',E.offer.left,E.offer.total);
  if(E.warn)upd('warn',E.warn.left,E.warn.total,'en ');
  for(const e of E.active){
    upd(e.id,e.left,e.total);
    if(e.def.progress){const t=evBox.querySelector('[data-t="'+e.id+'"]');if(t)t.textContent=Math.round(100*e.def.progress(e))+' % · '+evSecs(e.left)+' s'}
    if(e.id==='inspection'){const t=evBox.querySelector('[data-t="inspection"]');if(t)t.textContent='calor máx. '+Math.round(100*hotRatio())+' % · '+evSecs(e.left)+' s'}
  }
}
evBox&&evBox.addEventListener('click',e=>{
  const b=e.target.closest('[data-ans]');if(!b)return;
  evAnswer(b.dataset.ans==='1');sfx.click();renderEvents();
});
EVCFG.onEvent=(type,def,x)=>{
  if(type==='warn'){sfx.warn();toast('⚠ <b>'+def.icon+' '+def.name+'</b><br><span class="small">Ocurrirá en 10 s.</span>')}
  else if(type==='offer'){sfx.research();toast('🔔 <b>'+def.icon+' '+def.name+'</b><br><span class="small">Tienes una decisión pendiente (30 s).</span>')}
  else if(type==='start'){(def.kind==='adv'?sfx.warn:sfx.cash)();toast(def.icon+' <b>'+def.name+'</b>'+(def.kind==='adv'?'':''))}
  else if(type==='instant'){(def.kind==='adv'?sfx.warn:sfx.cash)();toast(def.icon+' <b>'+def.name+'</b><br><span class="small">'+(x||'')+'</span>')}
  else if(type==='end'&&x)toast(def.icon+' <b>'+def.name+'</b><br><span class="small">'+x+'</span>');
  else if(type==='msg')toast(def.icon+' <b>'+def.name+'</b><br><span class="small">'+x+'</span>');
  else if(type==='skip')logMsg('Evento evitado: '+def.name);
  evSig='';renderEvents();refreshHud();
};

/* ============================================================
   BUCLE DEL JUEGO
   ============================================================ */
/* El reloj de ticks corre en un Web Worker: los navegadores frenan los temporizadores de las pestañas ocultas
   (o tapadas por otra aplicación), pero no los de un worker. Si aun así se pierden ticks, se pagan como «ticks extra». */
let timer=null,worker=null,lastRun=0,missedAcc=0;
function tickHandler(){
  if(playFast&&EVX.noFast){playFast=false;restartLoop()}   // evento «falla de comunicación»
  const fast=playFast&&G.bonusTicks>0;
  EVCFG.fast=fast;
  const iv=tickInterval(),now=performance.now();
  if(!fast){
    if(lastRun){
      const miss=Math.floor((now-lastRun)/iv)-1;   // ticks que el navegador se saltó
      if(miss>=2){
        const cap=TICKS_MAXBONUS*(1000/iv);
        const add=Math.min(miss,Math.max(0,cap-G.bonusTicks));
        G.bonusTicks+=add;missedAcc+=add;
      }
    }
    lastRun=now;
  }else lastRun=0;
  const n=fast?5:1;
  for(let i=0;i<n;i++){
    gameTick();
    if(fast){G.bonusTicks--;if(G.bonusTicks<=0){playFast=false;restartLoop();break}}
  }
}
function setTicker(ms){
  if(worker){worker.postMessage(ms);return}
  clearInterval(timer);timer=ms>0?setInterval(tickHandler,ms):null;
}
function restartLoop(){
  lastRun=0;
  if(paused){setTicker(0);return}
  const fast=playFast&&G.bonusTicks>0&&!EVX.noFast;
  setTicker(fast?20:tickInterval());
}
(function initTicker(){
  try{
    const blob=new Blob(['let t=null;onmessage=e=>{clearInterval(t);t=null;if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}'],{type:'text/javascript'});
    worker=new Worker(URL.createObjectURL(blob));
    worker.onmessage=tickHandler;
    worker.onerror=()=>{worker=null;restartLoop()};
  }catch(e){worker=null}
})();
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&missedAcc>=10){
    toast('⏱ <b>Estuviste en segundo plano</b><br><span class="small">El navegador frenó el juego: se guardaron <b>'+nf(missedAcc)+'</b> ticks extra para que los uses con «Rápido».</span>');
    missedAcc=0;
  }
});

/* ---- inicio ---- */
(function init(){
  let loaded=false;
  try{const s=localStorage.getItem(SAVEKEY);if(s)loaded=loadSave(JSON.parse(s),true)}catch(e){}
  setView(curReactor&&G.reactors[curReactor]&&G.reactors[curReactor].bought?'game':'reactors');
  restartLoop();
  requestAnimationFrame(frame);
  checkAch();
  setInterval(saveGame,15000);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame()});
  window.addEventListener('beforeunload',saveGame);
})();
