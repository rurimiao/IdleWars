const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1300,height:900}});const er=[];p.on('pageerror',e=>er.push(e.message));
await p.goto('file://'+process.argv[2]);
await p.evaluate(()=>{sHumans.value='1';sPlayers.value=4;sFf.value='0';newBtn.click()});await p.waitForFunction(()=>{const G=__game.G;return G&&G.players[G.cur].human&&!G.busy},null,{timeout:60000});
await p.click('.dtabs button[data-dt="todo"]');await p.waitForTimeout(300);
console.log(await p.evaluate(()=>document.querySelector('#todoEco .kvx:last-child').title));
await p.click('#bHelp');await p.click('button[data-hg="turn"]');await p.waitForTimeout(200);
const btn=await p.$$eval('button[data-hs]',bs=>bs.filter(b=>b.textContent==='指挥点').length);console.log('nav',btn);
await p.click('button[data-hs]:text-is("指挥点")');await p.waitForTimeout(300);await p.screenshot({path:'/tmp/cp2.png'});console.log(er);await b.close()})()
