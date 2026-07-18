# 消费者接入契约

本文是人类和 AI coding agent 接入 `soloradish/ffmpeg-dist` 时必须遵守的规范流程。

## 1. 选择后锁定

默认选择 `core`；只有应用明确需要 HTTPS 输入或 extended 外部编码器时才选择 `extended`。

| 主机 | Target |
| --- | --- |
| Windows x64 | `windows-x86_64` |
| macOS `arm64` | `macos-aarch64` |
| macOS `x86_64` | `macos-x86_64` |
| Linux `x86_64` | `linux-x86_64-musl` |
| Linux `aarch64`/`arm64` | `linux-aarch64-musl` |

从精确 Release tag 读取 manifest，把所选记录复制到消费者仓库，而不是每次构建动态下载 manifest：

```json
{
  "repository": "soloradish/ffmpeg-dist",
  "releaseTag": "v8.1.2-r1",
  "ffmpegVersion": "8.1.2",
  "profile": "core",
  "target": "windows-x86_64",
  "assetName": "ffmpeg-8.1.2-r1-core-windows-x86_64.zip",
  "url": "https://github.com/soloradish/ffmpeg-dist/releases/download/v8.1.2-r1/ffmpeg-8.1.2-r1-core-windows-x86_64.zip",
  "sha256": "从 Release manifest 复制真实值"
}
```

消费者每个发布目标都需要一条 lock。上面的占位值禁止提交。

## 2. 准备应用资源

准备脚本必须：

1. 只下载 lock 中的 URL。
2. 解压前计算实际 SHA-256，不匹配立即失败。
3. 解压唯一的顶层包目录。
4. 使用固定路径读取 `bin/ffmpeg[.exe]` 和可选的 `bin/ffprobe[.exe]`，禁止递归查找第一个同名文件。
5. 验证 `BUILD-INFO.json` 中的版本、profile、target 和源码 hash。
6. 运行 `ffmpeg -version` 与 `ffmpeg -buildconf`，拒绝错误版本、GPL/nonfree 或 profile 不一致。
7. 把可执行文件和完整的 `LICENSES/` 一起复制进应用资源。

缓存 key 必须包含完整消费者 lock；命中缓存后仍然必须验证校验值和可执行文件。

## 3. 保留合规元数据

应用第三方声明必须注明 FFmpeg、profile 许可证、精确 `ffmpeg-dist` Release 和对应源码包链接，并说明 `ffmpeg-dist` 是非官方分发。应用下载页面应在下载链接附近提供对应源码链接。

禁止把这些二进制描述为 FFmpeg 官方 Release。

## 4. 验证消费者

CI 至少需要在应用发布的每个架构上验证：

- 资源中的程序可以启动并报告锁定版本；
- 应用真实使用的命令行可以处理测试媒体；
- 生产安装包包含可执行文件和许可证；
- 安装后的应用可以启动内置程序；
- 官方包不会静默回退到系统 FFmpeg。

Sylloop 应选择 core，执行单声道 16 kHz `s16le` 分析管道，并完成 Windows 与两种 macOS 安装包冒烟测试。

## 5. 通过独立 PR 升级

升级 PR 必须同时提交新 tag、每个资产记录、hash、声明和必要的准备逻辑。审查生产仓库的 lock 差异和 `BUILD-INFO.json` 后，运行完整原生打包矩阵。禁止把消费者 lock 指向同一 tag 下的替换资产；修正版必须使用新的 `rN`。

## Agent 完成清单

Agent 宣布接入完成前，必须能指出：

- 已提交且含真实 SHA-256 的各目标 lock；
- 解压前校验逻辑；
- 明确的 profile 与架构检查；
- 随包第三方许可证和精确源码链接；
- 每个支持目标的原生打包/冒烟测试证据。
