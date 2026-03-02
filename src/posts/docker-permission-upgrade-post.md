---
title: Docker 容器升级后数据目录权限踩坑全记录
date: 2026-03-02
description: 记录 Bangumi-sycner 的 DockerFile 采取 appuser 导致的 root 权限问题。
tags: [docker, nas]
categories: [python, Docker]
draft: false
---
# Docker 容器升级后数据目录权限踩坑全记录

> 本文记录了 Bangumi-syncer 项目从 root 用户切换到非 root 用户过程中，遇到的存量数据权限问题及解决方案。

## 一、问题背景

在 [#76](https://github.com/SanaeMio/Bangumi-syncer/pull/76) 中，为了遵循容器安全最佳实践——**最小权限原则（Principle of Least Privilege）**，我们将容器运行用户从默认的 `root` 切换为 `appuser`（UID 1000）。

然而，发版后我们收到了大量用户反馈：升级后的容器无法启动，日志中充斥着 `Permission Denied` 错误。

### 触发场景

```
用户状态：旧版本 Docker 容器（使用 root 运行）
操作路径：保留挂载卷中的数据 → 拉取新镜像 → 重启容器
预期结果：应用平滑升级，数据保留
实际结果：应用崩溃，报错 Permission Denied
```

## 二、根因分析

### 1. Linux 文件系统权限机制

Linux 的 DAC（自主访问控制）规定：进程只能修改属于自己或拥有写权限的文件。

| 角色 | UID | 文件 Owner | 能否写入？ |
|------|-----|------------|-----------|
| 旧容器 (root) | 0 | root (UID 0) | ✅ 可以 |
| 新容器 (appuser) | 1000 | root (UID 0) | ❌ 不可以 |

问题的本质：**UID 1000 的进程无权修改 UID 0 拥有的文件**。

### 2. Docker 挂载机制

当用户使用 `-v` 或 `docker-compose volumes` 挂载宿主机目录时：

- Docker **不会**自动递归修改宿主机文件的 Owner
- 文件属性（Owner、Permission）会被完整保留
- 这意味着：旧容器创建的 `root` 身份文件，会原封不动进入新容器

### 3. 测试缺口

我们在 CI 中主要测试了 **Greenfield Deployment（全新部署）**：

```
✅ 全新安装 → appuser 创建新文件 → Owner 是 appuser → 测试通过
❌ 升级安装 → root 创建旧文件 → Owner 是 root → 测试缺失
```

## 三、解决方案

经过调研，我们选择了 **方案 A：Entrypoint 修复**，在容器启动时自动检测并修复权限。

### 实现代码

项目中的 `entrypoint.sh`（第 44-51 行）：

```bash
# 确保挂载目录的所有权正确（以root身份运行，可以修改目录所有权）
echo "设置目录所有权..."
chown -R ${PUID}:${PGID} /app/config /app/logs /app/data /app/config_backups 2>/dev/null || true

# 切换到非root用户执行后续操作
echo "切换到用户 appuser (UID=${PUID}, GID=${PGID}) 执行应用..."
exec gosu appuser "$0" "$@"
```

### 完整流程

```
┌─────────────────────────────────────────────────────────────┐
│  1. 容器以 root 身份启动                                     │
│     ↓                                                       │
│  2. 检测当前用户是 root → 执行权限修复逻辑                   │
│     ↓                                                       │
│  3. chown -R 1000:1000 /app/config /app/logs ...          │
│     ↓                                                       │
│  4. 使用 gosu 降权切换为 appuser                            │
│     ↓                                                       │
│  5. 启动应用（此时所有数据目录已属于 appuser）               │
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

在修复版本发布前，受影响的用户可以在宿主机执行：

```bash
# 找到容器对应的宿主机目录
VOLUME_PATH=$(docker inspect <container_id> --format '{{range .Mounts}}{{.Source}}{{end}}')

# 递归修改所有权
sudo chown -R 1000:1000 $VOLUME_PATH
```

## 五、经验教训

### 1. 痛点

- 存量数据兼容性是一个容易被忽视的测试盲区
- "Security Patch" 往往被认为是"只改配置"的小改动

### 2. 改进措施

| 行动项 | 描述 |
|--------|------|
| ✅ 新增升级测试 | 在 CI 中模拟 "root 容器数据 + 重启" 场景 |
| ✅ 代码审查清单 | 涉及 `USER` 指令变更，必须 review 持久化兼容性 |
| ✅ Entrypoint 规范 | 容器非 Root 运行必须包含 `fix-permissions` 逻辑 |

### 3. 设计模式推广

```
┌────────────────────────────────────────────────────────────┐
│  Docker 安全运行标准模式                                    │
│                                                            │
│  Dockerfile: 创建 appuser，保留 root 启动能力              │
│  Entrypoint:  root 身份检查并修复权限 → gosu 降权启动       │
└────────────────────────────────────────────────────────────┘
```

## 六、总结

这次升级事故让我们深刻认识到：**安全加固和兼容性测试必须同步进行**。一个看似只涉及"改个配置"的优化，可能会因为测试覆盖不足而对生产环境造成严重影响。

所幸通过 Entrypoint 修复方案，我们实现了"零感知升级"——老用户无需任何手动操作，数据完整保留，应用自动以非 Root 身份运行。

---

*如果你正在或有计划将容器切换为非 Root 运行，建议在代码中直接集成权限修复逻辑，避免让用户踩坑。*
