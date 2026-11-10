---
title: 同步系统里长出异步：一个令牌桶，两种等待
date: 2026-11-10
description: Trakt 先异步、Agent 补异步请求层、最后同步和异步共用同一个令牌桶：一个同步项目局部异步化时，哪些基础设计可以共用，哪些必须分开。
tags: [Python, 异步, 限流, 令牌桶, 架构演进]
categories: [后端]
draft: false
---

# 同步系统里长出异步：一个令牌桶，两种等待

> 一个项目里同时跑着 requests 时代的同步调用、Trakt 的异步定时任务、Agent 的 async loop。异步不是重写出来的，是一块一块长出来的。

---

2026 年 1 月 31 日，同一天，Bangumi-syncer 加了两个东西：定时任务，和 Trakt 的异步客户端。

那时候 Bangumi 的请求还是 `requests.Session`，数据库是 SQLite 单连接加一把 `threading.Lock`，整个项目按“一个请求占一个线程”跑。Trakt 是新增模块，没有历史包袱，调用方又是定时任务，天然适合 async。于是项目里第一次出现两种调用方式：Bangumi 同步，Trakt 异步。

这不是设计出来的双栈，是历史长出来的。

这篇要回答的问题也从这里开始：一个同步系统局部异步化时，哪些基础设计可以共用，哪些必须分开。

2026 年 8 月，Agent Loop 落地，整个循环用 async 写。它要并发执行工具，而 Bangumi 工具还是同步的，只能 `run_in_executor` 丢进线程池。能跑，但异步里混同步，并发的上限受限于线程池的大小。于是 10 月补了 Bangumi 的异步请求层。

异步 API 有了，下一个问题跟着来：调用 Bangumi 的，从来不只是 Agent。同步匹配、封面、账号验证、回放补发也都在打它。每个调用点单看量都不大，但整个进程里多个局部同时跑，加起来就是一份进程级的请求总量，早晚撞上 Bangumi 的 IP 限额。

社区在 [Bangumi-syncer #208](https://github.com/SanaeMio/Bangumi-syncer/issues/208) 里讨论过用 Archive 替代 `get_subject` / `get_episodes` 这些高频查询，降低 API 配额压力。那是“少打一次”的思路；限速器是“打的时候排队”的思路。两条腿都要有。

项目还在逐步支撑多用户。`sync_service` 里已经按 `user_name` 缓存 `BangumiApi` 实例，但 Bangumi 限的是 IP，不是账号，多用户只会让同一个 IP 的请求量更大。所以限速器不能每个实例一个桶，也不能只管异步路径——它必须是进程级的，同步和异步走同一个。

这次拆分的跟踪 issue [Bangumi-syncer #282](https://github.com/SanaeMio/Bangumi-syncer/issues/282) 里，请求层的目标写得很直接：进程级限速、429 / `Retry-After`、同步/异步统一重试。

这篇讲的就是这条线。

---

## 1. 同步时代：阻塞是默认值

早期 Bangumi-syncer 的形状很简单：

- FastAPI 同步路由，请求跑在线程池里；
- Bangumi 请求用 `requests.Session`；
- SQLite 单连接，所有读写过同一把 `threading.Lock`；
- 一个请求从头到尾占一个线程，阻塞是正常行为。

在这个模型里，`time.sleep` 不是问题。限速器要等一秒，就阻塞当前线程一秒；其他请求有自己的线程，不受影响。线程池大小就是并发上限，排队、超时、取消都交给线程模型。

后来的一次全量替换把 `requests` 换成了 `httpx`。背景在 [Bangumi-syncer #186](https://github.com/SanaeMio/Bangumi-syncer/issues/186) 里写得很清楚：requests 用于 Bangumi 和通知，httpx 异步用于 fongmi / Trakt，两个库并存，连测试 mock 都要准备两套。但这次替换只解决了“两个 HTTP 库并存”：换完仍然是 `httpx.Client`，仍然跑在线程里，同步模型原样保留。

这套模型不是技术债，它是当时系统的形状：请求量不大，调用方是同步的，SQLite 也是同步的。用 async 重写一遍，除了增加复杂度，没有收益。

异步化真正的起点，是新模块的调用方变成了事件循环。

---

## 2. 第一次异步裂缝：Trakt 定时任务

2026 年 1 月 31 日的两个改动很有意思：

- 定时任务，用 APScheduler 的 `AsyncIOScheduler`；
- Trakt 异步客户端，用 `httpx.AsyncClient`。

同一天，同一个需求：定时拉取 Trakt 的观看记录。

为什么 Trakt 可以先异步？三个条件凑齐了：

1. 新增模块，没有同步调用方，不需要兼容旧代码；
2. 调用方是定时任务，本来就跑在事件循环里；
3. 南向链路独立，不和 Bangumi 共享状态。

这时候项目里已经有两种调用方式，但还没有“共享”的问题。Trakt 是 Trakt，Bangumi 是 Bangumi，各走各的。异步化的第一步落在新增模块上：让它们不背老模型的包袱，老代码原地不动。

这个选择后来被证明是对的：从 1 月底上线到现在，Trakt 的请求层一直是异步的，没有回退，也没有把 Bangumi 的同步路径拖下水。

真正的麻烦，是 Agent Loop 要调用 Bangumi 的时候。

---

## 3. Agent Loop：异步是业务形态决定的

Agent 是 IO 密集型业务：LLM 流式响应、工具调用、等外部 API。用同步写，一个 run 占住一个线程，线程池很快被打满；用 async 写，等待期间事件循环可以跑别的任务。

所以 `run_loop` 从第一天就是 `async def`。它要处理的东西也天然是异步的：

- LLM 的流式响应是 `AsyncIterator`；
- 工具调用要并发；
- 用户取消要能立刻停下来。

工具执行的并发语义是分层的：连续幂等段（重复执行无害的工具）用 `asyncio.gather` 并行，外面套一个 `Semaphore` 限并发；非幂等写只串行。这套语义在 `app/services/agent/execution/tools.py` 里，Agent runtime 的拆分见 [Bangumi-syncer #285](https://github.com/SanaeMio/Bangumi-syncer/pull/285)。

问题出在同步 handler：

```python
if asyncio.iscoroutinefunction(handler):
    return await asyncio.wait_for(handler(args), timeout=timeout)
# 同步 handler：丢到线程池并以 wait_for 限定超时
loop = asyncio.get_event_loop()
return await asyncio.wait_for(
    loop.run_in_executor(None, handler, args), timeout=timeout
)
```

能跑，但有两个别扭的地方。

第一，**取消不了**。`asyncio.wait_for` 超时后，协程这边已经返回了，线程池里的同步 handler 还在跑。它可能正卡在 `time.sleep` 里等令牌，也可能正卡在 HTTP 请求里。协程的取消语义传不进去。

第二，**控制流被切成两半**。Agent 的并发、超时、取消都在 async 这一侧，工具的执行却在另一个线程里。排查问题时，日志、trace、异常栈都要跨线程看。

这不是性能问题，是控制流问题。线程池能让同步代码“跑起来”，不能让同步代码“变成异步代码”。

于是有了 Bangumi 的异步请求层。

---

## 4. 给 Agent 补一套异步 Bangumi API

[Bangumi-syncer #283](https://github.com/SanaeMio/Bangumi-syncer/pull/283) 加的是 `AsyncHttpLayer`，不是重写 `BangumiApi`。

这个选择很关键。重写意味着把配置、缓存、不可达标记、错误语义、限速器全部复制一遍；复制出来的两份代码，迟早分叉。加一层 mixin——把请求方法拆到独立小类里，由宿主类组合继承——则让同一个 `BangumiApi` 实例同时拥有同步和异步方法：

```python
class BangumiApi(
    AsyncHttpLayer,
    HttpLayerMixin,
    SearchMixin,
    EpisodesMixin,
    CollectionMixin,
    RelationMixin,
):
    ...
```

`HttpLayerMixin` 继续管同步请求，`AsyncHttpLayer` 管异步请求，两者共享实例状态：缓存、`mark_api_unreachable`、配置、限速器单例。

异步层第一版只做了三个只读方法：`search_async`、`get_subject_async`、`get_related_subjects_async`。

为什么只做只读？因为 Agent 的匹配场景只需要这三个能力。写操作留在同步路径，等有实际调用方再迁移。渐进式异步化的关键是“按调用方需要的能力异步化”，不是“按模块全部异步化”。

异步层还有一个具体约束：`httpx.AsyncClient` 的连接池绑定创建它的 event loop，测试会逐用例新建 loop，复用 client 就是跨 loop 用连接池。所以 `_request_async` 每次请求临时创建 client，`async with` 退出即关闭：

```python
client = create_bgm_async_client(...)
async with client:
    res = await client.request(method, url, **kwargs)
```

牺牲连接复用，换来“不绑定 loop、不欠关闭义务”。对 Agent 这种低频、只读的调用形态，划算。

---

## 5. 并发调用带出限速器

Agent 只是把问题放大了。

在它之前，同步链路已经在调 Bangumi：匹配、详情、关联、集数、封面、账号验证、回放补发。单看每个调用点，量都不大；合起来，就是一份进程级的请求总量。

同步时代，线程池天然限制了并发；异步时代，`asyncio.gather` 可以瞬间打出很多请求，多个局部再一叠加，更容易撞限额。Bangumi 官方 API 的限制按 IP 算——社区实测约 300 请求/分钟，超限封禁一小时——不按实例，也不按账号。所以限速器必须是进程级单例：不管多少个 `BangumiApi` 实例、多少个线程、多少个协程、多少个用户，都过同一个桶。默认参数也照着社区实践取保守值：1 req/s，burst 3。

限速器和异步请求层最后都收在 [Bangumi-syncer #283](https://github.com/SanaeMio/Bangumi-syncer/pull/283) 里。限速器先在同步路径落地，`acquire_async` 是后来补的；异步请求层落地时直接复用它。`acquire_async` 是在同步时代就为异步留的口子，等异步 API 落地时，限速器已经能用了。

为什么是令牌桶，不是信号量或固定间隔？

- **固定间隔**（每秒一个）没有突发容量，启动时第一个请求也要等，明明桶是满的；
- **信号量**控的是并发数，不是速率。10 个并发、每个 100ms，等于 100 req/s，照样超限；
- **令牌桶**同时表达“平均速率”和“突发容量”，还能预约未来的放行时刻。Agent 的工具调用是突发式的：一轮可能同时调三个工具，下一轮几十秒没有请求。令牌桶正好匹配这个形状。

Go 的 `golang.org/x/time/rate` 给了成熟的骨架：`Reserve` 在锁内一次性扣令牌，算出未来的放行时刻；`Wait` 是预约加等待；`Cancel` 把预约还回去。我们借的是这套预扣语义，API 形状没照搬。

---

## 6. 共用一个令牌桶：边界在哪

这是全文最核心的设计问题：同步和异步怎么共享同一个桶。

先划边界：

| 能共享 | 不能共享 |
|---|---|
| 令牌账本 `_tokens` | 等待方式：`time.sleep` / `asyncio.sleep` |
| 429 冻结状态 `_frozen_until` | 锁的持有范围 |
| 预约计算 `_reserve` / `_remaining_wait` | 取消语义 |
| 配置单例 `get_bgm_rate_limiter()` | 调用方的线程/协程模型 |

一句话：**共享“状态和计算”，不共享“阻塞和取消”。**

`acquire_async` 不是 `acquire` 的复制品。它复用同一套预约：

```python
reserved_act, reserved_debt = self._reserve(timeout)
...
while True:
    remaining, reserved_act, reason, extra_debt = self._remaining_wait(reserved_act)
    ...
    await asyncio.sleep(remaining)
```

只换了等待原语。`_reserve`、`_remaining_wait`、`_rollback` 一行没改。

为什么不用 `asyncio.Lock`？因为桶的状态要和同步线程共享。同步线程拿的是 `threading.Lock`，异步协程如果拿 `asyncio.Lock`，两把锁保护同一份状态，等于没保护。`threading.Lock` 是两种调用方式唯一的共同语言。

代价是锁的临界区必须短，绝不跨 `await` 持锁。`_reserve` 在锁内算完就返回，`asyncio.sleep` 在锁外，醒来后重新进锁复查。

这个约束不是理论上的。第一版同步限速器就是在锁内 `sleep`，429 通知进不来，后来修复才改成锁外等待。异步侧从第一天就守这条线，因为 `await` 期间持锁，卡住的是整个事件循环。

---

## 7. 取消：同步和异步真正的分水岭

共享状态之后，同步和异步差异最大的地方是取消。

同步侧的放弃点只有 `timeout`：

```python
if total_wait + remaining > timeout:
    self._rollback(reserved_debt)
    raise RateLimitTimeoutError(...)
```

线程被 `KeyboardInterrupt` 或硬杀时，预约不会回滚。这是缺口，我没有为它写测试，也不打算假装它被覆盖了。

异步侧的取消是正常控制流。Agent 的 run 会被用户取消，协程会收到 `CancelledError`。这时候预约已经扣了令牌，如果不回滚，桶会被永久透支：

```python
except asyncio.CancelledError:
    self._rollback(reserved_debt)
    logger.info(...)
    raise
```

`reserved_debt` 不是只有 1。它累计了三层：

1. `_reserve` 扣的 1 个令牌；
2. `_reserve` 因 429 冻结折算的债务；
3. 等待循环里 `_remaining_wait` 每次追加的冻结债务。

取消时把这些全部加回，令牌桶才不会永久透支。`_rollback` 还要夹紧到 `burst`：等待期间 `_refill` 可能已经把令牌补到桶容量，直接加会超发。

这里有一个和 Go 的差异。Go 的 `CancelAt` 会判断“我是不是最后一个预约”，如果后来者已经排在我后面，就不能简单把令牌加回去，否则后来者会提前。Python 这版只做单 token 的净额回滚，没有 later-reservation 计算。当前测试覆盖了“超时者不影响先到者”，没有覆盖“先到者回滚影响后到者”。这是缺口。

共享状态的好处是两边看到同一个桶；代价是异步侧必须理解同步侧的债务账本。`acquire_async` 的取消逻辑不是独立的，它建立在 `_reserve` 的预约语义上。

---

## 8. 异常与 mixin：共用规则，不共用实例

限速器还有一个容易忽略的设计：`RateLimitTimeoutError` 刻意不继承 `httpx.HTTPError`，也不在 `RETRY_EXCEPTIONS` 里。

原因很直接：如果它被通用重试层当成网络错误，重试会继续打已经被限流的端点，把冷却期变成重试风暴。限速超时该交给调用方决定降级、跳过还是提示用户，自动重试只会火上浇油。

429 和线程池的反馈回路，我写在[《线程池调优：当 abort 遇到 429》](https://blog.lflops.ovh/posts/threadpool-abort-429/)里；那篇讲现象，这篇讲实现。429 的处理统一在一处：

- 响应层：`notify_limiter_from_response(res)`，429 冻结，`< 400` 重置升级计数，5xx 不重置；
- 令牌桶：60 → 120 → 240 → … → 3600，`Retry-After` 作为 hint；
- 请求层：429 快速失败不重试，5xx 才退避重试。

5xx 不重置是有意的：中途一个 500 不能证明限流解除。如果 429 → 500 → 429 的链路把计数清零，第二次 429 又从 60 秒冻起，升级永远升不上去。

同步和异步共用同一个 `notify_limiter_from_response`，口径只有一份。

挂载点也在请求层，不在 client 里：

- `HttpLayerMixin._request_once`：每次触网前 `acquire()`，响应后通知；
- `_try_direct_connection`：直连回退也 `acquire()`；
- `_request_with_retry`：每次尝试都走 `_request_once`，所以重试也消耗令牌；
- `AsyncHttpLayer._request_async`：每次尝试 `await acquire_async()`。

这里有一条硬约束：`_http_client.py` 里的 `max_retries` 必须是 0。如果 client 内部还重试，重试会绕过 `_request_once`，不经过 `acquire`，也不经过 `notify`。后果是 429 冷却期继续触网、重试不消耗令牌，前面所有预约和回滚都白做。`_http_client.py` 的模块 docstring 把这条写成“禁止修改”，还有回归测试守着。

Mixin 的代价也要说清楚：它适合无状态的横切编排。桶状态在模块级单例，mixin 只负责“什么时候 acquire、什么时候 notify”。宿主类要提供 `ssl_verify`、`access_token`、`http_proxy`、`_proxy_failed` 这些属性，类级注解只是给类型检查器看的，真正的赋值在 `BangumiApi.__init__`。

---

## 9. 测试：两种等待，一套时钟

限速器的测试不能写 `time.sleep(1)` 然后断言“差不多等了 1 秒”。慢，还不稳定。我们用两个注入点：

```python
class FakeClock:
    def __call__(self): return self.t
    def advance(self, seconds): self.t += seconds

class FakeSleeper:
    def __call__(self, seconds):
        self.calls.append(seconds)
        self._clock.advance(seconds)
```

`RateLimiter(rate=1, burst=3, clock=clock, sleep=sleeper)`，测试里不真实等待，直接断言 `sleeper.calls`。

几个关键用例：

- `test_acquire_waits_without_holding_lock`：用 `threading.Event` 卡住 `sleep`，在等待期间启动另一个线程调 `notify_rate_limited`，断言 2 秒内能完成。如果 `sleep` 在锁内，这个测试会超时失败。
- `test_freeze_update_visible_during_wait`：首轮等 1 秒补令牌，等待期间注入 300 秒冻结；复查后继续等 299 秒，总等待 300 秒。
- `test_acquire_reservations_are_fifo_with_monotonic_wait`：连续预约的等待是 `1s, 2s, 3s`，间隔严格 `1/rate`。
- `test_acquire_timeout_raises_and_rolls_back_reservation`：`timeout=0.5` 时抛错，不产生真实等待；回滚后补满令牌可以立即获取。
- `test_rate_limit_timeout_error_is_not_retryable`：断言它不属于 `RETRY_EXCEPTIONS`，也不是 `httpx.HTTPError`。
- `test_acquire_async_cancel_rolls_back_reserved_token`：任务取消后，令牌不会残留约 -1 的透支。
- `test_acquire_async_cancel_clamps_tokens_to_burst_after_freeze`：`rate=100/burst=1` 下取消，回滚后 `0 <= tokens <= burst`，后续请求不超发。

这些测试要证明的只有一件事：两边共享的是同一个桶。`test_sync_and_async_share_same_bucket_state` 就是同步占一个令牌、异步立刻感知，反过来也一样。

---

## 10. 渐进式异步化的代价

回头看，这条路走了三步：

1. **新增模块先异步**：Trakt 是独立链路，没有历史包袱，直接 async。
2. **按调用方能力异步化**：Agent 只需要三个只读方法，就先做三个，不重写整个客户端。
3. **共享基础设计**：限速器、配置、缓存、错误语义复用，等待和取消分开。

每一步只切一个可以独立切开的边界，没动其他地方。

代价也很真实：

- 共享状态意味着同步侧的历史债务会被异步侧继承。`acquire_async` 必须理解 `_reserve` 的负令牌、冻结债务、回滚夹紧，不能只写一个 `asyncio.sleep`。
- 同步侧的硬中断回滚仍然是缺口。
- `_rollback` 没有 Go `CancelAt` 的 later-reservation 计算。
- 异步层只覆盖只读方法，写操作还在同步路径。

这些不写在结尾的“下一步”里，它们就是当前设计的边界。

异步化不是重写。是给同步系统加一条并行的等待路径，然后守住共享状态的边界。限速器只是第一个撞上这条边界的地方，不会是最后一个。
