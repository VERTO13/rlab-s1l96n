'use strict';
/* ============================================================
   EVENTOS ALEATORIOS (idea propia, no existe en el juego original)
   Reglas de balance:
   · uno cada 4-8 min de juego; el contador no avanza mientras gastas ticks extra
   · mezcla 40 % favorables / 30 % decisiones / 30 % adversos; jamás dos adversos seguidos
   · premios y castigos son múltiplos de TU ingreso medio por tick (G.emaInc), así escalan con el progreso
   · los adversos avisan 10 s antes; los que tocan calor/agua solo salen si una simulación confirma que no explotaría nada
   · la duración se mide en ticks = segundos × ticks por segundo, para que valgan lo mismo con el Cronómetro
   ============================================================ */
const EVCFG={mode:'all',tps:()=>1,rand:Math.random,fast:false,onEvent(){}};
G.ev={next:null,active:[],warn:null,offer:null,lastAdv:false,log:[]};
const evRnd=(a,b)=>a+EVCFG.rand()*(b-a);
const evTk=s=>Math.max(1,Math.round(s*EVCFG.tps()));
const realR=()=>Object.values(G.reactors).filter(R=>!R.meta.sandbox);
const hasTile=f=>realR().some(R=>R.tiles.some(t=>t.c&&f(t)));
const hasCells=()=>hasTile(t=>t.c.st.type==='Cell'&&t.life>0);
const hotRatio=()=>Math.max(0,...realR().map(R=>R.maxRatio||0));
const NEUTRAL=()=>({sell:1,conv:1,water:1,price:1,cellPower:1,cellHeat:1,wear:1,noFast:false,upId:null,upMult:1});
function applyEffects(){
  Object.assign(EVX,NEUTRAL());
  for(const e of G.ev.active)if(e.def.fx)e.def.fx(EVX,e);
}
const evMoney=x=>'$'+nf(Math.round(x));

/* simula tus reactores con el efecto aplicado: ¿explotaría algo que antes no explotaba? */
function evSafe(def){
  const rs=realR().filter(R=>R.tiles.some(t=>t.c&&t.c.maxHeat));
  if(!rs.length||!def.fx)return true;
  const ticks=Math.max(20,Math.min(90,Math.round(def.secs*EVCFG.tps())));
  const base=rs.map(R=>simulate(R,ticks).booms.length);
  const keep=Object.assign({},EVX);
  let ok=true;
  try{def.fx(EVX,{data:{}});rs.forEach((R,i)=>{if(ok&&simulate(R,ticks).booms.length>base[i])ok=false})}
  finally{Object.assign(EVX,keep)}
  return ok;
}
/* estimación honesta para decisiones de producción: simula con y sin efecto, y resta el desgaste extra de las celdas */
function evEstimate(def){
  const rs=realR().filter(R=>R.tiles.some(t=>t.c));
  const total=Math.round(def.secs*EVCFG.tps()),ticks=Math.max(20,Math.min(90,total));
  const sum=()=>rs.reduce((a,R)=>a+simulate(R,ticks).avgMoney,0);
  const base=sum(),keep=Object.assign({},EVX);let withE;
  try{def.fx(EVX,{data:{}});withE=sum()}finally{Object.assign(EVX,keep)}
  let perLife=0;
  for(const R of rs)for(const t of R.tiles)if(t.c&&t.c.st.type==='Cell'&&t.life>0&&t.node!=='geo'){const ml=maxLife(R,t);if(ml>0)perLife+=t.c.price/ml}
  const gain=(withE-base)*total,cost=perLife*Math.max(0,def.wearMult-1)*total;
  return {gain,cost,net:gain-cost};
}
function pickUpgrade(){
  const c=[];
  for(const R of realR())for(const u of UPS){
    if(u.req&&!gres(u.req))continue;
    const lv=R.ups[u.id]||0;if(u.max&&lv>=u.max)continue;
    const p=u.price*Math.pow(u.inc,lv);
    if(p*.65<=G.money&&p>=G.money*.02&&p<=150*evTk(1)*G.emaInc)c.push({id:u.id,name:u.name,price:p});
  }
  return c.length?c[Math.floor(EVCFG.rand()*c.length)]:null;
}

/* kind: fav = ocurre solo · dec = decides tú · adv = avisa y ocurre
   secs = duración · fx = efecto sobre EVX · ok = condición para poder salir */
const EVDEFS=[
 {id:'demand',kind:'fav',icon:'📈',name:'Pico de demanda',secs:60,
  desc:()=>'Todo lo que vendes (energía y calor) vale <b>1,5×</b> durante 60 s.',fx:x=>{x.sell*=1.5},group:'sell',ok:()=>G.emaInc>0},
 {id:'investor',kind:'fav',icon:'💼',name:'Inversor visitante',instant:true,
  run:()=>{const v=45*evTk(1)*G.emaInc;addMoney(v);return 'Recibes <b>'+evMoney(v)+'</b> (45 s de producción).'},ok:()=>G.emaInc>0},
 {id:'subsidy',kind:'fav',icon:'🏷️',name:'Subvención',secs:90,group:'price',
  desc:()=>'Todo lo que compras cuesta <b>25 % menos</b> durante 90 s.',fx:x=>{x.price*=.75},ok:()=>G.money>50},
 {id:'fuel',kind:'fav',icon:'⛽',name:'Combustible de calidad',secs:60,group:'cell',
  desc:()=>'Tus celdas dan <b>30 % más de calor y de energía directa</b> durante 60 s (sin gastar más vida útil).',fx:x=>{x.cellHeat*=1.3;x.cellPower*=1.3},
  ok:()=>hasCells()&&G.emaInc>0},
 {id:'grant',kind:'fav',icon:'🔬',name:'Beca de investigación',instant:true,
  run:()=>{const v=60*evTk(1)*G.emaRp;G.rp+=v;return 'Recibes <b>'+nf(Math.round(v))+'</b> puntos de investigación.'},ok:()=>G.emaRp>0},
 {id:'chrono',kind:'fav',icon:'⏱️',name:'Cuerda del cronómetro',instant:true,
  run:()=>{const cap=TICKS_MAXBONUS*EVCFG.tps(),a=Math.max(0,Math.min(45,cap-G.bonusTicks));G.bonusTicks+=a;return 'Recibes <b>'+nf(a)+'</b> ticks extra.'},
  ok:()=>G.bonusTicks<TICKS_MAXBONUS*EVCFG.tps()-45},
 {id:'flash',kind:'fav',icon:'⚡',name:'Oferta relámpago',secs:40,
  prep:()=>{const u=pickUpgrade();return u&&{up:u.id,name:u.name,price:u.price}},
  desc:e=>'La mejora <b>'+e.data.name+'</b> cuesta <b>35 % menos</b> durante 40 s.',fx:(x,e)=>{if(e.data&&e.data.up){x.upId=e.data.up;x.upMult=.65}},
  ok:()=>!!pickUpgrade()},
 {id:'overload',kind:'dec',icon:'🔥',name:'Sobrecarga voluntaria',secs:60,wearMult:1.4,
  offer:()=>({est:evEstimate(EVBY.overload)}),
  desc:(e,d)=>'Tus celdas dan <b>+50 % de energía directa y de calor</b>, pero se <b>gastan 40 % más rápido</b>, durante 60 s.'+(d&&d.est?' <span class="small">Estimado con tu reactor actual: ganas <b>'+evMoney(d.est.gain)+'</b>, el desgaste cuesta <b>'+evMoney(d.est.cost)+'</b> → neto <b>+'+evMoney(d.est.net)+'</b>.</span>':''),
  fx:x=>{x.cellPower*=1.5;x.cellHeat*=1.5;x.wear*=1.4},group:'cell',ok:()=>hasCells()&&G.emaInc>0},
 {id:'contract',kind:'dec',icon:'📜',name:'Contrato urgente',secs:120,
  offer:()=>{const t=Math.round(1.05*G.emaInc*evTk(120));return {target:t,reward:Math.round(.35*t)}},
  desc:(e,d)=>'Gana <b>'+evMoney(d.target)+'</b> con tus ventas en 120 s. Premio: <b>'+evMoney(d.reward)+'</b>. Si no llegas, no pierdes nada.',
  start:e=>{e.data.start=G.earned},
  end:e=>{if(G.earned-e.data.start>=e.data.target){addMoney(e.data.reward);return 'Contrato cumplido: <b>+'+evMoney(e.data.reward)+'</b>.'}return 'Contrato incumplido, sin penalización.'},
  progress:e=>Math.min(1,(G.earned-e.data.start)/e.data.target),
  ok:()=>G.emaInc*evTk(120)>=60},
 {id:'bet',kind:'dec',icon:'🎲',name:'Apuesta del mercado',instant:true,
  offer:()=>({stake:Math.max(10,Math.floor(Math.min(.1*G.money,60*G.emaInc*evTk(1)))) }),
  desc:(e,d)=>'Arriesgas <b>'+evMoney(d.stake)+'</b>: 50 % de ganar <b>'+evMoney(1.4*d.stake)+'</b>, 50 % de perderlo.',
  run:(d)=>{if(EVCFG.rand()<.5){addMoney(1.4*d.stake);return '🎉 Ganaste <b>'+evMoney(1.4*d.stake)+'</b>.'}addMoney(-d.stake,false);return 'Perdiste '+evMoney(d.stake)+'.'},
  ok:()=>G.money>=200&&G.emaInc>0},
 {id:'inspection',kind:'dec',icon:'🕵️',name:'Inspección',secs:60,
  offer:()=>({win:Math.round(30*G.emaInc*evTk(1)),lose:Math.round(40*G.emaInc*evTk(1))}),
  desc:(e,d)=>'Mantén todas tus piezas por <b>debajo del 70 % de su calor máximo</b> durante 60 s. Premio: <b>'+evMoney(d.win)+'</b>. Si fallas, multa de <b>'+evMoney(d.lose)+'</b>.',
  tick:e=>{if(hotRatio()>=.7){addMoney(-e.data.lose,false);EVCFG.onEvent('msg',e.def,'Inspección fallida: multa de <b>'+evMoney(e.data.lose)+'</b>.');return true}return false},
  end:e=>{addMoney(e.data.win);return 'Inspección superada: <b>+'+evMoney(e.data.win)+'</b>.'},
  ok:()=>hasCells()&&G.emaInc>0&&hotRatio()<.6},
 {id:'maintenance',kind:'adv',icon:'🔧',name:'Desgaste imprevisto',instant:true,
  run:()=>{for(const R of realR())for(const t of R.tiles)if(t.c&&t.c.st.type==='Cell'&&t.life>0&&t.node!=='geo'){const ml=maxLife(R,t);t.life=Math.max(0,t.life-.05*ml)}
    return 'Tus celdas pierden un <b>5 % de su vida útil</b>.'},
  ok:()=>hasCells()},
 {id:'blackout',kind:'adv',icon:'🔌',name:'Apagón de red',secs:60,group:'sell',
  desc:()=>'Todo lo que vendes vale un <b>30 % menos</b> durante 60 s.',fx:x=>{x.sell*=.7},ok:()=>G.emaInc>0},
 {id:'inflation',kind:'adv',icon:'💸',name:'Inflación pasajera',secs:60,group:'price',
  desc:()=>'Todo lo que compras cuesta <b>20 % más</b> durante 60 s.',fx:x=>{x.price*=1.2},ok:()=>G.money>50},
 {id:'comms',kind:'adv',icon:'📡',name:'Falla de comunicación',secs:30,
  desc:()=>'No puedes usar el botón <b>Rápido</b> durante 30 s (no pierdes ticks extra).',fx:x=>{x.noFast=true},ok:()=>G.bonusTicks>50}
];
const EVBY={};EVDEFS.forEach(d=>EVBY[d.id]=d);
const KIND_W={fav:.4,dec:.3,adv:.3};

function evEligible(d,skipSafe){
  const E=G.ev;
  if(d.group&&E.active.some(e=>e.def.group===d.group))return false;
  if(E.active.some(e=>e.def.id===d.id)||(E.offer&&E.offer.id===d.id)||(E.warn&&E.warn.id===d.id))return false;
  if(d.kind==='adv'&&(E.lastAdv||E.warn||E.active.some(e=>e.def.kind==='adv')))return false;
  if(d.ok&&!d.ok())return false;
  if(!skipSafe&&(d.id==='overload'||d.id==='fuel')&&!evSafe(d))return false;
  if(!skipSafe&&d.id==='overload'&&evEstimate(d).net<=0)return false;   // nunca se ofrece una «sobrecarga» que te haría perder dinero
  return true;
}
function evNotify(type,def,extra){
  const L=G.ev.log;L.push({t:G.totalTicks,type,id:def.id});if(L.length>30)L.shift();
  EVCFG.onEvent(type,def,extra);
}
function evStart(def,data){
  const E=G.ev;
  if(def.instant){const msg=def.run(data);evNotify('instant',def,msg);return}
  const e={def,id:def.id,left:evTk(def.secs),total:evTk(def.secs),data:data||{}};
  if(def.prep&&!data){e.data=def.prep();if(!e.data)return}
  if(def.start)def.start(e);
  E.active.push(e);applyEffects();
  evNotify('start',def,e);
}
function evSpawn(){
  const E=G.ev,mode=EVCFG.mode;
  const kinds=['fav','dec'].concat(mode==='all'?['adv']:[]);
  const el={};
  for(const k of kinds){const l=EVDEFS.filter(d=>d.kind===k&&evEligible(d));if(l.length)el[k]=l}
  const ks=Object.keys(el);
  if(!ks.length){E.next=evTk(15);return null}
  let tot=0;ks.forEach(k=>tot+=KIND_W[k]);let r=EVCFG.rand()*tot,kind=ks[ks.length-1];
  for(const k of ks){r-=KIND_W[k];if(r<=0){kind=k;break}}
  const d=el[kind][Math.floor(EVCFG.rand()*el[kind].length)];
  E.lastAdv=kind==='adv';
  E.next=evTk(evRnd(240,480));
  if(kind==='adv'){E.warn={id:d.id,left:evTk(10),total:evTk(10)};evNotify('warn',d)}
  else if(kind==='dec'){E.offer={id:d.id,left:evTk(30),total:evTk(30),data:d.offer?d.offer():{}};evNotify('offer',d,E.offer)}
  else evStart(d);
  return d;
}
function evAnswer(accept){
  const E=G.ev,o=E.offer;if(!o)return;
  E.offer=null;const d=EVBY[o.id];
  if(!accept){evNotify('decline',d);return}
  if(d.instant){evNotify('instant',d,d.run(o.data))}else evStart(d,o.data);
}
function evTick(){
  const E=G.ev;let changed=false;
  for(let i=E.active.length-1;i>=0;i--){
    const e=E.active[i];
    if(e.def.tick&&e.def.tick(e)){E.active.splice(i,1);changed=true;continue}
    if(--e.left<=0){
      const msg=e.def.end?e.def.end(e):null;
      E.active.splice(i,1);changed=true;evNotify('end',e.def,msg);
    }
  }
  if(changed)applyEffects();
  if(E.offer&&--E.offer.left<=0){const d=EVBY[E.offer.id];E.offer=null;evNotify('expire',d)}
  if(E.warn&&--E.warn.left<=0){
    const d=EVBY[E.warn.id];E.warn=null;
    // al terminar el aviso se vuelve a comprobar que siga siendo seguro (no usa la regla «no dos adversos»: ya es este)
    if((!d.group||!E.active.some(e=>e.def.group===d.group))&&(!d.ok||d.ok())&&evSafe(d))evStart(d);else evNotify('skip',d);
  }
  if(EVCFG.mode==='off'||EVCFG.fast||G.totalTicks<300||!(G.emaInc>0))return;
  if(E.next==null)E.next=evTk(evRnd(180,300));
  if(E.next>0)E.next--;
  else if(!E.offer&&!E.warn)evSpawn();
}
function evReset(next){G.ev.active=[];G.ev.warn=null;G.ev.offer=null;if(next!==undefined)G.ev.next=next;applyEffects()}
