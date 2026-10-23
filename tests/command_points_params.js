const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1300,height:900}});const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.argv[2]);
await p.evaluate(()=>{sHumans.value='1';sPlayers.value=4;sFf.value='0';newBtn.click()});await p.waitForFunction(()=>{const G=__game.G;return G&&G.players[G.cur].human&&!G.busy},null,{timeout:60000});
await p.click('#bSet');await p.waitForTimeout(200);await p.click('#mRules');await p.waitForTimeout(300);await p.click('button[data-rt="cp"]');await p.waitForTimeout(300);
await p.screenshot({path:'/tmp/cp1.png'});await p.click('#mClose');
const r=await p.evaluate(()=>{const d=__game,G=d.G;return [d.cpMax(G.cur),d.cpUsed(G.cur),d.cpLeft(G.cur)]});console.log(r,er);await b.close()})()
