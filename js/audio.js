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

/* Música generativa (Web Audio, sin archivos): pulso electrónico/industrial a 124 bpm con bombo, hi-hats,
   bajo en movimiento y arpegio de 16avos sobre una progresión en La menor. Cada compás varía al azar. */
const music=(()=>{
  let ac=null,master,bus,drums,nbuf,timer=null,nextT=0,step=0,running=false,on=true,vol=.4;
  try{const p=JSON.parse(localStorage.getItem('reactorIdleMusic')||'null');if(p){on=p.on!==false;if(typeof p.vol==='number')vol=Math.min(1,Math.max(0,p.vol))}}catch(e){}
  const save=()=>{try{localStorage.setItem('reactorIdleMusic',JSON.stringify({on,vol}))}catch(e){}};
  const mtof=n=>440*Math.pow(2,(n-69)/12);
  const CH=[[57,60,64,67],[53,57,60,64],[48,52,55,60],[55,59,62,67]],BASS=[33,29,36,31];
  const S16=60/124/4,CHORD=64;
  const init=()=>{
    if(ac)return true;
    try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(e){return false}
    master=ac.createGain();master.gain.value=0;
    const comp=ac.createDynamicsCompressor();comp.threshold.value=-20;comp.ratio.value=5;
    bus=ac.createGain();drums=ac.createGain();drums.gain.value=1;
    const lp=ac.createBiquadFilter();lp.type='lowpass';lp.frequency.value=5000;
    const dl=ac.createDelay(2),fb=ac.createGain(),dlp=ac.createBiquadFilter(),send=ac.createGain();
    dl.delayTime.value=S16*3;fb.gain.value=.38;dlp.type='lowpass';dlp.frequency.value=2200;send.gain.value=.3;
    bus.connect(lp);lp.connect(comp);drums.connect(comp);
    bus.connect(send);send.connect(dl);dl.connect(dlp);dlp.connect(fb);fb.connect(dl);dlp.connect(comp);
    comp.connect(master);master.connect(ac.destination);
    const n=ac.sampleRate,b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=Math.random()*2-1;nbuf=b;
    return true;
  };
  const adsr=(g,t,a,peak,d,rel)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.setValueAtTime(peak,t+d);g.gain.linearRampToValueAtTime(0,t+d+rel)};
  const pad=(n,t,dur)=>{
    const f=ac.createBiquadFilter(),g=ac.createGain();f.type='lowpass';f.frequency.value=900;
    adsr(g,t,.4,.022,dur,.6);f.connect(g);g.connect(bus);
    [-9,9].forEach(c=>{const o=ac.createOscillator();o.type='sawtooth';o.frequency.value=mtof(n);o.detune.value=c;o.connect(f);o.start(t);o.stop(t+dur+.7)});
  };
  const kick=t=>{
    const o=ac.createOscillator(),g=ac.createGain();o.type='sine';
    o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(42,t+.12);
    g.gain.setValueAtTime(.55,t);g.gain.exponentialRampToValueAtTime(.001,t+.32);
    o.connect(g);g.connect(drums);o.start(t);o.stop(t+.35);
  };
  const noise=(t,dur,type,freq,v,q)=>{
    const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();s.buffer=nbuf;
    f.type=type;f.frequency.value=freq;if(q)f.Q.value=q;
    g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
    s.connect(f);f.connect(g);g.connect(drums);s.start(t,Math.random()*.5);s.stop(t+dur+.02);
  };
  const bassNote=(n,t,len,cut)=>{
    const o=ac.createOscillator(),f=ac.createBiquadFilter(),g=ac.createGain();o.type='sawtooth';o.frequency.value=mtof(n);
    f.type='lowpass';f.Q.value=6;f.frequency.setValueAtTime(cut,t);f.frequency.exponentialRampToValueAtTime(110,t+len);
    g.gain.setValueAtTime(.2,t);g.gain.exponentialRampToValueAtTime(.001,t+len+.05);
    o.connect(f);f.connect(g);g.connect(bus);o.start(t);o.stop(t+len+.1);
  };
  const lead=(n,t,v)=>{
    const o=ac.createOscillator(),f=ac.createBiquadFilter(),g=ac.createGain();o.type='square';o.frequency.value=mtof(n);
    f.type='lowpass';f.frequency.value=2400;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0005,t+S16*2.2);
    o.connect(f);f.connect(g);g.connect(bus);o.start(t);o.stop(t+S16*2.4);
  };
  const ARP=[0,1,2,3,2,1,2,3,0,2,1,3,2,3,1,2];
  const tick=()=>{
    if(!running||!ac)return;
    while(nextT<ac.currentTime+.6){
      const bar=Math.floor(step/16),ci=Math.floor(step/CHORD)%CH.length,s=step%16,cs=step%CHORD,t=nextT;
      /* intensidad: los 4 primeros compases de cada acorde van subiendo; el último compás hace un fill */
      const inChord=Math.floor(cs/16),last=inChord===3,lvl=Math.min(1,.55+inChord*.2);
      if(cs===0)CH[ci].forEach(n=>pad(n,t,CHORD*S16));
      if(s%4===0)kick(t);
      if(s===4||s===12)noise(t,.14,'bandpass',1800,.16*lvl,.8);
      if(s%4===2)noise(t,.05,'highpass',7500,.07*lvl);
      else if(s%2===1&&Math.random()<.45)noise(t,.03,'highpass',8500,.035*lvl);
      if(last&&s>=12)noise(t,.06,'highpass',6000,.05+.01*(s-12));
      const b=BASS[ci];
      if([0,3,6,8,10,13].includes(s)){const oct=(s===6||s===13)?12:0;bassNote(b+oct,t,S16*(s===0?3:1.7),1500*lvl+300)}
      if(inChord>=1){
        const ch=CH[ci],k=ARP[s],n=ch[k]+12*(1+(s%8>=4?1:0));
        if(Math.random()<.82)lead(n,t,.025+.01*lvl);
      }
      nextT+=S16;step++;
    }
  };
  const target=()=>(on&&!sfx.muted&&!document.hidden)?vol*.6:0;
  const apply=()=>{
    if(!ac)return;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(target(),ac.currentTime,.3);
    const want=target()>0;
    if(want&&!running){running=true;if(ac.state==='suspended')ac.resume();nextT=ac.currentTime+.1;timer=setInterval(tick,200);tick()}
    else if(!want&&running){running=false;clearInterval(timer);timer=null}
  };
  const kickoff=()=>{if(on&&!sfx.muted&&init()){if(ac.state==='suspended')ac.resume();apply()}};
  ['pointerdown','keydown','touchend'].forEach(ev=>addEventListener(ev,kickoff,{passive:true}));
  document.addEventListener('visibilitychange',()=>{apply()});
  return {
    get on(){return on},get vol(){return vol},
    sync(){if(on&&!sfx.muted)kickoff();else apply()},
    setOn(v){on=!!v;save();this.sync()},
    setVol(v){vol=Math.min(1,Math.max(0,v));save();apply()}
  };
})();
