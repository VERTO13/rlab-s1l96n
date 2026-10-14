'use strict';
/* ============================================================
   SINCRONIZACIÓN EN LA NUBE (Gist secreto de tu cuenta de GitHub)
   - El guardado se sube a un Gist SECRETO llamado «reactor-idle-save».
   - Hace falta un token clásico de GitHub con el único permiso «gist».
   - El token se guarda solo en este navegador (localStorage).
   - Antes de subir se comprueba si la nube tiene algo más reciente (evita pisar progreso).
   ============================================================ */
const SYNCKEY='reactorIdleSync';
const GIST_DESC='reactor-idle-save',GIST_FILE='save.json',GH_API='https://api.github.com';
const sync={token:'',gistId:'',lastRemoteAt:0,auto:true,status:'off',msg:'',busy:false,lastPushTicks:-1,lastOkAt:0};
try{Object.assign(sync,JSON.parse(localStorage.getItem(SYNCKEY)||'{}'))}catch(e){}
sync.busy=false;sync.status=sync.token?'idle':'off';
const saveSyncCfg=()=>{try{localStorage.setItem(SYNCKEY,JSON.stringify({token:sync.token,gistId:sync.gistId,lastRemoteAt:sync.lastRemoteAt,auto:sync.auto}))}catch(e){}};
const localSavedAt=(()=>{try{return (JSON.parse(localStorage.getItem(SAVEKEY)||'null')||{}).savedAt||0}catch(e){return 0}})();

async function gh(path,opt){
  opt=opt||{};
  const r=await fetch(GH_API+path,{method:opt.method||'GET',body:opt.body,headers:Object.assign({
    'Authorization':'Bearer '+sync.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},opt.body?{'Content-Type':'application/json'}:{})});
  if(!r.ok){const e=new Error('GitHub '+r.status);e.status=r.status;throw e}
  return r.json();
}
const summary=d=>d?`${nf(d.totalTicks||0)} ticks · $${nf(d.money||0)} · ${new Date(d.savedAt||0).toLocaleString()}`:'(vacío)';
function setSyncState(st,msg){
  sync.status=st;sync.msg=msg||'';
  const b=document.getElementById('bCloud');
  if(b){b.dataset.st=st;b.title='Nube: '+({off:'sin conectar',idle:'conectada',busy:'sincronizando…',ok:'sincronizado',err:'error'}[st]||st)+(msg?' — '+msg:'')}
  const el=document.getElementById('syncStatus');if(el)el.textContent=statusText();
}
function statusText(){
  if(!sync.token)return 'Sin conectar.';
  if(sync.status==='busy')return 'Sincronizando…';
  if(sync.status==='err')return '⚠ '+sync.msg;
  return sync.lastOkAt?'✓ Sincronizado '+new Date(sync.lastOkAt).toLocaleTimeString():'Conectado.';
}
const errText=e=>e.status===401?'Token inválido o caducado.':e.status===403||e.status===404?'El token necesita el permiso «gist».':e.message==='Failed to fetch'?'Sin conexión.':e.message;

async function findGist(){
  for(let page=1;page<=3;page++){
    const list=await gh('/gists?per_page=100&page='+page);
    const g=list.find(x=>x.description===GIST_DESC&&x.files&&x.files[GIST_FILE]);
    if(g)return g.id;
    if(list.length<100)break;
  }
  return null;
}
async function readRemote(){
  if(!sync.gistId)return null;
  const g=await gh('/gists/'+sync.gistId);
  const f=g.files&&g.files[GIST_FILE];if(!f)return null;
  const text=f.truncated?await (await fetch(f.raw_url)).text():f.content;
  try{return JSON.parse(text)}catch(e){return null}
}
async function writeRemote(payload){
  const body=JSON.stringify({description:GIST_DESC,files:{[GIST_FILE]:{content:JSON.stringify(payload)}}});
  if(!sync.gistId){const g=await gh('/gists',{method:'POST',body:JSON.stringify({description:GIST_DESC,public:false,files:{[GIST_FILE]:{content:JSON.stringify(payload)}}})});sync.gistId=g.id}
  else await gh('/gists/'+sync.gistId,{method:'PATCH',body});
  sync.lastRemoteAt=payload.savedAt;sync.lastOkAt=Date.now();sync.lastPushTicks=payload.totalTicks;saveSyncCfg();
}
/* sube el progreso local; si la nube tiene algo más reciente que lo último que vimos, pregunta antes de pisarlo */
async function syncPush(opts){
  opts=opts||{};
  if(!sync.token||sync.busy)return false;
  sync.busy=true;setSyncState('busy');
  try{
    if(!opts.force){
      const remote=await readRemote();
      if(remote&&remote.savedAt>sync.lastRemoteAt+1000){sync.busy=false;setSyncState('idle');askConflict(remote);return false}
    }
    await writeRemote(getSave());
    setSyncState('ok');return true;
  }catch(e){setSyncState('err',errText(e));return false}
  finally{sync.busy=false}
}
function applyRemote(remote){
  if(!remote||!loadSave(remote,true))return false;
  saveGame();sync.lastRemoteAt=remote.savedAt;sync.lastOkAt=Date.now();saveSyncCfg();
  setView(curReactor&&G.reactors[curReactor]&&G.reactors[curReactor].bought&&view==='game'?'game':(view==='game'?'reactors':view));
  setSyncState('ok');
  return true;
}
function askConflict(remote){
  if(document.querySelector('.sync-conflict'))return;
  const local=getSave();
  const m=modal(`<div class="sync-conflict"><h3>☁ La nube tiene otro progreso</h3>
    <p>Se guardó en otro dispositivo (o antes de este). Elige cuál conservar:</p>
    <div class="item"><div class="tx"><div class="nm">Nube</div><div class="small">${summary(remote)}</div></div><button id="scRemote">Usar la nube</button></div>
    <div class="item"><div class="tx"><div class="nm">Este dispositivo</div><div class="small">${summary(local)}</div></div><button id="scLocal">Usar este</button></div>
    <p class="small">El que no elijas se sobrescribe. Si dudas, elige el que tenga más ticks.</p></div>`);
  m.querySelector('#scRemote').onclick=()=>{applyRemote(remote);m.remove()};
  m.querySelector('#scLocal').onclick=async()=>{m.remove();await syncPush({force:true})};
}
async function syncConnect(token){
  sync.token=token.trim();sync.gistId='';sync.busy=true;setSyncState('busy');
  try{
    await gh('/user');
    sync.gistId=await findGist()||'';
    saveSyncCfg();sync.busy=false;
    if(sync.gistId){
      const remote=await readRemote();
      if(remote&&remote.savedAt>localSavedAt+1000&&(remote.totalTicks||0)>=G.totalTicks)askConflict(remote);
      else if(remote)askConflict(remote);
      else await syncPush({force:true});
    }else await syncPush({force:true});
    setSyncState(sync.status==='err'?'err':'ok',sync.msg);
    return true;
  }catch(e){sync.busy=false;sync.token='';sync.gistId='';saveSyncCfg();setSyncState('err',errText(e));return false}
}
function syncDisconnect(){sync.token='';sync.gistId='';sync.lastRemoteAt=0;sync.status='off';saveSyncCfg();setSyncState('off')}

/* ---- panel en Ajustes ---- */
function renderSyncBox(box){
  if(!box)return;
  const connected=!!sync.token;
  box.innerHTML=`<h3>☁ Sincronización en la nube</h3>`+(connected?
   `<div class="small" id="syncStatus">${statusText()}</div>
    <div class="row"><button id="syPush">Subir ahora</button><button id="syPull">Descargar de la nube</button>
    <label class="small"><input type="checkbox" id="syAuto" ${sync.auto?'checked':''}> Sincronizar automáticamente</label>
    <button id="syOff">Desconectar</button></div>
    <div class="small">Tu progreso está en un Gist <b>secreto</b> de tu cuenta de GitHub (nadie más lo ve). Para usarlo en otro dispositivo, conecta el mismo token allí.</div>`:
   `<p class="small">Guarda tu progreso en un Gist secreto de tu GitHub y recupéralo en cualquier dispositivo.</p>
    <ol class="small" style="padding-left:18px;margin:4px 0">
     <li>Crea un token <b>clásico</b> con <b>solo</b> el permiso <b>gist</b>: <a href="https://github.com/settings/tokens/new?scopes=gist&description=reactor-idle-sync" target="_blank" rel="noopener" style="color:var(--research)">abrir GitHub (ya viene marcado)</a>.</li>
     <li>Copia el token (empieza con <code>ghp_</code>) y pégalo aquí:</li></ol>
    <div class="row"><input type="password" id="syTok" placeholder="ghp_…" style="flex:1;min-width:180px;font:inherit;color:var(--text);background:#0c0c18;border:1px solid #3a3a58;border-radius:6px;padding:4px 8px"><button id="syGo">Conectar</button></div>
    <div class="small" id="syncStatus"></div>
    <div class="small">El token se guarda solo en este navegador y únicamente puede leer/escribir tus Gists.</div>`);
  const $b=id=>box.querySelector(id);
  if(connected){
    $b('#syPush').onclick=async()=>{await syncPush();renderSyncBox(box)};
    $b('#syPull').onclick=async()=>{
      try{setSyncState('busy');const r=await readRemote();setSyncState('idle');
        if(!r){alert('La nube está vacía.');return}
        if(confirm('Se reemplazará el progreso de este dispositivo por el de la nube:\n'+summary(r)+'\n\n¿Continuar?')){applyRemote(r);renderSyncBox(box)}
      }catch(e){setSyncState('err',errText(e))}};
    $b('#syAuto').onchange=e=>{sync.auto=e.target.checked;saveSyncCfg()};
    $b('#syOff').onclick=()=>{if(confirm('¿Desconectar la nube en este dispositivo? (El Gist no se borra.)')){syncDisconnect();renderSyncBox(box)}};
  }else{
    $b('#syGo').onclick=async()=>{
      const tk=$b('#syTok').value.trim();if(!tk)return;
      $b('#syGo').disabled=true;const ok=await syncConnect(tk);renderSyncBox(box);
      if(!ok){const el=box.querySelector('#syncStatus');if(el)el.textContent='⚠ '+sync.msg}
    };
  }
}

/* ---- sincronización automática ---- */
let syncTimer=null;
function autoSyncTick(){
  if(!sync.token||!sync.auto||sync.busy||document.hidden&&false)return;
  if(G.totalTicks===sync.lastPushTicks)return;      // nada nuevo que subir
  syncPush();
}
async function syncStartup(){
  const b=document.getElementById('bCloud');if(b)b.onclick=()=>document.getElementById('bSettings').click();
  if(!sync.token){if(sync.status!=='err')setSyncState('off');return}
  if(sync.busy)return;
  setSyncState('idle');
  try{
    sync.busy=true;setSyncState('busy');
    const remote=await readRemote();sync.busy=false;
    if(remote&&remote.savedAt>Math.max(localSavedAt,sync.lastRemoteAt)+1000){setSyncState('idle');askConflict(remote)}
    else{setSyncState('idle');await syncPush({force:!remote})}
  }catch(e){sync.busy=false;setSyncState('err',errText(e))}
}
clearInterval(syncTimer);syncTimer=setInterval(autoSyncTick,90000);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&sync.token&&sync.auto&&G.totalTicks!==sync.lastPushTicks){saveGame();syncPush()}});
window.addEventListener('online',()=>{if(sync.token&&sync.status==='err')autoSyncTick()});
setTimeout(syncStartup,1200);
