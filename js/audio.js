'use strict';
/* Sonidos sintetizados con Web Audio (sin archivos). Se activan tras el primer clic. */
const sfx=(()=>{
  let ac=null,muted=false;
  try{muted=localStorage.getItem('reactorIdleMuted')==='1'}catch(e){}
  const vib=ms=>{if(!muted)try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}};
  const ctx=()=>{
    if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(e){return null}}
    if(ac.state==='suspended')ac.resume();
    return ac;
  };
  const tone=(f0,f1,dur,type='sine',vol=.08,delay=0)=>{
    if(muted)return;const a=ctx();if(!a)return;
    const t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();
    o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(a.destination);o.start(t);o.stop(t+dur+.02);
  };
  const noise=(dur,vol=.18)=>{
    if(muted)return;const a=ctx();if(!a)return;
    const n=Math.floor(a.sampleRate*dur),b=a.createBuffer(1,n,a.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const s=a.createBufferSource(),g=a.createGain(),f=a.createBiquadFilter();
    f.type='lowpass';f.frequency.value=900;g.gain.value=vol;s.buffer=b;s.connect(f).connect(g).connect(a.destination);s.start();
  };
  return {
    build(){tone(520,780,.07,'square',.04);vib(8)},
    sell(){tone(700,380,.09,'triangle',.06);vib(14)},
    cash(){tone(880,1320,.1,'triangle',.06)},
    boom(){noise(.5,.22);tone(160,40,.5,'sawtooth',.07);vib([40,30,60])},
    research(){tone(520,520,.08,'sine',.06);tone(780,780,.12,'sine',.06,.09)},
    ach(){[660,880,1320].forEach((f,i)=>tone(f,f,.16,'sine',.06,i*.1))},
    warn(){tone(300,300,.1,'square',.04);tone(300,300,.1,'square',.04,.16)},
    click(){tone(400,400,.03,'square',.03)},
    get muted(){return muted},
    toggle(){muted=!muted;try{localStorage.setItem('reactorIdleMuted',muted?'1':'0')}catch(e){}return muted}
  };
})();

/* Música ambiental generativa (Web Audio, sin archivos): pads + bajo + notas sueltas con eco.
   Progresión lenta en La menor; las notas se eligen al azar, así que nunca se repite igual. */
const music=(()=>{
  let ac=null,master,bus,timer=null,nextT=0,step=0,running=false,on=true,vol=.4;
  try{const p=JSON.parse(localStorage.getItem('reactorIdleMusic')||'null');if(p){on=p.on!==false;if(typeof p.vol==='number')vol=Math.min(1,Math.max(0,p.vol))}}catch(e){}
  const save=()=>{try{localStorage.setItem('reactorIdleMusic',JSON.stringify({on,vol}))}catch(e){}};
  const mtof=n=>440*Math.pow(2,(n-69)/12);
  const CH=[[57,60,64,67],[53,57,60,64],[48,55,60,64],[55,59,62,67]],BASS=[33,29,36,31],PENTA=[0,3,5,7,10];
  const EIGHTH=60/70/2,CHORD=16;
  const init=()=>{
    if(ac)return true;
    try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(e){return false}
    master=ac.createGain();master.gain.value=0;
    const comp=ac.createDynamicsCompressor();
    bus=ac.createGain();bus.gain.value=.8;
    const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3200;
    const dl=ac.createDelay(2),fb=ac.createGain(),dlp=ac.createBiquadFilter(),send=ac.createGain();
    dl.delayTime.value=EIGHTH*3;fb.gain.value=.42;dlp.type='lowpass';dlp.frequency.value=1800;send.gain.value=.5;
    bus.connect(lp);lp.connect(comp);
    bus.connect(send);send.connect(dl);dl.connect(dlp);dlp.connect(fb);fb.connect(dl);dlp.connect(comp);
    comp.connect(master);master.connect(ac.destination);
    return true;
  };
  const env=(g,t,a,peak,d,rel)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.setValueAtTime(peak,t+d);g.gain.linearRampToValueAtTime(0,t+d+rel)};
  const pad=(n,t,dur)=>{
    const f=ac.createBiquadFilter(),g=ac.createGain();f.type='lowpass';f.frequency.value=700;f.Q.value=.5;
    f.frequency.setValueAtTime(400,t);f.frequency.linearRampToValueAtTime(1100,t+dur*.6);f.frequency.linearRampToValueAtTime(500,t+dur+2);
    env(g,t,2.2,.05,dur,2.5);f.connect(g);g.connect(bus);
    [-7,7].forEach(c=>{const o=ac.createOscillator();o.type='sawtooth';o.frequency.value=mtof(n);o.detune.value=c;o.connect(f);o.start(t);o.stop(t+dur+2.6)});
  };
  const bass=(n,t,dur)=>{
    const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=mtof(n);
    env(g,t,.05,.2,dur*.9,.8);o.connect(g);g.connect(bus);o.start(t);o.stop(t+dur+1);
    const o2=ac.createOscillator(),g2=ac.createGain();o2.type='triangle';o2.frequency.value=mtof(n+12);
    env(g2,t,.05,.04,dur*.9,.8);o2.connect(g2);g2.connect(bus);o2.start(t);o2.stop(t+dur+1);
  };
  const pluck=(n,t,v)=>{
    const o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.value=mtof(n);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.0005,t+1.1);
    o.connect(g);g.connect(bus);o.start(t);o.stop(t+1.2);
  };
  const tick=()=>{
    if(!running||!ac)return;
    while(nextT<ac.currentTime+.8){
      const ci=Math.floor(step/CHORD)%CH.length,s=step%CHORD;
      if(s===0){const dur=CHORD*EIGHTH;CH[ci].forEach(n=>pad(n,nextT,dur));bass(BASS[ci],nextT,dur)}
      if(s%8===4&&Math.random()<.5)bass(BASS[ci]+12,nextT,EIGHTH*3);
      if(Math.random()<(s%2?.22:.5)){
        const root=CH[ci][0]%12,base=69+((Math.random()*2)|0)*12;
        const n=Math.random()<.65?CH[ci][(Math.random()*4)|0]+12*(1+(Math.random()<.4?1:0)):base+root-9+PENTA[(Math.random()*5)|0];
        pluck(n,nextT,.04+Math.random()*.035);
      }
      nextT+=EIGHTH;step++;
    }
  };
  const target=()=>(on&&!sfx.muted&&!document.hidden)?vol*.55:0;
  const apply=()=>{
    if(!ac)return;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(target(),ac.currentTime,.4);
    const want=target()>0;
    if(want&&!running){running=true;if(ac.state==='suspended')ac.resume();nextT=ac.currentTime+.1;timer=setInterval(tick,250);tick()}
    else if(!want&&running){running=false;clearInterval(timer);timer=null}
  };
  const kick=()=>{if(on&&!sfx.muted&&init()){if(ac.state==='suspended')ac.resume();apply()}};
  ['pointerdown','keydown','touchend'].forEach(ev=>addEventListener(ev,kick,{passive:true}));
  document.addEventListener('visibilitychange',()=>{apply()});
  return {
    get on(){return on},get vol(){return vol},
    sync(){if(on&&!sfx.muted)kick();else apply()},
    setOn(v){on=!!v;save();this.sync()},
    setVol(v){vol=Math.min(1,Math.max(0,v));save();apply()}
  };
})();
