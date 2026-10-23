const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1400,height:900}});const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.argv[2]);
await p.evaluate(()=>{sHumans.value='0';sPlayers.value=5;sSpeed.value='0.05';sSpeed.dispatchEvent(new Event('change'));sFf.value='25';newBtn.click()});
await p.waitForFunction(()=>__game.G.round>=25,null,{timeout:100000});
await p.evaluate(()=>{zFit.click();zFront.click()});await p.waitForTimeout(600);
await p.screenshot({path:process.argv[3]});console.log(er);await b.close()})()
