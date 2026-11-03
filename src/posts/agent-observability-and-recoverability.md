---
title: Agent 可观测性与可恢复：trace、replay 与断点续跑
date: 2026-11-03
description: 一次 run 被拆成 trace 和 replay 两种视角：trace 给人看，replay 给状态机和审计用。恢复时先重建上下文，再按断点位置决定结算、补幂等工具还是继续跑。
tags: [Agent, LLM, 可观测性, 断点续跑, 工程效率]
categories: [工程效率]
draft: false
---

# Agent 可观测性与可恢复：trace、replay 与断点续跑

> 恢复不是重试。恢复是一个数据模型问题。

---

BS 的 Agent 循环，不是“用户坐在 UI 前点一下，等它跑完”。

它有两个触发源：播放器在用户看完一集后把记录推给 BS；或者 BS 定时从 Trakt 等站点拉取。跑起来之后，用户不一定还在看。它可能跑在笔记本上，也可能跑在 NAS 上，部署方式由用户自己选，统一的入口是 Web UI。

这时候有两个选择：给用户一个重试按钮，或者让程序自己恢复。

手动重试也成立。但自运维工具有个老问题：每加一个交互，用户就多一份学习成本。MCP 那部分的取舍，我写在另一篇里：[《传统项目 Agent 化：通用 Agent 够强，缺的是 Agent 友好的接口和上下文》](https://blog.lflops.ovh/posts/agent-friendly-interface-and-context/)。这篇只讲 Agent loop 的恢复。

自动恢复的代价，不是多写几行重试代码。重试本身也是定时器触发的一次调度；真正难的是定时器触发的恢复，和手动任务之间的状态流转、并发与抢占。

我选自动，是因为这条循环本来就是定时任务驱动的：每隔一段时间查数据库，看哪些任务要跑。把中断任务的恢复也交给同一个调度器，不用再做一个按钮，也不用让用户盯着。

自动恢复做两件事：先把已经跑过的上下文重建出来，再把没执行的部分继续执行。

问题就落在数据模型上：每一步要记什么，恢复时怎么读，断点停在不同位置该怎么接。

---

## 1. 先看整体：run、iteration、span

一次 Agent 任务，在代码里叫一个 `run`。一个 run 里有多轮 `iteration`；每轮有一次 LLM 调用，零到多次工具执行，末尾还会塞一条提醒模型剩余轮次的预算消息（比如 `[剩余轮次：3]`）。

```text
run（一次 Agent 任务）
└─ iteration 0
   ├─ seed span
   ├─ llm_chat span
   │  ├─ tool_execute span
   │  └─ tool_execute span
   └─ budget span
```

放到 BS 的番剧匹配里，一次 run 大概长这样：第 0 轮塞入待匹配标题（`seed`），模型调 `search_bangumi` 搜候选（`tool_execute`），末尾注入剩余轮次提示（`budget`）；第 1 轮模型看详情后调 `submit_suggestion` 提交结果。

落到数据库里，是两张表：`agent_runs` 一行对应一个 run，`agent_steps` 多行对应这个 run 里的所有 span。`run_id` 串起整次会话，`span_id` 标识单个 span，`parent_id` 表示父子关系——工具 span 挂在同轮的 chat span 下，seed 和 budget 是同轮的独立行。

从恢复视角看，`agent_runs` 只处理四种状态：`pending`（待执行）、`processing`（执行中）、`succeeded`（成功结束）、`failed`（失败结束）。代码全集里还有第五个状态 `cancelled`，用于“候选已经被用户处理”的旁路，不在恢复扫描范围里，这篇不展开。

`stop_reason` 不是状态，而是软状态说明：`give_up`、`exhausted`、`end_turn`、`llm_error`、`persist_error`。它只回答“为什么结束”，不回答“还在不在跑”。状态机只管生命周期，业务结果靠 `stop_reason` 和候选表说明，这样“没有建议”就不会膨胀成一种新状态。

`agent_steps` 存的是每一步的记录。同一张表，有两种读法：

- **trace 视角**：读类型化列（状态、模型、tokens、耗时、工具名、轮次、顺序），给人看。
- **replay 视角**：读 `replay_delta` 列，按 `(iteration, sequence)` 重放，重建消息序列。

这篇只讲 trace 这一层，metrics 和日志不在这里展开。trace 用来回答：这次 run 跑到哪、每轮用了什么模型、花了多少 tokens 和时间、调了哪些工具、错在哪。UI 的 run 列表、run 详情、步骤详情，读的都是 `agent_steps`；步骤详情展示的 `display_json`，也是从 `replay_delta` 里解出来的摘要。同一条 span，人看摘要，状态机读完整消息。

这套模型参考了 OTel 的 trace/span，但它是自建的，不引 OTel SDK，也没有 OTLP 导出；ID 不是 OTel 的 128/64 位格式，也没有 resource、instrumentation scope、events、links。结构上能映射，协议上还不能直接对接。

---

## 2. 一轮一个 chat span

恢复的锚点是 chat span，不是 run。

每轮 LLM 调用都包在一个 `async with recorder.chat_span()` 里：进入轮次时先 INSERT 一条 `running` 行；流式返回只在这一个入口里聚合；正常退出时只做一次 finalize，把响应、模型、tokens 写回终态；流中途异常或取消时写 error span，不把半截流当成成功响应；就算落库自己失败，也只记 warning，不把主流程的异常盖掉。

不能攒到 run 结束再写，原因很简单：崩溃不会等你攒完。按轮落库，崩在第 2 轮，第 0、1 轮还在，replay 能从断点接着走；攒到 run 末，崩一次就全没了。

这里有一个容易踩的坑：**轮次编号不能由 loop 传进来。**

续跑时，recorder 的起点是 `executed_iterations`，而 loop 的 `range(max_iterations)` 还是从 0 开始。如果直接把 loop 下标传给 recorder，新一轮的 span 会和历史轮次撞号；replay 按 `iteration` 分组时只取组内第一条，后面的响应就静默丢了。所以轮次由 recorder 自己维护，loop 只管跑，不管编号。

工具 span 也是一样：执行前先记起点，执行完立刻独立事务落库。同一批工具里就算后面的挂了，前面跑完的那些也已经落盘，恢复时不会丢前序观测。

---

## 3. 恢复流程：scheduler → replay → continue_run

恢复不是用户点按钮触发的，是调度器每轮扫描捞起来的。

```text
scheduler tick
  -> 扫描超时 processing
  -> 过滤 _active_run_ids + check-and-set 抢执行权
  -> 刷新 started_at 租约
  -> continue_run(run_id)
       -> replay(run_id) 重建上下文
       -> 按断点位置决定：结算 / 补幂等工具 / 继续跑 loop
```

这里把恢复拆成了两个角色：

- **replay 是读模型**：把已经发生的事重建成消息序列，没有副作用。
- **continue_run 是状态机**：拿到重建结果后决定下一步怎么走，有副作用。

把它们拆开，是为了让“读”可以单独测试，让“决策”可以单独演进。一句话：**replay 回答“已经发生了什么”，continue_run 回答“接下来做什么”。**

调度器每轮做四件事：清理过期 run、标记残留 span、扫描 `processing` 超时的 run、消费 pending。

BS 是单进程部署，但单进程下同样会撞车：一个任务如果跑得慢（超过 120 秒还没结束），下一轮定时扫描就会看到它的 `started_at` 已经超时。如果不拦，同一个任务会被当成“死任务”再拉起一次。

真正拦住它的是模块级 `_active_run_ids` 集合：

- 扫描结果先过滤掉集合里的 run；
- `_recover_run` 再用 check-and-set 抢执行权，抢不到就跳过；
- 集合的 check-and-set 没有 `await`，在 CPython 事件循环里是原子的，不需要额外加锁。

`refresh_started_at` 不是接管机制。它只是把 `started_at` 租约推到当前，避免刚接手还没跑完就被下一轮扫描再次捞起；同时用 `WHERE status='processing'` 确认状态没变。

为了防止坏任务把 CPU 和 token 烧穿，重试有硬上限：单 run 最多 3 次；同一个业务键累计失败 10 次后，不再新建 run。

---

## 4. replay 重建什么

`replay(run_id)` 不是把日志读一遍，而是把消息序列重建到“可以接着调 LLM”的状态。

`replay_delta` 按行分成四种形态，每种行只存一类增量：

| 行（`name`） | `kind` | 重建出的内容 |
|---|---|---|
| `seed` | `seed` | 初始的 system + user 种子消息 |
| `llm_chat` | `response` | 一条 assistant 消息（优先用含 thinking 的完整 blocks，缺失时退回 `tool_calls`） |
| `tool_execute` | `tool_result` | 一条独立的 user 工具结果消息（逐条追加，不合并） |
| `budget` | `budget_message` | 同轮末尾的剩余轮次提示 |

每行带 `kind` 和 `delta_version`，读的时候按行取对应形态，不用在一个字段里猜；预算消息单独成行、排在同轮工具后面，按 `(iteration, sequence)` 顺序读出来就行。

重放完之后，`replay` 返回五样东西：

- `messages`：重建后的消息序列。
- `executed_iterations`：已经完整跑完的轮数。
- `missing_tool_calls`：最后一轮里，模型已经发出 `tool_use`、但还没落 `tool_result` 的工具调用。
- `last_response`：如果最后一轮停在终局或工具半路，保留这一轮的模型响应供下游判断；如果最后一轮已经完整跑完，则为 `None`。
- `total_tokens`：已发生轮次的累计用量，落终态时一起带上。

---

## 5. continue_run 怎么决策

拿到 `replay` 的结果后，`continue_run` 看的是**断点停在了哪**：

1. **停在最后一轮的模型响应上，且已经是终局**（调了提交工具、`end_turn`，或 `max_tokens` / `llm_error`）→ 直接走终局结算落库，不再调 LLM。
2. **停在工具执行半路**（最后一轮有 `tool_use`，但 `missing_tool_calls` 非空）→ 先补齐缺失工具，还有剩余轮次就接着跑 loop，没有就按 `exhausted` 收尾。
3. **停在两轮之间**（上一轮的响应和工具都记完整了，`last_response` 为 `None`）→ 还有剩余轮次就进入下一轮，没有就按 `exhausted` 收尾。

这里有一条顺序铁律：**先消费终局响应，再判预算耗尽。**

原因很简单：末轮可能已经产出了 `submit_suggestion`，但进程在落库前挂了。如果恢复时先看“剩余轮次为 0”就直接判 `exhausted`，那次已经完成的提交就会被白白吞掉。

### 缺失工具：只重跑幂等工具

工具 span 是分两步写的：执行前先 INSERT 一条 `running` 行，执行完再把 `tool_result` 更新进去。如果进程崩在中间，`replay` 只能看到一条没有 `tool_result` 的调用，但它分不清**崩溃发生在实际执行前，还是实际执行完、写回结果前**。

所以恢复补执行不能“凡是缺失就重跑”，只能按幂等性分类。

工具能力现在收敛成一个枚举 `ToolKind`：

- `READ`：只读查询，无副作用，可并行、可提前执行、恢复可重跑；
- `IDEMPOTENT_WRITE`：幂等写，有副作用但重复执行安全，可并行、可提前执行、恢复可重跑，执行前写审计日志；
- `WRITE`：非幂等写，有副作用且重复执行不安全，只串行，恢复只回填占位；
- `TERMINAL`：终止工具，捕获参数后结束循环，不执行 handler，永不可重跑。

`is_idempotent` / `is_terminal` / `needs_write_audit` 都从这一个枚举派生，调用方组合不出“terminal + idempotent”这种非法状态。

恢复补执行的判据也跟着变成 `idempotent`：

- `READ` 默认幂等，补执行；
- `IDEMPOTENT_WRITE` 显式承诺重复执行安全，也可以补执行；
- `WRITE` 和 `TERMINAL` 只回填占位，不重放副作用；
- 未注册工具同样只回填占位，避免 `tool_use` 悬空。

`IDEMPOTENT_WRITE` 不是免费标签。标了它，就要自己保证 CAS、防 ABA、重复执行不会多写一条记录。标错比不标更危险。

### 崩溃留下的 running span

进程如果在流中途被杀，`llm_chat` span 也会停在 `running`。同样分两种情况处理：

| 情况 | 处理 |
|---|---|
| 流中途被杀，run 仍是 `processing` | 续跑前重置同一 `run_id + iteration` 的 chat span，后续 `end_span` 闭合同一行 |
| run 已终态，span 还停在 `running` | 启动和调度每轮兜底扫描，把残留的 `running` 标成 `error` |

第一种避免 UI 出现“同一轮一条未闭合 + 一条重跑”；第二种只清理所属 run 已经终结的残留行，还在 `processing` 的合法中间态不碰。

至于续跑过程中的 LLM 调用失败，仍然按可重试性分流：确定性失败直接落 `failed(llm_error)`，可重试失败累计 attempts。

---

回头看，做可恢复 Agent 其实只守住了三条线：

- **恢复和正常执行走同一套记录协议**，不搞第二套简化路径；
- **span 的写入时机和编号由记录器自持**，不让循环逻辑污染分组键；
- **恢复只重跑幂等动作**，非幂等写和终止动作只闭合协议、不盲目重放。

trace 不是日志，replay 不是重试。

Agent 的恢复，最后拼的不是模型多聪明，而是数据模型有没有把“已经发生了什么”记清楚。

> 后记：缓存还没算进设计目标。replay 只保证按原顺序重建请求前缀；能不能命中，取决于供应商 TTL、Anthropic 只在 system 打 `cache_control`、恢复时用当前配置的 model/thinking。要把它当成本优化，先做请求指纹对比，再决定是否固定 run 快照和补 `cache_control`。
