const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1400,height:900}});const er=[];p.on('pageerror',e=>er.push(e.message));await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
await p.evaluate(()=>{sHumans.value='1';sPlayers.value=4;sSpeed.value='1';sSpeed.dispatchEvent(new Event('change'));sFf.value='0';newBtn.click()});
await p.waitForFunction(()=>{const G=__game.G;return G&&G.players[G.cur].human&&!G.busy&&!G.pause},null,{timeout:60000});
await p.evaluate(()=>{endBtn.click();__game.G._endWarnAt=-1e9;endBtn.click()});
await p.waitForFunction(()=>!__game.G.players[__game.G.cur].human,null,{timeout:20000});
console.log('pre',JSON.stringify(await p.evaluate(()=>[__game.G.cur,__game.G.round,ffBtn.disabled])));await p.click('#ffBtn');console.log('post',JSON.stringify(await p.evaluate(()=>[__game.G._ffPause,__game.G._ff,__game.G.cur])));
await p.waitForFunction(()=>__game.G.round===2,null,{timeout:30000});
for(const w of [0,300,800,1500]){await p.waitForTimeout(w);console.log(w,JSON.stringify(await p.evaluate(()=>[__game.G.paused,__game.G.cur,__game.G.players[__game.G.cur].human,pauseBtn.textContent,__game.G.round])))}
console.log(er);await b.close()})()
