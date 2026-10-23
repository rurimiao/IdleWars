#!/bin/bash
# 在仓库根目录运行：把 src/ 里的文件按顺序拼成 idlewars.html，再做语法检查
set -e
cd "$(dirname "$0")"
cat src/page.html src/core.js src/text.js src/avatars.js src/sound_data.js src/sound.js src/settings.js src/mapgen.js \
    src/game.js src/ai.js src/ui.js src/panel_list.js src/stats.js src/panel_orders.js src/panel_players.js src/controls.js > idlewars.html
python3 - <<'PY'
s = open('idlewars.html').read()
open('/tmp/idlewars_check.js', 'w').write(s[s.index('<script>') + 8 : s.rindex('</script>')])
PY
node --check /tmp/idlewars_check.js && echo SYNTAX_OK
# 可选：eslint（没有就跳过）。未使用变量的警告很多，忽略
if command -v eslint >/dev/null 2>&1; then eslint -c eslint.config.mjs /tmp/idlewars_check.js 2>&1 | grep -v "no-unused-vars" | grep -v '^$' | head -30; fi
