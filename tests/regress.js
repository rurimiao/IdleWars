// 依次跑三个回归测试（一次只跑一个），按各自的“通过”输出判断，有一个不通过就以非 0 退出
const { spawnSync } = require('child_process');
const path = require('path');
const page = path.resolve(__dirname, '..', 'idlewars.html');
const runs = [
  ['all_panels.js', /errors \[\]/],
  ['save_load.js', /no errors/],
  ['clearing_sim.js', /bad \[\] errors \[\]/],
];
let failed = 0;
for (const [file, ok] of runs) {
  const r = spawnSync('node', [path.join(__dirname, file), page], { encoding: 'utf8', timeout: 170000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const pass = r.status === 0 && ok.test(out);
  if (!pass) failed++;
  console.log((pass ? '通过 ' : '失败 ') + file);
  if (!pass) console.log(out.split('\n').slice(-15).join('\n'));
}
process.exit(failed ? 1 : 0);
