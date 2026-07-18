[English](README.md)

# ffmpeg-dist

> [!IMPORTANT]
> **这是独立维护的非官方 FFmpeg 构建与分发。** 本项目不隶属于、不代表、未获 FFmpeg 项目背书，也不由 FFmpeg 项目提供支持。FFmpeg 官方项目、文档、源码和下载入口始终位于 [ffmpeg.org](https://ffmpeg.org/)。

`ffmpeg-dist` 为需要内置 FFmpeg 的桌面应用提供版本锁定、带校验值的 `ffmpeg` 与 `ffprobe` 命令行程序，避免每个消费者仓库都重复编译。第一个消费者是 [soloradish/sylloop](https://github.com/soloradish/sylloop)。

## 发布矩阵

每个 Release 为五个目标同时提供两种 profile：

| Target | 架构 | 格式 |
| --- | --- | --- |
| `windows-x86_64` | Windows x64 | ZIP |
| `macos-aarch64` | Apple Silicon | TAR.XZ |
| `macos-x86_64` | Intel macOS | TAR.XZ |
| `linux-x86_64-musl` | Linux x64、静态 musl | TAR.XZ |
| `linux-aarch64-musl` | Linux arm64、静态 musl | TAR.XZ |

- **core** 是本地媒体应用的默认选择。它保留 FFmpeg 内置格式、编解码器和滤镜，关闭网络、设备、GPL、nonfree、version3 和外部自动探测，以 `LGPL-2.1-or-later` 分发。
- **extended** 通过 Mbed TLS 增加 HTTPS，并加入锁定的 LAME、Ogg、Vorbis、Opus 和 libvpx；它仍关闭 GPL/nonfree，以 `LGPL-3.0-or-later` 分发。

包中只包含命令行程序和合规材料：

```text
ffmpeg-VERSION-rREVISION-PROFILE-TARGET/
├── bin/ffmpeg[.exe]
├── bin/ffprobe[.exe]
├── LICENSES/
└── BUILD-INFO.json
```

开发头文件和 FFmpeg 链接库不在本项目范围内。

## 安全接入 Release

1. 从 `ffmpeg-dist-manifest-v1.json` 选择精确 tag、profile 和 target。
2. 把 tag、资产名和 SHA-256 写入消费者仓库的 lock 文件并提交。
3. 下载精确的 `/releases/download/TAG/ASSET` URL；构建过程中禁止解析 `latest`。
4. 解压前验证 SHA-256。
5. 验证 `ffmpeg -version`、目标架构、profile 构建参数和许可证。
6. 将可执行文件与相应 `LICENSES/` 一起打包，并保留本 Release 和对应源码包的链接。

完整的确定性流程与 lock 示例见[消费者接入指南](docs/INTEGRATION.zh-CN.md)。

### 给 AI coding agent

Agent 将本发行包接入其他仓库前，必须先阅读 [docs/INTEGRATION.zh-CN.md](docs/INTEGRATION.zh-CN.md)。Release manifest 只是发现元数据，不是动态依赖解析器。Agent 必须在消费者仓库提交精确资产信息，保留校验与许可声明，并在每次升级后验证消费者的原生安装包。

禁止：

- 在 CI 中下载 `releases/latest`；
- 信任没有提交 SHA-256 的资产；
- 静默地从 core 切换到 extended；
- 遗漏随包许可证或对应源码链接；
- 替换已发布资产或移动已发布 tag。

维护本仓库的 Agent 还必须遵守 [AGENTS.md](AGENTS.md)。

## 验证下载

每个 Release 发布 `SHA256SUMS.txt`、`ffmpeg-dist-manifest-v1.json`、精确对应的源码包和 GitHub artifact attestation。

```bash
sha256sum --check SHA256SUMS.txt
gh attestation verify ffmpeg-8.1.2-r1-core-linux-x86_64-musl.tar.xz \
  --repo soloradish/ffmpeg-dist
```

校验和用于证明文件完整性；attestation 用于证明资产与本仓库工作流的关系。两者都不表示 FFmpeg 或输入媒体不存在安全问题。

## 构建与发布策略

源码和依赖锁文件是 [`build-lock.json`](build-lock.json) 与 [`deps-lock.json`](deps-lock.json)。Pull request 必须运行全部元数据测试和原生构建。只有 `main` 上符合 `v{ffmpegVersion}-r{revision}` 的 annotated tag 才能创建 Release。

- 升级 FFmpeg 后从 `r1` 开始，例如 `v8.1.3-r1`。
- FFmpeg 源码不变但调整构建、依赖或打包时递增 revision，例如 `v8.1.2-r2`。
- 已发布 Release 和 tag 永不修改；修正版使用新的 revision。

准确工作流与本地命令见[构建指南](docs/BUILDING.md)。

## 支持与安全边界

本仓库负责其构建脚本、manifest 契约、校验值和可复现元数据。FFmpeg 行为及上游安全问题由 [FFmpeg 项目](https://ffmpeg.org/security.html)负责。依赖升级必须通过修改 lock 的 PR，并重新运行完整原生矩阵。

二进制不进行代码签名，请在使用前验证校验和与 attestation。

## 许可证

本仓库的自动化与文档使用 [MIT License](LICENSE)。FFmpeg 和 extended 依赖仍使用各自的许可证；详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)、每个包内的许可证目录和 Release 附带源码包。
