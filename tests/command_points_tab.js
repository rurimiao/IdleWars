const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1300,height:900}});const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.argv[2]);
await p.evaluate(()=>{sHumans.value='1';sPlayers.value=4;sFf.value='0';newBtn.click()});await p.waitForFunction(()=>{const G=__game.G;return G&&G.players[G.cur].human&&!G.busy},null,{timeout:60000});
await p.click('.dtabs button[data-dt="todo"]');await p.waitForTimeout(300);
await p.click('button[data-tdtab="a:cp"]');await p.waitForTimeout(300);
await p.screenshot({path:'/tmp/cp3.png',clip:{x:900,y:50,width:400,height:500}});console.log(er);await b.close()})()
