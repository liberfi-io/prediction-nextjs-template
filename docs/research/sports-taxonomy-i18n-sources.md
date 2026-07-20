# Sports Taxonomy 国际化来源取证

## 结论

Sports / Esports taxonomy 的本地化由前端语言包负责，后端继续提供稳定的 `section`、`node_type`、`slug` 与英文 `label`。运行时只读取本地资源；目标语言没有经对标站确认的词条时，直接显示 API 的英文 `label`。

本次于 2026-07-20（Asia/Shanghai）核验并抄录以下页面：

- Future：`https://future.news/{locale}/sports`
- Polymarket：`https://polymarket.com/{locale}/sports/live`

逐节点、逐语言的实际 URL、页面值、状态和来源归属保存在 `src/features/sports/i18n/taxonomySources.json`。API 冻结清单保存在独立的 `taxonomyInventory.json`，避免刷新 API 数据时覆盖人工取证。

## Locale 可用性

Future 页面自身声明支持 `en-US`、`zh`、`zh-hant`、`ko`、`ja`、`es`、`de`、`fr`、`ru`。本项目使用其中：

```text
zh-Hant -> zh-hant
ja      -> ja
ko      -> ko
fr      -> fr
de      -> de
es      -> es
ru      -> ru
```

Polymarket 的语言入口用于补齐 `th`、`vi`、`it`、`pt`，并用于复核其支持的其他目标语言。Polymarket 没有韩语入口，因此韩语只采用 Future 页面已有值。

## 采纳规则

1. Future 存在稳定的 taxonomy message key 时优先采用 Future。
2. Future 没有对应节点或目标 locale 时，检查 Polymarket 的 sports path slug。
3. 写入语言包的值逐字来自目标语言页面；没有进行人工、模型或机器翻译。
4. 页面仍使用英文、联赛官方名或通用缩写时，不创建静态词条，由 API 英文 label 回退。
5. 无法同时用层级、slug/path 和英文语义确认的节点保持英文回退。

## 冻结统计

| language | inventory | source visible | adopted | conflict | English fallback | source unavailable |
| -------- | --------: | -------------: | ------: | -------: | ---------------: | -----------------: |
| zh-Hant  |        90 |             87 |      58 |        0 |               32 |                  0 |
| ja       |        90 |             87 |      48 |        0 |               42 |                  0 |
| ko       |        90 |             72 |      48 |        0 |               42 |                  0 |
| th       |        90 |             71 |      10 |        0 |               80 |                  0 |
| vi       |        90 |             71 |       6 |        0 |               84 |                  0 |
| fr       |        90 |             87 |      17 |        0 |               73 |                  0 |
| de       |        90 |             87 |      17 |        0 |               73 |                  0 |
| it       |        90 |             71 |       3 |        0 |               87 |                  0 |
| es       |        90 |             87 |      20 |        0 |               70 |                  0 |
| pt       |        90 |             71 |       8 |        0 |               82 |                  0 |
| ru       |        90 |             87 |      41 |        0 |               49 |                  0 |

`source visible` 表示目标语言页面能稳定映射到 inventory 的节点数；`adopted` 只统计实际写入语言包的本地化值。页面展示英文或没有展示节点均归入英文回退，二者可通过 fixture 的 `localized_label` 是否为 `null` 区分。

## 维护流程

taxonomy 变化时，以下步骤必须作为一个原子操作完成：

1. 启动本地 prediction-server，运行 `node scripts/sports/refresh-taxonomy-inventory.mjs --base-url=http://localhost:8082`。
2. 审查脚本输出的新增、删除、label 与 parent 变化。
3. 对新增或变化节点重新核验两个对标站，将人工字段补入 `taxonomySources.json`。
4. 只把 `adopted` 值写入 11 个非英语语言包；不要修改 `en.json` 或未接入资源的 `zh.json`。
5. 更新来源 fixture 顶层统计并运行 taxonomy 完整性测试、全量测试、typecheck 和 lint。

刷新脚本只重写 API 派生的 inventory，不会读取或覆盖来源 fixture。
