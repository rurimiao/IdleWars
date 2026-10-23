const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1300,height:900}});const er=[];p.on('pageerror',e=>er.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')er.push('CONSOLE '+m.text().slice(0,200))});await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
await p.evaluate(()=>{sHumans.value='1';sPlayers.value=4;sClr.checked=true;sClr.dispatchEvent(new Event('change'));sSpeed.value='0.05';sSpeed.dispatchEvent(new Event('change'));newBtn.click()});
const hum=()=>p.waitForFunction(()=>{const G=__game.G;return G.players[G.cur].human&&!G.busy&&!G.pause},null,{timeout:60000});
await hum();
// round 1: skip
await p.evaluate(()=>(endBtn.click(),__game.G._endWarn&&(__game.G._endWarnAt=-1e9),endBtn.click()));await hum();
const r=await p.evaluate(()=>{const G=__game.G,me=G.cur;G.paused=false;const A=G.L.find(l=>l.owner===me&&l.type===0);const t=G.land.find(i=>G.zone[i]>=0&&!G.lg[i]&&!G.def[i]&&__game.hexDist(A.cell,i)>=2&&__game.hexDist(A.cell,i)<=3);const ok=__game.orderMarch(A,t);return {id:A.id,from:A.cell,t,ok,round:G.round,clr:G.clearing}});
console.log(r);
await p.evaluate(()=>(endBtn.click(),__game.G._endWarn&&(__game.G._endWarnAt=-1e9),endBtn.click()));
await p.waitForTimeout(800);
const mid=await p.evaluate(id=>{const L=__game.G.L.find(x=>x.id===id);return {cell:L&&L.cell,round:__game.G.round}},r.id);console.log('after my turn ended (AI turns running)',mid);
await hum();
const after=await p.evaluate(id=>{const G=__game.G,L=G.L.find(x=>x.id===id);return {cell:L&&L.cell,st:L&&L.st,tgt:L&&L.tgt,round:G.round,lines:G.log.filter(m=>/^logClr/.test(m.key)).slice(-4).map(m=>__game.logText(m))}},r.id);
console.log(after,er);await b.close()})()
