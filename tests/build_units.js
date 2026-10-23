const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1400,height:900}});const er=[];p.on('pageerror',e=>er.push(e.message));await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
await p.evaluate(()=>{sHumans.value='1';sPlayers.value=4;sSpeed.value='0.05';sSpeed.dispatchEvent(new Event('change'));newBtn.click()});
const hum=()=>p.waitForFunction(()=>{const G=__game.G;return G.players[G.cur].human&&!G.busy&&!G.pause},null,{timeout:60000});
await hum();
const r=await p.evaluate(()=>{const d=__game,G=d.G,me=G.cur;G.players[me].stock=5000;const C=[...Array(G.def.length).keys()].filter(x=>G.def[x]>=200&&G.co[x]===me).find(x=>d.orderBuildUnits(me,x,0,3)===false&&d.orderBuildUnits(me,x,0,7));
 const res={};res.ordered=G.players[me].pending.length;res.C=C;res.before=G.L.filter(l=>l.owner===me).length;return res});
const end=()=>p.evaluate(()=>{endBtn.click();__game.G._endWarnAt=-1e9;endBtn.click()});
await end();await hum();
console.log(JSON.stringify(r),await p.evaluate((C)=>{const G=__game.G,me=G.cur;return [G.L.filter(l=>l.owner===me).length,G.log.filter(m=>m.key==='logSpawn').length,G.players[me].pending.length]},r.C),er);await b.close()})()
