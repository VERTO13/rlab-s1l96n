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
