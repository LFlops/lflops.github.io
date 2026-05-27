---
title: AI 时代的工作流：从 Worktree 到 Hook，让 Claude Code 做你的副驾驶
date: 2026-05-27
description: 拆解一套用 Git Worktree 做隔离、Hook 做异步通知、CLAUDE.md 做项目记忆的 AI 开发工作流，让 Claude Code 从"你盯着它干活"变成"它干它的，你干你的"。
tags: [Claude Code, AI, 工作流, Git, 开发工具]
categories: [工程效率]
draft: false
---
# AI 时代的工作流：从 Worktree 到 Hook，让 Claude Code 做你的副驾驶

接手一个 6 年老项目、三个代码仓、风格各异的模块、没有可用的项目级规范——这不是什么极端场景，大部分工程师的日常就是这样的。

我试过在公司那 200 页 Go 规范里找答案。写得很全，但太全了——它回答的是"Go 代码应该长什么样"，而我真正需要的问题一个都没答："这个模块用 ORM 还是 raw SQL？""SDK 仓的入库逻辑要复刻调度层的写法吗？""事务管理到底走哪个模式？"

我也试过把规范文档的关键部分提炼出来塞进 CLAUDE.md。但 6 年的代码，你不知道哪些规则还在被人遵守，哪些早就只剩纸上条文。提炼错了不是在精简，是在投毒。

所以我换了个思路。不写宪法了，搭工作流。

## 1. Git Worktree：三个沙盒，互不污染

`git worktree` 让我从同一个仓库检出多个独立的工作目录，每个有自己的分支。我固定开了三个：

- **需求开发** — 从 master 切 feature 分支，在独立的 worktree 里写。有些长任务跑几个小时甚至过夜，我不盯着它。
- **修线上 bug** — 另一个 worktree，从 master 切 hotfix。代码干干净净，没有开发分支的半成品逻辑。
- **Oncall 排查** — 直接在 master 的 worktree 上让 AI 帮忙追日志、查调用链、定位瓶颈。不用切分支，不用藏代码。

三个 worktree 各过各的，互不打扰。这一点在后面并行跑 Agent 的时候会变得特别关键。

## 2. 并行 Agent + Hook：我在修 bug，AI 在跑需求

需求方案定好、Task 拆完之后，我把 Agent 丢到后台自己跑。但跑着跑着就会遇上阻塞——权限确认、依赖选型、测试挂了需要我判断方向。我总不能隔五分钟切回去看一眼。

所以我在 `settings.json` 里配了三组 Hook：

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "Bash",
        "hooks": [{
          "type": "command",
          "command": "<your-home>/.claude/hooks/check-authorization.sh"
        }]
      },
      {
        "matcher": "Write|Edit|NotebookEdit|WebFetch|WebSearch",
        "hooks": [{
          "type": "command",
          "command": "<your-home>/.claude/hooks/notify-permission.sh"
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "<your-home>/.claude/hooks/task-complete.sh"
        }]
      }
    ]
  }
}
```

三个 hook，各管一摊：

**check-authorization.sh** — Bash 命令的安全网。我维护了一份白名单（`git add`、`pytest`、`uv` 之类的日常命令），匹配上的直接放行，匹配不上的弹 macOS 桌面通知让我手动审批。每次被拦的命令记到 `/tmp/.claude/logs/denied-commands.log`，隔几天扫一眼，就知道哪些该加白名单。

**notify-permission.sh** — 覆盖 Write、Edit、WebFetch 这些非 Bash 工具的权限请求。不拦截，只通知。让我在干别的事的时候知道 AI 在动什么文件。

**task-complete.sh** — Agent 干完了叫一声。

这三个脚本加起来不到 100 行 shell，但整条链路通了。后台 Agent 不需要我盯着的时段自己跑，阻塞了再叫我；而我同时在另一个 worktree 上排查线上问题——需求代码没有合入，不会污染排查环境。

我以前是"盯着 AI 干活"。现在是"AI 干 AI 的，我干我的，它卡住了自己叫我"。

## 3. 规则不靠设计，靠碰撞

工作流通了之后，只剩一个问题：AI 不知道三个仓各自怎么写代码。

调度层有数据库，走 Beego ORM，查数据 `orm.doTx`。执行层没有持久化，轻量风格。SDK 仓最麻烦——它一半被调度层加载、一半被执行层加载，拿不到调度层的数据模型，入库只能手写 raw SQL；但同一个仓里调用调度层 gRPC 的地方，返回的又是结构体，可以直接用字段访问。

Agent 在 SDK 仓里经常搞混：刚写完 raw SQL 入库，下一行就开始 `db.Model(&User{})` ——编译报错。我改过来，说一句："记住，这个仓没有数据模型，持久化只走 raw SQL。"

另一个坑是事务管理。调度层残留了一些手动 `Begin()`/`Commit()`/`Rollback()` 的老写法，还没完全迁到 `orm.doTx`。Agent 看到两种风格并存，有时候就挑旧的模仿——同一个 PR 里一半用 `doTx`，一半手动管事务。我只能一个个改："记住，事务统一走 doTx。"

不到两周，每个仓的 CLAUDE.md 里攒了七八条规则。调度层的讲 ORM 和事务，执行层的讲轻量调用和超时处理，SDK 仓的讲怎么在两种上下文之间安全切换。

公司那 200 页 Go 规范不会告诉你这些，也不可能。它不知道这三个仓长什么样。

这条链路上有个设计我特别满意：规则跟着 worktree 走，不跟着人走。你在当前分支上积累的教训，不影响其他分支的 AI 行为。合入 master 的时候，再把验证过的规则提升到项目级，临时教训自然消亡，不会污染全局。

## 4. 总结

反复调 prompt 不如搭一套能自己纠偏的工作流。拆开来每一步都很简单：

- **Worktree 做隔离** — 并行不串味
- **Hook 做异步** — 它卡了叫我，不卡就自己跑
- **CLAUDE.md 做记忆** — 撞过的坑不再撞第二次

我对这套工作流理解是这样的：AI 不是替你干活，是你在忙别的事情的时候帮它把烂摊子收一下。它犯的错你纠正一次，工具帮你记住一辈子。

那 200 页规范有它的位置——教科书。但 CLAUDE.md 是案发现场。AI 更需要案发现场。

---

## 附录：Talk is cheap, show me the code

### authorized-commands.json

```json
{
  "patterns": [
    "git add",
    "git commit",
    "git push",
    "git pull",
    "ruff check",
    "ruff format",
    "pytest",
    "python",
    "uv"
  ]
}
```

### check-authorization.sh

```bash
#!/bin/bash
# PermissionRequest hook — Bash commands
# Whitelisted → auto-allow. Unknown → notify + log + let user decide.
set -e

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")
DESCRIPTION=$(echo "$INPUT" | jq -r '.tool_input.description // empty' 2>/dev/null || echo "")
PERM_MODE=$(echo "$INPUT" | jq -r '.permission_mode // empty' 2>/dev/null || echo "")

escape_applescript() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

if [ "$TOOL_NAME" != "Bash" ]; then
    echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}'
    exit 0
fi

if [ "$PERM_MODE" = "bypassPermissions" ] || [ "$PERM_MODE" = "dontAsk" ]; then
    echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}'
    exit 0
fi

if [ -z "$COMMAND" ]; then
    echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"deny","reason":"Could not parse command"}}}'
    exit 0
fi

AUTH_FILE="${HOME}/.claude/authorized-commands.json"
ALLOWED=false

if [ -f "$AUTH_FILE" ] && command -v jq &> /dev/null; then
    if jq -e --arg cmd "$COMMAND" \
       'reduce .patterns[] as $p (false; . or ($cmd | contains($p)))' \
       "$AUTH_FILE" > /dev/null 2>&1; then
        ALLOWED=true
    fi
fi

if [ "$ALLOWED" = false ] && [ -n "$AUTHORIZED_COMMANDS" ]; then
    IFS=',' read -ra ADDR <<< "$AUTHORIZED_COMMANDS"
    for pattern in "${ADDR[@]}"; do
        if [[ "$COMMAND" == *"$pattern"* ]]; then
            ALLOWED=true
            break
        fi
    done
fi

if [ "$ALLOWED" = true ]; then
    echo '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}'
else
    mkdir -p /tmp/.claude/logs 2>/dev/null
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $COMMAND" >> /tmp/.claude/logs/denied-commands.log

    if [ -n "$DESCRIPTION" ]; then
        NOTIFY_TEXT="$DESCRIPTION"
    else
        NOTIFY_TEXT=$(escape_applescript "$COMMAND")
    fi
    if command -v osascript &> /dev/null; then
        osascript -e "display notification \"$NOTIFY_TEXT\" with title \"⚠️ Claude Code\"" &
    elif command -v notify-send &> /dev/null; then
        notify-send "⚠️ Claude Code Needs Approval" "$COMMAND" &
    fi
    # No JSON output → Claude Code shows normal permission dialog
fi

exit 0
```

### notify-permission.sh

```bash
#!/bin/bash
# PermissionRequest hook — Write, Edit, WebFetch, etc.
# Notification only, no blocking. Claude Code's normal dialog still shows.
set -e

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null || echo "")
DESCRIPTION=$(echo "$INPUT" | jq -r '.tool_input.description // empty' 2>/dev/null || echo "")
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

escape_applescript() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

if [ -n "$DESCRIPTION" ]; then
    NOTIFY_TEXT="$DESCRIPTION"
elif [ -n "$FILE_PATH" ]; then
    NOTIFY_TEXT="[$TOOL_NAME] $FILE_PATH"
else
    NOTIFY_TEXT="$TOOL_NAME"
fi

NOTIFY_TEXT=$(escape_applescript "$NOTIFY_TEXT")

if command -v osascript &> /dev/null; then
    osascript -e "display notification \"$NOTIFY_TEXT\" with title \"⚠️ Claude Code\"" &
elif command -v notify-send &> /dev/null; then
    notify-send "⚠️ Claude Code Needs Approval" "$NOTIFY_TEXT" &
fi

# No JSON output → fall through to normal permission dialog
exit 0
```

### task-complete.sh

```bash
#!/bin/bash
# Stop hook — ping me when Claude Code finishes a task
set -e

INPUT=$(cat)
TASK_SUMMARY=$(echo "$INPUT" | grep -o '"message":"[^"]*"' | sed 's/"message":"//;s/"$//' || echo "")

if command -v osascript &> /dev/null; then
    if [ -n "$TASK_SUMMARY" ]; then
        osascript -e "display notification \"$TASK_SUMMARY\" with title \"Claude Code\""
    else
        osascript -e 'display notification "Task completed" with title "Claude Code"'
    fi
elif command -v notify-send &> /dev/null; then
    if [ -n "$TASK_SUMMARY" ]; then
        notify-send "Claude Code" "$TASK_SUMMARY"
    else
        notify-send "Claude Code" "Task completed"
    fi
fi

exit 0
```
