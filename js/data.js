'use strict';
/* ============================================================
   DATOS  (valores tomados del juego original)
   ============================================================ */
const SUF=['','K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc','Ud','Dd','Td'];
function nf(v){
  if(!isFinite(v))return '∞';
  const neg=v<0;v=Math.abs(v);
  // máximo 2 decimales (y menos cuanto más grande el número); lo que redondea a 0 se muestra como 0
  if(v<1000)return (neg?'-':'')+(v<100?String(+v.toFixed(2)):String(+v.toFixed(1)));
  let i=0;while(v>=1000&&i<SUF.length-1){v/=1000;i++}
  return (neg?'-':'')+(+v.toFixed(2))+' '+SUF[i];
}
const TERR={' ':'grass',s:'sand',w:'water','.':'mountain'};
const PAT_S={1:[[-1,0],[0,-1],[1,0],[0,1]]};
PAT_S[2]=PAT_S[1].concat([[-1,-1],[-1,1],[1,1],[1,-1],[-2,0],[0,-2],[2,0],[0,2]]);
PAT_S[3]=PAT_S[2].concat([[-3,0],[0,-3],[3,0],[0,3],[-2,1],[-1,2],[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1]]);
const PAT_D={};for(let k=1;k<=4;k++){PAT_D[k]=[];for(let i=1;i<=k;i++)PAT_D[k].push([-i,i],[i,i],[i,-i],[-i,-i])}
const N4=[[-1,0],[0,-1],[1,0],[0,1]];
const N5=[[0,0],[-1,0],[0,-1],[1,0],[0,1]];

const REACTORS=[
 {id:'mini',name:'Isla',price:0,maxPower:50,w:22,h:15,rows:[
"wwwwwwwwwwwwwwwwwwwwww","wwww wwwwwwwwwwwwwwwww","www  wwwwwwwwwwwwwwwww","wwwwwwwwwwwwwwwwwwwwww","wwwwwwwww.  wwwwwwwwww","wwwwwww       wwwwwwww","wwwwwwww    wwwwwwwwww","wwwwwww    wwwwwwwwwww","wwwwwww   www   wwwwww","wwwwwww. www  w.wwwwww","wwwwwwwwwwwwwwwwwwwwww","wwww.wwwwwwwww wwwwwww","wwwwww.wwwwww.   ww ww","wwwwwwwwwwwwww. wwwwww","wwwwwwwwwwwwwwwwwwwwww"]},
 {id:'medium',name:'Aldea',price:1e6,maxPower:100,w:22,h:15,rows:[
"               wwwwwww","              wwwwwwww"," www    .ww   wwwwwwww","wwww     .ww   wwwwwww","ww.www     ww    wwwww","wwwwww     .w    .wwww","wwwwwwww        wwwwww","wwwwwwwww      wwwwwww","wwwwwwwwww   .www  www","wwwwwwwwwww www.  wwww","wwwwwwwwwwwwwwwwwwwwww","wwwwwwwwwwww  .wwwwwww","wwwwwwwww.    wwwwwwww","wwwwwwwwwwww wwwwwwwww","wwwwwwwwwwwwwwwwwwwwww"]},
 {id:'big',name:'Región',price:1e11,maxPower:100,w:22,h:16,rows:[
"wwwwwwwwwwwwwwwwwwwwww","wwwwwwwwwwww.wwww.wwww","www wwwwww   .wwwwwwww","wwwwwwwwwwwwwwwwwwwwww","wwwwwwwwwwwwwwwwwwwwww","wwwwwww. w  wwwwwwwwww","wwwww      ww.www w   ","wwww           w    . ","www                   ","wwww               .  ","ww                    ","wwwwwww.              ","wwwwwwwwww            ","wwwwwwwwwwwww         ","wwwwwwwwwwww.         ","wwwwwwwwwwwww         "]},
 {id:'huge',name:'Ciudad',price:1e14,maxPower:100,w:22,h:16,rows:[
"            . wwwwwwww","           .     wwwww","                   www","              .   wwww","                   .ww","                  wwww","                 wwwww","                  wwww","                  wwww","                  wwww","                    ww","                   www","                  wwww","     .             .ww","                  wwww"," .        . .   wwwwww"]},
 {id:'challenge1',name:'Reto: 1 celda de calor',price:1e15,maxPower:100,w:21,h:17,heatCellsAllowed:1,researchComponentsDisabled:true,rows:'wwwwwwwwwwwwwwwwwwwww|'+('w                   w|'.repeat(15))+'wwwwwwwwwwwwwwwwwwwww'},
 {id:'metropolis',name:'Metrópolis',price:5e16,maxPower:100,w:23,h:17,rows:[
"w         www         w","                       ","                       ","                       ","                       ","                       ","w                     w","w                     w","w                     w","                       ","                       ","                       ","                       ","                       ","                       ","                       ","w         www         w"]},
 {id:'challenge2',name:'Reto: 4 celdas de calor',price:125e16,maxPower:100,w:21,h:17,heatCellsAllowed:4,researchComponentsDisabled:true,rows:'wwwwwwwwwwwwwwwwwwwww|'+('w                   w|'.repeat(15))+'wwwwwwwwwwwwwwwwwwwww'},
 {id:'mainland',name:'Tierra firme',price:3e19,maxPower:100,w:25,h:21,rows:'wwwwwwwwwwwwwwwwwwwwwwwww|ww                     ww|'+('w                       w|'.repeat(16))+'ww                     ww|wwwwwwwwwwwwwwwwwwwwwwwww|'},
 {id:'challenge3',name:'Reto: 8 celdas de calor',price:75e19,maxPower:100,w:21,h:17,heatCellsAllowed:8,researchComponentsDisabled:true,rows:'wwwwwwwwwwwwwwwwwwwww|'+('w                   w|'.repeat(15))+'wwwwwwwwwwwwwwwwwwwww'},
 {id:'continent',name:'Continente',price:21e21,maxPower:100,w:25,h:21,rows:'wwwwwwwwwwwwwwwwwwwwwwwww|'+('                         |'.repeat(18))+'wwwwwwwwwwwwwwwwwwwwwwwww|'},
 // Extra (no existe en el original): reactor de pruebas con todo desbloqueado y dinero infinito
 {id:'lab',name:'Laboratorio',price:0,maxPower:1e18,w:25,h:21,sandbox:true,rows:'wwwwwwwwwwwwwwwwwwwwwwwww|'+('w                       w|'.repeat(19))+'wwwwwwwwwwwwwwwwwwwwwwwww'}
];
REACTORS.forEach(r=>{
  if(typeof r.rows==='string')r.rows=r.rows.split('|');
  r.layout=r.rows.join('');          // las filas que faltan al final cuentan como agua
});

const C=(o)=>o;
const COMPS=[
 C({id:'windTurbine',name:'Turbina eólica',icon:'🌬️',col:'#4a6a8a',desc:'Produce energía',group:'a',price:1,lifetime:10,refund:0,st:{type:'Cell',powerProduction:.15}}),
 C({id:'solarCell',name:'Celda solar',icon:'☀️',col:'#8a6a20',desc:'Produce calor',group:'a',price:200,lifetime:100,refund:0,req:'solarCell',st:{type:'Cell',heatProduction:3}}),
 C({id:'coalBurner',name:'Quemador de carbón',icon:'⚫',col:'#4a4a4a',desc:'Produce calor',group:'a',price:1e5,lifetime:400,refund:0,req:'coalBurner',st:{type:'Cell',heatProduction:380}}),
 C({id:'gasBurner',name:'Quemador de gas',icon:'🔥',col:'#8a4a20',desc:'Produce calor',group:'a',price:4e7,lifetime:800,refund:0,req:'gasBurner',st:{type:'Cell',heatProduction:75e3}}),
 C({id:'nuclearCell',name:'Celda nuclear',icon:'☢️',col:'#2f7a2f',desc:'Produce calor',group:'a',price:5e8,lifetime:800,refund:0,req:'nuclearCell',st:{type:'Cell',heatProduction:12e5}}),
 C({id:'nuclearCell2',name:'Celda termonuclear',icon:'☣️',col:'#7a2f6a',desc:'Produce calor',group:'a',price:2e10,lifetime:800,refund:0,req:'nuclearCell2',st:{type:'Cell',heatProduction:5e7}}),
 C({id:'nuclearCell3',name:'Celda de fusión',icon:'🌞',col:'#8a2a2a',desc:'Produce calor.',group:'a',price:8e11,lifetime:800,refund:0,req:'nuclearCell3',st:{type:'Cell',heatProduction:25e8}}),
 C({id:'nuclearCell4',name:'Celda de torio',icon:'🟣',col:'#5a3a8a',desc:'Produce calor y lo reparte hasta 2 casillas de distancia.',group:'a',price:72e12,lifetime:800,refund:0,req:'nuclearCell4',st:{type:'Cell',heatProduction:15e10,distributeSize:2}}),
 C({id:'nuclearCell5',name:'Celda de protactinio',icon:'🔵',col:'#2a4a9a',desc:'Produce calor y lo reparte hasta 2 casillas de distancia.',group:'a',price:504e13,lifetime:800,refund:0,req:'nuclearCell5',st:{type:'Cell',heatProduction:9e12,distributeSize:2}}),
 C({id:'nuclearCell6',name:'Celda de curio',icon:'🟢',col:'#1a7a5a',desc:'Produce calor y lo reparte hasta 3 casillas de distancia.',group:'a',price:3024e14,lifetime:800,refund:0,req:'nuclearCell6',st:{type:'Cell',heatProduction:63e13,distributeSize:3}}),
 C({id:'nuclearCell7',name:'Celda de balduranio',icon:'💎',col:'#2a8a9a',desc:'Produce calor y lo reparte en diagonal hasta 3 casillas.',group:'a',price:1512e16,lifetime:800,refund:0,req:'nuclearCell7',st:{type:'Cell',heatProduction:315e14,distributeSize:3,distributeType:'diagonal'}}),
 C({id:'generator',name:'Generador',icon:'⚡',n:'1',col:'#7a5a20',desc:'Convierte calor en energía',type:'generator',group:'b',price:500,maxHeat:25,refund:1,acceptsWater:false,acceptsHeat:true,givesHeatOut:true,req:'solarCell',st:{type:'HeatToPowerConverter',convertHeatToPower:3,waterEffectiveness:0}}),
 C({id:'generator2',name:'Generador 2',icon:'⚡',n:'2',col:'#6a6e7e',desc:'Convierte calor en energía',type:'generator',group:'b',price:25e5,maxHeat:150,maxWater:5e3,refund:1,acceptsWater:true,acceptsHeat:true,givesHeatOut:true,req:'gasBurner',st:{type:'HeatToPowerConverter',convertHeatToPower:9,waterEffectiveness:100}}),
 C({id:'generator3',name:'Generador 3',icon:'⚡',n:'3',col:'#8a7a20',desc:'Convierte calor en energía.',type:'generator',group:'b',price:1e13,maxHeat:900,maxWater:8e3,refund:1,acceptsWater:true,acceptsHeat:true,givesHeatOut:true,req:'generator3',st:{type:'HeatToPowerConverter',convertHeatToPower:32,waterEffectiveness:200}}),
 C({id:'generator4',name:'Generador 4',icon:'⚡',n:'4',col:'#1f6a7a',desc:'Convierte calor en energía.',type:'generator',group:'b',price:5e16,maxHeat:2200,maxWater:22e3,refund:1,acceptsWater:true,acceptsHeat:true,givesHeatOut:true,req:'generator4',st:{type:'HeatToPowerConverter',convertHeatToPower:96,waterEffectiveness:400}}),
 C({id:'generator5',name:'Generador 5',icon:'⚡',n:'5',col:'#6a2a8a',desc:'Convierte calor en energía.',type:'generator',group:'b',price:125e17,maxHeat:4400,maxWater:44e3,refund:1,acceptsWater:true,acceptsHeat:true,givesHeatOut:true,req:'generator5',st:{type:'HeatToPowerConverter',convertHeatToPower:288,waterEffectiveness:1200}}),
 C({id:'heatExchanger',name:'Intercambiador de calor',icon:'🔁',col:'#8a5a2a',desc:'Intenta equilibrar el calor entre los componentes adyacentes',group:'b2',price:15e5,maxHeat:15e3,refund:1,acceptsHeat:true,givesHeatOut:true,req:'heatExchanger',st:{type:'HeatExchanger'}}),
 C({id:'heatInlet',name:'Entrada de calor',icon:'⏬',col:'#8a2a2a',type:'heatInletOutletElement',desc:'Absorbe calor y lo reparte por igual entre todas las salidas de calor.',group:'b2',price:25e13,maxHeat:55e9,refund:1,acceptsHeat:true,givesHeatOut:false,req:'undergroundHeatPipes',st:{type:'HeatInlet',transferHeat:38e9}}),
 C({id:'heatOutlet',name:'Salida de calor',icon:'⏫',col:'#2a5a8a',type:'heatInletOutletElement',desc:'Solo recibe calor de las entradas. Un intercambiador debe sacarlo.',group:'b2',price:15e13,maxHeat:55e9,refund:1,acceptsHeat:false,givesHeatOut:true,req:'undergroundHeatPipes',st:{type:'HeatOutlet'}}),
 C({id:'isolation',name:'Aislamiento',icon:'🧱',col:'#6a5a4a',desc:'Aumenta el calor de las celdas productoras adyacentes',group:'c',price:1e3,refund:1,req:'isolation',st:{type:'CellHeatProductionAmplifier',heatProductionBonus:.05}}),
 C({id:'heatBattery',name:'Disipador de calor',icon:'🧊',col:'#2a5a6a',desc:'Absorbe calor. No lo devuelve y pierde parte cada tick.',group:'c',price:25e5,maxHeat:1e7,refund:1,acceptsHeat:true,givesHeatOut:false,req:'heatBattery',st:{type:'HeatAbsorber',loseHeat:.05}}),
 C({id:'boilerHouse',name:'Caldera',icon:'♨️',col:'#6a3a2a',desc:'Vende calor en bloque. Explota si recibe calor directo de una celda.',group:'c',price:15e6,maxHeat:2e3,refund:1,acceptsHeat:true,givesHeatOut:true,req:'boilerHouse',st:{type:'BulkHeatToMoneyConverter',convertHeatToMoney:18e3}}),
 C({id:'battery',name:'Batería',icon:'🔋',col:'#3a6a3a',desc:'Aumenta la energía máxima que puedes almacenar',group:'cc',price:50,refund:1,req:'battery',st:{type:'MaxPowerIncrease',maxPowerIncrease:100}}),
 C({id:'waterPump',name:'Bomba de agua',icon:'🚰',col:'#2a5a9a',type:'waterElement',desc:'Enfría generadores para que produzcan mucha más energía. Debe estar junto al agua.',group:'ee',price:5e9,maxWater:15e4,refund:1,onlyNextToWater:true,acceptsWater:true,acceptsHeat:false,givesHeatOut:false,req:'waterPump',st:{type:'WaterPump',waterProduction:25e3,balancesWater:true}}),
 C({id:'groundwaterPump',name:'Bomba subterránea',icon:'⛲',col:'#2a4a7a',type:'waterElement',desc:'Bombea agua subterránea. Necesita tuberías para repartirla.',group:'ee',price:4e10,maxWater:25e4,refund:1,onlyNextToWater:false,acceptsWater:true,acceptsHeat:false,givesHeatOut:false,req:'groundwaterPump',st:{type:'WaterPump',waterProduction:67500,balancesWater:false}}),
 C({id:'waterPipe',name:'Tubería de agua',icon:'🔹',col:'#2a6a8a',type:'waterElement',desc:'Amplía el área efectiva de las bombas de agua.',group:'ee',price:15e8,maxWater:1e5,refund:1,acceptsWater:true,acceptsHeat:false,givesHeatOut:false,req:'waterPipe',st:{type:'WaterExchanger'}}),
 C({id:'circulator',name:'Circulador',icon:'🔄',col:'#2a7a7a',desc:'Mueve el agua más rápido por los generadores, aumentando su agua máxima.',group:'ee',price:25e16,refund:1,req:'circulator',st:{type:'Circulator',maxWaterBonus:.9}}),
 C({id:'office',name:'Oficina en casa',icon:'🏠',col:'#6a5a2a',type:'office',desc:'Vende una pequeña cantidad de energía automáticamente.',group:'d',price:50,maxHeat:10,refund:1,acceptsHeat:true,givesHeatOut:true,req:'office',st:{type:'PowerToMoneyConverter',maxSellPower:5}}),
 C({id:'office2',name:'Oficina pequeña',icon:'🏢',col:'#2a5a6a',type:'office',desc:'Vende energía',group:'d',price:1e5,maxHeat:10,refund:1,acceptsHeat:true,givesHeatOut:true,req:'office2',st:{type:'PowerToMoneyConverter',maxSellPower:100}}),
 C({id:'office3',name:'Oficina mediana',icon:'🏬',col:'#3a6a3a',type:'office',desc:'Vende energía',group:'d',price:5e8,maxHeat:10,refund:1,acceptsHeat:true,givesHeatOut:true,req:'office3',st:{type:'PowerToMoneyConverter',maxSellPower:2500}}),
 C({id:'office4',name:'Oficina grande',icon:'🏭',col:'#6a3a5a',type:'office',desc:'Vende energía',group:'d',price:1e10,maxHeat:10,refund:1,acceptsHeat:true,givesHeatOut:true,req:'office4',st:{type:'PowerToMoneyConverter',maxSellPower:6e4}}),
 C({id:'office5',name:'Oficina enorme',icon:'🌆',col:'#4a3a8a',type:'office',desc:'Vende energía',group:'d',price:1e15,maxHeat:10,refund:1,acceptsHeat:true,givesHeatOut:true,req:'office5',st:{type:'PowerToMoneyConverter',maxSellPower:9e5}}),
 C({id:'bank',name:'Banco',icon:'🏦',col:'#7a6a2a',desc:'Potencia las ventas de las oficinas',group:'d',price:4e12,maxHeat:1,refund:1,acceptsHeat:true,givesHeatOut:true,req:'bank2',st:{type:'Bank',sellAmountBonus:1.5}}),
 C({id:'researchCenter',name:'Centro de investigación',icon:'🔬',col:'#2a6a7a',type:'researchCenter',desc:'Da puntos de investigación para desbloquear nuevas tecnologías',group:'e',price:100,maxHeat:1,refund:1,acceptsHeat:true,givesHeatOut:true,req:'researchCenter',st:{type:'ResearchCenter',researchProduction:1}}),
 C({id:'researchCenter2',name:'Centro de investigación avanzado',icon:'🧪',col:'#2a7a4a',type:'researchCenter',desc:'Da puntos de investigación para desbloquear nuevas tecnologías',group:'e',price:1e7,maxHeat:100,refund:1,acceptsHeat:true,givesHeatOut:true,req:'researchCenter2',st:{type:'ResearchCenter',researchProduction:8}}),
 C({id:'researchCenter3',name:'Súper centro de investigación',icon:'🧬',col:'#7a2a6a',type:'researchCenter',desc:'Da puntos de investigación para desbloquear nuevas tecnologías',group:'e',price:504e13,maxHeat:100,refund:1,acceptsHeat:true,givesHeatOut:true,req:'researchCenter3',st:{type:'ResearchCenter',researchProduction:40}})
];
const CBY={},CTYPE={};
COMPS.forEach(c=>{CBY[c.id]=c;(CTYPE[c.type]=CTYPE[c.type]||[]).push(c)});

/* ---- Mejoras ---- */
const UPS=[];
const U=(id,name,group,price,inc,req,type,target,mult,extra)=>UPS.push(Object.assign({id,name,group,price,inc,req,bonus:{type,mult},target},extra||{}));
U('officeSellPower','Venta de oficinas','1',1e3,10,'office','powerSellAmount',{ctype:'office'},2);
U('bankEffectiveness','Efectividad del banco','1',1e13,4,'bank2','powerToMoneyAmountBonusMultiplayer',{cid:'bank'},1.25);
U('researchCenterAmount','Centros de investigación','1',25e3,1.78,'researchCenter','researchPointsProduction',{ctype:'researchCenter'},1.25);
U('boilerHouseSellAmount','Venta de la caldera','1',5e7,2.8,'boilerHouse','heatSellAmount',{cid:'boilerHouse'},1.4);
/* --- Extra (no existe en el original): recuperar más valor al vender --- */
U('cellRecycling','Reciclaje de celdas','1',5e3,4,'solarCell','refundCells',{cat:'cell'},.05,{sell:1,method:'sum',max:8,abs:true});
U('coolBeforeSale','Enfriado previo a la venta','1',1e4,3.5,'solarCell','refundHeat',{cat:'heat'},.2,{sell:1,method:'sum',max:5,abs:true});
U('generatorMaxHeat','Calor máx. de generadores','d',1e3,3.7,'solarCell','maxHeatMultiplayer',{ctype:'generator'},2);
U('generatorConvertPower','Eficiencia de generadores','d',400,1.5,'solarCell','heatToPower',{ctype:'generator'},1.25);
U('heatExchangerMaxHeat','Calor máx. de intercambiadores','d',2e6,2.6,'heatExchanger','maxHeatMultiplayer',{cid:'heatExchanger'},2);
U('heatBatteryMaxHeat','Calor máx. de disipadores','d',2e7,4,'heatBattery','maxHeatMultiplayer',{cid:'heatBattery'},2,{sell:1});
U('battery','Tamaño de baterías','d',300,2,'battery','maxPower',{cid:'battery'},2);
U('isolationEffectiveness','Efectividad del aislamiento','d',5e4,10,'isolation','isolationEffectiveness',{cid:'isolation'},1,{sell:1,method:'sum'});
U('WaterPumpProduction','Producción de bombas de agua','d',8e10,1.98,'waterPump','waterProduction',{cid:'waterPump'},1.5);
U('GroundwaterPumpProduction','Prod. de bombas subterráneas','d',64e10,2,'groundwaterPump','waterProduction',{cid:'groundwaterPump'},1.5);
U('waterElementsMaxWater','Agua máx. de elem. de agua','d',3e10,2,'waterPump','maxWater',{ctype:'waterElement'},1.5);
U('generatorMaxWater','Agua máx. de generadores','d',2e10,1.45,'waterPipe','maxWater',{ctype:'generator'},1.25);
U('heatInletOutletMaxHeat','Calor máx. de entradas/salidas','d',1e15,2.7,'undergroundHeatPipes','maxHeatMultiplayer',{ctype:'heatInletOutletElement'},2);
U('heatInletMaxTransfer','Transferencia máx. de entrada','d',1e15,1.5,'undergroundHeatPipes','heatInletMaxTransferMultiplayer',{cid:'heatInlet'},1.3);
U('circulatorEffectiveness','Efectividad del circulador','d',1e18,2.1,'circulator','circulatorEffectiveness',{cid:'circulator'},.25,{sell:1,method:'sum'});
const CELLUP=[ // id, nombre, precioProd, precioVida
 ['nuclearCell7','Celda de balduranio',25e20,125e20],['nuclearCell6','Celda de curio',5e19,25e19],['nuclearCell5','Celda de protactinio',1e18,5e18],
 ['nuclearCell4','Celda de torio',1e16,5e16],['nuclearCell3','Celda de fusión',1e14,5e14],['nuclearCell2','Celda termonuclear',1e11,5e11],
 ['nuclearCell','Celda nuclear',1e10,5e10],['gasBurner','Quemador de gas',8e7,25e7],['coalBurner','Quemador de carbón',125e3,5e6]];
const WARN='Si usas esta celda, mejorar su producción de calor puede sobrecalentar los componentes adyacentes. ¡Asegúrate de que aguanten el calor! ¿Seguro que quieres comprar?';
CELLUP.forEach(([id,n,pp,lp])=>{
  U(id+'Production',n,'a',pp,1.78,id,'heatProduction',{cid:id},1.25,{sell:1,warn:WARN});
  U(id+'Life',n+': vida útil','a',lp,8,id,'lifetime',{cid:id},2);
});
U('solarCellProduction','Celdas solares','a',1e3,3.165,'solarCell','heatProduction',{cid:'solarCell'},1.5,{sell:1,warn:WARN});
U('solarCellLife','Celdas solares: vida útil','a',1e4,10,'solarCell','lifetime',{cid:'solarCell'},2);
U('windTurbineProduction','Turbina eólica','a',250,2.8,null,'powerProduction',{cid:'windTurbine'},1.5,{sell:1});
U('windTurbineLife','Turbina eólica: vida útil','a',15,12,null,'lifetime',{cid:'windTurbine'},2);
const UPBY={};UPS.forEach(u=>UPBY[u.id]=u);
const UPFIELD={powerProduction:'powerProductionMultiplayer',heatProduction:'heatProductionMultiplayer',lifetime:'lifetimeMultiplayer',
 maxHeatMultiplayer:'maxHeatMultiplayer',powerToMoneyAmountBonusMultiplayer:'powerToMoneyAmountBonusMultiplayer',heatSellAmount:'bulkHeatSellMultiplayer',
 researchPointsProduction:'researchPointsProductionMultiplayer',powerSellAmount:'powerSellAmountMultiplayer',heatToPower:'heatToPowerConversionMultiplayer',
 maxPower:'maxPowerMultiplayer',isolationEffectiveness:'isolationMultiplayer',waterProduction:'waterProductionMultiplayer',maxWater:'maxWaterMultiplayer',
 circulatorEffectiveness:'circulatorMaxPowerMultiplayer',heatInletMaxTransferMultiplayer:'heatInletMaxTransferMultiplayer',
 refundCells:'refundBonus',refundHeat:'heatRefundMitigation'};
/* piezas afectadas por una mejora (una pieza, un tipo o una categoría) */
function upTargets(u){
  const t=u.target;
  if(t.cid)return [CBY[t.cid]];
  if(t.cat==='cell')return COMPS.filter(c=>c.st.type==='Cell');
  if(t.cat==='heat')return COMPS.filter(c=>c.maxHeat);
  return CTYPE[t.ctype]||[];
}
const pct=m=>Math.round(100*(m-1));
const UPTXT={powerProduction:b=>`Aumenta la producción de energía un ${pct(b.mult)}%`,heatProduction:b=>`Aumenta la producción de calor un ${pct(b.mult)}%`,
 lifetime:b=>`Aumenta la vida útil un ${pct(b.mult)}%`,maxHeatMultiplayer:b=>`Aumenta el calor máximo un ${pct(b.mult)}%`,
 powerToMoneyAmountBonusMultiplayer:b=>`Aumenta el bono base del banco un ${pct(b.mult)}%`,heatSellAmount:b=>`Aumenta la venta de calor un ${pct(b.mult)}%`,
 researchPointsProduction:b=>`Aumenta la investigación un ${pct(b.mult)}%`,powerSellAmount:b=>`Aumenta la energía vendida un ${pct(b.mult)}%`,
 heatToPower:b=>`Aumenta la conversión calor→energía un ${pct(b.mult)}%`,maxPower:b=>`Aumenta la energía máx. del reactor un ${pct(b.mult)}%`,
 isolationEffectiveness:b=>`Aumenta la efectividad del aislamiento un ${pct(b.mult+1)}%`,waterProduction:b=>`Aumenta la producción de agua un ${pct(b.mult)}%`,
 maxWater:b=>`Aumenta el agua máxima un ${pct(b.mult)}%`,circulatorEffectiveness:b=>`Aumenta la efectividad del circulador un ${pct(b.mult+1)}%`,
 heatInletMaxTransferMultiplayer:b=>`Aumenta la transferencia máx. de la entrada un ${pct(b.mult)}%`,
 refundCells:b=>`Las celdas devuelven un ${Math.round(b.mult*100)}% más de su precio al venderlas (proporcional a la vida útil que les queda)`,
 refundHeat:b=>`Se pierde un ${Math.round(b.mult*100)}% menos de reembolso por el calor que lleva una pieza al venderla`};

/* ---- Investigación ---- */
const RES=[];
const R=(id,group,name,desc,req,rp,max,inc,money,icon)=>RES.push({id,group,name,desc,req,rp,max:max||1,inc,money,icon:icon||id});
R('researchCenter','1','Centro de investigación','Produce puntos de investigación',null,0,1,0,100);
R('researchCenter2','1','Centro de investigación avanzado','Produce más puntos de investigación','gasBurner',3e6);
R('researchCenter3','1','Súper centro de investigación','Produce aún más puntos de investigación','nuclearCell5',125e15);
R('office','1','Oficina','Vende energía automáticamente','researchCenter',500);
R('office2','1','Oficina 2','Una oficina más grande vende mucha más energía','coalBurner',5e4);
R('office3','1','Oficina 3','Una oficina más grande vende mucha más energía','nuclearCell',4e8);
R('office4','1','Oficina 4','Una oficina más grande vende mucha más energía','nuclearCell2',1e10);
R('office5','1','Oficina 5','Una oficina más grande vende mucha más energía','nuclearCell4',4e13);
R('bank2','1','Banco','Potencia las ventas de las oficinas','nuclearCell3',3e11);
R('chronometer','1','Cronómetro','+1 tick por segundo','researchCenter',1e4,5,1e3);
R('battery','c','Baterías','Las baterías aumentan la energía máxima del reactor.','windTurbineAutoRebuild',250);
R('isolation','c','Aislamiento','El aislamiento aumenta el calor de los elementos adyacentes.','solarCell',12e3);
R('heatExchanger','c','Intercambiadores de calor','Transfieren calor entre componentes adyacentes.','gasBurner',15e4);
R('undergroundHeatPipes','c','Tuberías de calor subterráneas','Distribuir calor sin una red enorme de tubos','nuclearCell4',2e14,1,0,0,'heatInlet');
R('heatBattery','c','Disipador de calor','Almacena una cantidad enorme de calor.','heatExchanger',1e6);
R('boilerHouse','c','Caldera','Toma calor del disipador y lo vende en bloque.','heatBattery',5e6);
R('waterPump','c','Bomba de agua','Enfría generadores para que produzcan más energía.','nuclearCell2',6e9);
R('waterPipe','c','Tubería de agua','Amplía el área efectiva de las bombas de agua','waterPump',2e9);
R('groundwaterPump','c','Bomba subterránea','Enfría generadores para que produzcan más energía.','nuclearCell3',12e11);
R('generator3','c','Generador 3','Convierte una enorme cantidad de calor en energía.','nuclearCell3',25e12);
R('generator4','c','Generador 4','Convierte una enorme cantidad de calor en energía.','nuclearCell4',625e12);
R('circulator','c','Circulador','Aumenta el agua máx. del generador si se coloca adyacente.','nuclearCell5',125e13);
R('generator5','c','Generador 5','Convierte una enorme cantidad de calor en energía.','nuclearCell6',6875e13);
[['nuclearCell7','Celdas de balduranio','nuclearCell6',625e16,'nuclearCell7AutoRebuild','Gestor de balduranio',8e17],
 ['nuclearCell6','Celdas de curio','nuclearCell5',125e15,'nuclearCell6AutoRebuild','Gestor de curio',8e15],
 ['nuclearCell5','Celdas de protactinio','nuclearCell4',25e14,'nuclearCell5AutoRebuild','Gestor de protactinio',8e13],
 ['nuclearCell4','Celdas de torio','nuclearCell3',5e13,'nuclearCell4AutoRebuild','Gestor de torio',8e11],
 ['nuclearCell3','Celdas de fusión','nuclearCell2',5e11,'nuclearCell3AutoRebuild','Gestor de fusión',8e9],
 ['nuclearCell2','Celdas termonucleares','nuclearCell',5e9,'nuclearCell2AutoRebuild','Gestor termonuclear',2e9],
 ['nuclearCell','Celdas nucleares','gasBurner',2e8,'nuclearCellAutoRebuild','Gestor nuclear',1e8],
 ['gasBurner','Quemador de gas','coalBurner',2e6,'gasBurnerAutoRebuild','Gestor de gas',1e6],
 ['coalBurner','Quemador de carbón','solarCell',5e4,'coalBurnerAutoRebuild','Gestor de carbón',15e3],
 ['solarCell','Celdas solares','researchCenter',2500,'solarCellAutoRebuild','Gestor solar',1e3]
].forEach(([id,n,rq,rp,mid,mn,mrp])=>{
  R(id,'a',n,'Abre la tecnología: '+n.toLowerCase(),rq,rp);
  R(mid,'a',mn,'Esas celdas se reemplazan automáticamente.',id,mrp,1,0,0,id);
});
// el orden original es de mayor a menor; reordenamos pares (tech + gestor) como en el original: gestor justo después
(()=>{const a=RES.filter(r=>r.group==='a'),rest=RES.filter(r=>r.group!=='a');
 const ord=[];for(let i=0;i<a.length;i+=2)ord.push(a[i],a[i+1]);
 RES.length=0;RES.push(...rest,...ord)})();
RES.push({id:'windTurbineAutoRebuild',group:'a',name:'Gestor de turbinas',desc:'Las turbinas eólicas se reemplazan automáticamente.',req:'researchCenter',rp:100,max:1,icon:'windTurbine'});
const RESBY={};RES.forEach(r=>RESBY[r.id]=r);

const TICKS_MAXBONUS=4000,TICKS_MINBONUS=10,OFFLINE_SLOWER=10;

