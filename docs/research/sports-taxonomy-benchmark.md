# 体育 taxonomy 对标研究：Future.news 与 Polymarket

> 采集日期：2026-07-17（Asia/Shanghai）
> 范围：仅分析 Future.news 与 Polymarket 的第一方页面、浏览器网络请求、Next.js 服务端状态和第一方 JavaScript；不使用第三方资料。

## 结论摘要

| 产品入口 | 实际语义 | 数据获取与筛选结论 |
| --- | --- | --- |
| Future.news「实时」 | 比赛视图，按日期、联赛展示；页面同时出现已经进行中的比赛和近期赛程 | 初始请求为 `GET /events/api/sports/list`，URL 中没有 `live`、状态、日期或 taxonomy 等业务筛选参数。页面另请求 `GET /events/api/sports/tag-series-count?live_start_at=<本地当天零点>` 获取计数。实时视图应是客户端在同一份 sports 数据上形成的比赛视图。 |
| Future.news「提案」 | 跨体育项目的长期事件与命题市场，例如冠军、MVP、金靴、球员去向等 | 切换「实时 → 提案」不发起新的业务请求，仍使用同一次 `/sports/list` 响应；它不是一个独立 endpoint，也没有可见的服务端 query filter。列表观测顺序与 `24h 成交量` 降序一致，但排序逻辑需在接入业务接口时再确认。 |
| Future.news「精选」 | 世界杯、欧冠、MLB、UFC 四个运营入口 | 未观察到「精选配置」接口；栏目标题、顺序和图标由页面固定呈现，计数来自动态数据。因此应建模为客户端/运营配置的 taxonomy 节点列表，节点数量动态查询，不应硬编码数量。 |
| Polymarket「实时」 | 一个特殊体育入口，内容分为实际直播与即将开始（Starting Soon） | 初始数据随 Next.js RSC/Flight 服务端状态下发，浏览器看不到服务端上游请求参数。第一方前端代码有明确判定：显式 `live=true` 且信号未过期，或 `startTime` 落在 `now-1h` 到 `now+5m`；其余未开始/未来比赛进入 Starting Soon。 |
| Polymarket「远期」 | 运营挑选的 NBA/EPL 长期事件仪表盘，不是“所有未来体育事件” | NBA 和 EPL 都由第一方代码硬编码 event slug 列表，再按 slug 精确请求 `gamma-api.polymarket.com/events/keyset`。这与 Future.news 的广义「提案」语义不同。 |

由此建议：侧栏的「实时」「更多竞猜」应是两个特殊视图入口，不应混入普通体育 taxonomy 树；「精选」则应保存为一组可运营选择的 taxonomy 节点。

## Future.news

### 页面结构与请求

研究页面：[Future.news 体育](https://future.news/zh/sports)。左侧依次为：

1. 特殊入口：「实时」「提案」；
2. 「精选」：世界杯、欧冠、MLB、UFC；
3. 完整体育 taxonomy 树。

浏览器在首次打开页面时观察到以下业务请求：

```text
GET https://future.news/events/api/sports/list?<会话与平台参数>
GET https://future.news/events/api/sports/tag-series-count?<会话与平台参数>&live_start_at=1784217600000
GET https://future.news/api/v1/worldcup/carousel?<会话与平台参数>
```

会话与平台参数包括 `device_id`、`fp_did`、`client_id`、`from_app=future-web`、`app_ver`、`tz_name=Asia/Shanghai`、`tz_offset=28800`、`app_lang=zh-CN`、`os=web`、`worker=0`。这些不是业务筛选条件，本文不记录实际设备标识。

关键证据：

- `/events/api/sports/list` 的可见 query 中没有 `live`、`proposal`、taxonomy、tag、状态、日期、排序等参数。
- `live_start_at=1784217600000` 对应 `2026-07-16T16:00:00Z`，即 Asia/Shanghai 的 `2026-07-17 00:00:00`。该参数只出现在 `tag-series-count` 请求，而非 `sports/list`。
- 页面实时视图顶部显示 `Jul 17–Jul 23, 2026`，并提供日期切换；因此 UI 是一个按日期组织的近期比赛视图，但从请求 URL 不能证明七天范围由服务端过滤。

### 「实时」的数据语义

实时视图的记录是比赛行，按日期和联赛组织。采集时既有明确标记为「实时」的比赛，也有尚未开始的近期比赛。因此 Future.news 的「实时」并不等价于 `event.live === true`，更接近“实时 + 近期赛程”的比赛视图。

从网络请求可以确认：页面没有为实时视图单独调用带 `live` 或日期范围条件的列表接口。能观察到的业务输入只有计数接口的本地当天零点 `live_start_at`。具体“已经直播”和“近期赛程”如何从 `/sports/list` 响应中分类，响应体受站点防护影响，无法仅凭请求 URL 进一步证明。

### 「提案」的数据语义

从「实时」切换至「提案」时：

- 地址仍为 `https://future.news/zh/sports`；
- 没有产生新的业务 XHR；
- 页面继续复用首次加载的 `/events/api/sports/list` 与 `tag-series-count` 数据。

提案视图改为事件聚合表，列为「事件、概率、24h 涨跌幅、价差、24h 成交量、总成交量、流动性、操作」。采集时可见的记录包括：

- 2026 世界杯冠军；
- 2026 F1 车手总冠军；
- MLB 最多本垒打球队、2026 美联 MVP；
- 世界杯金球奖、金靴奖；
- 2027 英超、NBA、NFL 冠军；
- LeBron 下一支球队等体育相关命题。

这些记录不是单场比赛，而是跨联赛的冠军、奖项、赛季、球队/球员去向等长期事件或命题市场。采集时可见行的 `24h 成交量` 依次为约 `$2,021,891`、`$561,963`、`$556,543`、`$555,904`、`$484,370` 等，表面上符合降序，但因为未取得排序实现代码，不能把“固定按 24h 成交量降序”当作已验证接口契约。

实现含义：Future.news 的「提案」是同一 sports payload 的另一个客户端投影视图，而不是 taxonomy 筛选。产品中的「更多竞猜」若要对齐它，应按事件/市场形态区分“非单场比赛的体育命题”，不能只筛某个 taxonomy 节点。

### 「精选」是否为运营配置

页面固定显示四个精选节点，顺序为：世界杯、欧冠、MLB、UFC。DOM 中图标也直接绑定在相应入口上：

- 世界杯：`/static/img/soccer/fifwc.png`；
- 欧冠：`/static/img/soccer/ucl.png`；
- MLB、UFC：页面内联 SVG。

进一步观察：

- 点击世界杯后 URL 为 `https://future.news/zh/sports?isWorldCup=Y`，没有新增“精选配置”请求；
- 点击欧冠后列表切换到欧冠比赛，仍未产生“精选配置”请求；
- 初始请求中只有通用 `sports/list`、动态 `tag-series-count` 与世界杯 carousel，没有返回“精选节点列表”的独立 endpoint。

因此可以高置信度判断：四个节点的选择、顺序与图标属于客户端/运营配置；旁边显示的数量是动态值。由于未直接读取 `/sports/list` 的完整响应体，不能排除通用响应同时携带 taxonomy 元数据，但没有证据表明“精选栏目本身”由接口下发。

## Polymarket

### 「实时」入口与服务端状态

研究页面：[Polymarket 体育直播](https://polymarket.com/zh/sports/live)。侧栏把「实时」链接到 `/sports/live`，把「远期」链接到 `/sports/futures/nba`。第一方前端配置中两者的 `tagId` 都是 `null`，说明它们是合成的特殊入口，而不是普通 taxonomy/tag 节点。

Polymarket 首屏业务数据被压缩进 Next.js Flight/RSC HTML 的 `initialState`，浏览器初始加载没有出现对应的 Gamma events 列表 XHR。采集到的状态顶层字段包括：

```text
status, fetchStatus, sportSlug, games, events, teams, sections,
marketsSections, marketsSectionsState, gameIdToSlug,
parentToChildEventIds, leagueHasMore
```

其中 `sportSlug` 为 `live`。采集时状态中有 41 场比赛和 41 个事件，事件均为 `active=true`、`closed=false`、`archived=false`；数量和比赛状态是时间相关快照，不应写成固定规则。`leagueHasMore` 还表明首屏按联赛截取部分记录，再提供“查看全部”。

### Polymarket 的实时/即将开始判定

第一方部署 chunk（采集时）：[`0roqa4u97kl4z.js`](https://polymarket.com/_next/static/chunks/0roqa4u97kl4z.js)。其中 `showLiveGames` 的可复查判定可归纳为：

```ts
if (!event || event.period === "SUS") return false;
if (isEsports(event) && event.endDate <= now) return false;

if (event.live === true) {
  return !hasStaleLiveSignal(event);
}

if (!event.startTime) return false;
const delta = event.startTime - now;
return delta >= -60 * 60_000 && delta <= 5 * 60_000;
```

随后 `showUnstartedGames` 将以下记录归入即将开始：

- 不满足 `showLiveGames`；并且
- `live=true` 但直播信号已过期，或 `period === "NS"`，或 `startTime > now`。

页面再把非延迟事件分为 `live` 与 `soon` 两组，延迟比赛单独处理。因此 `/sports/live` 实际是“Live + Starting Soon”，其行为会让价格/比赛状态在同一批数据更新后同时变化，但这段逻辑本身不能证明价格通道采用轮询还是 WebSocket。

需要注意：首屏数据是服务端请求后随 RSC 下发，所以无法从浏览器网络面板还原服务端调用 Gamma 时的完整 query。当前可严格复现的是客户端分类条件，而不是服务端上游筛选参数。

### 「远期」是精确运营选品

研究页面：[Polymarket NBA 远期](https://polymarket.com/zh/sports/futures/nba)。页面只提供 NBA 与 EPL 两个二级入口，展示冠军、MVP、最佳新秀、分区冠军等事件聚合卡片，不展示单场比赛。

第一方部署 chunk（采集时）：[`0-5dy7wd1flug.js`](https://polymarket.com/_next/static/chunks/0-5dy7wd1flug.js)。代码中 NBA 事件 slug 被固定为：

```text
2026-nba-champion
nba-mvp-694
nba-rookie-of-the-year-873
nba-cup-winner-164
nba-playoffs-eastern-conference-champion
nba-playoffs-western-conference-champion
```

EPL 事件 slug 被固定为：

```text
english-premier-league-winner
english-premier-league-2nd-place
english-premier-league-3rd-place
english-premier-league-last-place
epl-which-clubs-get-relegated
```

服务端预取状态中的 query key 也包含完全相同的 slug 数组。第一方 Gamma 客户端 chunk（采集时）：[`1droawa4bmt-n.js`](https://polymarket.com/_next/static/chunks/1droawa4bmt-n.js)，其请求形态为：

```text
GET https://gamma-api.polymarket.com/events/keyset
  ?limit=<GAMMA_PAGINATION_LIMIT>
  &slug=<slug-1>
  &slug=<slug-2>
  ...
  &locale=zh
```

没有 `closed=false`、日期、tag 或通用 `future=true` 条件；选品完全由 slug 白名单决定。对应查询缓存的 `staleTime` 和 `gcTime` 均为 300,000 ms（5 分钟），并关闭 `refetchOnWindowFocus` 与 `refetchOnReconnect`。

所以 Polymarket 的 Futures 不能直接作为「更多竞猜」的数据筛选模板：它是窄范围的运营专题，而 Future.news 的「提案」是跨体育项目的广义命题列表。

## 对本项目的数据建模建议

### 1. 特殊入口与 taxonomy 树分离

- `实时`：特殊比赛视图，路由与查询语义独立；不要给它伪造普通 taxonomy ID。
- `更多竞猜`：特殊事件视图，筛选非单场比赛的体育命题/长期事件；不要仅按 taxonomy 查询。
- `精选`：保存可运营的 taxonomy 节点引用，例如节点 ID/slug、显示顺序、图标覆盖；节点标题与计数仍取 taxonomy/API 数据。
- `完整 taxonomy 树`：只承载真实体育层级，不混入上述特殊入口。

### 2. 「实时」推荐查询语义

若现有 SDK/API 能提供足够字段，建议明确区分：

1. `live`：开放且有效的比赛事件；优先使用可靠直播信号，并排除暂停、结束或信号过期记录；
2. `startingSoon`：尚未开始且开赛时间接近的比赛；
3. `upcoming`：Future.news 风格的近期日期赛程，可从用户本地当天零点开始按日期窗口查询。

若目标是精确对齐 Polymarket，可把无可靠直播信号事件的兜底窗口设为 `[now - 60 分钟, now + 5 分钟]`；若目标是对齐 Future.news，则还需把未来数日赛程作为实时页内容。两者的产品语义并不完全相同，接口命名应避免把“七日赛程”误写成纯 `live=true`。

### 3. 「更多竞猜」推荐查询语义

先在现有业务数据模型中确认能否区分：

- game/match event；
- outright、season winner、award、team/player future；
- 普通体育 yes/no proposition。

查询结果应为事件聚合层，而非展开后的单个 outcome/market 行。Future.news 的观测结果提示可默认按 `volume24h` 降序，但在 API/SDK 没有明确契约前，应把它作为产品排序决策，而不是对标站已证实的服务端参数。

### 4. 「精选」推荐配置结构

建议只持久化运营决策，不复制动态数据：

```ts
type FeaturedSportsTaxonomy = {
  taxonomyId: string;
  slug: string;
  order: number;
  iconOverride?: string;
};
```

标题、层级、是否可用和计数应由 taxonomy/API 合并得到。这样既能运营调整节点，也不会因名称或数量更新而修改代码。

## 证据边界

- Future.news 的 `/events/api/sports/list` 响应体无法在当前环境绕过站点防护单独抓取；本文对“实时/提案复用同一 payload”的判断来自浏览器实际请求序列与切换行为。精确字段级过滤仍需结合本项目 SDK 返回结构验证。
- Polymarket 实时首屏的上游请求发生在服务端，浏览器无法看到其完整 query。本文给出的实时条件来自第一方客户端判定代码，并由 SSR `initialState` 的页面快照交叉验证。
- 部署 chunk 文件名带构建 hash，后续上线会变化；上述链接和代码位置以 2026-07-17 的部署为准，页面路由与可观察行为是更稳定的复查入口。
