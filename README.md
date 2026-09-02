# 目标台 · 个人目标管理工作台

一个本地优先（local-first）的个人目标管理工具：支持年 / 季 / 月 / 周 / 自定义周期的目标管理，无限层级拆解，甘特图可视化，打卡系统，以及基于本地规则 + 可粘贴提示词的 AI 复盘。数据默认存在本机浏览器，可一键导出 / 导入 JSON 迁移；接入 Supabase 后支持账号登录与多设备云端同步。

技术栈：React 19 + TypeScript + Vite + Tailwind v4 + Zustand + Supabase。

---

## 功能一览

| 能力 | 说明 |
| --- | --- |
| 周期目标 | 年 / 季 / 月 / 周 / 自定义周期；顶部可切换周期维度并前后翻页 |
| 无限层级 | 目标与任务统一为「节点」，通过 `parent_id` 任意嵌套；每支线可设计划起止时间 |
| 状态与超时 | 未开始 / 进行中 / 已完成 / 已放弃；到计划完成日未闭环自动标记为「已超时」（展示态计算，不污染原始状态） |
| 甘特图 | 自绘 SVG 甘特图，展示计划区间、进度、状态色与层级缩进；含**今日基准线**与**任务依赖连线**（紫色虚线，由前置完成点指向后继开始点） |
| 大纲视图 | 树形结构，**支持拖拽调整层级与顺序**（拖到行上半区=同级前插，下半区=成为其子级）；含展开 / 折叠、内联新增、改状态 |
| 看板视图 | 按状态分列，拖拽式改状态 |
| 打卡系统 | 一个任务可挂多个打卡项；支持周度 / 月度周期、设定周期内目标次数、补签、断签检测、连续天数 |
| Emoji 图标 | 目标 / 任务 / 打卡 / 分类均可各自设置 emoji |
| 分类体系 | 目标 / 任务 / 打卡可设置分类；分类支持父子层级，自动归属；「标签」页按分类聚合汇总 |
| AI 复盘 | 12 条规则诊断（超时 / 进度滞后 / 时间倒挂 / 层级过深 / 断签 / 分类失衡等）；一键生成可粘贴提示词，配置 LLM 后还可**一键出报告**直连大模型生成深度复盘 |
| 导入导出 | 全部数据导出为 JSON；支持「合并」或「覆盖」导入，便于换设备迁移 |
| 云端同步 | 接入 Supabase 后账号登录 + 多设备自动同步（行级安全隔离） |
| PWA | 可安装到桌面 / 手机主屏，断网也能打开 |

---

## 快速开始

```bash
# 1. 安装依赖（需 Node 18+）
npm install

# 2. 启动开发服务器
npm run dev
# 打开 http://localhost:5173

# 3. 生产构建
npm run build
npm run preview
```

默认数据为空，进入后点右上角「+ 新建」即可创建第一个目标。已预置「工作 / 健康 / 学习」三个分类。

---

## 部署（GitHub Pages）

已配置好子路径部署，线上地址：**https://mnm43.github.io/MNM-goal-tracker/**

后续改动后一键重新发布：

```bash
# 1. 在仓库根目录，设置带 repo 权限的 GitHub 令牌（仅本次 shell 使用，不会写入文件）
export GH_TOKEN=ghp_xxx

# 2. 一键构建并推送到 gh-pages 分支（GitHub Pages 会自动重新发布）
npm run deploy
```

脚本逻辑（`deploy.sh`）：`npm run build` → 把 `dist/` 发布到独立的 `gh-pages` 分支 → 强制推送 → GitHub Pages 自动生效。
仓库名 / 用户名可改：`REPO=你的仓库 GH_USER=你的用户名 npm run deploy`。

> 注：GitHub Pages 项目页地址在 `/仓库名/` 子路径下，因此 `vite.config.ts` 的 `base` 已设为 `/MNM-goal-tracker/`，`sw.js`、`manifest.webmanifest`、`index.html` 的资源路径也相应改为相对/子路径，切勿改回根路径否则子路径下资源全 404。

---

## 数据模型

所有数据存于浏览器 `localStorage`（key：`goal-tracker-v1`），由 Zustand `persist` 管理。

- **nodes**：目标与任务统一表，`parent_id` 自引用实现无限层级；`node_type` 区分 goal / task；`depends_on` 为前置依赖数组（用于甘特图依赖连线）。
- **categories**：分类，支持父子层级，节点通过 `category_id` 归属，缺失时沿父链继承。
- **checkins**：挂在某个节点上的打卡项，`period_type` 周 / 月，`target_count` 为周期内目标次数。
- **checkin_logs**：打卡明细，`checkin_id + record_date` 唯一，`is_makeup` 标识补签。

删除均为软删除（`deleted_at`），可在「设置 → 回收站」恢复。

---

## 接入云端同步（Supabase）

云同步为可选能力，用于多设备登录与自动备份。需要你自行创建一个免费 Supabase 项目。

### 1. 建表

登录 [supabase.com](https://supabase.com) → 新建项目 → 打开 **SQL Editor** → 复制本仓库 `supabase/schema.sql` 的全部内容执行。脚本会创建 `profiles / nodes / categories / checkins / checkin_logs` 五张表，开启行级安全（RLS），并配置「仅本人可见」策略，以及新用户自动建 profile 的触发器。

### 2. 开启邮箱登录

**Authentication → Providers** 中开启 **Email**（魔法链接 / OTP，无需密码）。

### 3. 在应用内连接

打开应用 → 右上角头像 / 设置 → **云同步** 标签：

1. 填入 Project URL 与 anon key（在 **Project Settings → API** 获取）。
2. 输入邮箱，点击「发送登录链接」，去邮箱点击链接完成登录（会跳回本页自动登录）。
3. 登录后即可「立即同步」，或开启「自动同步」（本地变更 1.5 秒后自动上传）。

同步策略：上传按 `id` upsert（软删除一并同步）；拉取按 `updated_at` 做 last-write-wins 合并，多设备并发编辑时以较新的一方为准。

> 配置、登录态保存在本机 `localStorage`，不上传到任何第三方。

---

## AI 一键出报告（LLM 直连）

在「统计」页点「一键出报告」，即可把本机规则诊断结果 + 完整数据快照交给大模型，生成结构化深度复盘（合理性 / 可行性 / 调整建议 / 执行建议）。

配置只需一次，在「设置 → AI 复盘」标签：

1. 选择服务商（DeepSeek / Kimi / 通义 / OpenAI / 自定义），自动填入对应接口地址与模型。
2. 填入 API Key（仅保存在本机 `localStorage`，不离开你的浏览器）。
3. 点「保存配置」。

实现说明：

- 调用 OpenAI 兼容的 `/chat/completions` 接口，使用浏览器原生 `fetch`，支持流式输出（打字机效果）。
- 预置模型：`deepseek-chat`、`moonshot-v1-8k`、`qwen-plus`、`gpt-4o-mini`；选「自定义」可填任意兼容端点（含自建代理）。
- 报告渲染使用自研极简 Markdown 渲染器（纯 React 节点，不依赖 `dangerouslySetInnerHTML`），天然规避 LLM 输出中的 XSS 风险。

> 浏览器直连大模型接口可能受跨域（CORS）限制。若调用报错，请使用支持 CORS 的接口，或自备代理转发。

---

## 目录结构

```
goal-tracker/
├─ index.html
├─ public/
│  ├─ manifest.webmanifest        # PWA 清单
│  └─ sw.js                       # Service Worker（离线壳）
├─ supabase/
│  └─ schema.sql                  # 云端表结构 + RLS
└─ src/
   ├─ App.tsx                     # 主布局 + 视图路由
   ├─ types.ts                    # 数据模型类型
   ├─ store/
   │  ├─ useStore.ts              # 数据层（CRUD / 导入导出 / 合并）
   │  └─ useUI.ts                 # 界面状态（视图 / 周期 / 展开）
   ├─ lib/
   │  ├─ cycle.ts                 # 周期计算（年/季/月/周）
   │  ├─ progress.ts              # 进度与状态计算
   │  ├─ checkin.ts               # 打卡进度 / 连续天数
   │  ├─ review.ts                # AI 复盘规则引擎 + 提示词生成
   │  ├─ llm.ts                   # LLM 客户端（OpenAI 兼容，流式）
   │  ├─ markdown.tsx             # 报告 Markdown 渲染（纯 React，无 innerHTML）
   │  ├─ derive.ts                # 派生数据（过滤 / 概览 / 分类）
   │  ├─ tree.ts                  # 树构建 / 剪枝 / 分类继承
   │  ├─ pastel.ts                # 配色
   │  └─ sync.ts                  # Supabase 同步客户端
   ├─ components/                 # UI 组件（编辑器 / 抽屉 / 设置 / 图标）
   └─ views/                      # 甘特 / 大纲 / 看板 / 打卡 / 标签 / 统计
```

---

## 设计说明

- 配色参照 MarkTimes / 滴答清单：白底、近黑文字、蓝紫主色 `#5C5CE0`，节点用 10 色低饱和柔彩区分。
- 进度来源三种：手动填写 / 按子项算术平均 / 按打卡完成度；可在节点编辑器中指定。
- 「超时」为展示态（计划完成日 < 今天且未完成），不写入原始状态，避免破坏真实进度。

---

## 后续可扩展

- 团队 / 共享目标：在 Supabase 增加共享表与协作者策略。
- 日历视图：基于 `planned_start/end` 叠加日历。
- 甘特图交互增强：依赖连线可拖拽直接创建、关键路径高亮。
- 大纲拖拽增强：拖到空白区快速置顶、跨视图拖拽。
