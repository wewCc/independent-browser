# Independent Browser for Codex

在 Windows 上，让 Codex 桌面聊天操作一个看得见、可手动登录的独立 Chrome。输入 `$independent_browser` 后直接描述任务，例如打开网页、填写表单、读取 Notebook 状态或核对下载结果。

本项目把用户技能与 [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp) 连接起来。Codex 通过本地 STDIO 启动项目内的固定版本，Playwright 通过浏览器协议操作页面。浏览器使用专用用户数据目录，可以与日常 Chrome 同时使用。

## 安装

准备 Windows、支持本地 MCP 的 Codex 桌面客户端、Google Chrome、PowerShell 7，以及 PATH 中可用的 Node.js 24 或 22 LTS 和 npm。首次安装需要访问 npm 官方源。下载或克隆本仓库，解压到长期使用的可写目录，从仓库根目录打开 PowerShell 7。

```powershell
./scripts/install.ps1
./scripts/register_mcp.ps1
./scripts/install_skill.ps1
./scripts/doctor.ps1
```

安装脚本按锁文件准备本地依赖。注册脚本备份用户的 Codex 配置后写入服务项；技能脚本安装用户级技能。相同技能可以重复安装，遇到内容不同的同名技能会停止。安装后在 Codex 设置的 MCP servers 中查看 `independent_browser`，必要时重启客户端并新建本地聊天。

## 验证第一次桌面调用

> $independent_browser 打开 https://example.com/ ，在当前标签页读取页面标题、一级标题和最终链接。

页面应显示 **Example Domain**。能在桌面聊天里读到实际页面，才算桌面调用通过。`doctor.ps1` 单独检查本地注册、协议握手和工具列表。

## 登录与后台使用

首次登录时在专用窗口手动操作，完成后告诉 Codex 继续。每位使用者的 Cookie 和站点存储由自己的浏览器创建。同一个 Profile 同时只交给一个会话。需要尽量保持窗口最小化时，请指定「使用当前标签页」。启动浏览器、弹窗和打开新标签都可能改变窗口焦点，建议先用本地测试页验证自己的环境。

## 本地回归测试

```powershell
./scripts/run_tests.ps1 -Mode connection
./scripts/run_tests.ps1 -Mode basic
./scripts/run_tests.ps1 -Mode minimized-core
```

连接模式连续检查 20 次新进程握手。基础模式启动独立测试 Profile 和回环测试页，检查表单、滚动、异步刷新、截图、标签页、iframe、上传下载及跨重启存储。最小化专项需要你手动最小化测试窗口，完成后按提示恢复。结果写入本机的 `reports/`。后台运行、窗口最小化和真实站点任务应分别验收。

## 卸载与维护

关闭本项目的浏览器会话，在原安装目录运行 `./scripts/uninstall.ps1` 移除 MCP 注册。登录目录与备份会保留。用户技能可在 Codex 用户目录的 `skills/independent_browser/` 单独移除。移动安装目录前先取消注册，移动后重新安装和注册。依赖版本由 `package-lock.json` 固定，升级时请重跑连接、基础和最小化测试。

[使用与隐私说明](docs/usage.md) · [技能指令](skills/independent_browser/SKILL.md) · [浏览器配置](config/playwright.config.json) · [Codex MCP 接入说明](https://developers.openai.com/codex/mcp/)
