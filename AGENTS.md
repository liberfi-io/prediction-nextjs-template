# AGENTS.md instructions

本文件是本仓库面向所有 AI 编码工具（Codex / Cursor / Claude 等）的唯一规则来源。
`CLAUDE.md` 与 `.cursor/rules/agents-md.mdc` 仅作引用，不重复维护内容。

## 计划输出

- 当用户要求生成计划或输出计划时，计划文件必须输出到项目根目录下的 `.plans` 目录。

## SDK 升级规则

- 当用户说“升级 sdk”或“更新 sdk”时，默认升级本仓库实际依赖的 `@liberfi.io/*` 相关包到最新版本。
- 本仓库**不依赖** `@chainstream-io/sdk`（仅 `@liberfi.io/client` 会引入它，而 prediction 不使用 client），升级时无需处理 chainstream。
- 升级前必须确认最新版本及版本对应关系；用户提到的 react-sdk 明确指 `@liberfi.io/*` 组织下相关 SDK / React / UI 包。
- 查询最新版本时必须考虑 npm registry / 镜像源的缓存与同步延迟问题；如果当前 npm 镜像无法确认最新版本，或不同来源返回版本不一致，必须切换到官方 npm registry（`https://registry.npmjs.org/`）或使用等效可靠来源复核，避免因镜像滞后误判“已是最新版本”。
- 本仓库为单包应用，只有根目录一个 `package.json`；必须检查其 `dependencies`、`devDependencies`、`peerDependencies` 三类字段，统一 bump 相关包版本，不得遗漏。
- 更新后必须刷新 `pnpm-lock.yaml`，并用 `rg` 或等效方式复查旧版本号、相关包名和锁文件，确认没有残留或漏改。
- 必须运行类型构建或完整 `pnpm build`；发现新版 SDK API 或类型破坏时，只做最小兼容适配，保持现有业务抽象和调用方 API 不变。
- 提交前必须检查 diff 范围，确保只包含依赖升级、lockfile 和必要兼容代码，不混入无关变更。

## 本地开发调试

- 修改完代码后，必须通过本地开发调试进行验证，不要直接进行 production build。
- 如果本地开发调试服务已经启动，必须直接利用现有服务验证，不要自行额外重启。
- production build 只在发布时进行。
- dev server 端口固定为 **3001**（`next dev -p 3001`），不要擅自改用其他端口。

## 本地 App 与 SDK 联调步骤

当用户提到“调试”、“联调”、“本地调试”、“本地测试”等与本地运行验证相关的需求时，默认遵循本节步骤处理。

本仓库是**单包 Next.js 应用**（非 monorepo），联调配置位于根目录 `build-config/`，`LOCAL_SDK_ROOT` 相对仓库根目录解析。

1. 确保 `react-sdk` 与当前仓库位于同级目录。
2. 在 `react-sdk` 中执行：
   ```bash
   pnpm install
   ```
3. 仅当涉及生成产物、dist-only subpath、SDK package exports 变化，或 dev server 报缺失产物时，才在 `react-sdk` 中执行：
   ```bash
   pnpm build
   ```
4. 在当前仓库根目录的 `.env.local` 中配置：
   ```env
   USE_LOCAL_SDK=true
   LOCAL_SDK_ROOT=../react-sdk
   ```
5. 在当前仓库中执行：
   ```bash
   pnpm install
   pnpm dev
   ```
   dev server 固定监听 `http://localhost:3001`。
6. 修改 `react-sdk/packages/*/src` 下的 TS/TSX/CSS 文件后，通过 dev server 热更新调试。
7. 修改 `.env.local`、SDK package exports、`package.json`、生成文件、Tailwind/CSS 入口、alias 相关配置或 provider/context 结构后，重启 dev server。
8. 如果涉及生成产物、dist-only subpath 或热更新异常，在 `react-sdk` 中额外执行：
   ```bash
   pnpm dev:watch
   ```
9. 如果启动 dev server 时出现端口 3001 被占用，不得直接改用新端口，也不得擅自 kill 占用端口的进程；必须先询问用户，是启动新端口，还是 kill 占用端口的进程来释放端口。
10. 通过 dev server 日志确认本地 SDK 模式生效，应能看到 `[local-sdk]`（webpack alias）与 `[local-sdk-postcss]`（CSS rewrite）相关输出。

### 联调机制说明

- 激活条件（三者必须同时满足）：`USE_LOCAL_SDK=true`、`NODE_ENV !== "production"`、`LOCAL_SDK_ROOT`（默认 `../react-sdk`）下存在 `packages/` 目录。
- `build-config/local-sdk-aliases.mjs`：扫描 `react-sdk/packages/*`，生成 webpack alias，根 import 指向 `src/index.{tsx,ts}`，subpath export 翻译为 src（src 缺失时回退 dist），并将 watch 收窄到 `packages/*/src/**`。
- `build-config/local-sdk-rewrite.cjs`：PostCSS 插件（必须 CJS），把 Tailwind 4 的 `@import` / `@source` 从 npm dist 改写到本地 src；必须用 `Once` 回调而非 `AtRule` visitor（Next.js 的 lazy wrapper 会让 visitor 静默失效）。
- `build-config/local-sdk-shared.mjs`：env gate、`resolveSdkRoot`、`scanSdkPackages` 等共享逻辑，供上述两者复用。

## 编码约定

- 包管理器固定使用 **pnpm 9.5.0**。
- 所有代码注释必须使用 **英文**；公共 API 函数与组件使用 JSDoc。
- 命名约定：组件 PascalCase（如 `PredictMatchesPage`）、Hook `useXxx`（如 `usePredictClient`）、页面/布局沿用 Next.js App Router 约定（`page.tsx` / `layout.tsx`）、服务端工具用描述性命名（如 `getServerPredictClient`）。
- 环境变量：客户端变量以 `NEXT_PUBLIC_` 前缀；服务端变量如 `PREDICT_URL`、`PRIVY_APP_SECRET` 等；可用变量参考 `.env.example`；严禁提交 `.env.local`。

## 项目架构概览

- 单包 Next.js 15（App Router）应用，`output: "standalone"`，作为薄壳，把大部分 UI 与数据逻辑委托给 `@liberfi.io/*` SDK 包。
- 技术栈：TypeScript 5.7、Jotai + TanStack React Query 5、HeroUI + Tailwind CSS 4 + Framer Motion、Privy（`@liberfi.io/wallet-connector-privy`）、viem + `@solana/web3.js`、i18next（`@liberfi.io/i18n` + 本地 `src/locales/`）。
- 目录：`src/app/`（页面与 API 路由）、`src/components/`（`AppLayout` 与页面级客户端组件）、`src/libs/`（浏览器 `queryClient`、服务端 `predictClient`、Privy 鉴权）、`src/i18n/`、`src/locales/`、`src/styles/`（`globals.css` Tailwind 入口、`theme.css` CSS 变量）。
- SSR 模式：列表/详情页统一使用「服务端 QueryClient prefetch → dehydrate → HydrationBoundary → 客户端同 key 查询」，并用 `Promise.race` 3s 超时避免阻塞首屏。
- SDK 集成：数据 hooks `@liberfi.io/react-predict`、服务端 prefetch `@liberfi.io/react-predict/server`、UI `@liberfi.io/ui-predict`、布局 `@liberfi.io/ui-scaffold`、类型 `@liberfi.io/types`。
- API 路由：浏览器经 `NEXT_PUBLIC_PREDICT_URL`（默认 `/predict-api`）→ Next.js rewrite → `PREDICT_URL`；服务端 `getServerPredictClient()` 直接用 `PREDICT_URL`。
- Singleton 保证：`next.config.mjs` 为 `jotai`、`@tanstack/react-query` 固定单实例解析，避免重复实例。
- 部署：GitHub Actions（`.github/workflows/deploy.yml`，push `main` 或 `workflow_dispatch`）→ Vercel CLI（`vercel pull` / `vercel build --prod` / `vercel deploy --prebuilt --prod`）。
