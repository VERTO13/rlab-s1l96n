'use strict';
/* ============================================================
   SIMULACIÓN: estado, acciones de compra y el tick por fases.
   No toca el DOM: la interfaz se engancha mediante `hooks`.
   ============================================================ */
const hooks={log(){},onTick(){},onBoom(){},onBuild(){},onSell(){}};

const G={money:1,totalMoney:0,totalTicks:0,rp:0,research:{},bonusTicks:0,reactors:{},ach:{},stats:{explosions:0,sold:0,built:0}};

function makeReactor(meta){
  const R={meta,power:0,bought:!!meta.sandbox,auto:true,ups:{},tiles:[],last:{},expl:[],ub:null,ubDirty:true,tileBonus:0,
    ctx:null,stepIdx:0,dry:null,maxRatio:0,hotCount:0};
  for(let y=0;y<meta.h;y++)for(let x=0;x<meta.w;x++){
    const ch=meta.layout[y*meta.w+x];
    R.tiles.push({x,y,terrain:TERR[ch]||'water',c:null,heat:0,water:0,wc:0,life:null,b:null,inHeat:0,dump:null,delta:0,heatOut:0});
  }
  return R;
}
REACTORS.forEach(m=>G.reactors[m.id]=makeReactor(m));
const gres=id=>G.research[id]||0;
const isFree=R=>!!R.meta.sandbox;
const tileAt=(R,x,y)=>(x<0||y<0||x>=R.meta.w||y>=R.meta.h)?null:R.tiles[y*R.meta.w+x];
const near=(R,t,offs)=>{const o=[];for(const [dx,dy] of offs){const n=tileAt(R,t.x+dx,t.y+dy);if(n)o.push(n)}return o};

/* comparación de dinero tolerante a errores de decimales (0.1+0.2 ≠ 0.3): evita «tengo $1 pero no puedo comprar algo de $1» */
const afford=(have,price)=>have>=price-1e-9*Math.max(1,Math.abs(price));
function setMoney(v,count){
  if(Math.abs(v-Math.round(v))<1e-9)v=Math.round(v); // limpia residuos como 0.9999999999
  if(v<0)v=0;if(G.totalTicks>=1e4&&v<1)v=1;
  if(v>G.money&&(count||count==null))G.totalMoney+=v-G.money;
  G.money=v;
}
const addMoney=(v,c)=>setMoney(G.money+v,c);

/* ---- bonos por mejoras ---- */
function computeUB(R){
  const ub={};
  for(const c of COMPS)ub[c.id]={powerProductionMultiplayer:1,heatProductionMultiplayer:1,waterProductionMultiplayer:1,lifetimeMultiplayer:1,maxHeatMultiplayer:1,maxWaterMultiplayer:1,
   powerToMoneyAmountBonusMultiplayer:1,bulkHeatSellMultiplayer:1,researchPointsProductionMultiplayer:1,powerSellAmountMultiplayer:1,heatToPowerConversionMultiplayer:1,
   maxPowerMultiplayer:1,isolationMultiplayer:1,heatInletMaxTransferMultiplayer:1,circulatorMaxPowerMultiplayer:1};
  for(const id in R.ups){
    const u=UPBY[id];if(!u)continue;
    const f=UPFIELD[u.bonus.type];
    const targets=u.target.cid?[CBY[u.target.cid]]:(CTYPE[u.target.ctype]||[]);
    for(let i=0;i<R.ups[id];i++)for(const c of targets){
      if(u.method==='sum')ub[c.id][f]+=u.bonus.mult;else ub[c.id][f]*=u.bonus.mult;
    }
  }
  R.ub=ub;R.ubDirty=false;
}
const UB=(R,c)=>{if(R.ubDirty||!R.ub)computeUB(R);return R.ub[c.id]};

/* ---- propiedades de casilla ---- */
const maxHeat=(R,t)=>t.c.maxHeat*UB(R,t.c).maxHeatMultiplayer;
const maxWater=(R,t)=>t.c.maxWater*UB(R,t.c).maxWaterMultiplayer*(t.b?t.b.maxWaterBonus:1);
const maxLife=(R,t)=>t.c?(t.c.lifetime?t.c.lifetime*UB(R,t.c).lifetimeMultiplayer:null):null;
function setComp(R,t,c){
  t.c=c;t.heat=0;t.water=0;t.wc=0;t.life=null;t.dump=null;
  if(c&&c.lifetime)t.life=maxLife(R,t);
}
const getMaxPower=R=>R.meta.maxPower+R.tileBonus;
function heatProdOf(R,t){return t.c.st.heatProduction*UB(R,t.c).heatProductionMultiplayer*(t.b?t.b.heatProductionBonus:1)}
function powerProdOf(R,c){return c.st.powerProduction*UB(R,c).powerProductionMultiplayer}
function convAmount(R,c){return c.st.convertHeatToPower*UB(R,c).heatToPowerConversionMultiplayer}
function patternFor(c){
  const s=c.st,k=s.distributeSize||1;
  return s.distributeType==='diagonal'?PAT_D[k]:PAT_S[k];
}
function receiversOf(R,x,y,c){
  return near(R,{x,y},patternFor(c)).filter(n=>n.c&&n.c.acceptsHeat);
}
const compAvailable=(R,c)=>isFree(R)||!c.req||!!gres(c.req);

/* ---- historial (deshacer / rehacer) ---- */
const hist={group:null,undo:[],redo:[]};
/* Anti-abuso: deshacer/rehacer SOLO vale mientras no haya pasado ningún tick desde la acción
   (o en el laboratorio, que no tiene economía). Si no, se podría construir, dejar producir,
   deshacer para recuperar el 100 % del precio y repetir: producción gratis. */
const histValid=g=>g.every(e=>G.reactors[e.rid].meta.sandbox||e.tick===G.totalTicks);
function pruneHistory(){
  hist.undo=hist.undo.filter(histValid);
  hist.redo=hist.redo.filter(histValid);
}
function beginGroup(){hist.group=[]}
function endGroup(){
  if(hist.group&&hist.group.length&&histValid(hist.group)){hist.undo.push(hist.group);if(hist.undo.length>200)hist.undo.shift();hist.redo.length=0}
  hist.group=null;
}
const snapT=t=>({c:t.c,heat:t.heat,water:t.water,life:t.life});
function applySnap(t,s){t.c=s.c;t.heat=s.heat;t.water=s.water;t.life=s.life;t.wc=0;t.dump=null}
function recordChange(R,t,before,mb){
  if(!hist.group)return;
  hist.group.push({rid:R.meta.id,i:t.y*R.meta.w+t.x,before,after:snapT(t),dm:G.money-mb,tick:G.totalTicks});
}
function undoLast(){
  pruneHistory();
  const g=hist.undo.pop();if(!g)return false;
  for(let k=g.length-1;k>=0;k--){const e=g[k],R=G.reactors[e.rid];applySnap(R.tiles[e.i],e.before);if(e.dm)addMoney(-e.dm,false)}
  hist.redo.push(g);return true;
}
function redoLast(){
  pruneHistory();
  const g=hist.redo.pop();if(!g)return false;
  for(const e of g){const R=G.reactors[e.rid];applySnap(R.tiles[e.i],e.after);if(e.dm)addMoney(e.dm,false)}
  hist.undo.push(g);return true;
}

/* ---- acciones de compra ---- */
const waterOk=(R,t,c)=>!c.onlyNextToWater||near(R,t,N4).some(n=>n.terrain==='water');
function canBuild(R,t,c){
  if(t.c||t.terrain!=='grass'||!waterOk(R,t,c))return false;
  const lim=R.meta.heatCellsAllowed;
  if(lim&&c.st.type==='Cell'){let n=0;R.tiles.forEach(q=>{if(q.c&&q.c.st.type==='Cell')n++});if(n>=lim)return false}
  if(R.meta.researchComponentsDisabled&&c.type==='researchCenter')return false;
  return isFree(R)||afford(G.money,c.price);
}
function canRestore(R,t,c){
  return !!(t.c&&t.c.id===c.id&&maxLife(R,t)>0&&waterOk(R,t,c)&&(isFree(R)||afford(G.money,c.price)));
}
function build(R,t,c){
  const b=snapT(t),mb=G.money;
  if(!isFree(R))addMoney(-c.price);
  setComp(R,t,c);if(!isFree(R))G.stats.built++;
  t.born=performance.now();hooks.onBuild(R,t);
  recordChange(R,t,b,mb);
}
function sellPrice(R,t){
  if(!t.c.refund||isFree(R))return 0;
  const p=t.c.price*t.c.refund;let f=1;
  if(t.c.maxHeat)f=1-t.heat/maxHeat(R,t);
  return p*f;
}
function sell(R,t){
  if(!t.c)return;
  const b=snapT(t),mb=G.money;
  hooks.onSell(R,t);
  addMoney(sellPrice(R,t),false);setComp(R,t,null);if(!isFree(R))G.stats.sold++;
  recordChange(R,t,b,mb);
}
function buyOrRestoreOne(R,t,c,dragMode){
  if(!t||!c)return false;
  if(canBuild(R,t,c)||(canRestore(R,t,c)&&(!dragMode||(maxLife(R,t)>0&&t.life<=0)))){build(R,t,c);return true}
  return false;
}
function restoreMany(R,c){
  R.tiles.forEach(t=>{if(t.c&&t.c.id===c.id&&t.life!=null&&t.life<=0)buyOrRestoreOne(R,t,c,false)});
}
function restoreAllExpired(R){
  R.tiles.forEach(t=>{if(t.c&&t.c.lifetime>0&&t.life<=0)buyOrRestoreOne(R,t,t.c,false)});
}
function sellMany(R,t){const id=t.c&&t.c.id;if(!id)return;R.tiles.forEach(q=>{if(q.c&&q.c.id===id)sell(R,q)})}

/* ============================================================
   TICK POR FASES  (el orden es el del juego original)
   ============================================================ */
function boom(R,t,why){
  if(R.dry){R.dry.booms.push({x:t.x,y:t.y,id:t.c.id,name:t.c.name,why,tick:R.dry.tick});setComp(R,t,null);return}
  R.expl.push({x:t.x,y:t.y,t:performance.now()});
  if(!isFree(R))G.stats.explosions++;
  hooks.log('💥 '+t.c.name+' explotó en ('+(t.x+1)+','+(t.y+1)+')'+(why?': '+why:''));
  hooks.onBoom(R,t);
  setComp(R,t,null);
}
const PHASES=[
 {id:'bonus',name:'1. Bonos',desc:'Aislamiento, bancos y circuladores marcan sus bonos en las casillas vecinas.',run(R){
  if(R.ubDirty||!R.ub)computeUB(R);
  const tiles=R.tiles;
  R.ctx={exchangers:[],inlets:[],outlets:[],before:null,e:{powerMax:0,maxPowerToMoney:0,maxPowerBonus:0,money:0,research:0,heatToPower:0}};
  for(const t of tiles){t.b={heatProductionBonus:1,powerToMoneyMultiplayer:1,maxWaterBonus:1};t.inHeat=0;t.dump=null;t.delta=0;t.heatOut=0}
  for(const t of tiles){
    if(!t.c)continue;const s=t.c.st;
    if(s.type==='CellHeatProductionAmplifier'){
      const b=s.heatProductionBonus*UB(R,t.c).isolationMultiplayer;
      for(const n of near(R,t,N4))if(n.c&&n.c.st.type==='Cell')n.b.heatProductionBonus+=b;
    }else if(s.type==='Bank'){
      const b=s.sellAmountBonus*UB(R,t.c).powerToMoneyAmountBonusMultiplayer;
      for(const n of near(R,t,N4))if(n.c&&n.c.st.type==='PowerToMoneyConverter')n.b.powerToMoneyMultiplayer+=b;
    }else if(s.type==='Circulator'){
      const b=1+s.maxWaterBonus*UB(R,t.c).circulatorMaxPowerMultiplayer;
      for(const n of near(R,t,N4))if(n.c&&n.c.st.type==='HeatToPowerConverter')n.b.maxWaterBonus=Math.max(b,n.b.maxWaterBonus);
    }
  }
 }},
 {id:'water',name:'2. Agua',desc:'Las bombas producen agua y las tuberías la reparten entre vecinos.',run(R){
  const balancers=[];
  for(const t of R.tiles){
    if(!t.c)continue;
    if(t.c.st.type==='WaterPump')t.water=Math.min(maxWater(R,t),t.water+t.c.st.waterProduction*UB(R,t.c).waterProductionMultiplayer);
    if(t.c.st.type==='WaterExchanger'||(t.c.st.type==='WaterPump'&&t.c.st.balancesWater))balancers.push(t);
  }
  for(let i=0;i<balancers.length;i++)balanceWater(R,balancers[i]);
  for(let i=balancers.length-1;i>=0;i--)balanceWater(R,balancers[i]);
 }},
 {id:'cells',name:'3. Las celdas reparten su calor',desc:'Cada celda produce calor y lo reparte TODO de golpe, en partes iguales, entre las vecinas que aceptan calor. Si no hay ninguna, explota.',run(R){
  for(const t of R.tiles){
    if(!t.c)continue;const ty=t.c.st.type;
    if(ty==='Cell')cellHeat(R,t);
    if(ty==='HeatExchanger')R.ctx.exchangers.push(t);
    if(ty==='HeatInlet')R.ctx.inlets.push(t);
    if(ty==='HeatOutlet')R.ctx.outlets.push(t);
  }
 }},
 {id:'inlets',name:'4. Entradas → salidas',desc:'Cada entrada de calor manda calor, repartido por igual, a todas las salidas del mapa.',run(R){
  const {inlets,outlets}=R.ctx;
  for(const t of inlets){
    if(!outlets.length)continue;
    const a=Math.min(t.c.st.transferHeat*UB(R,t.c).heatInletMaxTransferMultiplayer,t.heat);
    t.dump=[];
    for(const o of outlets){o.heat+=a/outlets.length;o.inHeat+=a/outlets.length;t.dump.push({to:o,amt:a/outlets.length})}
    t.heat-=a;
  }
 }},
 {id:'exch',name:'5. Intercambiadores',desc:'Cada intercambiador promedia el calor con sus 4 vecinos (se repite 6 veces).',run(R){
  const ex=R.ctx.exchangers,before=new Map();
  if(ex.length)for(const t of R.tiles)if(t.c&&t.c.maxHeat)before.set(t,t.heat);
  for(let r=0;r<6;r++){
    for(let i=0;i<ex.length;i++)balanceHeat(R,ex[i]);
    for(let i=ex.length-1;i>=0;i--)balanceHeat(R,ex[i]);
  }
  for(const [t,h] of before)t.delta=t.heat-h;
 }},
 {id:'power',name:'6. Energía, dinero e investigación',desc:'Los generadores convierten calor en energía, las oficinas venden, las celdas gastan vida útil.',run(R){
  const e=R.ctx.e;
  for(const t of R.tiles){
    if(!t.c)continue;const s=t.c.st;
    switch(s.type){
      case 'Cell':{
        if(t.life>0){
          if(s.powerProduction>0)e.powerMax+=powerProdOf(R,t.c);
          t.life--;
        }else if((isFree(R)||gres(t.c.id+'AutoRebuild'))&&R.auto&&canRestore(R,t,t.c)){
          const b=snapT(t);if(!isFree(R))addMoney(-t.c.price);setComp(R,t,t.c);void b}
        break}
      case 'PowerToMoneyConverter':
        e.maxPowerToMoney+=s.maxSellPower*UB(R,t.c).powerSellAmountMultiplayer*t.b.powerToMoneyMultiplayer;break;
      case 'HeatToPowerConverter':{
        const i=Math.min(t.heat,convAmount(R,t.c));
        e.powerMax+=i;e.heatToPower+=i;t.heat-=i;t.heatOut=i;
        if(s.waterEffectiveness){
          const a=Math.min(t.heat,t.water*s.waterEffectiveness);
          e.powerMax+=a;e.heatToPower+=a;t.heat-=a;t.heatOut+=a;
          t.wc=a/s.waterEffectiveness;t.water-=t.wc;
        }
        break}
      case 'MaxPowerIncrease':e.maxPowerBonus+=s.maxPowerIncrease*UB(R,t.c).maxPowerMultiplayer;break;
      case 'HeatAbsorber':t.heat*=1-s.loseHeat;break;
      case 'ResearchCenter':e.research+=s.researchProduction*UB(R,t.c).researchPointsProductionMultiplayer;break;
    }
  }
 }},
 {id:'boiler',name:'7. Calderas y almacenamiento',desc:'Las calderas venden el calor acumulado a su alrededor y se actualiza la energía almacenada.',run(R){
  const e=R.ctx.e;
  for(const t of R.tiles){
    if(!t.c||t.c.st.type!=='BulkHeatToMoneyConverter')continue;
    const ns=near(R,t,N4).filter(n=>n.c);
    let a=0;ns.forEach(n=>a+=n.heat);
    const o=t.c.st.convertHeatToMoney*UB(R,t.c).bulkHeatSellMultiplayer;
    if(a<o)continue;
    const k=(a-o)/a;ns.forEach(n=>n.heat*=k);
    e.money+=o;
  }
  R.tileBonus=e.maxPowerBonus;
  let p=R.power+e.powerMax;
  const toMoney=Math.min(e.maxPowerToMoney,p);
  p-=toMoney;
  if(p>getMaxPower(R))p=getMaxPower(R);
  R.power+=p-R.power;
  e.money+=toMoney;
  if(!isFree(R)){addMoney(e.money);G.rp+=e.research}
  R.last={powerMax:e.powerMax,money:e.money,research:e.research,heatToPower:e.heatToPower};
 }},
 {id:'overheat',name:'8. Sobrecalentamiento',desc:'Las piezas cuyo calor supera su máximo explotan.',run(R){
  let mr=0,hot=0;
  for(const t of R.tiles){
    if(!t.c||!t.c.maxHeat)continue;
    if(t.heat>maxHeat(R,t)){boom(R,t,'sobrecalentamiento');continue}
    const r=t.heat/maxHeat(R,t);if(r>mr)mr=r;if(r>=.85)hot++;
  }
  R.maxRatio=mr;R.hotCount=hot;
 }}
];
function tickReactor(R){for(const p of PHASES)p.run(R)}

function cellHeat(R,t){
  const s=t.c.st;
  if(!(s.heatProduction>0&&t.life>0))return;
  const total=t.heat+heatProdOf(R,t);
  const rec=near(R,t,patternFor(t.c)).filter(n=>n.c&&n.c.acceptsHeat);
  if(!rec.length){boom(R,t,'no tenía a dónde mandar el calor');return}
  t.dump=[];
  for(const n of rec){n.heat+=total/rec.length;n.inHeat+=total/rec.length;t.dump.push({to:n,amt:total/rec.length})}
  t.heatOut=total;
}
function balanceHeat(R,t){
  const e=near(R,t,N5).filter(x=>x.c&&(x.c.acceptsHeat||x.c.givesHeatOut));
  let a=0;e.forEach(x=>{if(x.c.givesHeatOut)a+=x.heat});
  const n=a/e.length;let i=0;const g=[];
  e.forEach(x=>{
    const c=x.c;
    if(c.givesHeatOut){if(!(!c.acceptsHeat&&n>x.heat)){i+=x.heat;g.push(x)}}
    else if(c.acceptsHeat)g.push(x);
  });
  const k=i/g.length;
  g.forEach(x=>{if(x.c.givesHeatOut)x.heat=k;else x.heat+=k});
}
function balanceWater(R,t){waterRound(R,near(R,t,N5).filter(x=>x.c&&x.c.acceptsWater),0)}
function waterRound(R,list,carry){
  let a=carry;list.forEach(x=>a+=x.water);
  let over=0;const un=[];const avg=a/list.length;
  list.forEach(x=>{let u=avg;const m=maxWater(R,x);if(u>m){over+=u-m;u=m}else un.push(x);x.water=u});
  if(un.length>0&&over>0)waterRound(R,un,over);
}
function gameTick(){
  for(const id in G.reactors){
    const R=G.reactors[id];
    if(R.meta.sandbox&&!R.bought)continue;
    tickReactor(R);
  }
  G.totalTicks++;
  pruneHistory();
  hooks.onTick();
}
/* paso a paso (modo cámara lenta): ejecuta UNA fase de UN reactor */
function stepPhase(R){
  const p=PHASES[R.stepIdx];p.run(R);
  R.stepIdx=(R.stepIdx+1)%PHASES.length;
  if(R.stepIdx===0){G.totalTicks++;pruneHistory();hooks.onTick()}
  return p;
}

/* ============================================================
   MODO SECO: simula sin tocar el juego real
   ============================================================ */
function cloneReactor(R){
  const C=Object.assign({},R);
  C.tiles=R.tiles.map(t=>Object.assign({},t,{dump:null}));
  C.expl=[];C.last={};C.ctx=null;C.stepIdx=0;
  return C;
}
function simulate(R,ticks,mod){
  const C=cloneReactor(R);
  if(mod)mod(C);
  const sv={m:G.money,tm:G.totalMoney,rp:G.rp,st:Object.assign({},G.stats)};
  C.dry={booms:[],tick:0};
  const power=[],money=[];
  try{
    for(let i=1;i<=ticks;i++){
      C.dry.tick=i;
      for(const p of PHASES)p.run(C);
      power.push(C.last.powerMax||0);money.push(C.last.money||0);
    }
  }finally{G.money=sv.m;G.totalMoney=sv.tm;G.rp=sv.rp;G.stats=sv.st}
  return {booms:C.dry.booms,power,money,tiles:C.tiles,maxRatio:C.maxRatio,
    avgPower:power.reduce((a,b)=>a+b,0)/Math.max(1,power.length),avgMoney:money.reduce((a,b)=>a+b,0)/Math.max(1,money.length)};
}
/* ¿qué pasaría si coloco `c` en `t`? */
function analyzePlacement(R,t,c,horizon,baseCache){
  const base=baseCache||simulate(R,horizon);
  const idx=t.y*R.meta.w+t.x;
  const withC=simulate(R,horizon,C=>{const q=C.tiles[idx];setComp(C,q,c)});
  const key=b=>b.x+','+b.y;
  const baseSet=new Set(base.booms.map(key));
  const extra=withC.booms.filter(b=>!baseSet.has(key(b)));
  const self=withC.booms.find(b=>b.x===t.x&&b.y===t.y);
  return {self,extra,dPower:withC.avgPower-base.avgPower,dMoney:withC.avgMoney-base.avgMoney,withC,base};
}
