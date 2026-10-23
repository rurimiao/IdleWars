const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1400,height:900}});const er=[];p.on('pageerror',e=>er.push(e.message));await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
await p.evaluate(()=>{sHumans.value='1';sPlayers.value=4;sSpeed.value='0.05';sSpeed.dispatchEvent(new Event('change'));newBtn.click()});
await p.waitForFunction(()=>{const G=__game.G;return G.players[G.cur].human&&!G.busy&&!G.pause},null,{timeout:60000});
const r=await p.evaluate(()=>{const d=__game,G=d.G,me=G.cur,res={};
 // make three infantry in a row: B in middle with two neighbors A and C
 const B=G.L.find(l=>l.owner===me&&l.type===0);
 const nb=[];for(let e=0;e<6;e++){const v=G.link[B.cell*6+e];if(v>=0&&!G.lg[v]&&G.zone[v]>=0)nb.push(v)}
 const mk=(c,n)=>{const L=G.L.find(l=>l.owner===me&&l.type===0&&l!==B&&!l._u);return L};
 const others=G.L.filter(l=>l.owner===me&&l.type===0&&l!==B).slice(0,2);
 // teleport the others next to B
 G.lg[others[0].cell]=null;others[0].cell=nb[0];G.lg[nb[0]]=others[0];
 G.lg[others[1].cell]=null;others[1].cell=nb[1];G.lg[nb[1]]=others[1];
 B.n=5;others[0].n=8;others[1].n=8;
 res.m1=d.orderSplit(others[0],7,B.cell);res.acted=B.acted;res.recv=B.recvN;
 res.m2=d.orderSplit(others[1],7,B.cell);res.recv2=B.recvN;res.n=B.n;
 res.cancel=d.cancelOrder(others[0]);res.afterCancelActed=B.acted;res.recv3=B.recvN;
 res.cancel2=d.cancelOrder(others[1]);res.actedEnd=B.acted;
 return res});
console.log(JSON.stringify(r),er);
// popup test
await p.evaluate(()=>{const G=__game.G,me=G.cur;const L=G.L.find(l=>l.owner===me&&l.type===0);G.sel=L.cell;G.mode='march';G.ver++;__game.ui(true)});
await p.mouse.click(300,300);await p.waitForTimeout(200);
console.log(await p.evaluate(()=>[denyModal.hidden,denyT.textContent,denyP.textContent]));
await p.screenshot({path:process.argv[3]});await b.close()})()
