const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1400,height:900}});const er=[];p.on('pageerror',e=>er.push(e.message));await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
await p.evaluate(()=>{sHumans.value='1';sPlayers.value=4;sClr.checked=true;sClr.dispatchEvent(new Event('change'));sSpeed.value='1';sSpeed.dispatchEvent(new Event('change'));sFf.value='0';newBtn.click()});
const hum=()=>p.waitForFunction(()=>{const G=__game.G;return G.players[G.cur].human&&!G.busy&&!G.pause},null,{timeout:90000});
const end=()=>p.evaluate(()=>{endBtn.click();__game.G._endWarnAt=-1e9;endBtn.click()});
await hum();await end();await hum();
// round 2 under clearing: order a few marches and a strike
await p.evaluate(()=>{const d=__game,G=d.G,me=G.cur;let n=0;for(const L of G.L.filter(l=>l.owner===me&&l.type===0)){if(n>=4)break;const c=[...Array(G.def.length).keys()].find(x=>G.zone[x]>=0&&!G.lg[x]&&d.hexDist(x,L.cell)===2);if(c!=null&&d.orderMarch(L,c))n++}
 const A=G.L.find(l=>l.owner===me&&l.type===1&&!l.acted);if(A){const c=[...Array(G.def.length).keys()].find(x=>G.zone[x]>=0&&d.hexDist(x,A.cell)>=2&&d.hexDist(x,A.cell)<=5);window.__st=d.orderStrike(A,c,null)}G.ver++;d.ui(true);return [n,!!A,window.__st]}).then(r=>console.log('ordered',r));
const t0=Date.now();await end();
let shot=0;const marks=[];
for(let i=0;i<80;i++){await p.waitForTimeout(250);const s=await p.evaluate(()=>{const G=__game.G;return [G.round,G.cur,G._phase||"-",hintText.textContent.slice(0,12),getComputedStyle(hint).display]});

 marks.push(s.join(','));if(s[0]>=3)break}
console.log(Date.now()-t0,marks.slice(0,24).join(' | '),er);await b.close()})()
