# Coral 部署脚本

这个目录包含了 Coral 智能合约的部署、升级和验证脚本。

## 📋 前置要求

1. 安装 Sui CLI
   ```bash
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
   ```

2. 配置 Sui 环境
   ```bash
   sui client
   ```

3. 安装依赖工具
   - `jq` - JSON 处理工具
   - `bc` - 计算器（用于余额显示）

   在 macOS 上：
   ```bash
   brew install jq bc
   ```

   在 Ubuntu 上：
   ```bash
   sudo apt-get install jq bc
   ```

## 🚀 脚本说明

### 1. deploy.sh - 部署脚本

部署 Coral 合约到指定网络。

**用法：**
```bash
# 部署到 testnet（默认）
./scripts/deploy.sh

# 部署到 mainnet
./scripts/deploy.sh mainnet

# 部署到 devnet
./scripts/deploy.sh devnet
```

**功能：**
- ✅ 检查环境和余额
- ✅ 编译合约
- ✅ 部署合约
- ✅ 初始化版本配置（添加 version 1）
- ✅ 生成配置文件（JSON 和 TypeScript）
- ✅ 生成部署报告（Markdown）

**输出文件：**
- `deployed_addresses_{network}.json` - JSON 配置
- `deployed_addresses_{network}.ts` - TypeScript 配置
- `deployment_report_{network}_{timestamp}.md` - 部署报告
- `deploy_output.json` - 原始部署输出
- `build.log` - 构建日志

### 2. upgrade.sh - 升级脚本

升级已部署的合约到新版本。

**用法：**
```bash
./scripts/upgrade.sh [network] [upgrade_cap_id]
```

**示例：**
```bash
./scripts/upgrade.sh testnet 0x123...
```

**功能：**
- ✅ 编译新版本
- ✅ 执行升级
- ✅ 更新配置文件
- ✅ 记录版本历史

### 3. verify.sh - 验证脚本

验证已部署的合约状态。

**用法：**
```bash
# 验证 testnet
./scripts/verify.sh

# 验证 mainnet
./scripts/verify.sh mainnet
```

**验证内容：**
- ✅ Package 是否存在
- ✅ Market 手续费配置
- ✅ GlobalConfig 版本配置
- ✅ MarketConfig 支持的币种和支付类型

## 📝 使用流程

### 首次部署

1. **准备环境**
   ```bash
   # 确保你在正确的网络
   sui client active-env
   
   # 检查余额（至少需要 0.1 SUI）
   sui client gas
   ```

2. **执行部署**
   ```bash
   cd /path/to/coral
   chmod +x scripts/*.sh
   ./scripts/deploy.sh testnet
   ```

3. **验证部署**
   ```bash
   ./scripts/verify.sh testnet
   ```

4. **保存重要信息**
   - 将生成的配置文件提交到 git
   - 备份 AdminCap 和 VersionAdminCap 的对象 ID
   - 记录 Package ID 以便后续升级

### 合约升级

1. **修改合约代码**
   ```bash
   # 编辑 sources/ 目录下的文件
   vim sources/coral_market.move
   ```

2. **执行升级**
   ```bash
   # 需要 UpgradeCap 对象 ID（部署时生成）
   ./scripts/upgrade.sh testnet 0x123...
   ```

3. **验证升级**
   ```bash
   ./scripts/verify.sh testnet
   ```

### 多网络部署

```bash
# 部署到 testnet
./scripts/deploy.sh testnet

# 部署到 mainnet
./scripts/deploy.sh mainnet

# 验证两个网络
./scripts/verify.sh testnet
./scripts/verify.sh mainnet
```

## 📊 生成的配置文件

### JSON 配置文件
```json
{
  "network": "testnet",
  "packageId": "0x...",
  "deployerAddress": "0x...",
  "deployedAt": "2024-01-01T00:00:00Z",
  "objects": {
    "coralAdminCap": "0x...",
    "versionAdminCap": "0x...",
    "globalConfig": "0x...",
    "market": "0x...",
    "marketConfig": "0x...",
    "display": "0x...",
    "publisher": "0x..."
  }
}
```

### TypeScript 配置文件
可以直接在前端项目中使用：
```typescript
import { CORAL_CONFIG } from './config/deployed_addresses_testnet';

console.log(CORAL_CONFIG.packageId);
console.log(CORAL_CONFIG.objects.market);
```

## 🔒 安全注意事项

1. **保护 AdminCap**
   - `CoralAdminCap` - 可以提取平台手续费
   - `VersionAdminCap` - 可以控制版本兼容性
   - **切勿**分享或泄露这些对象 ID

2. **验证部署**
   - 部署后立即运行验证脚本
   - 检查手续费配置是否正确
   - 确认版本配置已初始化

3. **备份配置**
   - 将配置文件加入版本控制
   - 在多个安全位置备份
   - 记录部署时间和网络

## 🐛 故障排除

### 问题：余额不足
```bash
# 获取测试币
# Testnet: 访问 Discord 水龙头
# Devnet: 使用命令行水龙头
sui client faucet
```

### 问题：Gas 不足
```bash
# 增加 gas budget（在脚本中修改 --gas-budget 参数）
# 默认: 500000000 (0.5 SUI)
```

### 问题：找不到配置文件
```bash
# 确保在正确的目录
cd /path/to/coral

# 检查配置文件
ls -la deployed_addresses_*.json
```

### 问题：网络连接失败
```bash
# 检查网络配置
sui client envs

# 切换到正确的网络
sui client switch --env testnet
```

## 📚 相关资源

- [Sui 文档](https://docs.sui.io/)
- [Move 语言指南](https://move-book.com/)
- [Sui Explorer](https://suiscan.xyz/)
- [Sui Discord](https://discord.gg/sui)

## 🆘 获取帮助

如果遇到问题：
1. 检查 `build.log` 和 `deploy_output.json`
2. 运行 `./scripts/verify.sh` 查看状态
3. 查看 [Sui 文档](https://docs.sui.io/)
4. 在项目 issue 中提问

---

**提示：** 脚本会自动处理大部分错误情况，如果遇到问题，请查看输出的错误信息。

