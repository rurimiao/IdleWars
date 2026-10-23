# 交接说明（给接手的模型）

规则和改动记录见 `design.md`；这一页讲怎么动手。习惯与约定见 `../CLAUDE.md`。

## 1. 代码地图

页面是一个 HTML：骨架和全部 CSS，加一个 `<script>`，里面一个 IIFE，下面的文件按顺序连起来，**共用一个作用域，没有 import**。拼装顺序见 `build.sh`。

| 文件 | 负责什么 |
| --- | --- |
| `page.html` | HTML 骨架、全部 CSS（深浅色、固定高度卡片 `.tdcard`、弹窗、帮助窗口）、版本号。新游戏面板和设置控件的 `id` 都在这里 |
| `core.js` | 常量和基础工具：`TYPES`（两个兵种的表）、六边形坐标（`hexDist`、`within`、`nbrs`）、堆（找路用） |
| `text.js` | 全部中文文案 `L.zh`、`tr()`、帮助正文。最大的文件 |
| `avatars.js` `sound_data.js` `sound.js` | 国家颜色 `hue()`、头像绘制；枪声和炮声的录音（base64）；音效（WebAudio，`snd.*`） |
| `settings.js` | `DEFAULTS`（所有可调设置的默认值）、`applyParams`（夹进合法范围并写回 `TYPES`）、`readForm`/`writeForm`（新游戏面板和设置读写） |
| `mapgen.js` | 地图生成：大区、障碍、陆地连通、初始城市 |
| `game.js` | **规则和状态**：创建与存档、补给覆盖与可达、下令、行军、开火、清算、经济、回合推进。最重要，约 1060 行 |
| `ai.js` | 电脑：造兵、想法（意图）、造城、逐兵团下令、`aiTurn` |
| `ui.js` | 绘制（`draw`）、面板、弹窗（`deny`/`confirmBox`）、居中“轮到谁”提示、电脑步骤回放（`playLive`）、状态栏（`hintUI`）、补给线（`supplyViz`）、“战线”概览（`drawFront`） |
| `panel_list.js` | “清单”页（大区/城市/兵团） |
| `stats.js` | 统计窗口和曲线 |
| `panel_orders.js` | “操作”页顶部的经济卡和两张分页卡片 |
| `panel_players.js` | “玩家”页和“经济”页 |
| `controls.js` | 接线：按钮和键盘事件、帮助窗口、参数窗口、快进和托管弹窗。结尾把内部函数挂到 `window.__game` 供测试用 |
| `eslint.config.mjs` | 可选的 eslint 配置（未使用变量的警告很多，忽略） |

### 状态 `G`（一局游戏，全局单例，存档用 `packGame`/`unpackGame`）

- 格子用一维下标：`G.X[c]`/`G.Y[c]` 像素坐标，`G.zone[c]` 大区编号（-1 = 空洞），`G.def[c]` 城防（≥ `CITY_MIN` 才是大城市，低于它是工地），`G.co[c]` 城的主人，`G.wasCity[c]` 这格已经当过大城市（建成新城奖励每座城只发一次；被占时清零，旧存档按城防补上），`G.lg[c]` 该格上的兵团（每格最多一个），`G.land` 所有陆地格。
- `G.players[p]`：`human`、`alive`、`stock`、`income`、`pending`（在途造兵订单）。`G.order` 行动座次，`G.cur` 现在轮到谁，`G.round` 回合数。
- `G.L` 全部兵团。关键字段：`type`（0 步兵 / 1 炮兵）、`n`、`cell`、`st`（`alert` 戒备 / `march` 行军）、`tgt`、`sup`（携带补给）、`hoard`（备粮目标）、`acted`（这回合用过行动点）、`cpFree`（这个行动不占指挥点）、`atk`（攻击目标兵团 id；-1 = 清算制里打某个格子，目标在 `atkCell`/`atkV`）、`bld`（在修城）、`splitRound`（这回合参与了拆并，回合末不自动开火）、`firedRound`（这回合已经开过火）、`undo`（撤销快照）、`mv`（显示用 `{from,t0,dur}`，滑动动画）、`dead`。
- `G.ver` 是“版本号”：**任何改了状态的操作都要调 `touch()`**，补给、覆盖、面板的缓存都靠它失效。
- `G.clearing`：这一局是否用清算制（开局时从 `S.clr` 复制，中途切换从下回合起生效）。`G.busy` 正在结算一个回合，`G.pause` 暂停。
- `G.fx`（开火线）、`G.pops`（上浮的字）、`G._aim`（清算目标预览）只给绘制用，不存档。

### 设置 `S` 和默认值

- `S` 存在 `localStorage['idlewars-command-1']`，存档在 `idlewars-command-save-1`。新加一个设置要改 4 处：`DEFAULTS`、`applyParams`（夹值）、`readForm`（列进重建 `S` 的对象里）、参数窗口（`controls.js` 里 `PK` 表和 `cRow`）。例：指挥点的 `cpBase`（4）、`cpDiv`（200）。

## 2. 核心流程

### 回合推进（`game.js`：`endTurn` → `doEndTurn` → `roundEnd`）

1. 真人点“结束回合”，或电脑 `aiTurn` 跑完，进 `doEndTurn()`：`G.busy = true`。
2. **轮流制**：先让这个国家的行军兵团走完（`stepMarch(p)`）。**清算制**这一步什么也不做，命令只记在兵团身上。
3. 找座次上下一个活着的国家。绕了一圈 → `roundEnd()`：
   - 轮流制：`fireRound()`，这回合还没开过火的兵团同时开火。攻击命令早在下令时就由 `attackNow()` → `fireNow()` 当场打掉了（人和电脑都走这条路，界面和 `__game` 都调 `attackNow`）。
   - 清算制：`declareStrikes()` → `clearMoves()`（所有行军同时算落点）→ `clearAim()`（打击范围预览）→ `await clearFire()`（逐个目标结算）。
   - 不管哪种，操作全部清算完才对每个活着的国家跑 `economy(p)`；然后 `zoneChanges()`、把到达的行军兵团改回戒备、`checkAlive()`。
4. `checkOver()` 判胜负；`G.round++`，`G.clearing = !!S.clr`。
5. `G.cur` 换下一个国家，`startTurn(p)` 清零它所有兵团的 `acted`/`undo`/`cpFree`/`grp`（指挥点每回合就是这样重置的）。真人国弹“轮到谁”，电脑国由 `runAI()` 接着跑。

快进只改 `quick()`，不跳过任何规则计算；`G.ffUntil`、`G._ff`、`G._ffPause` 控制快进。

### 清算制的实现要点

- **状态一次改完，画面分步播**：`clearMoves()` 在同一个调用里算完并应用所有落点（抢同一格、目标被占就退格，循环到稳定），每个移动的兵团带上 `L.mv = {from, t0: 现在 + 延迟}`，绘制时一个接一个滑过去。补给线则把还没播到的兵团临时当成站在原来的格子（`supplyViz`）。
- **开火是真的逐个结算**：`resolveFireSeq` 先把所有骰子掷完（`rollShots`），再一个目标一个目标地应用伤害（`applyShots`），每个之间 `await sleep(clrStep())`。结果和同时结算一致。
- 阶段文字：`phase(k)` 设 `g._phase` 为 `phMove`/`phAim`/`phFire`/`phDone`，`hintUI()` 读它；“① 表达意图”没有 `_phase`，是 `hintUI` 在清算制里轮到电脑国时直接写的。
- **播放顺序**：`byRegion(items, cellOf)` 把事项按大区分组，大区之间和大区里都是“离上一个最近的先播”，起点是左上角。移动、标出目标、开火三段都用它。
- **每一步的时长**：`clrStep()` = 设置里“电脑每步停留”（`S.step` 秒，默认 1.5），`quick()` 为真时是 0。这是唯一的节奏参数，不要再加“兵团多就自动缩短”。
- 计算时先让所有人离开原格（`G.lg[L.cell] = null`），再逐个站上去，两个兵团才能“互相穿过”。

### 指挥点（`cpMax` / `cpUsed` / `cpLeft` / `cpLines`）

- 总数 = `S.cpBase` + 每座该国大城的 `floor(城防 / S.cpDiv)`（默认 4 和 200），按 `G.ver + round` 缓存。
- 已用数**不存下来，从兵团身上现算**：本国已用过行动点、且没有 `cpFree` 的兵团个数（带 `grp` 编号的组只算 1 点，是为将来“编组下令”留的接口，现在没有命令会设它）。撤销命令（`L.acted = false`）自动退点。
- 没点数了：`canAct(L)` 返回 false，所有 `orderXxx` 先检查它，电脑也自动受限；人的界面由 `whyAp`（`ui.js`）弹窗解释。拆并出的新兵团和第一次接收合并的接收方设 `cpFree = true`。
- 显示：“操作”页经济卡第三栏永远用 `G.cur` 的点数；“指挥点”分页逐行列出构成。电脑下令时靠 `draw()` 里调 `renderTodoEco()` 刷新。

### 电脑怎么决策（`ai.js`）

- `aiTurn(p, play)`：`aiProduce`（造兵）→ `aiThink`（更新“想法”：进攻某城、占领某大区、报复某国，带强度和剩余回合）→ `aiBuildCity` ×2 → 对每个兵团用 `aiLegion` 下令（随机顺序，每个步骤记进 `STEPS`）。`aiExpand` 现在是空函数。
- 分数都是手写的规则打分，不是搜索或学习；风格（`aiStyle`）和难度（`AIK`）只是调权重。原理在帮助“电脑 > 电脑决策原理”。
- 电脑是一批批下令、一批批演示（`flush`）：`playLive`（`ui.js`）把 `STEPS` 里的步骤重新“演给你看”，字幕、镜头、声音，每步等“电脑每步停留”；你中途拖动地图就暂停跟随。

## 3. 显示、动画和界面的约定

- `quick()` 为真时所有“等一等”都跳过：点了快进按钮、自动快进中、或速度小于 0.1。`wait(ms)` 和 `clrStep()` 都看它。
- **没有“动画速度”这个用户设置了**，`S.speed` 强制为 '1'。`#sSpeed` 这个隐藏控件还保留，只给自动测试用（调成 0.05 让模拟跑得快）。不要再暴露给用户。
- 兵团滑动一格固定 320 毫秒（`L.mv`）。“轮到谁”大提示的停留是另一个设置（`S.tbs`，1–9 秒，每条想法再加 1 秒）。
- 镜头：`camTo(x, y, ms)`；电脑回合和清算每一步都跟随（`camStep`），每步平移一次，时长比这一步的停留短，**不要让两次平移重叠**（会抖屏）。“镜头跟随”指示器（`G._camOff`）关了或开了迷雾而那一格你看不见时不动。
- 重绘：状态改动后调 `requestDraw()`。滑动、上浮字、打击线都按 `performance.now()` 算，没有独立定时器。
- 补给线（`supplyViz`）：缓存在 `G._svz`，键是 `G.ver` 和“还没滑完的兵团 id 列表”。有兵团没滑完时临时把它们放回原格、换掉缓存和 `G.ver` 再算，**必须 `try/finally` 换回来**。
- 上浮字：`G.pops.push({cell, txt, c, t0})`，`t0` 可在将来。清算的“抵达 / 被阻挡在原地 / 被阻挡在半路 / 被敌军拦下 / 打空”用 `clrPop`。
- **状态栏**（顶栏标题旁，`hintUI()`）优先级：游戏结束 → `G._phase`（清算阶段文字）→ 正在结算 → 鼠标指到的格子信息 → 现在的情况（真人回合“请下达命令”，电脑回合“某国正在思考 / 清算制 ① 表达意图”）。用户要求**一直显示当前状态**。
- **操作页所有卡片固定高度**（`.tdcard`、`.todoeco` 等），内容超出在卡里滚动；不要往卡片里加会自动换行的内容。
- “不能这么操作”一律用弹窗 `deny(title, body)`；确认类用 `confirmBox`（三个按钮，`data-tone` 决定颜色）。拒绝原因的文字在 `dn*` 键里，由 `why*` 函数（`whyMarch`、`whySplit`、`whyAp`）挑。
- “结束回合”要再点一次确认；700 毫秒内的连点不算确认；点“快进”“托管”也先弹窗。
- 帮助窗口目录是可折叠的树；新加一页要同时改 `howSections` 的分组（`controls.js` 里 `isTurn` 等）和对应文案。帮助正文是字符串数组：`#` 开头是节标题，`>` 开头是上一行的缩进子项，`<b>…</b>` 是粗体。

## 4. 测试

没有测试框架。`tests/` 里每个都是一个 Node + Playwright 脚本，用浏览器打开拼好的页面，在页面里调 `window.__game` 读写状态。

### 环境

- 浏览器：云容器里已装好 Chromium，`chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'})`，**不要跑 `playwright install`**。
- 第一次先 `npm install`，只装 playwright 模块（`package.json` 里锁了版本），浏览器不另外下载。别的机器上浏览器不在这个路径，就用环境变量 `CHROMIUM` 指定。
- 三个回归一起跑：`npm test`（先拼装，再依次跑 `all_panels`、`save_load`、`clearing_sim`，全部通过才返回 0，脚本是 `tests/regress.js`）。
- 单独跑一个：`timeout 170 node tests/xxx.js $PWD/idlewars.html`，页面路径是第一个参数。一次只跑一个（并发会因为抢 CPU 超时）。截图写到 `/tmp/`。
- 页面报错一律收集：`p.on('pageerror', e => er.push(e.message))`，结尾打印；通过的输出是 `errors []`。

### 通用写法（每个脚本都从这几行开始）

```js
const {chromium} = require('playwright');
(async () => {
  const b = await chromium.launch({executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium'});
  const p = await b.newPage({viewport: {width: 1300, height: 900}});   // 最小布局 1300×800
  const er = []; p.on('pageerror', e => er.push(e.message));
  await p.goto('file://' + process.argv[2]);
  // 页面一打开就是“新游戏”面板，要先点 newBtn，否则别的按钮点不到
  await p.evaluate(() => {
    sHumans.value = '1'; sPlayers.value = 4; sFf.value = '0';
    sClr.checked = true; sClr.dispatchEvent(new Event('change'));      // 清算制
    sSpeed.value = '0.05'; sSpeed.dispatchEvent(new Event('change'));  // 隐藏控件：模拟要快时用
    newBtn.click();
  });
  const hum = () => p.waitForFunction(() => { const G = __game.G; return G.players[G.cur].human && !G.busy && !G.pause; }, null, {timeout: 90000});
  // 结束回合要点两次（第一次只是确认，第二次前先把“防快速双击”的时间戳拨回去）
  const end = () => p.evaluate(() => { endBtn.click(); __game.G._endWarnAt = -1e9; endBtn.click(); });
  await hum(); await end(); await hum();
  console.log('errors', er); await b.close();
})();
```

开局前要把“自动快进” `sFf` 置 0。想看真实节奏就不要把 `sSpeed` 调小，而且“电脑每步停留”默认 1.5 秒，一回合要十几秒，超时要给足。`sHumans = 0` 是全电脑观战。

### 不变量检查（模拟里每隔几秒跑一次，任何一条不满足都是真 bug）

```js
const bad = await p.evaluate(() => {
  const G = __game.G, bad = [], seen = new Set();
  for (const L of G.L) {
    if (L.dead) bad.push('dead in list');
    if (G.lg[L.cell] !== L) bad.push('lg mismatch ' + L.id);      // 格子表和兵团位置必须一致
    if (seen.has(L.cell)) bad.push('two legions in one cell');
    seen.add(L.cell);
    if (L.n <= 0) bad.push('n<=0');
    if (L.n > __game.TYPES[L.type].cap) bad.push('over cap ' + L.n);
  }
  let cnt = 0; for (const x of G.lg) if (x) cnt++;
  if (cnt !== G.L.length) bad.push('lg count ' + cnt + ' vs ' + G.L.length);
  return bad;
});
```

### 脚本清单

| 脚本 | 作用 | 通过的输出 |
| --- | --- | --- |
| `all_panels.js` | 依次打开帮助（先点开分组再点各页）、右侧各面板标签、规则参数的四个页（兵种/城池/大区/指挥点）、统计窗口，只看有没有页面报错。**每次改动都要跑** | `errors []` |
| `save_load.js` | 开局、走几回合、存档、读档，比对回合数、兵团数、总人数、库存、城防总和 | `no errors` |
| `clearing_sim.js` | 6 个电脑国、清算制跑约 80 秒，每 2 秒查一次不变量，还打印几条清算战报样例 | `bad [] errors []` |
| `ai_sim.js` | 纯电脑模拟：`node tests/ai_sim.js <html> <玩家数> <最大回合> <难度> <大小> <秒>`，环境变量 `FOG=1` 开迷雾；打印回合、城池数、库存、兵团和人数，用来对比改动前后电脑的表现（先对基线再对新版，样本很小只能看大趋势） | 无 `bad` |
| `orders_tab.js` | 操作页“没有行动点”“城市已下单”这类原因文字 | 打印出正确的句子 |
| `clearing_anim.js` / `clearing_status_bar.js` / `clearing_supply_lines.js` | 清算演示：截图、状态栏阶段文字轮询、补给线随每一步的变化和格子表一致性 | 轮询序列里的值按预期变化 |
| `command_points_params.js` / `command_points_help.js` / `command_points_tab.js` / `command_points_ai.js` | 指挥点：参数页截图、帮助页、操作页标签、电脑下令时指挥点轮询 | 数字随下令减少 |
| `front_view.js` | 只用电脑跑 25 回合，点“战线”后截图 | 截图里图标和弧线清楚 |
| `clearing_strike.js` | 清算制朝格子开火：定目标、打空、打中走进来的敌军 | 打印的结果符合规则 |
| `fast_forward.js` | 快进按钮：电脑回合中点快进后的暂停和继续 | 打印的状态前后变化正确 |
| `merge.js` | 拆并：几个兵团并进同一个接收方，再撤销；并完剩下不够最小编制要被拒；全部并走原兵团消失 | 打印的人数和行动点正确，`leaveTooFew:false`、`allGone:true` |
| `attack_now.js` | 轮流制里真人下攻击命令当场开火，撤销快照被清掉 | `ok` |
| `build_units.js` | 造兵：下单，到期出营编成新兵团 | 兵团数多 1 |

### 小经验

- 点按钮时可能被弹窗挡住（`intercepts pointer events`）：页面打开就有“新游戏”面板，没开局前点别的都会超时。
- 截图能看布局、文字、颜色，看不出动画的手感；动画要让用户亲眼看。

## 5. 踩过的坑

- **批量改代码容易改坏**：每次改一小块，立即拼装 + 语法检查；替换前确认锚点只出现一次。
- **忘记 `touch()`**：状态变了面板、补给、经济卡的缓存不刷新，现象是“数字不动”。
- **`readForm` 漏字段**：新设置没列进去，开新游戏会丢掉。
- **镜头抖动**：每一步都平移镜头而平移时长超过步长，两次重叠。
- **卡片变得比固定高度高**：经济卡加第三栏后换行被盖住。
- **临时换状态算东西必须换回来**：`supplyViz`。
- **规则文案不要凭印象写**：曾把“断粮立刻饿死人”写成“过几回合”，实际 `STARVE_AFTER = 1`。解释规则前先读代码。
- **清算制的“抵达”等上浮字和战报文字是两套**：上浮字在 `clearMoves` 的 `tag`，战报在 `text.js` 的 `logClr*`，改一个不会自动改另一个。
- **用户的要求会反复纠正理解**：“状态栏”是顶栏标题旁边的那一条，不是地图下方；“每步停留”是设置项，不是“动画速度”。拿不准先问。

## 6. 下一步建议（按优先级）

1. **完整玩一局清算制，确认手感**：三阶段逐步播放、镜头跟随、状态栏文字、补给线逐步、按大区排序都只用脚本读过数据或截过图。
2. **指挥点数值实测**：开局约 10 点对 18 个兵团，是否太紧、电脑受限后打法是否变差，用 `ai_sim.js` 对比前后（城池数、总资源、活到的国家数）。电脑现在随机顺序下令，点数用完就停，没有“优先把点数花在最重要的兵团上”的逻辑，这是明显的改进点。
3. **编组下令**（讨论过、用户选择先不做）：一批兵团一起下行军或攻击，整批只花 1 点，给每个兵团就近分配不同落点。`cpUsed` 里已为 `L.grp` 留了接口。选择方式（Shift 点选 + “选中同区同兵种”按钮，或在“战线”视图里拖框）没有定，先跟用户确认。
4. **电脑攻城和守城**：电脑很少真的攻下敌城，守城评分没跟上“大区看城池”的规则。
5. **经济平衡**：没有人完整玩过一局，收入会滚雪球。先跟用户确认想要什么节奏。
6. 每改一批，把版本范围、新规则、没验证的东西记到 `design.md` 的“改动时间线”和“已知问题”里。
