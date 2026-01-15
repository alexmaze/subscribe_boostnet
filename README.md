# Boostnet Subscription Tool

一个基于 Bun 和 Puppeteer 的自动化 CLI 工具，用于自动登录 Boostnet 面板，获取订阅链接，并生成兼容 Mihomo (Clash) 的配置文件。

## 前置要求

使用本工具需要先安装 [Bun](https://bun.com/)。

## 使用方法

### 方式一：临时直接运行 (推荐)

无需安装，直接通过 `bunx` 运行：

```bash
bunx github:alexmaze/subscribe_boostnet
```

### 方式二：全局安装

安装到系统全局命令中，方便随时调用：

1. **安装**
   ```bash
   bun install -g github:alexmaze/subscribe_boostnet
   ```

2. **运行**
   安装完成后，可以直接使用 `boostnet` 命令：
   ```bash
   boostnet
   ```

   *注意：如果提示找不到命令，请确保 `~/.bun/bin` 在你的 `PATH` 环境变量中。*

### 方式三：本地开发运行

```bash
git clone https://github.com/alexmaze/subscribe_boostnet.git
cd subscribe_boostnet
bun install
bun run start
```

## 配置说明

工具运行时需要读取配置文件，默认路径为 `~/.config/subscribe_boostnet.yaml`。

请在配置文件路径下创建文件，内容格式如下：

```yaml
# 目标网站 URL 列表 (通常只需要一个)
urls:
  - "https://666.boostnet1.com/"

# 登录凭据
username: "your_email@example.com"
password: "your_password"

# 输出目录 (生成的配置文件将保存在这里)
output_dir: "/Users/yourname/config/mihomo"

# 可选：输出文件名 (默认为 boostnet.yaml)
filename: "my-proxy.yaml"
```

### 指定配置文件路径

如果你不想使用默认路径，可以通过 `-c` 或 `--config` 参数指定配置文件：

```bash
boostnet -c ./my-config.yaml
# 或者
bunx github:alexmaze/subscribe_boostnet -c /path/to/config.yaml
```

## 功能特性

1. **自动登录**：使用 puppeteer 自动完成登录流程。
2. **链接提取**：自动点击"复制订阅链接"并解析。
3. **格式转换**：从订阅链接中解析节点信息（支持 SS/Trojan 等），并转换为 Mihomo/Clash 兼容的 YAML 格式。
4. **自动保存**：将生成的配置直接保存到指定目录。
