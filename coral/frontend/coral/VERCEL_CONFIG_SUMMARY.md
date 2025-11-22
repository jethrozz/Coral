# Vercel 部署配置总结 ⚡

## 🎯 关键修复

### 问题 1: pnpm 版本错误
**症状**: `ERR_PNPM_UNSUPPORTED_ENGINE` - pnpm 6.35.1 vs 9.15.0
**解决方案**: 在 `vercel.json` 中使用 corepack 升级 pnpm

### 问题 2: @mysten/sui 版本冲突
**症状**: TypeScript 类型错误 - SuiJsonRpcClient 不兼容
**解决方案**: 使用 pnpm overrides 锁定版本到 1.44.0

### 问题 3: React 19 兼容性
**症状**: vaul@0.9.9 不支持 React 19
**解决方案**: 升级 vaul 到 1.1.2

---

## 📦 必需的配置文件

### 1. vercel.json
```json
{
  "buildCommand": "pnpm build:testnet",
  "installCommand": "corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_ENV": "testnet"
  }
}
```

**关键点**:
- `installCommand` 使用 corepack 确保正确的 pnpm 版本
- `buildCommand` 指定环境（testnet/mainnet）
- `env` 设置运行时环境变量

### 2. package.json（关键部分）
```json
{
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0"
  },
  "pnpm": {
    "overrides": {
      "@mysten/sui": "1.44.0"
    }
  },
  "dependencies": {
    "@mysten/sui": "1.44.0",
    "vaul": "^1.1.1"
  }
}
```

**关键点**:
- `packageManager` 声明 pnpm 版本
- `engines.node` 指定 Node.js 版本
- `pnpm.overrides` 锁定 @mysten/sui 版本，避免冲突

### 3. .npmrc
```ini
# pnpm 配置
auto-install-peers=true
shamefully-hoist=false
strict-peer-dependencies=false

# 使用官方 npm registry
registry=https://registry.npmjs.org/

# 网络配置
network-timeout=300000
fetch-retries=5
fetch-retry-mintimeout=10000
fetch-retry-maxtimeout=60000

# 解决 URLSearchParams 错误
resolution-mode=highest
```

**关键点**:
- 移除了 `engine-strict=true`（会导致冲突）
- 增加网络超时时间
- 添加 `resolution-mode=highest`

### 4. pnpm-workspace.yaml
```yaml
packages:
  - '.'
```

**关键点**:
- 告诉 pnpm 这是一个工作空间
- 帮助 Vercel 识别这是 pnpm 项目

---

## 🚀 Vercel Dashboard 配置

### Root Directory
```
coral/frontend/coral
```

### Node.js Version
选择: **20.x**（推荐）或 18.x

### Environment Variables（可选但推荐）
| Key | Value | 说明 |
|-----|-------|------|
| `NEXT_PUBLIC_ENV` | `testnet` 或 `mainnet` | 网络环境 |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` | 启用 Corepack（可选，installCommand 已处理） |

### Build Command
留空或设置为 `pnpm build:testnet`（vercel.json 会覆盖）

### Install Command
留空（vercel.json 已配置）

---

## ✅ 部署前检查清单

- [ ] `vercel.json` 包含自定义 installCommand
- [ ] `package.json` 中 `@mysten/sui` 锁定到 1.44.0
- [ ] `package.json` 中 `vaul` >= 1.1.0
- [ ] `package.json` 中 `packageManager: "pnpm@9.15.0"`
- [ ] `.npmrc` 不包含 `engine-strict=true`
- [ ] `pnpm-workspace.yaml` 已创建
- [ ] `pnpm-lock.yaml` 已提交
- [ ] Root Directory 设置为 `coral/frontend/coral`
- [ ] Node.js Version 设置为 20.x

---

## 🔍 验证部署

### 1. 检查构建日志
在 Vercel Dashboard → Deployments → 点击部署 → "Build Logs"

**期望看到**:
```
Installing dependencies...
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install
...
Packages: +403
Done in X.Xs
```

### 2. 检查 pnpm 版本
在构建日志中搜索 `pnpm`，应该看到：
```
pnpm install
```
而不是 `npm install`

### 3. 验证构建成功
```
✓ Compiled successfully
✓ Generating static pages
Route (app)
✓ Build completed successfully
```

### 4. 测试部署的应用
- 访问 Vercel 提供的 URL
- 测试钱包连接
- 测试专栏浏览
- 检查浏览器控制台无错误

---

## 🐛 常见部署错误及解决

### 错误 1: pnpm 版本仍然是 6.35.1
**症状**: 构建日志显示 `Your pnpm version is incompatible`
**解决**:
1. 确认 `vercel.json` 中有 `installCommand`
2. 删除 Vercel 项目重新导入
3. 或在 Vercel Settings → General → Install Command 中手动设置

### 错误 2: ERR_INVALID_THIS
**症状**: `GET https://registry.npmjs.org/... error (ERR_INVALID_THIS)`
**解决**:
1. 这通常是旧版 pnpm 的 bug
2. 确保 `installCommand` 正确升级了 pnpm
3. 检查 `.npmrc` 是否有冲突配置

### 错误 3: Type error - SuiJsonRpcClient
**症状**: TypeScript 编译错误，提示 cache 属性不兼容
**解决**:
1. 确认 `package.json` 中 `pnpm.overrides` 包含 `@mysten/sui: "1.44.0"`
2. 删除 `node_modules` 和 `pnpm-lock.yaml`，重新安装
3. 提交更新后的 `pnpm-lock.yaml`

### 错误 4: 构建超时
**症状**: `Error: Command exceeded maximum execution time`
**解决**:
1. 升级 Vercel 套餐（免费版有限制）
2. 优化依赖，减少包大小
3. 在 `.npmrc` 中增加 `network-timeout`

---

## 📊 性能优化建议

### 1. 启用 Vercel 缓存
Vercel 自动缓存 `node_modules`，确保：
- 不要频繁更改依赖版本
- 使用 `pnpm-lock.yaml` 锁定版本

### 2. 使用 Vercel Edge Functions
对于动态路由，考虑启用 Edge Functions：
```typescript
// app/column/[id]/route.ts
export const runtime = 'edge'
```

### 3. 监控构建时间
- 平均构建时间应该在 2-5 分钟
- 如果超过 5 分钟，检查依赖和构建配置

---

## 🎉 成功部署标志

当看到以下信息时，说明部署成功：

```
✓ Build completed successfully
Your deployment is ready at:
https://your-project.vercel.app
```

访问 URL，测试应用功能！

---

## 📚 相关文档

- [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) - 详细部署指南
- [DEPLOYMENT.md](../../../DEPLOYMENT.md) - 通用部署文档
- [Vercel 官方文档](https://vercel.com/docs)
- [pnpm 文档](https://pnpm.io/)
- [Next.js 部署文档](https://nextjs.org/docs/app/building-your-application/deploying)

---

<div align="center">
  <strong>🚀 现在可以成功部署了！</strong>
</div>

