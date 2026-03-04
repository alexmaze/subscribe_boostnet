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

## Serve 模式

除了一次性运行，还支持以 HTTP 服务器模式运行，提供 `/subscription` 代理端口供客户端直接拉取订阅：

```bash
# 启动服务器（默认端口 3000）
boostnet serve

# 指定端口
boostnet serve -p 8080

# 指定配置文件
boostnet serve -c ./my-config.yaml -p 8080
```

启动后，客户端可通过以下接口获取订阅内容：

```bash
# 拉取订阅（请求头会透传给 Boostnet）
curl http://localhost:3000/subscription -H "User-Agent: Clash/1.0"

# 健康检查
curl http://localhost:3000/health
```

每次请求 `/subscription` 时，服务器会实时通过 Puppeteer 登录 Boostnet 获取最新订阅链接，然后代理返回内容。适用于客户端无法直接访问 Boostnet 的场景。

配置文件中可指定默认端口：

```yaml
port: 3000  # 可选，serve 模式监听端口，默认 3000
```

## Docker 部署

### 使用 Docker Compose（推荐）

1. 在项目根目录创建 `config.yaml` 配置文件（格式参考上方配置说明）

2. 启动服务：

```bash
docker compose up -d
```

3. 查看日志：

```bash
docker compose logs -f
```

### 使用 Docker 命令

```bash
# 拉取镜像
docker pull ghcr.io/alexmaze/subscribe_boostnet:latest

# 运行（将宿主机配置文件挂载到容器内）
docker run -d -p 3000:3000 \
  -v /path/to/your/config.yaml:/app/config.yaml:ro \
  ghcr.io/alexmaze/subscribe_boostnet:latest
```

### 本地构建镜像

```bash
docker build -t boostnet .
docker run -d -p 3000:3000 \
  -v ./config.yaml:/app/config.yaml:ro \
  boostnet
```

## 功能特性

1. **自动登录**：使用 puppeteer 自动完成登录流程。
2. **链接提取**：自动点击"复制订阅链接"并解析。
3. **格式转换**：从订阅链接中解析节点信息（支持 SS/Trojan 等），并转换为 Mihomo/Clash 兼容的 YAML 格式。
4. **自动保存**：将生成的配置直接保存到指定目录。
5. **Serve 代理模式**：启动 HTTP 服务器，代理订阅请求，透传请求头，适用于客户端无法直连 Boostnet 的场景。
