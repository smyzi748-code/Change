'use strict';
/* Chicken Arena 3D — онлайн-сервер. Без зависимостей: node server.js */
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=+process.env.PORT||3000,R=22,WIN=10,DIR=__dirname;
const WP=[{cd:.3,d:20,v:760,l:1.2,q:1,sp:.03},{cd:.1,d:9,v:900,l:1,q:1,sp:.09},{cd:.8,d:12,v:700,l:.5,q:6,sp:.13},{cd:1.1,d:75,v:1500,l:1.4,q:1,sp:0},{cd:.22,d:14,v:850,l:1.1,q:1,sp:.02},{cd:.16,d:13,v:1150,l:1,q:1,sp:.04},{cd:.06,d:5,v:950,l:1,q:1,sp:.15}];
const BN=['Кудах','Пухляш','Рокки','Цыпа','Гриль','Наггетс','Петруха','Яичница','Крылышко','Бройлер','Хохлатка','Пеструшка','Кокоша','Глаша','Курлык','Пернатый'];

/* ---------- карты (должны совпадать с клиентом: тот же генератор и seed) ---------- */
const MD=[
{s:11,W:3600,H:2700,gen:(p,v)=>{p('barn',300,220,1,80);p('house',150,130,7,90);v('fence',280,14,10,60);p('hay',46,46,28,30);p('crate',42,42,30,30);p('rock',50,50,20,30);p('tree',26,26,150,24)}},
{s:23,W:3800,H:2800,gen:(p,v)=>{v('canyon',560,56,10,70);p('house',150,130,3,90);p('rock',50,50,30,30);p('cact',30,30,80,24);p('crate',42,42,14,30);p('hay',46,46,6,30)}},
{s:37,W:3600,H:2700,gen:(p,v)=>{p('house',150,130,4,90);p('igloo',92,92,6,60);p('ice',60,60,22,30);v('log',140,32,10,40);p('tree',26,26,110,24);p('rock',50,50,14,30)}},
{s:51,W:3800,H:2900,gen:(p,v)=>{p('tree',26,26,200,20);v('log',150,34,14,40);p('rock',50,50,30,30);p('house',150,130,2,90);p('hay',46,46,6,30)}},
{s:67,W:3400,H:2600,gen:(p,v,b,rn,W,H)=>{for(let r=0;r<5;r++)for(let c=0;c<6;c++){if(rn()<.2)continue;const x=260+c*(W-520)/5,y=230+r*(H-460)/4;rn()<.3?b('cont',x,y,64,200):b('cont',x-100,y,200,64)}p('barn',300,220,2,80);p('crate',42,42,28,30)}},
{s:79,W:3600,H:2700,gen:(p,v,b,rn,W,H)=>{for(let r=0;r<4;r++)for(let c=0;c<6;c++){const w=150+(rn()*70|0),h=130+(rn()*60|0),x=260+c*(W-520)/5-w/2,y=250+r*(H-500)/3-h/2;if(Math.abs(x+w/2-W/2)<200&&Math.abs(y+h/2-H/2)<200)continue;b('bld',x,y,w,h)}v('cont',110,50,10,40);p('crate',42,42,26,30);p('rock',50,50,8,30)}}];
const mapCache={};
function mapData(i){if(mapCache[i])return mapCache[i];const T=MD[i],W=T.W,H=T.H;let sd=T.s;const rn=()=>(sd=sd*16807%2147483647)/2147483647,walls=[],dec=[],spw=[[110,110],[W-110,110],[110,H-110],[W-110,H-110]];
  const clr=(x,y,w,h,m)=>!walls.some(q=>x<q[0]+q[2]+m&&x+w+m>q[0]&&y<q[1]+q[3]+m&&y+h+m>q[1])&&spw.every(p=>Math.hypot(p[0]-x-w/2,p[1]-y-h/2)>260)&&Math.abs(x+w/2-W/2)>w/2+70&&Math.abs(y+h/2-H/2)>h/2+70;
  const put=(t,w,h,n,m)=>{for(let k=0,c=0;c<n&&k<600;k++){const x=70+rn()*(W-140-w),y=70+rn()*(H-140-h);if(clr(x,y,w,h,m)){walls.push([x,y,w,h]);dec.push({t,x,y,w,h,r:rn()});c++}}};
  const box=(t,x,y,w,h)=>{if(spw.every(p=>Math.hypot(p[0]-x-w/2,p[1]-y-h/2)>230)){walls.push([x,y,w,h]);dec.push({t,x,y,w,h,r:rn()})}};
  const putV=(t,a,b,n,m)=>{for(let k=0;k<n;k++){const v=rn()<.5;put(t,v?b:a,v?a:b,1,m)}};
  T.gen(put,putV,box,rn,W,H);return mapCache[i]={W,H,walls,spw}}

/* ---------- симуляция ---------- */
const hit=(X,x,y,r)=>{for(const w of X.walls){const cx=Math.max(w[0],Math.min(x,w[0]+w[2])),cy=Math.max(w[1],Math.min(y,w[1]+w[3]));if((x-cx)**2+(y-cy)**2<r*r)return 1}return x<r||y<r||x>X.W-r||y>X.H-r};
const los=(X,x1,y1,x2,y2)=>{const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/24);for(let k=1;k<n;k++)if(hit(X,x1+(x2-x1)*k/n,y1+(y2-y1)*k/n,2))return 0;return 1};
const ang=a=>Math.atan2(Math.sin(a),Math.cos(a));
const rnd=X=>{let x,y;do{x=80+Math.random()*(X.W-160);y=80+Math.random()*(X.H-160)}while(hit(X,x,y,30));return[x,y]};
const wp2=X=>{let q;for(let n=0;n<20;n++){q=Math.random()<.5?rnd(X):[X.W/2+(Math.random()-.5)*700,X.H/2+(Math.random()-.5)*700];if(!hit(X,q[0],q[1],30))return q}return rnd(X)};
function camOf(x,y,a,pt,fp){const cp=Math.cos(pt),dx=Math.cos(a)*cp,dy=Math.sin(pt),dz=Math.sin(a)*cp;
  if(fp)return{c:[x,50,y],t:[x+dx*100,50+dy*100,y+dz*100]};const c=[x-dx*150,Math.max(10,50-dy*150+24),y-dz*150];return{c,t:[c[0]+dx*100,c[1]+dy*100,c[2]+dz*100]}}
function aimDir(x,y,a,pt,fp,fd){const{c,t}=camOf(x,y,a,pt,fp);const F=fd>0?Math.max(40,Math.min(1600,fd)):450;let fx=t[0]-c[0],fy=t[1]-c[1],fz=t[2]-c[2];const l=Math.hypot(fx,fy,fz),
  mx=x+Math.cos(a)*42,my=36,mz=y+Math.sin(a)*42;let vx=c[0]+fx/l*F-mx,vy=c[1]+fy/l*F-my,vz=c[2]+fz/l*F-mz;const q=Math.hypot(vx,vy,vz);return{m:[mx,my,mz],d:[vx/q,vy/q,vz/q]}}
function mkP(X,i,bot,name,wp){const a=i%2?Math.PI:0;return{x:X.spw[i][0],y:X.spw[i][1],a,hp:100,alive:1,k:0,bot,name,inp:{mx:0,my:0,a,pt:0,fp:0,f:0,w:wp,fd:450},cd:0,rs:0,sp:0,dm:0,wp}}
function spawnMon(X,G){const[x,y]=rnd(X);G.mons.push({x,y,hp:60+(G.wv||0)*8,cd:0})}
function spawnItem(X,G,t,x,y){if(x===undefined)[x,y]=rnd(X);G.items.push({x,y,t})}
function hurt(p,d){p.hp-=d;if(p.hp<=0&&p.alive){p.alive=0;p.rs=3;return 1}}
function ai(X,G,p,i){const dt=1/60,I=p.inp,k=p.skl||(p.skl=.55+Math.random()*.4),w=WP[p.wp]||WP[0];let best=null,bd=1e9;
  const see=q=>{const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<1100&&d<bd&&los(X,p.x,p.y,q.x,q.y)){bd=d;best=q}};
  G.players.forEach((q,j)=>{if(j!==i&&q.alive&&G.gm!==2&&!(G.gm===1&&j%2===i%2))see(q)});G.mons.forEach(see);
  if(best){if(!p.seen)p.rt=(.08+Math.random()*.2)/k;p.seen=1;p.lt={x:best.x,y:best.y,t:3}}else{p.seen=0;if(p.lt&&(p.lt.t-=dt)<=0)p.lt=null}
  p.rt=(p.rt||0)-dt;p.swt=(p.swt||0)-dt;if(p.swt<=0){p.swt=.8+Math.random()*1.4;p.dir=Math.random()<.5?1:-1}
  const T=p.lt;let vx=0,vy=0,look=I.a;
  if(T){const d=Math.hypot(T.x-p.x,T.y-p.y),pf=w.q>3?170:w.d>=60?520:w.cd<.12?300:280,a=Math.atan2(T.y-p.y,T.x-p.x);look=best?Math.atan2(T.y+(best.vy||0)*d/w.v*.9-p.y,T.x+(best.vx||0)*d/w.v*.9-p.x):a;
    const to=p.hp<35&&best?-1:d>pf+70?1:d<pf-70&&best?-1:0,s=best?.7*p.dir:0;
    if(!best&&d<60)p.lt=null;vx=Math.cos(a)*to-Math.sin(a)*s;vy=Math.sin(a)*to+Math.cos(a)*s}
  else{let g=null,gd=1e9;G.items.forEach(o=>{const d=Math.hypot(o.x-p.x,o.y-p.y);if(d<700&&d<gd&&(o.t||p.hp<95)){gd=d;g=o}});
    if(!g){if(!p.gp||Math.hypot(p.gp[0]-p.x,p.gp[1]-p.y)<70)p.gp=wp2(X);g={x:p.gp[0],y:p.gp[1]}}
    look=Math.atan2(g.y-p.y,g.x-p.x);vx=Math.cos(look);vy=Math.sin(look)}
  p.stk=(p.stk||0)+dt;if(p.stk>.6){if((vx||vy)&&Math.hypot(p.x-(p.sx||0),p.y-(p.sy||0))<12){p.gp=wp2(X);p.lt=null;p.dir=-p.dir}p.sx=p.x;p.sy=p.y;p.stk=0}
  const l=Math.hypot(vx,vy);if(l){vx/=l;vy/=l;for(let s=0;s<5&&hit(X,p.x+vx*60,p.y+vy*60,R);s++){const c=Math.cos(.6*p.dir),n=Math.sin(.6*p.dir);[vx,vy]=[vx*c-vy*n,vx*n+vy*c]}}
  I.mx=vx;I.my=vy;
  if((p.et=(p.et||0)-dt)<=0){p.et=.35;p.er=(Math.random()-.5)*(1-k)*.22}
  const da=ang(look+(best?p.er||0:0)-I.a),tr=(6+6*k)*dt;I.a+=Math.max(-tr,Math.min(tr,da));
  I.pt=best?Math.atan2(-24,Math.max(bd,80)):0;I.fp=1;I.fd=best?bd:450;
  I.f=best&&p.rt<=0&&Math.abs(da)<.14&&bd<w.l*w.v*.85&&Math.random()<.92?1:0;
}
function step(X,G,dt){
  if(G.over!==-1)return;
  G.players.forEach((p,i)=>{
    p.sp-=dt;p.dm-=dt;
    if(!p.alive){p.rs-=dt;if(p.rs<=0&&G.gm!==2&&G.gm!==3){p.alive=1;p.hp=100;[p.x,p.y]=X.spw[G.gm===1?(i%2)+2*(Math.random()<.5?0:1):Math.floor(Math.random()*4)]}return}
    if(p.bot)ai(X,G,p,i);
    const m=p.inp,l=Math.hypot(m.mx,m.my)||1,k=Math.min(1,l),v=210*dt*(p.sp>0?1.6:1);
    const nx=p.x+m.mx/l*k*v,ny=p.y+m.my/l*k*v;
    if(!hit(X,nx,p.y,R))p.x=nx;if(!hit(X,p.x,ny,R))p.y=ny;
    p.vx=(p.x-(p.px??p.x))/dt;p.vy=(p.y-(p.py??p.y))/dt;p.px=p.x;p.py=p.y;p.a=m.a;p.cd-=dt;
    if(!p.bot&&WP[m.w])p.wp=m.w;const w=WP[p.wp]||WP[0];
    if(m.f&&p.cd<=0){p.cd=w.cd;G.players.forEach((o,j)=>{if(j!==i&&o.bot&&o.alive&&!o.seen&&G.gm!==2&&!(G.gm===1&&j%2===i%2)&&Math.hypot(o.x-p.x,o.y-p.y)<1400)o.lt={x:p.x+(Math.random()-.5)*400,y:p.y+(Math.random()-.5)*400,t:3}});
      const ad=aimDir(p.x,p.y,m.a,m.pt||0,m.fp,m.fd);for(let q=0;q<w.q;q++){let d=ad.d.map(v=>v+(Math.random()-.5)*w.sp*2);const l=Math.hypot(...d);d=d.map(v=>v/l);
      G.bullets.push({x:ad.m[0],y:ad.m[2],z:ad.m[1],vx:d[0]*w.v,vy:d[2]*w.v,vz:d[1]*w.v,o:i,l:w.l,d:w.d})}}
  });
  G.mt-=dt;if(G.gm!==2&&G.mt<=0){G.mt=5;if(G.mons.length<8)spawnMon(X,G)}
  if(G.items.length<5&&Math.random()<dt*.15)spawnItem(X,G,Math.floor(Math.random()*3));
  G.mons=G.mons.filter(m=>m.hp>0);
  G.mons.forEach(m=>{let b=null,bd=1e9;G.players.forEach(p=>{if(p.alive){const d=Math.hypot(p.x-m.x,p.y-m.y);if(d<bd){bd=d;b=p}}});
    if(!b)return;const a=Math.atan2(b.y-m.y,b.x-m.x),nx=m.x+Math.cos(a)*95*dt,ny=m.y+Math.sin(a)*95*dt;
    if(!hit(X,nx,m.y,20))m.x=nx;if(!hit(X,m.x,ny,20))m.y=ny;
    m.cd-=dt;if(bd<R+20&&m.cd<=0){m.cd=.7;hurt(b,12)}});
  G.items=G.items.filter(it=>{for(const p of G.players)if(p.alive&&Math.hypot(p.x-it.x,p.y-it.y)<R+14){
    if(it.t===0)p.hp=Math.min(100,p.hp+40);else if(it.t===1)p.sp=8;else p.dm=8;return 0}return 1});
  G.bullets=G.bullets.filter(b=>{
    b.l-=dt;if(b.l<=0)return 0;const n=Math.ceil(Math.hypot(b.vx,b.vy,b.vz)*dt/18),h=dt/n,o=G.players[b.o],dmg=b.d*(o.dm>0?2:1);
    for(let s=0;s<n;s++){
      b.x+=b.vx*h;b.y+=b.vy*h;b.z+=b.vz*h;
      if(b.z<=0||b.z>500||(b.z<110&&hit(X,b.x,b.y,3)))return 0;
      for(const m of G.mons)if(m.hp>0&&b.z<56&&Math.hypot(m.x-b.x,m.y-b.y)<26){m.hp-=dmg;if(m.hp<=0&&Math.random()<.4)spawnItem(X,G,Math.floor(Math.random()*3),m.x,m.y);return 0}
      for(let j=0;j<4;j++){const p=G.players[j];
        if(j===b.o||!p.alive||G.gm===2||(G.gm===1&&j%2===b.o%2))continue;
        if(b.z<66&&Math.hypot(p.x-b.x,p.y-b.y)<R+4){
          if(hurt(p,dmg)){o.k++;if(G.gm===1){G.tk[b.o%2]++;if(G.tk[b.o%2]>=15)G.over=b.o}else if(G.gm===0&&o.k>=WIN)G.over=b.o}return 0}}
    }
    return 1;
  });
  if(G.gm===2){if(!G.mons.length){G.wt-=dt;if(G.wt<=0){G.wv++;G.wt=4;for(let i=0;i<2+G.wv*2;i++)spawnMon(X,G);G.players.forEach((p,i)=>{if(!p.alive){p.alive=1;p.hp=60;[p.x,p.y]=X.spw[i]}else p.hp=Math.min(100,p.hp+30)})}}
    if(G.players.every(p=>!p.alive))G.over=-3}
  if(G.gm===3){const al=G.players.filter(p=>p.alive);if(al.length<=1)G.over=al.length?G.players.indexOf(al[0]):-3}
}
const r1=v=>Math.round(v*10)/10;
function snap(room){const G=room.G,now=Date.now();return{t:'s',p:G.players.map(p=>[r1(p.x),r1(p.y),+p.a.toFixed(2),Math.max(0,Math.round(p.hp)),p.alive?1:0,p.k,p.sp>0?1:0,p.dm>0?1:0]),b:G.bullets.map(b=>[b.x|0,b.y|0,b.z|0]),m:G.mons.map(m=>[m.x|0,m.y|0]),i:G.items.map(i=>[i.x|0,i.y|0,i.t]),o:G.over,w:G.wv,tk:G.tk,ak:G.players.map(p=>p.ts?p.ts+(now-p.tsAt):0)}}

/* ---------- рейтинг ---------- */
const LB=Object.create(null);try{Object.assign(LB,JSON.parse(fs.readFileSync(path.join(DIR,'lb.json'),'utf8')))}catch(e){}
let lbT=null;const lbSave=()=>{clearTimeout(lbT);lbT=setTimeout(()=>fs.writeFile(path.join(DIR,'lb.json'),JSON.stringify(LB),()=>{}),2000)};
function recLB(room){const G=room.G;G.players.forEach((p,i)=>{if(!p.human)return;const e=LB[p.name]||(LB[p.name]={k:0,w:0}),win=G.over>=0&&(G.gm===1?i%2===G.over%2:i===G.over);e.k+=p.k;if(win)e.w++});lbSave()}

/* ---------- WebSocket (RFC 6455, минимум) ---------- */
function wsSend(sock,str){if(sock.destroyed)return;const p=Buffer.from(str),l=p.length;let h;if(l<126)h=Buffer.from([129,l]);else if(l<65536){h=Buffer.alloc(4);h[0]=129;h[1]=126;h.writeUInt16BE(l,2)}else{h=Buffer.alloc(10);h[0]=129;h[1]=127;h.writeBigUInt64BE(BigInt(l),2)}sock.write(Buffer.concat([h,p]))}
const tx=(c,o)=>wsSend(c.sock,JSON.stringify(o));
function parse(c){for(;;){const b=c.buf;if(b.length<2)return;const op=b[0]&15,fin=b[0]&128,mk=b[1]&128;let len=b[1]&127,o=2;
  if(len===126){if(b.length<4)return;len=b.readUInt16BE(2);o=4}else if(len===127){if(b.length<10)return;len=Number(b.readBigUInt64BE(2));o=10}
  if(len>8192||!mk){c.sock.destroy();return}
  if(b.length<o+4+len)return;const mm=b.slice(o,o+4),p=Buffer.from(b.slice(o+4,o+4+len));for(let i=0;i<len;i++)p[i]^=mm[i&3];c.buf=b.slice(o+4+len);
  if(op===8){c.sock.end();return}if(op===9){if(!c.sock.destroyed)c.sock.write(Buffer.concat([Buffer.from([138,p.length]),p]));continue}
  if(op===1||op===0){c.frag.push(p);if(fin){const t=Buffer.concat(c.frag).toString();c.frag=[];msg(c,t)}}}}

/* ---------- комнаты ---------- */
const rooms=new Map();
const clean=n=>String(n==null?'':n).replace(/[^\p{L}\p{N} _.\-]/gu,'').slice(0,10)||'Курица';
const cleanSk=k=>{const a=Array.isArray(k)?k:[];const n=(v,m)=>Math.max(0,Math.min(m,v|0));return[n(a[0],9),n(a[1],13),n(a[2],WP.length-1)]};
const clampCfg=r=>{r.g=((r.g%4)+4)%4;r.mp=((r.mp%MD.length)+MD.length)%MD.length};
function newRoom(pub){let code;do{code=String(1000+Math.floor(Math.random()*9000))}while(rooms.has(code));
  const r={code,pub,slots:[null,null,null,null],host:-1,g:0,mp:0,started:false,G:null,X:null,cd:Date.now()+15000,lastLob:0,endAt:0,acc:0,last:0};rooms.set(code,r);return r}
function bcast(r,str){r.slots.forEach(s=>{if(s)wsSend(s.c.sock,str)})}
function lob(r){bcast(r,JSON.stringify({t:'lob',n:r.slots.map(s=>s?s.name:''),k:r.slots.map(s=>s?s.sk:[]),g:r.g,mp:r.mp,h:r.host,cd:r.pub&&!r.started?Math.max(0,Math.ceil((r.cd-Date.now())/1000)):0}))}
function join(c,r,m){const s=r.slots.findIndex(x=>!x);if(s<0)return 0;c.room=r;c.slot=s;r.slots[s]={c,name:clean(m.n),sk:cleanSk(m.sk)};if(r.host<0)r.host=s;tx(c,{t:'hi',s,c:r.code,h:r.host});lob(r);return 1}
function start(r){if(r.started)return;const used=r.slots.map(s=>s&&s.name);
  const bn=()=>{let n,t=0;do{n=BN[Math.random()*BN.length|0]}while(used.includes(n)&&++t<40);used.push(n);return n};
  const X=mapData(r.mp),names=[],sk=[];
  r.slots.forEach((s,i)=>{names[i]=s?s.name:bn();sk[i]=s?s.sk:[Math.random()*10|0,Math.random()*14|0,Math.random()*WP.length|0]});
  const G={players:[0,1,2,3].map(i=>{const p=mkP(X,i,!r.slots[i],names[i],sk[i][2]);p.human=!!r.slots[i];return p}),bullets:[],mons:[],items:[],over:-1,mt:3,gm:r.g,wv:0,wt:2,tk:[0,0]};
  r.X=X;r.G=G;r.started=true;r.last=Date.now();bcast(r,JSON.stringify({t:'go',n:names,k:sk,g:r.g,mp:r.mp}))}
function kill(r){r.slots.forEach(s=>{if(s)s.c.sock.end()});rooms.delete(r.code)}
function drop(c){const r=c.room;if(!r)return;c.room=null;const s=c.slot;
  if(r.started){const p=r.G.players[s];if(p){p.bot=1;p.human=p.human;p.inp.f=0;p.inp.mx=p.inp.my=0}r.slots[s]=null;if(!r.slots.some(Boolean))rooms.delete(r.code)}
  else{r.slots[s]=null;if(!r.slots.some(Boolean)){rooms.delete(r.code);return}if(r.host===s)r.host=r.slots.findIndex(Boolean);lob(r)}}
function setInput(p,i){if(!i||typeof i!=='object')return;const n=(v,a,b,d)=>typeof v==='number'&&isFinite(v)?Math.max(a,Math.min(b,v)):d;
  p.inp={mx:n(i.mx,-1.5,1.5,0),my:n(i.my,-1.5,1.5,0),a:n(i.a,-1e6,1e6,0),pt:n(i.pt,-1,1,0),fp:i.fp?1:0,f:i.f?1:0,w:n(i.w,0,WP.length-1,0)|0,fd:n(i.fd,40,1600,450)};
  if(typeof i.ts==='number'&&isFinite(i.ts)){p.ts=i.ts;p.tsAt=Date.now()}}
function msg(c,t){let m;try{m=JSON.parse(t)}catch(e){return}if(!m||typeof m!=='object')return;const room=c.room;
  switch(m.t){
  case 'ping':tx(c,{t:'pong',ts:m.ts});break;
  case 'create':if(!room){const r=newRoom(false);r.g=m.g|0;r.mp=m.mp|0;clampCfg(r);join(c,r,m)}break;
  case 'join':if(!room){const r=rooms.get(String(m.c));if(!r||r.started)tx(c,{t:'err',m:'Комната не найдена или бой уже идёт'});else if(!join(c,r,m))tx(c,{t:'err',m:'Комната заполнена'})}break;
  case 'quick':if(!room){let r=[...rooms.values()].find(x=>x.pub&&!x.started&&x.slots.some(s=>!s));if(!r){r=newRoom(true);r.g=[0,0,3,1][Math.random()*4|0];r.mp=Math.random()*MD.length|0}join(c,r,m)}break;
  case 'cfg':if(room&&!room.started&&room.host===c.slot){room.g=m.g|0;room.mp=m.mp|0;clampCfg(room);lob(room)}break;
  case 'start':if(room&&!room.started&&room.host===c.slot)start(room);break;
  case 'in':if(room&&room.started){const p=room.G.players[c.slot];if(p&&!p.bot)setInput(p,m.i)}break}}

setInterval(()=>{const now=Date.now();for(const r of [...rooms.values()]){
  if(!r.started){if(r.pub){if(now>=r.cd||r.slots.every(Boolean))start(r);else if(now-r.lastLob>1000){r.lastLob=now;lob(r)}}continue}
  const G=r.G,dt=Math.min(.05,(now-r.last)/1000);r.last=now;step(r.X,G,dt);
  r.acc+=dt;if(r.acc>=.04){r.acc=0;bcast(r,JSON.stringify(snap(r)))}
  if(G.over!==-1){if(!r.endAt){r.endAt=now+9000;recLB(r)}else if(now>r.endAt)kill(r)}}},16);
setInterval(()=>{for(const r of rooms.values())r.slots.forEach(s=>{if(s&&!s.c.sock.destroyed)s.c.sock.write(Buffer.from([137,0]))})},25000);

/* ---------- HTTP ---------- */
const srv=http.createServer((req,res)=>{const u=req.url.split('?')[0];
  if(u==='/'||u==='/index.html'){fs.readFile(path.join(DIR,'index.html'),(e,d)=>{if(e){res.writeHead(500);res.end('index.html not found');return}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});res.end(d)})}
  else if(u==='/lb.json'){res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(LB))}
  else if(u==='/health'){res.writeHead(200);res.end('ok '+rooms.size)}
  else{res.writeHead(404);res.end('404')}});
srv.on('upgrade',(req,sock)=>{if(req.url.split('?')[0]!=='/ws'||!req.headers['sec-websocket-key']){sock.destroy();return}
  const key=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+key+'\r\n\r\n');sock.setNoDelay(true);
  const c={sock,buf:Buffer.alloc(0),frag:[],room:null,slot:-1};
  sock.on('data',d=>{c.buf=Buffer.concat([c.buf,d]);try{parse(c)}catch(e){sock.destroy()}});sock.on('close',()=>drop(c));sock.on('error',()=>{})});
process.on('uncaughtException',e=>console.error('ERR',e));
if(require.main===module)srv.listen(PORT,()=>console.log('Chicken Arena server: http://localhost:'+PORT));
module.exports={mapData};

