# OnePiece Gallery 🏴‍☠️

一个精美的海贼王图片收藏网站，支持从 Twitter/X 和 Instagram 一键导入图片，基于 Astro 构建。

## ✨ 功能特性

- **一键导入**：粘贴 Twitter/X 或 Instagram 链接，自动提取图片、标题和作者
- **自动元数据**：智能解析社交媒体帖子信息，无需手动填写
- **瀑布流布局**：响应式图片网格，适配各种屏幕尺寸
- **密码保护**：管理后台需密码验证，安全可靠
- **GitHub 存储**：图片和内容直接存储在 GitHub 仓库中

## 🛠️ 技术栈

- [Astro](https://astro.build) - 静态站点生成器
- [Vue 3](https://vuejs.org) - 管理后台组件
- [TypeScript](https://typescriptlang.org) - 类型安全
- GitHub API - 内容存储

## 📦 安装

```bash
# 克隆项目
git clone https://github.com/Eyozy/OnePieceGallery.git
cd OnePieceGallery

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写你的配置
```

## ⚙️ 环境变量

在 `.env` 文件中配置以下变量：

| 变量名 | 说明 |
|--------|------|
| `GITHUB_TOKEN` | GitHub Personal Access Token |
| `GITHUB_OWNER` | GitHub 用户名 |
| `GITHUB_REPO` | 仓库名称 |
| `ADMIN_PASSWORD` | 管理后台密码（自定义） |

### 获取 GitHub Token

1. 登录 GitHub，点击右上角头像 → **Settings**
2. 左侧菜单滚动到底部，点击 **Developer settings**
3. 选择 **Personal access tokens** → **Tokens (classic)**
4. 点击 **Generate new token** → **Generate new token (classic)**
5. 填写 Token 信息：
   - **Note**：填写用途说明，如 `OnePiece Gallery`
   - **Expiration**：选择过期时间（建议 90 天或更长）
   - **Select scopes**：勾选 `repo`（完整仓库访问权限）
6. 点击 **Generate token**，复制生成的 Token（只显示一次！）

### 获取 GitHub Owner 和 Repo

- **GITHUB_OWNER**：你的 GitHub 用户名
  - 例如：`https://github.com/Eyozy` 中的 `Eyozy`
- **GITHUB_REPO**：仓库名称
  - 例如：`https://github.com/Eyozy/OnePieceGallery` 中的 `OnePieceGallery`

### 配置示例

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=YourUsername
GITHUB_REPO=OnePieceGallery
ADMIN_PASSWORD=your_secure_password
```

## 🚀 运行

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

开发服务器默认运行在 http://localhost:4321

## 📁 项目结构

```
/
├── public/              # 静态资源
├── src/
│   ├── components/      # Vue/Astro 组件
│   │   └── Admin/       # 管理后台组件
│   ├── content/         # 内容集合（图库数据）
│   │   └── gallery/     # 图库条目
│   ├── layouts/         # 页面布局
│   └── pages/           # 页面路由
│       ├── api/         # API 端点
│       ├── admin.astro  # 管理后台页面
│       └── index.astro  # 首页
└── package.json
```

## 🔒 管理后台

访问 `/admin` 进入管理后台，需要输入 `ADMIN_PASSWORD` 中配置的密码。

**功能**：
- 粘贴社交媒体链接获取预览
- 编辑标题和作者信息
- 确认保存到图库
- 删除现有图片

## 📄 许可证

MIT License
