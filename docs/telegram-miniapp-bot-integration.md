# Telegram Mini App Bot 对接文档

本文档面向 Telegram Bot 开发同事，说明如何构造 Liberfi Prediction Mini App 的 `start_param`，以及如何用它打开世界杯比赛列表页、比赛详情页、初始化 market/outcome 和携带返佣参数。

当前 Mini App：

- Bot Mini App URL: `https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App`
- Production Web URL: `https://predict.liberfi.io`
- Staging 临时部署 URL: `https://liberfi-prediction-kan5x1589-sgt-lab.vercel.app`
- Local dev URL: `http://localhost:3001`

## 1. Telegram 启动链接

Bot 侧打开 Mini App 时，把本文档定义的 `start_param` 放到 Telegram 的 `startapp` 参数：

```text
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=<start_param>
```

示例：

```text
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wl-M12
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wd-M12-mlh-y
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wd-M12-mlh-y-rAFF2026
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wd-M12-mlh-y-gHctKD5O-rAFF2026
```

Telegram 会把 `startapp` 传给 Mini App。前端会从以下来源读取：

- `window.Telegram.WebApp.initDataUnsafe.start_param`
- URL/search/hash fallback：`tgWebAppStartParam`
- URL/search/hash fallback：`startapp`

Bot 不需要把 Telegram user id 编码进 `start_param`。Mini App 会通过 Telegram WebApp context 获取 Telegram user，再由 Privy 处理 Telegram 自动登录。群消息点击进入 Mini App 时，如果 Telegram WebApp context 无法提供群组 `chat.id`，Bot 可以按本文档第 5 节把群组 `chat.id` 编进 `start_param`。

## 2. start_param 总体限制

Telegram 对 `start_param` 有硬限制：

- 最大长度：64 个字符
- 允许字符：`A-Z`、`a-z`、`0-9`、`_`、`-`
- 当前实现额外要求：整体必须匹配 `^[A-Za-z0-9_-]{1,64}$`

由于 `-` 是字段分隔符，返佣码字段不能包含 `-`。返佣码只允许：

```text
[A-Za-z0-9_]+
```

不合法的 `start_param` 会被前端忽略，用户停留在默认页面。

## 3. start_param 文法

### 3.1 列表页

打开世界杯比赛列表页，并定位到某个比赛卡片：

```text
v1-wl-<matchId>
v1-wl-<matchId>-g<chatIdBase62>
v1-wl-<matchId>-r<referral>
v1-wl-<matchId>-g<chatIdBase62>-r<referral>
```

字段说明：

| 字段 | 含义 | 示例 |
| --- | --- | --- |
| `v1` | 协议版本 | 固定 `v1` |
| `wl` | World Cup list | 固定 `wl` |
| `<matchId>` | 比赛编号 | `M12` |
| `g<chatIdBase62>` | 可选群组 ID | `gHctKD5O` |
| `r<referral>` | 可选返佣码 | `rAFF2026` |

示例：

```text
v1-wl-M12
v1-wl-M12-gHctKD5O
v1-wl-M12-rAFF2026
v1-wl-M12-gHctKD5O-rAFF2026
```

前端路由效果：

```text
/world-cup?match=M12
```

注意：当前列表页临时隐藏了已完赛的 `M1`、`M2`。如果 deep link 指向 `M1` 或 `M2`，页面仍会进入 `/world-cup`，但列表中没有可滚动定位的卡片。

### 3.2 详情页

打开世界杯比赛详情页，只指定比赛，不指定 market/outcome：

```text
v1-wd-<matchId>
v1-wd-<matchId>-g<chatIdBase62>
v1-wd-<matchId>-r<referral>
v1-wd-<matchId>-g<chatIdBase62>-r<referral>
```

打开世界杯比赛详情页，并初始化 market/outcome：

```text
v1-wd-<matchId>-<marketCode>-<outcomeCode>
v1-wd-<matchId>-<marketCode>-<outcomeCode>-g<chatIdBase62>
v1-wd-<matchId>-<marketCode>-<outcomeCode>-r<referral>
v1-wd-<matchId>-<marketCode>-<outcomeCode>-g<chatIdBase62>-r<referral>
```

字段说明：

| 字段 | 含义 | 示例 |
| --- | --- | --- |
| `v1` | 协议版本 | 固定 `v1` |
| `wd` | World Cup detail | 固定 `wd` |
| `<matchId>` | 比赛编号 | `M12` |
| `<marketCode>` | market 短码 | `mlh` |
| `<outcomeCode>` | outcome 短码 | `y` / `n` |
| `g<chatIdBase62>` | 可选群组 ID | `gHctKD5O` |
| `r<referral>` | 可选返佣码 | `rAFF2026` |

示例：

```text
v1-wd-M12
v1-wd-M12-gHctKD5O
v1-wd-M12-rAFF2026
v1-wd-M12-gHctKD5O-rAFF2026
v1-wd-M12-mlh-y
v1-wd-M12-mld-y
v1-wd-M12-mla-y
v1-wd-M12-to-y
v1-wd-M12-to25-y
v1-wd-M12-sp-n
v1-wd-M12-btts-y
v1-wd-M12-mlh-y-gHctKD5O
v1-wd-M12-mlh-y-rAFF2026
v1-wd-M12-mlh-y-gHctKD5O-rAFF2026
```

前端路由效果：

```text
/world-cup/match/fifwc-swe-tun-2026-06-14
/world-cup/match/fifwc-swe-tun-2026-06-14?market=mlh&outcome=yes
```

## 4. marketCode 与 outcomeCode

### 4.1 marketCode

| marketCode | 含义 | 备注 |
| --- | --- | --- |
| `mlh` | Moneyline home | 主队胜 market |
| `mld` | Moneyline draw | 平局 market |
| `mla` | Moneyline away | 客队胜 market |
| `sp` | Spread 默认盘口 | 阶段一只支持默认盘口，不支持指定 spread line |
| `to` | Total 默认盘口 | 默认大小球盘口 |
| `to<line>` | Total 指定盘口线 | `<line>` = 盘口线乘 10，例如 `to25` 表示 2.5 |
| `btts` | Both teams to score | 双方是否都进球 |

不支持的旧短码：

```text
sph
spa
tou
tun
```

这些短码在当前实现中会被视为非法。

### 4.2 outcomeCode

| outcomeCode | Query 参数 | 含义 |
| --- | --- | --- |
| `y` | `outcome=yes` | 选 YES 方向 |
| `n` | `outcome=no` | 选 NO 方向 |

语义说明：

- Moneyline：通常使用 `y`，例如 `mlh-y` 表示选择主队胜 YES。
- Spread：`sp-y` / `sp-n` 对应 Polymarket 该 spread market 的 YES / NO。
- Total：`to-y` / `to25-y` 表示 over，`to-n` / `to25-n` 表示 under。
- BTTS：`btts-y` 表示双方都进球，`btts-n` 表示不是双方都进球。

### 4.3 Total line 编码

`to<line>` 中的 `<line>` 是盘口线乘以 10 后的整数：

| 盘口线 | marketCode |
| --- | --- |
| 0.5 | `to5` |
| 1.5 | `to15` |
| 2.5 | `to25` |
| 3.5 | `to35` |
| 4.5 | `to45` |
| 5.5 | `to55` |

如果指定的 total line 在该比赛不存在，当前前端会 fallback 到默认 total market。Bot 侧应尽量只生成当前比赛真实存在的 total line。

### 4.4 Spread 指定盘口线

阶段一不支持 `sp<line>`。只支持：

```text
sp
```

原因：spread 有正负号，`-` 已作为字段分隔符，直接写 `sp-15` 会和协议冲突。后续如要支持精确 spread line，可扩展为：

```text
spm15 = home -1.5
spp15 = home +1.5
```

当前请不要生成 `sp15`、`spm15`、`spp15`。

## 5. 群组参数

当 Bot 在 Telegram 群里发送 Mini App 消息时，如果需要让后端下单记录关联到群组，请把群组 `chat.id` 编进 `start_param`。

群组参数格式为：

```text
g<chatIdBase62>
```

示例：

```text
v1-wl-M12-gHctKD5O
v1-wd-M12-mlh-y-gHctKD5O
v1-wd-M12-mlh-y-gHctKD5O-rAFF2026
```

规则：

- `chatIdBase62` 使用 `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz` 字母表。
- Bot 侧对 Telegram 群 `chat.id` 取绝对值后做 base62 编码。
- Mini App 服务端解码后会恢复为负数群组 ID，例如 `gHctKD5O` 解码为 `-1001234567890`。
- 群组参数必须放在 referral 参数之前；referral 仍然必须是最后一段。
- 如果 Telegram `initData.chat.id` 存在，服务端优先使用 `initData.chat.id`；仅当它缺失时，才使用 `start_param` 中的群组 ID。
- `start_param` 中的群组 ID 只能作为群上下文提示，不能单独作为可信授权凭证；服务端仍会先校验 Telegram `initData` 签名。

示例编码：

| Telegram chat.id | abs(chat.id) | chatIdBase62 | start_param 字段 |
| ---: | ---: | --- | --- |
| `-1001234567890` | `1001234567890` | `HctKD5O` | `gHctKD5O` |

## 6. 返佣参数

返佣参数写在最后一段，格式为：

```text
r<referral>
```

示例：

```text
v1-wl-M12-rAFF2026
v1-wd-M12-mlh-y-rAFF2026
```

规则：

- `<referral>` 不能为空。
- `<referral>` 只允许 `A-Z`、`a-z`、`0-9`、`_`。
- 不允许包含 `-`，因为 `-` 是字段分隔符。
- 前端收到后会调用现有 referral storage，遵循 first-touch 规则和 TTL。
- `start_param` 来源在阶段一不作为可信归因凭证；最终绑定和落库仍以后端 referral/bind 与后续 Telegram initData 校验为准。

## 7. 长度预算

当前格式的长度计算示例：

| 用途 | start_param | 长度 |
| --- | --- | ---: |
| 列表定位 | `v1-wl-M12` | 9 |
| 列表定位 + 群组 | `v1-wl-M12-gHctKD5O` | 18 |
| 列表定位 + 返佣 | `v1-wl-M12-rAFF2026` | 18 |
| 列表定位 + 群组 + 返佣 | `v1-wl-M12-gHctKD5O-rAFF2026` | 27 |
| 详情默认 market | `v1-wd-M12` | 9 |
| 详情默认 market + 群组 | `v1-wd-M12-gHctKD5O` | 18 |
| 详情默认 market + 返佣 | `v1-wd-M12-rAFF2026` | 18 |
| 详情默认 market + 群组 + 返佣 | `v1-wd-M12-gHctKD5O-rAFF2026` | 27 |
| 详情 moneyline | `v1-wd-M12-mlh-y` | 15 |
| 详情 moneyline + 群组 | `v1-wd-M12-mlh-y-gHctKD5O` | 24 |
| 详情 moneyline + 返佣 | `v1-wd-M12-mlh-y-rAFF2026` | 24 |
| 详情 moneyline + 群组 + 返佣 | `v1-wd-M12-mlh-y-gHctKD5O-rAFF2026` | 33 |
| 详情 total 2.5 | `v1-wd-M12-to25-y` | 16 |
| 详情 total 2.5 + 群组 | `v1-wd-M12-to25-y-gHctKD5O` | 25 |
| 详情 total 2.5 + 返佣 | `v1-wd-M12-to25-y-rAFF2026` | 25 |
| 详情 total 2.5 + 群组 + 返佣 | `v1-wd-M12-to25-y-gHctKD5O-rAFF2026` | 34 |
| 详情 btts + 返佣 | `v1-wd-M12-btts-y-rAFF2026` | 25 |
| 详情 btts + 群组 + 返佣 | `v1-wd-M12-btts-y-gHctKD5O-rAFF2026` | 34 |

64 字符限制下，返佣码可用余量：

- `v1-wl-M12-r<referral>`：最多 53 个 referral 字符。
- `v1-wl-M12-gHctKD5O-r<referral>`：最多 44 个 referral 字符。
- `v1-wd-M12-r<referral>`：最多 53 个 referral 字符。
- `v1-wd-M12-gHctKD5O-r<referral>`：最多 44 个 referral 字符。
- `v1-wd-M12-mlh-y-r<referral>`：最多 47 个 referral 字符。
- `v1-wd-M12-mlh-y-gHctKD5O-r<referral>`：最多 38 个 referral 字符。
- `v1-wd-M12-to25-y-r<referral>`：最多 46 个 referral 字符。
- `v1-wd-M12-to25-y-gHctKD5O-r<referral>`：最多 37 个 referral 字符。
- `v1-wd-M12-btts-y-r<referral>`：最多 46 个 referral 字符。
- `v1-wd-M12-btts-y-gHctKD5O-r<referral>`：最多 37 个 referral 字符。

建议 Bot 侧把 referral 控制在 32 字符以内，留出未来扩展空间。

`gHctKD5O` 是常见 Telegram supergroup ID `-1001234567890` 的示例编码，群组字段长度为 8。即使按 signed int64 最大值计算，`g<chatIdBase62>` 最长也只有 12 个字符；此时 `v1-wd-M104-to25-y-g<chatIdBase62>-r<32 字符 referral>` 刚好 64 字符。Bot 侧如果同时携带最大长度群组字段和 referral，建议把 referral 控制在 32 字符以内。

## 8. 非 Telegram Web 环境 Query 参数

为了方便普通浏览器和本地测试，世界杯页面同步支持 query 参数。

### 8.1 列表页定位

```text
/world-cup?match=<matchId>
/world-cup?anchor=<matchId>
```

示例：

```text
http://localhost:3001/world-cup?match=M12
http://localhost:3001/world-cup?anchor=M12
```

### 8.2 详情页初始化 market/outcome

```text
/world-cup/match/<eventSlug>?market=<marketCode>&outcome=<yes|no>
```

示例：

```text
http://localhost:3001/world-cup/match/fifwc-swe-tun-2026-06-14?market=mlh&outcome=yes
http://localhost:3001/world-cup/match/fifwc-swe-tun-2026-06-14?market=to25&outcome=no
http://localhost:3001/world-cup/match/fifwc-swe-tun-2026-06-14?market=btts&outcome=yes
```

## 9. 测试链接

### 9.1 Local Web

```text
http://localhost:3001/world-cup?match=M12
http://localhost:3001/world-cup/match/fifwc-swe-tun-2026-06-14
http://localhost:3001/world-cup/match/fifwc-swe-tun-2026-06-14?market=mlh&outcome=yes
http://localhost:3001/world-cup/match/fifwc-swe-tun-2026-06-14?market=mld&outcome=yes
http://localhost:3001/world-cup/match/fifwc-swe-tun-2026-06-14?market=mla&outcome=yes
http://localhost:3001/world-cup/match/fifwc-swe-tun-2026-06-14?market=to&outcome=yes
http://localhost:3001/world-cup/match/fifwc-swe-tun-2026-06-14?market=to25&outcome=no
http://localhost:3001/world-cup/match/fifwc-swe-tun-2026-06-14?market=sp&outcome=no
http://localhost:3001/world-cup/match/fifwc-swe-tun-2026-06-14?market=btts&outcome=yes
```

### 9.2 Local Telegram 参数模拟

这些链接不需要真的在 Telegram 里打开，用来验证前端是否能从 `tgWebAppStartParam` fallback 解析：

```text
http://localhost:3001/?tgWebAppStartParam=v1-wl-M12
http://localhost:3001/?tgWebAppStartParam=v1-wl-M12-gHctKD5O
http://localhost:3001/?tgWebAppStartParam=v1-wl-M12-rAFF2026
http://localhost:3001/?tgWebAppStartParam=v1-wl-M12-gHctKD5O-rAFF2026
http://localhost:3001/?tgWebAppStartParam=v1-wd-M12
http://localhost:3001/?tgWebAppStartParam=v1-wd-M12-mlh-y
http://localhost:3001/?tgWebAppStartParam=v1-wd-M12-mlh-y-gHctKD5O
http://localhost:3001/?tgWebAppStartParam=v1-wd-M12-to25-n
http://localhost:3001/?tgWebAppStartParam=v1-wd-M12-btts-y-rAFF2026
http://localhost:3001/?tgWebAppStartParam=v1-wd-M12-btts-y-gHctKD5O-rAFF2026
```

### 9.3 Production Telegram Mini App

```text
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wl-M12
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wl-M12-gHctKD5O
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wl-M12-rAFF2026
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wl-M12-gHctKD5O-rAFF2026
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wd-M12
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wd-M12-mlh-y
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wd-M12-mlh-y-gHctKD5O
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wd-M12-to25-n
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wd-M12-btts-y-rAFF2026
https://t.me/LiberfiWCLiveBot/Liberfi_Prediction_App?startapp=v1-wd-M12-btts-y-gHctKD5O-rAFF2026
```

### 9.4 Production Web fallback

```text
https://predict.liberfi.io/?tgWebAppStartParam=v1-wl-M12
https://predict.liberfi.io/?tgWebAppStartParam=v1-wd-M12-mlh-y
https://predict.liberfi.io/world-cup?match=M12
https://predict.liberfi.io/world-cup/match/fifwc-swe-tun-2026-06-14?market=mlh&outcome=yes
```

### 9.5 Staging Web fallback

```text
https://liberfi-prediction-kan5x1589-sgt-lab.vercel.app/?tgWebAppStartParam=v1-wl-M12
https://liberfi-prediction-kan5x1589-sgt-lab.vercel.app/?tgWebAppStartParam=v1-wd-M12-mlh-y
https://liberfi-prediction-kan5x1589-sgt-lab.vercel.app/world-cup?match=M12
https://liberfi-prediction-kan5x1589-sgt-lab.vercel.app/world-cup/match/fifwc-swe-tun-2026-06-14?market=mlh&outcome=yes
```

## 10. Bot 侧生成建议

推荐 Bot 侧用固定函数生成，避免手写字符串。

```ts
type Route = "wl" | "wd";
type Outcome = "y" | "n";
type MarketCode = "mlh" | "mld" | "mla" | "sp" | "to" | `to${number}` | "btts";
const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function assertSafeSegment(name: string, value: string, pattern: RegExp) {
  if (!pattern.test(value)) throw new Error(`Invalid ${name}: ${value}`);
}

function encodeTelegramGroupChatId(chatId: number | bigint): string {
  let value = typeof chatId === "bigint" ? chatId : BigInt(chatId);
  if (value >= 0n) throw new Error(`Telegram group chatId must be negative: ${chatId}`);
  value = -value;

  let encoded = "";
  while (value > 0n) {
    encoded = BASE62_ALPHABET[Number(value % 62n)] + encoded;
    value /= 62n;
  }
  return `g${encoded || "0"}`;
}

export function buildWorldCupListStartParam(input: {
  matchId: string;
  telegramGroupChatId?: number | bigint;
  referral?: string;
}) {
  assertSafeSegment("matchId", input.matchId, /^M[0-9]+$/);
  const parts = ["v1", "wl", input.matchId];
  if (input.telegramGroupChatId !== undefined) {
    parts.push(encodeTelegramGroupChatId(input.telegramGroupChatId));
  }
  if (input.referral) {
    assertSafeSegment("referral", input.referral, /^[A-Za-z0-9_]+$/);
    parts.push(`r${input.referral}`);
  }
  const value = parts.join("-");
  if (value.length > 64) throw new Error(`start_param too long: ${value.length}`);
  return value;
}

export function buildWorldCupDetailStartParam(input: {
  matchId: string;
  market?: MarketCode;
  outcome?: Outcome;
  telegramGroupChatId?: number | bigint;
  referral?: string;
}) {
  assertSafeSegment("matchId", input.matchId, /^M[0-9]+$/);
  const parts = ["v1", "wd", input.matchId];
  if (input.market || input.outcome) {
    if (!input.market || !input.outcome) throw new Error("market and outcome must be provided together");
    assertSafeSegment("market", input.market, /^(?:mlh|mld|mla|sp|to|to[0-9]+|btts)$/);
    assertSafeSegment("outcome", input.outcome, /^[yn]$/);
    parts.push(input.market, input.outcome);
  }
  if (input.telegramGroupChatId !== undefined) {
    parts.push(encodeTelegramGroupChatId(input.telegramGroupChatId));
  }
  if (input.referral) {
    assertSafeSegment("referral", input.referral, /^[A-Za-z0-9_]+$/);
    parts.push(`r${input.referral}`);
  }
  const value = parts.join("-");
  if (value.length > 64) throw new Error(`start_param too long: ${value.length}`);
  return value;
}
```

## 11. 当前比赛配置

说明：

- `matchId` 是 `start_param` 使用的比赛编号。
- `eventSlug` 是详情页 `/world-cup/match/<eventSlug>` 使用的 slug。
- `mlhSlug`、`mldSlug`、`mlaSlug` 分别对应 `mlh`、`mld`、`mla`。
- `bttsSlug` 对应 `btts`。
- `defaultSpreadSlug` 对应 `sp` 当前默认 market。
- `defaultTotalSlug` 对应 `to` 当前默认 market。
- 完整 market set 可通过 `GET /api/v1/worldcup/matches/<eventSlug>` 获取，当前每场还包含 exact score、halftime result、多个 spread line 和多个 total line。

| matchId | Group | Match | eventSlug | mlhSlug | mldSlug | mlaSlug | bttsSlug | defaultSpreadSlug | defaultTotalSlug |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | A | Mexico vs. South Africa | fifwc-mex-rsa-2026-06-11 | fifwc-mex-rsa-2026-06-11-mex | fifwc-mex-rsa-2026-06-11-draw | fifwc-mex-rsa-2026-06-11-rsa | fifwc-mex-rsa-2026-06-11-btts | fifwc-mex-rsa-2026-06-11-spread-away-1pt5 | fifwc-mex-rsa-2026-06-11-total-1pt5 |
| M2 | A | Korea Republic vs. Czechia | fifwc-kr-cze-2026-06-11 | fifwc-kr-cze-2026-06-11-kr | fifwc-kr-cze-2026-06-11-draw | fifwc-kr-cze-2026-06-11-cze | fifwc-kr-cze-2026-06-11-btts | fifwc-kr-cze-2026-06-11-spread-away-2pt5 | fifwc-kr-cze-2026-06-11-total-0pt5 |
| M3 | B | Canada vs. Bosnia and Herzegovina | fifwc-can-bih-2026-06-12 | fifwc-can-bih-2026-06-12-can | fifwc-can-bih-2026-06-12-draw | fifwc-can-bih-2026-06-12-bih | fifwc-can-bih-2026-06-12-btts | fifwc-can-bih-2026-06-12-spread-away-2pt5 | fifwc-can-bih-2026-06-12-total-4pt5 |
| M4 | D | United States vs. Paraguay | fifwc-usa-par-2026-06-12 | fifwc-usa-par-2026-06-12-usa | fifwc-usa-par-2026-06-12-draw | fifwc-usa-par-2026-06-12-par | fifwc-usa-par-2026-06-12-btts | fifwc-usa-par-2026-06-12-spread-away-2pt5 | fifwc-usa-par-2026-06-12-total-1pt5 |
| M5 | B | Qatar vs. Switzerland | fifwc-qat-che-2026-06-13 | fifwc-qat-che-2026-06-13-qat | fifwc-qat-che-2026-06-13-draw | fifwc-qat-che-2026-06-13-che | fifwc-qat-che-2026-06-13-btts | fifwc-qat-che-2026-06-13-spread-away-2pt5 | fifwc-qat-che-2026-06-13-total-0pt5 |
| M6 | C | Brazil vs. Morocco | fifwc-bra-mar-2026-06-13 | fifwc-bra-mar-2026-06-13-bra | fifwc-bra-mar-2026-06-13-draw | fifwc-bra-mar-2026-06-13-mar | fifwc-bra-mar-2026-06-13-btts | fifwc-bra-mar-2026-06-13-spread-away-1pt5 | fifwc-bra-mar-2026-06-13-total-4pt5 |
| M7 | C | Haiti vs. Scotland | fifwc-hai-sco-2026-06-13 | fifwc-hai-sco-2026-06-13-hai | fifwc-hai-sco-2026-06-13-draw | fifwc-hai-sco-2026-06-13-sco | fifwc-hai-sco-2026-06-13-btts | fifwc-hai-sco-2026-06-13-spread-away-1pt5 | fifwc-hai-sco-2026-06-13-total-4pt5 |
| M8 | D | Australia vs. Türkiye | fifwc-aus-tur-2026-06-14 | fifwc-aus-tur-2026-06-14-aus | fifwc-aus-tur-2026-06-14-draw | fifwc-aus-tur-2026-06-14-tur | fifwc-aus-tur-2026-06-14-btts | fifwc-aus-tur-2026-06-14-spread-away-2pt5 | fifwc-aus-tur-2026-06-14-total-5pt5 |
| M9 | E | Germany vs. Curaçao | fifwc-ger-kor-2026-06-14 | fifwc-ger-kor-2026-06-14-ger | fifwc-ger-kor-2026-06-14-draw | fifwc-ger-kor-2026-06-14-kor | fifwc-ger-kor-2026-06-14-btts | fifwc-ger-kor-2026-06-14-spread-home-3pt5 | fifwc-ger-kor-2026-06-14-total-0pt5 |
| M10 | F | Netherlands vs. Japan | fifwc-nld-jpn-2026-06-14 | fifwc-nld-jpn-2026-06-14-nld | fifwc-nld-jpn-2026-06-14-draw | fifwc-nld-jpn-2026-06-14-jpn | fifwc-nld-jpn-2026-06-14-btts | fifwc-nld-jpn-2026-06-14-spread-away-1pt5 | fifwc-nld-jpn-2026-06-14-total-0pt5 |
| M11 | E | Côte d'Ivoire vs. Ecuador | fifwc-civ-ecu-2026-06-14 | fifwc-civ-ecu-2026-06-14-civ | fifwc-civ-ecu-2026-06-14-draw | fifwc-civ-ecu-2026-06-14-ecu | fifwc-civ-ecu-2026-06-14-btts | fifwc-civ-ecu-2026-06-14-spread-away-2pt5 | fifwc-civ-ecu-2026-06-14-total-0pt5 |
| M12 | F | Sweden vs. Tunisia | fifwc-swe-tun-2026-06-14 | fifwc-swe-tun-2026-06-14-swe | fifwc-swe-tun-2026-06-14-draw | fifwc-swe-tun-2026-06-14-tun | fifwc-swe-tun-2026-06-14-btts | fifwc-swe-tun-2026-06-14-spread-home-1pt5 | fifwc-swe-tun-2026-06-14-total-0pt5 |
| M13 | H | Spain vs. Cabo Verde | fifwc-esp-cvi-2026-06-15 | fifwc-esp-cvi-2026-06-15-esp | fifwc-esp-cvi-2026-06-15-draw | fifwc-esp-cvi-2026-06-15-cvi | fifwc-esp-cvi-2026-06-15-btts | fifwc-esp-cvi-2026-06-15-spread-away-2pt5 | fifwc-esp-cvi-2026-06-15-total-0pt5 |
| M14 | G | Belgium vs. Egypt | fifwc-bel-egy-2026-06-15 | fifwc-bel-egy-2026-06-15-bel | fifwc-bel-egy-2026-06-15-draw | fifwc-bel-egy-2026-06-15-egy | fifwc-bel-egy-2026-06-15-btts | fifwc-bel-egy-2026-06-15-spread-away-1pt5 | fifwc-bel-egy-2026-06-15-total-1pt5 |
| M15 | H | Saudi Arabia vs. Uruguay | fifwc-ksa-ury-2026-06-15 | fifwc-ksa-ury-2026-06-15-ksa | fifwc-ksa-ury-2026-06-15-draw | fifwc-ksa-ury-2026-06-15-ury | fifwc-ksa-ury-2026-06-15-btts | fifwc-ksa-ury-2026-06-15-spread-away-2pt5 | fifwc-ksa-ury-2026-06-15-total-4pt5 |
| M16 | G | IR Iran vs. New Zealand | fifwc-irn-nzl-2026-06-15 | fifwc-irn-nzl-2026-06-15-irn | fifwc-irn-nzl-2026-06-15-draw | fifwc-irn-nzl-2026-06-15-nzl | fifwc-irn-nzl-2026-06-15-btts | fifwc-irn-nzl-2026-06-15-spread-away-1pt5 | fifwc-irn-nzl-2026-06-15-total-3pt5 |
| M17 | I | France vs. Senegal | fifwc-fra-sen-2026-06-16 | fifwc-fra-sen-2026-06-16-fra | fifwc-fra-sen-2026-06-16-draw | fifwc-fra-sen-2026-06-16-sen | fifwc-fra-sen-2026-06-16-btts | fifwc-fra-sen-2026-06-16-spread-home-1pt5 | fifwc-fra-sen-2026-06-16-total-0pt5 |
| M18 | I | Iraq vs. Norway | fifwc-irq-nor-2026-06-16 | fifwc-irq-nor-2026-06-16-irq | fifwc-irq-nor-2026-06-16-draw | fifwc-irq-nor-2026-06-16-nor | fifwc-irq-nor-2026-06-16-btts | fifwc-irq-nor-2026-06-16-spread-away-2pt5 | fifwc-irq-nor-2026-06-16-total-0pt5 |
| M19 | J | Argentina vs. Algeria | fifwc-arg-alg-2026-06-16 | fifwc-arg-alg-2026-06-16-arg | fifwc-arg-alg-2026-06-16-draw | fifwc-arg-alg-2026-06-16-alg | fifwc-arg-alg-2026-06-16-btts | fifwc-arg-alg-2026-06-16-spread-home-2pt5 | fifwc-arg-alg-2026-06-16-total-4pt5 |
| M20 | J | Austria vs. Jordan | fifwc-aut-jor-2026-06-17 | fifwc-aut-jor-2026-06-17-aut | fifwc-aut-jor-2026-06-17-draw | fifwc-aut-jor-2026-06-17-jor | fifwc-aut-jor-2026-06-17-btts | fifwc-aut-jor-2026-06-17-spread-away-1pt5 | fifwc-aut-jor-2026-06-17-total-3pt5 |
| M21 | K | Portugal vs. DR Congo | fifwc-prt-cdr-2026-06-17 | fifwc-prt-cdr-2026-06-17-prt | fifwc-prt-cdr-2026-06-17-draw | fifwc-prt-cdr-2026-06-17-cdr | fifwc-prt-cdr-2026-06-17-btts | fifwc-prt-cdr-2026-06-17-spread-away-2pt5 | fifwc-prt-cdr-2026-06-17-total-4pt5 |
| M22 | L | England vs. Croatia | fifwc-eng-hrv-2026-06-17 | fifwc-eng-hrv-2026-06-17-eng | fifwc-eng-hrv-2026-06-17-draw | fifwc-eng-hrv-2026-06-17-hrv | fifwc-eng-hrv-2026-06-17-btts | fifwc-eng-hrv-2026-06-17-spread-away-2pt5 | fifwc-eng-hrv-2026-06-17-total-0pt5 |
| M23 | L | Ghana vs. Panama | fifwc-gha-pan-2026-06-17 | fifwc-gha-pan-2026-06-17-gha | fifwc-gha-pan-2026-06-17-draw | fifwc-gha-pan-2026-06-17-pan | fifwc-gha-pan-2026-06-17-btts | fifwc-gha-pan-2026-06-17-spread-away-2pt5 | fifwc-gha-pan-2026-06-17-total-2pt5 |
| M24 | K | Uzbekistan vs. Colombia | fifwc-uzb-col-2026-06-17 | fifwc-uzb-col-2026-06-17-uzb | fifwc-uzb-col-2026-06-17-draw | fifwc-uzb-col-2026-06-17-col | fifwc-uzb-col-2026-06-17-btts | fifwc-uzb-col-2026-06-17-spread-home-2pt5 | fifwc-uzb-col-2026-06-17-total-2pt5 |
| M25 | A | Czechia vs. South Africa | fifwc-cze-rsa-2026-06-18 | fifwc-cze-rsa-2026-06-18-cze | fifwc-cze-rsa-2026-06-18-draw | fifwc-cze-rsa-2026-06-18-rsa | fifwc-cze-rsa-2026-06-18-btts | fifwc-cze-rsa-2026-06-18-spread-home-1pt5 | fifwc-cze-rsa-2026-06-18-total-0pt5 |
| M26 | B | Switzerland vs. Bosnia and Herzegovina | fifwc-che-bih-2026-06-18 | fifwc-che-bih-2026-06-18-che | fifwc-che-bih-2026-06-18-draw | fifwc-che-bih-2026-06-18-bih | fifwc-che-bih-2026-06-18-btts | fifwc-che-bih-2026-06-18-spread-away-1pt5 | fifwc-che-bih-2026-06-18-total-2pt5 |
| M27 | B | Canada vs. Qatar | fifwc-can-qat-2026-06-18 | fifwc-can-qat-2026-06-18-can | fifwc-can-qat-2026-06-18-draw | fifwc-can-qat-2026-06-18-qat | fifwc-can-qat-2026-06-18-btts | fifwc-can-qat-2026-06-18-spread-away-1pt5 | fifwc-can-qat-2026-06-18-total-0pt5 |
| M28 | A | Mexico vs. Korea Republic | fifwc-mex-kr-2026-06-18 | fifwc-mex-kr-2026-06-18-mex | fifwc-mex-kr-2026-06-18-draw | fifwc-mex-kr-2026-06-18-kr | fifwc-mex-kr-2026-06-18-btts | fifwc-mex-kr-2026-06-18-spread-away-1pt5 | fifwc-mex-kr-2026-06-18-total-0pt5 |
| M29 | D | United States vs. Australia | fifwc-usa-aus-2026-06-19 | fifwc-usa-aus-2026-06-19-usa | fifwc-usa-aus-2026-06-19-draw | fifwc-usa-aus-2026-06-19-aus | fifwc-usa-aus-2026-06-19-btts | fifwc-usa-aus-2026-06-19-spread-away-2pt5 | fifwc-usa-aus-2026-06-19-total-0pt5 |
| M30 | C | Scotland vs. Morocco | fifwc-sco-mar-2026-06-19 | fifwc-sco-mar-2026-06-19-sco | fifwc-sco-mar-2026-06-19-draw | fifwc-sco-mar-2026-06-19-mar | fifwc-sco-mar-2026-06-19-btts | fifwc-sco-mar-2026-06-19-spread-away-1pt5 | fifwc-sco-mar-2026-06-19-total-0pt5 |
| M31 | C | Brazil vs. Haiti | fifwc-bra-hai-2026-06-19 | fifwc-bra-hai-2026-06-19-bra | fifwc-bra-hai-2026-06-19-draw | fifwc-bra-hai-2026-06-19-hai | fifwc-bra-hai-2026-06-19-btts | fifwc-bra-hai-2026-06-19-spread-away-2pt5 | fifwc-bra-hai-2026-06-19-total-1pt5 |
| M32 | D | Türkiye vs. Paraguay | fifwc-tur-par-2026-06-19 | fifwc-tur-par-2026-06-19-tur | fifwc-tur-par-2026-06-19-draw | fifwc-tur-par-2026-06-19-par | fifwc-tur-par-2026-06-19-btts | fifwc-tur-par-2026-06-19-spread-away-1pt5 | fifwc-tur-par-2026-06-19-total-0pt5 |
| M33 | F | Netherlands vs. Sweden | fifwc-nld-swe-2026-06-20 | fifwc-nld-swe-2026-06-20-nld | fifwc-nld-swe-2026-06-20-draw | fifwc-nld-swe-2026-06-20-swe | fifwc-nld-swe-2026-06-20-btts | fifwc-nld-swe-2026-06-20-spread-away-1pt5 | fifwc-nld-swe-2026-06-20-total-4pt5 |
| M34 | E | Germany vs. Côte d'Ivoire | fifwc-ger-civ-2026-06-20 | fifwc-ger-civ-2026-06-20-ger | fifwc-ger-civ-2026-06-20-draw | fifwc-ger-civ-2026-06-20-civ | fifwc-ger-civ-2026-06-20-btts | fifwc-ger-civ-2026-06-20-spread-away-2pt5 | fifwc-ger-civ-2026-06-20-total-0pt5 |
| M35 | E | Ecuador vs. Curaçao | fifwc-ecu-kor-2026-06-20 | fifwc-ecu-kor-2026-06-20-ecu | fifwc-ecu-kor-2026-06-20-draw | fifwc-ecu-kor-2026-06-20-kor | fifwc-ecu-kor-2026-06-20-btts | fifwc-ecu-kor-2026-06-20-spread-away-1pt5 | fifwc-ecu-kor-2026-06-20-total-1pt5 |
| M36 | F | Tunisia vs. Japan | fifwc-tun-jpn-2026-06-21 | fifwc-tun-jpn-2026-06-21-tun | fifwc-tun-jpn-2026-06-21-draw | fifwc-tun-jpn-2026-06-21-jpn | fifwc-tun-jpn-2026-06-21-btts | fifwc-tun-jpn-2026-06-21-spread-away-1pt5 | fifwc-tun-jpn-2026-06-21-total-3pt5 |
| M37 | H | Spain vs. Saudi Arabia | fifwc-esp-ksa-2026-06-21 | fifwc-esp-ksa-2026-06-21-esp | fifwc-esp-ksa-2026-06-21-draw | fifwc-esp-ksa-2026-06-21-ksa | fifwc-esp-ksa-2026-06-21-btts | fifwc-esp-ksa-2026-06-21-spread-away-1pt5 | fifwc-esp-ksa-2026-06-21-total-0pt5 |
| M38 | G | Belgium vs. IR Iran | fifwc-bel-irn-2026-06-21 | fifwc-bel-irn-2026-06-21-bel | fifwc-bel-irn-2026-06-21-draw | fifwc-bel-irn-2026-06-21-irn | fifwc-bel-irn-2026-06-21-btts | fifwc-bel-irn-2026-06-21-spread-away-2pt5 | fifwc-bel-irn-2026-06-21-total-1pt5 |
| M39 | H | Uruguay vs. Cabo Verde | fifwc-ury-cvi-2026-06-21 | fifwc-ury-cvi-2026-06-21-ury | fifwc-ury-cvi-2026-06-21-draw | fifwc-ury-cvi-2026-06-21-cvi | fifwc-ury-cvi-2026-06-21-btts | fifwc-ury-cvi-2026-06-21-spread-away-2pt5 | fifwc-ury-cvi-2026-06-21-total-0pt5 |
| M40 | G | New Zealand vs. Egypt | fifwc-nzl-egy-2026-06-21 | fifwc-nzl-egy-2026-06-21-nzl | fifwc-nzl-egy-2026-06-21-draw | fifwc-nzl-egy-2026-06-21-egy | fifwc-nzl-egy-2026-06-21-btts | fifwc-nzl-egy-2026-06-21-spread-home-1pt5 | fifwc-nzl-egy-2026-06-21-total-0pt5 |
| M41 | J | Argentina vs. Austria | fifwc-arg-aut-2026-06-22 | fifwc-arg-aut-2026-06-22-arg | fifwc-arg-aut-2026-06-22-draw | fifwc-arg-aut-2026-06-22-aut | fifwc-arg-aut-2026-06-22-btts | fifwc-arg-aut-2026-06-22-spread-away-2pt5 | fifwc-arg-aut-2026-06-22-total-3pt5 |
| M42 | I | France vs. Iraq | fifwc-fra-irq-2026-06-22 | fifwc-fra-irq-2026-06-22-fra | fifwc-fra-irq-2026-06-22-draw | fifwc-fra-irq-2026-06-22-irq | fifwc-fra-irq-2026-06-22-btts | fifwc-fra-irq-2026-06-22-spread-away-2pt5 | fifwc-fra-irq-2026-06-22-total-0pt5 |
| M43 | I | Norway vs. Senegal | fifwc-nor-sen-2026-06-22 | fifwc-nor-sen-2026-06-22-nor | fifwc-nor-sen-2026-06-22-draw | fifwc-nor-sen-2026-06-22-sen | fifwc-nor-sen-2026-06-22-btts | fifwc-nor-sen-2026-06-22-spread-home-1pt5 | fifwc-nor-sen-2026-06-22-total-1pt5 |
| M44 | J | Jordan vs. Algeria | fifwc-jor-alg-2026-06-22 | fifwc-jor-alg-2026-06-22-jor | fifwc-jor-alg-2026-06-22-draw | fifwc-jor-alg-2026-06-22-alg | fifwc-jor-alg-2026-06-22-btts | fifwc-jor-alg-2026-06-22-spread-away-1pt5 | fifwc-jor-alg-2026-06-22-total-1pt5 |
| M45 | K | Portugal vs. Uzbekistan | fifwc-prt-uzb-2026-06-23 | fifwc-prt-uzb-2026-06-23-prt | fifwc-prt-uzb-2026-06-23-draw | fifwc-prt-uzb-2026-06-23-uzb | fifwc-prt-uzb-2026-06-23-btts | fifwc-prt-uzb-2026-06-23-spread-away-1pt5 | fifwc-prt-uzb-2026-06-23-total-0pt5 |
| M46 | L | England vs. Ghana | fifwc-eng-gha-2026-06-23 | fifwc-eng-gha-2026-06-23-eng | fifwc-eng-gha-2026-06-23-draw | fifwc-eng-gha-2026-06-23-gha | fifwc-eng-gha-2026-06-23-btts | fifwc-eng-gha-2026-06-23-spread-away-2pt5 | fifwc-eng-gha-2026-06-23-total-0pt5 |
| M47 | L | Panama vs. Croatia | fifwc-pan-hrv-2026-06-23 | fifwc-pan-hrv-2026-06-23-pan | fifwc-pan-hrv-2026-06-23-draw | fifwc-pan-hrv-2026-06-23-hrv | fifwc-pan-hrv-2026-06-23-btts | fifwc-pan-hrv-2026-06-23-spread-away-2pt5 | fifwc-pan-hrv-2026-06-23-total-0pt5 |
| M48 | K | Colombia vs. DR Congo | fifwc-col-cdr-2026-06-23 | fifwc-col-cdr-2026-06-23-col | fifwc-col-cdr-2026-06-23-draw | fifwc-col-cdr-2026-06-23-cdr | fifwc-col-cdr-2026-06-23-btts | fifwc-col-cdr-2026-06-23-spread-away-2pt5 | fifwc-col-cdr-2026-06-23-total-2pt5 |
| M49 | B | Bosnia and Herzegovina vs. Qatar | fifwc-bih-qat-2026-06-24 | fifwc-bih-qat-2026-06-24-bih | fifwc-bih-qat-2026-06-24-draw | fifwc-bih-qat-2026-06-24-qat | fifwc-bih-qat-2026-06-24-btts | fifwc-bih-qat-2026-06-24-spread-away-1pt5 | fifwc-bih-qat-2026-06-24-total-0pt5 |
| M50 | B | Switzerland vs. Canada | fifwc-che-can-2026-06-24 | fifwc-che-can-2026-06-24-che | fifwc-che-can-2026-06-24-draw | fifwc-che-can-2026-06-24-can | fifwc-che-can-2026-06-24-btts | fifwc-che-can-2026-06-24-spread-away-2pt5 | fifwc-che-can-2026-06-24-total-2pt5 |
| M51 | C | Morocco vs. Haiti | fifwc-mar-hai-2026-06-24 | fifwc-mar-hai-2026-06-24-mar | fifwc-mar-hai-2026-06-24-draw | fifwc-mar-hai-2026-06-24-hai | fifwc-mar-hai-2026-06-24-btts | fifwc-mar-hai-2026-06-24-spread-away-1pt5 | fifwc-mar-hai-2026-06-24-total-1pt5 |
| M52 | C | Scotland vs. Brazil | fifwc-sco-bra-2026-06-24 | fifwc-sco-bra-2026-06-24-sco | fifwc-sco-bra-2026-06-24-draw | fifwc-sco-bra-2026-06-24-bra | fifwc-sco-bra-2026-06-24-btts | fifwc-sco-bra-2026-06-24-spread-away-2pt5 | fifwc-sco-bra-2026-06-24-total-0pt5 |
| M53 | A | Czechia vs. Mexico | fifwc-cze-mex-2026-06-24 | fifwc-cze-mex-2026-06-24-cze | fifwc-cze-mex-2026-06-24-draw | fifwc-cze-mex-2026-06-24-mex | fifwc-cze-mex-2026-06-24-btts | fifwc-cze-mex-2026-06-24-spread-away-1pt5 | fifwc-cze-mex-2026-06-24-total-0pt5 |
| M54 | A | South Africa vs. Korea Republic | fifwc-rsa-kr-2026-06-24 | fifwc-rsa-kr-2026-06-24-rsa | fifwc-rsa-kr-2026-06-24-draw | fifwc-rsa-kr-2026-06-24-kr | fifwc-rsa-kr-2026-06-24-btts | fifwc-rsa-kr-2026-06-24-spread-away-1pt5 | fifwc-rsa-kr-2026-06-24-total-4pt5 |
| M55 | E | Ecuador vs. Germany | fifwc-ecu-ger-2026-06-25 | fifwc-ecu-ger-2026-06-25-ecu | fifwc-ecu-ger-2026-06-25-draw | fifwc-ecu-ger-2026-06-25-ger | fifwc-ecu-ger-2026-06-25-btts | fifwc-ecu-ger-2026-06-25-spread-away-1pt5 | fifwc-ecu-ger-2026-06-25-total-0pt5 |
| M56 | E | Curaçao vs. Côte d'Ivoire | fifwc-kor-civ-2026-06-25 | fifwc-kor-civ-2026-06-25-kor | fifwc-kor-civ-2026-06-25-draw | fifwc-kor-civ-2026-06-25-civ | fifwc-kor-civ-2026-06-25-btts | fifwc-kor-civ-2026-06-25-spread-home-2pt5 | fifwc-kor-civ-2026-06-25-total-2pt5 |
| M57 | F | Japan vs. Sweden | fifwc-jpn-swe-2026-06-25 | fifwc-jpn-swe-2026-06-25-jpn | fifwc-jpn-swe-2026-06-25-draw | fifwc-jpn-swe-2026-06-25-swe | fifwc-jpn-swe-2026-06-25-btts | fifwc-jpn-swe-2026-06-25-spread-home-1pt5 | fifwc-jpn-swe-2026-06-25-total-0pt5 |
| M58 | F | Tunisia vs. Netherlands | fifwc-tun-nld-2026-06-25 | fifwc-tun-nld-2026-06-25-tun | fifwc-tun-nld-2026-06-25-draw | fifwc-tun-nld-2026-06-25-nld | fifwc-tun-nld-2026-06-25-btts | fifwc-tun-nld-2026-06-25-spread-home-2pt5 | fifwc-tun-nld-2026-06-25-total-0pt5 |
| M59 | D | Paraguay vs. Australia | fifwc-par-aus-2026-06-25 | fifwc-par-aus-2026-06-25-par | fifwc-par-aus-2026-06-25-draw | fifwc-par-aus-2026-06-25-aus | fifwc-par-aus-2026-06-25-btts | fifwc-par-aus-2026-06-25-spread-away-2pt5 | fifwc-par-aus-2026-06-25-total-0pt5 |
| M60 | D | Türkiye vs. United States | fifwc-tur-usa-2026-06-25 | fifwc-tur-usa-2026-06-25-tur | fifwc-tur-usa-2026-06-25-draw | fifwc-tur-usa-2026-06-25-usa | fifwc-tur-usa-2026-06-25-btts | fifwc-tur-usa-2026-06-25-spread-away-1pt5 | fifwc-tur-usa-2026-06-25-total-2pt5 |
| M61 | I | Norway vs. France | fifwc-nor-fra-2026-06-26 | fifwc-nor-fra-2026-06-26-nor | fifwc-nor-fra-2026-06-26-draw | fifwc-nor-fra-2026-06-26-fra | fifwc-nor-fra-2026-06-26-btts | fifwc-nor-fra-2026-06-26-spread-away-1pt5 | fifwc-nor-fra-2026-06-26-total-1pt5 |
| M62 | I | Senegal vs. Iraq | fifwc-sen-irq-2026-06-26 | fifwc-sen-irq-2026-06-26-sen | fifwc-sen-irq-2026-06-26-draw | fifwc-sen-irq-2026-06-26-irq | fifwc-sen-irq-2026-06-26-btts | fifwc-sen-irq-2026-06-26-spread-away-1pt5 | fifwc-sen-irq-2026-06-26-total-0pt5 |
| M63 | H | Cabo Verde vs. Saudi Arabia | fifwc-cvi-ksa-2026-06-26 | fifwc-cvi-ksa-2026-06-26-cvi | fifwc-cvi-ksa-2026-06-26-draw | fifwc-cvi-ksa-2026-06-26-ksa | fifwc-cvi-ksa-2026-06-26-btts | fifwc-cvi-ksa-2026-06-26-spread-home-1pt5 | fifwc-cvi-ksa-2026-06-26-total-0pt5 |
| M64 | H | Uruguay vs. Spain | fifwc-ury-esp-2026-06-26 | fifwc-ury-esp-2026-06-26-ury | fifwc-ury-esp-2026-06-26-draw | fifwc-ury-esp-2026-06-26-esp | fifwc-ury-esp-2026-06-26-btts | fifwc-ury-esp-2026-06-26-spread-home-2pt5 | fifwc-ury-esp-2026-06-26-total-1pt5 |
| M65 | G | Egypt vs. IR Iran | fifwc-egy-irn-2026-06-26 | fifwc-egy-irn-2026-06-26-egy | fifwc-egy-irn-2026-06-26-draw | fifwc-egy-irn-2026-06-26-irn | fifwc-egy-irn-2026-06-26-btts | fifwc-egy-irn-2026-06-26-spread-away-1pt5 | fifwc-egy-irn-2026-06-26-total-1pt5 |
| M66 | G | New Zealand vs. Belgium | fifwc-nzl-bel-2026-06-26 | fifwc-nzl-bel-2026-06-26-nzl | fifwc-nzl-bel-2026-06-26-draw | fifwc-nzl-bel-2026-06-26-bel | fifwc-nzl-bel-2026-06-26-btts | fifwc-nzl-bel-2026-06-26-spread-home-2pt5 | fifwc-nzl-bel-2026-06-26-total-5pt5 |
| M67 | L | Croatia vs. Ghana | fifwc-hrv-gha-2026-06-27 | fifwc-hrv-gha-2026-06-27-hrv | fifwc-hrv-gha-2026-06-27-draw | fifwc-hrv-gha-2026-06-27-gha | fifwc-hrv-gha-2026-06-27-btts | fifwc-hrv-gha-2026-06-27-spread-home-1pt5 | fifwc-hrv-gha-2026-06-27-total-1pt5 |
| M68 | L | Panama vs. England | fifwc-pan-eng-2026-06-27 | fifwc-pan-eng-2026-06-27-pan | fifwc-pan-eng-2026-06-27-draw | fifwc-pan-eng-2026-06-27-eng | fifwc-pan-eng-2026-06-27-btts | fifwc-pan-eng-2026-06-27-spread-away-1pt5 | fifwc-pan-eng-2026-06-27-total-1pt5 |
| M69 | K | DR Congo vs. Uzbekistan | fifwc-cdr-uzb-2026-06-27 | fifwc-cdr-uzb-2026-06-27-cdr | fifwc-cdr-uzb-2026-06-27-draw | fifwc-cdr-uzb-2026-06-27-uzb | fifwc-cdr-uzb-2026-06-27-btts | fifwc-cdr-uzb-2026-06-27-spread-home-2pt5 | fifwc-cdr-uzb-2026-06-27-total-4pt5 |
| M70 | K | Colombia vs. Portugal | fifwc-col-prt-2026-06-27 | fifwc-col-prt-2026-06-27-col | fifwc-col-prt-2026-06-27-draw | fifwc-col-prt-2026-06-27-prt | fifwc-col-prt-2026-06-27-btts | fifwc-col-prt-2026-06-27-spread-home-2pt5 | fifwc-col-prt-2026-06-27-total-5pt5 |
| M71 | J | Algeria vs. Austria | fifwc-alg-aut-2026-06-27 | fifwc-alg-aut-2026-06-27-alg | fifwc-alg-aut-2026-06-27-draw | fifwc-alg-aut-2026-06-27-aut | fifwc-alg-aut-2026-06-27-btts | fifwc-alg-aut-2026-06-27-spread-home-1pt5 | fifwc-alg-aut-2026-06-27-total-1pt5 |
| M72 | J | Jordan vs. Argentina | fifwc-jor-arg-2026-06-27 | fifwc-jor-arg-2026-06-27-jor | fifwc-jor-arg-2026-06-27-draw | fifwc-jor-arg-2026-06-27-arg | fifwc-jor-arg-2026-06-27-btts | fifwc-jor-arg-2026-06-27-spread-away-2pt5 | fifwc-jor-arg-2026-06-27-total-4pt5 |

## 12. 验收 Checklist

Bot 侧接入完成后，至少验证以下 case：

- `v1-wl-M12`：从 Telegram 打开后进入 `/world-cup`，并滚动定位到 `M12`。
- `v1-wl-M12-rAFF2026`：进入列表并捕获 referral。
- `v1-wd-M12`：进入 Sweden vs. Tunisia 详情页，使用默认 market。
- `v1-wd-M12-mlh-y`：进入详情页，选中 Sweden moneyline YES。
- `v1-wd-M12-mld-y`：进入详情页，选中 Draw YES。
- `v1-wd-M12-mla-y`：进入详情页，选中 Tunisia moneyline YES。
- `v1-wd-M12-to25-n`：进入详情页，选中 total 2.5 NO；如果该盘口不存在，前端 fallback 到默认 total。
- `v1-wd-M12-btts-y-rAFF2026`：进入详情页，选中 BTTS YES，并捕获 referral。
- `v1-wd-M12-btts-y-gHctKD5O-rAFF2026`：进入详情页，选中 BTTS YES，捕获 referral，并在 Telegram initData 校验通过后把 `tgChatId=-1001234567890` 写入 `tg_miniapp_context` cookie。
- 非法 referral，例如 `v1-wl-M12-rAFF-2026`：应被前端忽略，因为 referral 含 `-`。
- 非法群组参数，例如 `v1-wl-M12-g0`、`v1-wl-M12-gHct-KD5O`：应被前端忽略，服务端也不会从 `start_param` 解出 `tgChatId`。
- 超过 64 字符的 `start_param`：应被 Bot 侧拒绝，不发送给 Telegram。
