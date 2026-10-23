const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1300,height:900}});const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.argv[2]);
await p.evaluate(()=>{sHumans.value='1';sPlayers.value=4;sFf.value='0';newBtn.click()});await p.waitForFunction(()=>{const G=__game.G;return G&&G.players[G.cur].human&&!G.busy},null,{timeout:60000});
await p.click('.dtabs button[data-dt="todo"]');
await p.evaluate(()=>{endBtn.click();__game.G._endWarnAt=-1e9;endBtn.click()});
const seen=[];for(let i=0;i<300;i++){await p.waitForTimeout(150);const t=await p.evaluate(()=>{const G=__game.G;return G.cur+'/'+__game.cpLeft(G.cur)+'/'+G.L.filter(l=>l.owner===G.cur&&l.acted).length+':'+document.querySelector('#todoEco .kvx:last-child').textContent.replace(/\s/g,'')});if(seen[seen.length-1]!==t)seen.push(t);if(await p.evaluate(()=>{const G=__game.G;return G.players[G.cur].human&&!G.busy&&G.round>1}))break}
console.log(seen.join(' | '),er);await p.screenshot({path:'/tmp/cp4.png',clip:{x:900,y:50,width:400,height:120}});await b.close()})()
