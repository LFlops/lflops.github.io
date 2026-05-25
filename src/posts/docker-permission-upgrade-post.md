---
title: Docker 容器升级后数据目录权限踩坑全记录
date: 2026-03-02
description: 记录 Bangumi-syncer 的 DockerFile 采取 appuser 导致的 root 权限问题。
tags: [docker, nas]
categories: [Docker]
draft: false
---
# Docker 容器升级后数据目录权限踩坑全记录

> 本文记录了 Bangumi-syncer 项目从 root 用户切换到非 root 用户过程中，遇到的存量数据权限问题及解决方案。

## 一、问题背景

在 [#76](https://github.com/SanaeMio/Bangumi-syncer/pull/76) 中，为了遵循容器安全最佳实践——**最小权限原则（Principle of Least Privilege）**，我们将容器运行用户从默认的 `root` 切换为 `appuser`（UID 1000）。然而，发版后收到了用户反馈：升级后的容器无法启动。

### 问题一：存量数据权限问题

保留宿主机挂载卷中的数据、然后拉取新镜像并重启容器，这本应是平滑升级的标准操作。然而，新容器启动后却直接崩溃，报错提示 `groupmod: GID '100' already exists`。

### 问题二：PGID=100 的隐藏陷阱

上述错误背后的真正原因是：**GID 100 在大多数 Linux 发行版中是系统默认的 `users` 组**，已经被宿主机系统占用。当用户在 docker-compose 中配置 `PUID=1000, PGID=100` 时，entrypoint.sh 尝试创建 GID 100 的组却发现该 ID 已被系统占用，导致操作失败。

```
用户配置：PUID=1000, PGID=100
预期行为：创建 GID 100 的组并加入 appuser
实际行为：groupmod: GID '100' already exists
```

这就是为什么这个问题如此普遍——几乎每个使用默认 PUID/PGID 配置的宿主机用户都会遇到。

## 二、根因分析

要理解这个问题，需要从三个层面来分析。

### 1. Linux 文件系统权限机制

Linux 的 DAC（自主访问控制）规定：进程只能修改属于自己或拥有写权限的文件。

| 角色 | UID | 文件 Owner | 能否写入？ |
|------|-----|------------|-----------|
| 旧容器 (root) | 0 | root (UID 0) | ✅ 可以 |
| 新容器 (appuser) | 1000 | root (UID 0) | ❌ 不可以 |

也就是说，**UID 1000 的进程无权修改 UID 0 拥有的文件**。这就是存量数据权限问题的本质。

### 2. Docker 挂载机制

当用户使用 `-v` 或 `docker-compose volumes` 挂载宿主机目录时：

- Docker **不会**自动递归修改宿主机文件的 Owner
- 文件属性（Owner、Permission）会被完整保留
- 这意味着：旧容器以 `root` 身份创建的文件，会原封不动进入新容器

因此，升级后新容器中的 appuser 无法写入原本属于 root 的数据目录。

### 3. GID 100 冲突详解

这是本文的核心问题。当用户在 docker-compose 中配置 `PGID=100` 时：

- **预期**：创建 GID 100 的组 `appuser`，将用户加入该组
- **现实**：GID 100 已经被系统 `users` 组占用
- **结果**：`groupmod -g 100 appuser` 试图修改组 ID，但系统不允许

```bash
# 正常情况（PGID=1000，不冲突）
$ groupmod -g 1000 appuser  # ✅ 成功，创建新组

# 冲突情况（PGID=100，被系统占用）
$ groupmod -g 100 appuser
groupmod: GID '100' already exists  # ❌ 失败
```

### 4. 测试缺口

我们在 CI 中主要测试了 **Greenfield Deployment（全新部署）**，而忽略了升级场景：

```
✅ 全新安装 → appuser 创建新文件 → Owner 是 appuser → 测试通过
❌ 升级安装 → root 创建旧文件 → Owner 是 root → 测试缺失
❌ PGID=100 场景 → 系统组冲突 → 测试缺失
```

## 三、解决方案

针对上述问题，我们需要在 entrypoint.sh 中实现智能检测，区分两种不同情况并分别处理：

| 情况 | 判定条件 | 处理方式 |
|------|----------|----------|
| **A: GID 被占用** | `getent group 100` 返回结果 | 将用户附加到现有组 |
| **B: GID 可用** | `getent group 100` 无结果 | 安全修改组 ID |

### 完整修复代码

```bash
#!/bin/bash
set -e

PUID=${PUID:-1000}
PGID=${PGID:-100}

echo "==> 配置信息: PUID=${PUID}, PGID=${PGID}"

# ========== 核心修复：处理 GID 冲突 ==========
if [ "$(id -u)" = "0" ]; then
    echo "==> 检测到 root 身份执行"

    # 创建用户（如果不存在）
    if ! id -u appuser &>/dev/null; then
        echo "==> 创建用户 appuser (UID=${PUID})"
        useradd -m -s /bin/bash -U appuser
    fi

    # 处理 GID 冲突问题
    EXISTING_GROUP=$(getent group ${PGID} | cut -d: -f1)
    CURRENT_GID=$(id -g appuser)

    if [ -n "$EXISTING_GROUP" ] && [ "$CURRENT_GID" != "$PGID" ]; then
        # 情况 A: GID 已被系统组占用
        echo "==> GID ${PGID} 已被系统组 '${EXISTING_GROUP}' 占用"
        echo "==> 将 appuser 附加到现有组 ${EXISTING_GROUP}"

        # 修改用户的主要组为现有组
        usermod -g ${EXISTING_GROUP} appuser

        # 额外：将用户也附加到原来的组（保持兼容性）
        # 注意：需要确保 appuser 组存在
        if ! getent group appuser &>/dev/null; then
            groupadd appuser
        fi
        usermod -aG appuser appuser 2>/dev/null || true
    elif [ "$CURRENT_GID" != "$PGID" ]; then
        # 情况 B: GID 未被占用，可以安全修改
        echo "==> GID ${PGID} 可用，修改 appuser 组 ID"

        # 如果 appuser 组存在，先删除（否则 groupmod 会失败）
        if getent group appuser &>/dev/null; then
            groupmod -g ${PGID} appuser
        else
            groupadd -g ${PGID} appuser
        fi

        # 将用户加入新组
        usermod -g ${PGID} appuser
    else
        echo "==> GID 无需修改，当前正确"
    fi

    echo "==> 最终用户信息: $(id appuser)"

    # ========== 修复数据目录权限 ==========
    echo "==> 设置目录所有权..."
    chown -R ${PUID}:${PGID} /app/config /app/logs /app/data /app/config_backups 2>/dev/null || true
fi

# ========== 切换到非 root 用户启动 ==========
echo "==> 切换到用户 appuser (UID=${PUID}, GID=${PGID}) 执行应用..."
exec gosu appuser "$0" "$@"
```

### 代码逻辑解读

```
┌─────────────────────────────────────────────────────────────┐
│  1. 容器以 root 身份启动                                     │
│     ↓                                                       │
│  2. 获取目标 PGID（如 100）                                 │
│     ↓                                                       │
│  3. getent group 100 检查是否被占用？                        │
│     ↓                                                       │
│  ├── YES (被 'users' 占用) ──→ 情况 A                      │
│  │   → usermod -g users appuser (加入现有组)               │
│  │   → usermod -aG appuser appuser (保持 appuser 组)       │
│  │                                                       │
│  └── NO (未被占用) ──────────→ 情况 B                      │
│      → groupmod -g 100 appuser (安全修改组 ID)              │
│     ↓                                                       │
│  4. chown -R 修复数据目录                                   │
│     ↓                                                       │
│  5. gosu 降权启动应用                                       │
└─────────────────────────────────────────────────────────────┘
```

### 为什么选择 gosu？

相比 `su` 和 `sudo`，`gosu` 的优势：

- 只做用户切换，不启动 shell
- 更轻量，攻击面更小
- Docker 社区标准工具

```dockerfile
# Dockerfile 中安装 gosu
RUN apt-get update && apt-get install -y --no-install-recommends gosu
```

## 四、用户侧临时解决方案

在官方修复版本发布前，受影响的用户可以采用以下临时方案绕过问题：

```bash
# 找到容器对应的宿主机目录
VOLUME_PATH=$(docker inspect <container_id> --format '{{range .Mounts}}{{.Source}}{{end}}')

# 递归修改所有权
sudo chown -R 1000:1000 $VOLUME_PATH
```

### 另一个临时方案：避开 GID 100

如果用户不想等待修复，可以在 docker-compose.yml 中使用其他 PGID：

```yaml
environment:
  - PUID=1000
  - PGID=1000  # 使用 1000 而不是 100，避免冲突
```

## 五、经验教训

这次事故让我们总结了以下关键教训：

### 1. 主要痛点

- 存量数据兼容性是一个容易被忽视的测试盲区
- "Security Patch" 往往被认为是"只改配置"的小改动，从而低估了其影响范围
- **GID 100 是隐藏的坑**：作为大多数 Linux 系统的默认组，它非常容易与宿主机用户冲突

### 2. 改进措施

| 行动项 | 描述 |
|--------|------|
| ✅ 新增升级测试 | 在 CI 中模拟 "root 容器数据 + 重启" 场景 |
| ✅ GID 冲突检测 | 在 entrypoint 中添加 `getent group` 检测 |
| ✅ 代码审查清单 | 涉及 `USER` 指令变更，必须 review 持久化兼容性 |
| ✅ Entrypoint 规范 | 容器非 Root 运行必须包含 `fix-permissions` 逻辑 |

### 3. 设计模式推广

```
┌────────────────────────────────────────────────────────────┐
│  Docker 安全运行标准模式                                    │
│                                                            │
│  1. Dockerfile: 创建 appuser，保留 root 启动能力           │
│  2. Entrypoint: root 身份检查并修复权限                    │
│     ├── 检测 GID 是否被占用                                │
│     ├── 情况 A: 加入现有组                                 │
│     └── 情况 B: 安全修改组 ID                              │
│  3. gosu 降权启动                                          │
└────────────────────────────────────────────────────────────┘
```

## 六、总结

回顾这次升级事故，我们深刻认识到：

1. **安全加固和兼容性测试必须同步进行**——不能因为是"小改动"就忽视其潜在影响
2. **GID 100 是最常见的冲突点**——作为系统 `users` 组，几乎必然与宿主机用户冲突
3. 智能检测 + 差异化处理是应对此类问题的最佳方案

通过 Entrypoint 修复方案，我们实现了"零感知升级"——老用户无需任何手动操作，数据完整保留，应用自动以非 Root 身份运行。

---

*如果你正在或有计划将容器切换为非 Root 运行，建议在代码中直接集成权限修复逻辑，并处理好 GID 冲突问题，避免让用户踩坑。*
