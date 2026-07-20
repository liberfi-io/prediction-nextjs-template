# Sports Taxonomy 国际化逐节点审计（2026-07-20）

## 结论

本次对 `taxonomyInventory.json` 的全部 90 个节点做了逐项核对，并对 `taxonomySources.json`、11 个非英语语言包以及 Polymarket 对标页面自身携带的 sports 文案数据做了交叉检查。

发现的 2 个漏采节点、合计 11 个缺失词条现已补齐：

- `sports.sport.volleyball`：Polymarket 在 8 个目标 locale 中提供了非英文文案，但当前来源 fixture 全部记为 `english-fallback`，语言包也没有相应 key。
- `sports.sport.hockey`：该节点需要通过语义 alias 对齐到 Polymarket 的 `/sports/nhl/games`，不能只按同名 path slug 搜索。当前 `th`、`vi`、`pt` 的来源记录为 `localized_label: null`，但第一方页面实际提供了本地化文案。

| locale    | Polymarket 页面原文 |
| --------- | ------------------- |
| `zh-Hant` | `排球`              |
| `ja`      | `バレーボール`      |
| `th`      | `วอลเลย์บอล`        |
| `vi`      | `Bóng chuyền`       |
| `it`      | `Pallavolo`         |
| `es`      | `Voleibol`          |
| `pt`      | `Vôlei`             |
| `ru`      | `Волейбол`          |

`fr` 与 `de` 页面仍显示 `Volleyball`，因此继续使用 API 英文回退是正确的。Future 没有可优先覆盖这个节点的稳定映射。

`hockey` 还缺少以下 3 个对标页面原始值，英文基线为 `Hockey`：

| locale | Polymarket 页面原文 | 页面路径               |
| ------ | ------------------- | ---------------------- |
| `th`   | `ฮอกกี้`            | `/th/sports/nhl/games` |
| `vi`   | `Khúc côn cầu`      | `/vi/sports/nhl/games` |
| `pt`   | `Hóquei`            | `/pt/sports/nhl/games` |

用户特别指出的另外两个节点不是竞品漏采，但已按产品负责人确认补充繁体中文术语：

- `sports.sport.motorsports`：Polymarket 的 10 个对应语言页面均显示 `Motorsports`；`zh-Hant` 按产品确认收录 `賽車`，来源明确记录为 `product`。
- `sports.sport.poker`：Polymarket 的 10 个对应语言页面均显示 `Poker`；`zh-Hant` 按产品确认收录 `撲克`，来源明确记录为 `product`。

## 核验方法与边界

1. inventory 身份使用 `section + node_type + slug`，确认 90 个 inventory 节点与 90 个 source 节点一一对应。
2. 对每个节点检查 11 个目标语言记录均存在；`adopted` 必须具有非空 `localized_label`，其余状态继续由 API label 回退。
3. 对 Polymarket 的 `zh-hant`、`ja`、`th`、`vi`、`fr`、`de`、`it`、`es`、`pt`、`ru` 页面下载 HTML，并读取页面自身序列化的 sports 文案。以页面 path slug、节点层级、英文语义及已确认的 alias 共同对齐；例如 inventory 的 `hockey` 对应 Polymarket 的 `/sports/nhl/games`。没有自行翻译。
4. Future 在本轮命令行复核时返回 Cloudflare challenge，不能把该临时网络状态判成 `source-unavailable`。Future 节点因此以 2026-07-20 已冻结的对标页面取证、来源 key 和语言包逐 key 一致性为复核依据；本轮没有凭空补充任何 Future 文案。
5. 下表“已采纳 locale”列出当前 fixture 中 `adopted` 的完整集合；未列出的目标 locale 均为英文回退。这样每个节点的 11-language 结果仍是完备的。

## 90 节点完整矩阵

| section | type   | slug                     | API label                     | 已采纳 locale                                   | 审计结论                |
| ------- | ------ | ------------------------ | ----------------------------- | ----------------------------------------------- | ----------------------- |
| esports | sport  | call-of-duty             | Call of Duty                  | zh-Hant, ja, ko                                 | 通过                    |
| esports | sport  | cs2                      | Counter-Strike 2              | —                                               | 通过                    |
| esports | sport  | dota2                    | Dota 2                        | —                                               | 通过                    |
| esports | sport  | honor-of-kings           | Honor of Kings                | zh-Hant                                         | 通过                    |
| esports | sport  | league-of-legends        | League of Legends             | zh-Hant                                         | 通过                    |
| esports | sport  | mobile-legends-bang-bang | Mobile Legends: Bang Bang     | zh-Hant, ja, ko                                 | 通过                    |
| esports | sport  | overwatch                | Overwatch                     | zh-Hant, ja, ko                                 | 通过                    |
| esports | sport  | rainbow-six-siege        | Rainbow Six Siege             | zh-Hant, ja, ko                                 | 通过                    |
| esports | sport  | rocket-league            | Rocket League                 | zh-Hant, ja, ko                                 | 通过                    |
| esports | sport  | starcraft-2              | StarCraft 2                   | zh-Hant, ja, ko                                 | 通过                    |
| esports | sport  | starcraft-brood-war      | StarCraft: Brood War          | zh-Hant, ja, ko                                 | 通过                    |
| esports | sport  | valorant                 | Valorant                      | zh-Hant, ja, ko                                 | 通过                    |
| sports  | league | arg                      | ARG                           | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | atp                      | ATP                           | —                                               | 通过                    |
| sports  | league | atp-doubles              | Atp Doubles                   | —                                               | 通过                    |
| sports  | league | aus                      | AUS                           | —                                               | 通过                    |
| sports  | league | aut                      | AUT                           | —                                               | 通过                    |
| sports  | league | bkbsn                    | BKBSN                         | zh-Hant                                         | 通过                    |
| sports  | league | bol1                     | BOL1                          | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | boxing                   | Boxing                        | zh-Hant, ja, ko, fr, de, es, ru                 | 通过                    |
| sports  | league | bra                      | BRA                           | zh-Hant, ja, ko, fr, de, es, ru                 | 通过                    |
| sports  | league | bra2                     | BRA2                          | zh-Hant, ja, ko, fr, de, es, ru                 | 通过                    |
| sports  | league | bundesliga               | Bundesliga                    | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | cfb                      | CFB                           | zh-Hant, ja, ko, fr, de, es, ru                 | 通过                    |
| sports  | league | cfl                      | CFL                           | —                                               | 通过                    |
| sports  | league | chi1                     | CHI1                          | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | col1                     | COL1                          | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | cpbl                     | CPBL                          | —                                               | 通过                    |
| sports  | league | cricmlc                  | Cricmlc                       | —                                               | 通过                    |
| sports  | league | cricshpageeza            | Cricshpageeza                 | —                                               | 通过                    |
| sports  | league | crict20blast             | Crict20blast                  | zh-Hant, ja, ko, fr, de, es, ru                 | 通过                    |
| sports  | league | crint                    | CRINT                         | zh-Hant, ja, ko, fr, de, es, ru                 | 通过                    |
| sports  | league | csl                      | CSL                           | zh-Hant, ja, ko, fr, de, es, ru                 | 通过                    |
| sports  | league | cze1                     | CZE1                          | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | den                      | DEN                           | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | epl                      | EPL                           | zh-Hant                                         | 通过                    |
| sports  | league | f1                       | Formula 1                     | zh-Hant, fr, de, es, ru                         | 通过                    |
| sports  | league | gtm                      | GTM                           | —                                               | 通过                    |
| sports  | league | indycar                  | IndyCar                       | —                                               | 通过                    |
| sports  | league | itf                      | ITF                           | —                                               | 通过                    |
| sports  | league | ja2                      | JA2                           | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | kbo                      | KBO                           | zh-Hant                                         | 通过                    |
| sports  | league | kor                      | KOR                           | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | laliga                   | La Liga                       | zh-Hant                                         | 通过                    |
| sports  | league | ligue-1                  | Ligue 1                       | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | lpl                      | LPL                           | —                                               | 通过                    |
| sports  | league | mex                      | MEX                           | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | mlb                      | MLB                           | —                                               | 通过                    |
| sports  | league | mls                      | MLS                           | zh-Hant                                         | 通过                    |
| sports  | league | nba                      | NBA                           | —                                               | 通过                    |
| sports  | league | nbasl                    | NBASL                         | —                                               | 通过                    |
| sports  | league | nfl                      | NFL                           | —                                               | 通过                    |
| sports  | league | nor                      | NOR                           | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | npb                      | NPB                           | —                                               | 通过                    |
| sports  | league | nwsl                     | NWSL                          | —                                               | 通过                    |
| sports  | league | per1                     | PER1                          | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | pll                      | PLL                           | —                                               | 通过                    |
| sports  | league | por                      | POR                           | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | powerslap                | Powerslap                     | —                                               | 通过                    |
| sports  | league | rou1                     | ROU1                          | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | sea                      | SEA                           | zh-Hant                                         | 通过                    |
| sports  | league | spl                      | SPL                           | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | sud                      | SUD                           | zh-Hant, ja, ko, ru                             | 通过                    |
| sports  | league | svk1                     | SVK1                          | —                                               | 通过                    |
| sports  | league | swe                      | SWE                           | zh-Hant, ja, ko, fr, de, es, ru                 | 通过                    |
| sports  | league | trsk                     | TRSK                          | —                                               | 通过                    |
| sports  | league | ucol                     | UEFA Europa Conference League | zh-Hant, ja, ko, fr, de, es, ru                 | 通过                    |
| sports  | league | uel                      | UEL                           | zh-Hant                                         | 通过                    |
| sports  | league | ufc                      | UFC                           | —                                               | 通过                    |
| sports  | league | uwcl                     | UWCL                          | zh-Hant, ja, ko, fr, de, es, ru                 | 通过                    |
| sports  | league | wll                      | WLL                           | —                                               | 通过                    |
| sports  | league | wnba                     | WNBA                          | —                                               | 通过                    |
| sports  | league | world-cup                | World Cup                     | zh-Hant, ja, ko, fr, de, es, ru                 | 通过                    |
| sports  | league | wta                      | WTA                           | —                                               | 通过                    |
| sports  | league | wta-doubles              | Wta Doubles                   | —                                               | 通过                    |
| sports  | sport  | baseball                 | Baseball                      | zh-Hant, ja, ko, th, vi, es, pt, ru             | 通过                    |
| sports  | sport  | basketball               | Basketball                    | zh-Hant, ja, ko, th, vi, fr, it, es, pt, ru     | 通过                    |
| sports  | sport  | chess                    | Chess                         | zh-Hant, ja, ko, th, vi, fr, de, it, es, pt, ru | 通过                    |
| sports  | sport  | combat                   | Combat                        | zh-Hant, ja, ko, de, es, ru                     | 通过                    |
| sports  | sport  | cricket                  | Cricket                       | zh-Hant, ja, ko, th, es, pt, ru                 | 通过                    |
| sports  | sport  | football                 | Football                      | zh-Hant, ja, ko, th, vi, fr, de, es, pt, ru     | 通过                    |
| sports  | sport  | golf                     | Golf                          | zh-Hant, ja, ko, th, pt, ru                     | 通过                    |
| sports  | sport  | hockey                   | Hockey                        | zh-Hant, ja, ko, th, vi, de, pt, ru             | 通过：已补齐 alias 取证 |
| sports  | sport  | lacrosse                 | Lacrosse                      | zh-Hant, ja, ko, th, fr, ru                     | 通过                    |
| sports  | sport  | motorsports              | Motorsports                   | zh-Hant                                         | 通过：产品确认繁中术语  |
| sports  | sport  | pickleball               | Pickleball                    | zh-Hant, ja, ko, th, ru                         | 通过                    |
| sports  | sport  | poker                    | Poker                         | zh-Hant                                         | 通过：产品确认繁中术语  |
| sports  | sport  | soccer                   | Soccer                        | zh-Hant, ja, ko, th, vi, fr, de, it, es, pt, ru | 通过                    |
| sports  | sport  | tennis                   | Tennis                        | zh-Hant, ja, ko, th, vi, es, pt, ru             | 通过                    |
| sports  | sport  | volleyball               | Volleyball                    | zh-Hant, ja, th, vi, it, es, pt, ru             | 通过：已补齐 alias 取证 |

## 修复结果

`volleyball` 与 `hockey` 的 11 个漏采词条已逐字采用上表的 Polymarket 页面值；另外收录产品负责人确认的 `賽車`、`撲克`：

1. 8 个对应语言包已添加 `extend.sports.taxonomy.sports.sport.volleyball`。
2. `th`、`vi`、`pt` 已添加 `extend.sports.taxonomy.sports.sport.hockey`。
3. `taxonomySources.json` 已同步 11 条竞品证据，并固化 `volleyball → vbvnl`、`hockey → nhl` alias。
4. `zh-Hant` 已添加 `motorsports=賽車`、`poker=撲克`，来源记录为产品确认而非竞品翻译。
5. 顶层统计已按实际 `localized_label` 和语言包词条重新计算。
6. 资源契约测试已显式覆盖上述 13 个新增值，并继续逐 key 校验 fixture 与语言包一致。
