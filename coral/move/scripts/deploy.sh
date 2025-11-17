#!/bin/bash

# Coral Move Contracts 部署脚本
# 用法: ./scripts/deploy.sh [network]
# network: testnet (默认), mainnet, devnet

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取网络参数
NETWORK=${1:-testnet}
print_info "部署网络: $NETWORK"

# 检查 sui 命令是否存在
if ! command -v sui &> /dev/null; then
    print_error "sui 命令未找到，请先安装 Sui CLI"
    print_info "安装指南: https://docs.sui.io/build/install"
    exit 1
fi

# 检查当前网络
CURRENT_ENV=$(sui client active-env)
print_info "当前 Sui 环境: $CURRENT_ENV"

if [ "$CURRENT_ENV" != "$NETWORK" ]; then
    print_warning "当前环境 ($CURRENT_ENV) 与目标网络 ($NETWORK) 不匹配"
    read -p "是否切换到 $NETWORK? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sui client switch --env $NETWORK
        print_success "已切换到 $NETWORK"
    else
        print_error "取消部署"
        exit 1
    fi
fi

# 获取当前地址
DEPLOYER=$(sui client active-address)
print_info "部署地址: $DEPLOYER"

# 检查余额
BALANCE=$(sui client gas --json | jq -r '.[] | .mistBalance' | awk '{s+=$1} END {print s}')
print_info "当前余额: $BALANCE MIST ($(echo "scale=4; $BALANCE/1000000000" | bc) SUI)"

MIN_BALANCE=100000000  # 0.1 SUI
if [ "$BALANCE" -lt "$MIN_BALANCE" ]; then
    print_error "余额不足，至少需要 0.1 SUI"
    print_info "请访问水龙头获取测试币: https://discord.com/channels/916379725201563759/971488439931392130"
    exit 1
fi

# 进入项目目录
cd "$(dirname "$0")/.."
print_info "项目目录: $(pwd)"

# 清理之前的构建
print_info "清理旧的构建文件..."
rm -rf build/

# 构建合约
print_info "构建 Move 合约..."
sui move build 2>&1 | tee build.log

# 检查构建是否成功
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    print_error "合约构建失败，请查看 build.log"
    exit 1
fi
print_success "合约构建成功"

# 确认部署
print_warning "准备部署到 $NETWORK"
print_info "Gas 预算: 500000000 MIST (0.5 SUI)"
read -p "确认部署? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "取消部署"
    exit 1
fi

# 部署合约
print_info "正在部署合约..."
DEPLOY_OUTPUT=$(sui client publish --gas-budget 500000000 --json 2>&1)

# 保存部署输出
echo "$DEPLOY_OUTPUT" > deploy_output.json

# 提取 JSON 部分（新版本 Sui CLI 在前面有编译输出）
# 方法1: 使用 awk 提取从第一个 { 开始到文件结束的内容（JSON可能是多行的）
# 注意：不要使用 head -1，因为JSON是多行的
DEPLOY_JSON=$(echo "$DEPLOY_OUTPUT" | awk '/^{/,0')

# 如果方法1失败，尝试从保存的文件中提取
if ! echo "$DEPLOY_JSON" | jq empty > /dev/null 2>&1; then
    if [ -f "deploy_output.json" ]; then
        # 从文件中提取JSON（从第一个 { 开始到文件结束）
        DEPLOY_JSON=$(awk '/^{/,0' deploy_output.json)
    fi
fi

# 如果还是失败，尝试使用 sed 提取JSON块
if ! echo "$DEPLOY_JSON" | jq empty > /dev/null 2>&1; then
    if [ -f "deploy_output.json" ]; then
        # 找到第一个 { 的行号，然后提取从那里到文件结束
        FIRST_BRACE_LINE=$(grep -n "^{" deploy_output.json | head -1 | cut -d: -f1)
        if [ -n "$FIRST_BRACE_LINE" ]; then
            DEPLOY_JSON=$(sed -n "${FIRST_BRACE_LINE},\$p" deploy_output.json)
        fi
    fi
fi

# 检查部署是否成功
# 首先验证JSON是否有效
if ! echo "$DEPLOY_JSON" | jq empty > /dev/null 2>&1; then
    print_error "无法解析部署输出JSON"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

# 检查部署状态（支持多种可能的JSON结构）
if echo "$DEPLOY_JSON" | jq -e '.effects.status.status == "success"' > /dev/null 2>&1; then
    print_success "合约部署成功！"
elif echo "$DEPLOY_JSON" | jq -e '.status.status == "success"' > /dev/null 2>&1; then
    print_success "合约部署成功！"
elif echo "$DEPLOY_JSON" | jq -e '.effects.status == "success"' > /dev/null 2>&1; then
    print_success "合约部署成功！"
elif echo "$DEPLOY_JSON" | jq -e '.status == "success"' > /dev/null 2>&1; then
    print_success "合约部署成功！"
else
    # 检查是否有错误信息
    ERROR_MSG=$(echo "$DEPLOY_JSON" | jq -r '.error // .message // empty' 2>/dev/null)
    if [ -n "$ERROR_MSG" ]; then
        print_error "合约部署失败: $ERROR_MSG"
    else
        print_error "合约部署失败（状态检查未通过）"
    fi
    
    # 显示详细的错误信息
    print_info "部署输出详情:"
    echo "$DEPLOY_JSON" | jq '.' 2>/dev/null || echo "$DEPLOY_OUTPUT"
    exit 1
fi

# 提取重要信息（添加null检查以避免错误）
PACKAGE_ID=$(echo "$DEPLOY_JSON" | jq -r '.objectChanges[] | select(.type == "published") | .packageId' | head -1)
ADMIN_CAP_ID=$(echo "$DEPLOY_JSON" | jq -r '.objectChanges[] | select(.objectType != null and (.objectType | contains("CoralAdminCap"))) | .objectId' | head -1)
VERSION_ADMIN_CAP_ID=$(echo "$DEPLOY_JSON" | jq -r '.objectChanges[] | select(.objectType != null and (.objectType | contains("CoralVersionAdminCap"))) | .objectId' | head -1)
GLOBAL_CONFIG_ID=$(echo "$DEPLOY_JSON" | jq -r '.objectChanges[] | select(.objectType != null and (.objectType | contains("GlobalConfig"))) | .objectId' | head -1)
MARKET_ID=$(echo "$DEPLOY_JSON" | jq -r '.objectChanges[] | select(.objectType != null and (.objectType | contains("Market")) and (.objectType | contains("MarketConfig") | not)) | .objectId' | head -1)
MARKET_CONFIG_ID=$(echo "$DEPLOY_JSON" | jq -r '.objectChanges[] | select(.objectType != null and (.objectType | contains("MarketConfig"))) | .objectId' | head -1)
DISPLAY_ID=$(echo "$DEPLOY_JSON" | jq -r '.objectChanges[] | select(.objectType != null and (.objectType | contains("Display"))) | .objectId' | head -1)
PUBLISHER_ID=$(echo "$DEPLOY_JSON" | jq -r '.objectChanges[] | select(.objectType != null and (.objectType | contains("Publisher"))) | .objectId' | head -1)

# 验证关键信息是否提取成功
if [ -z "$PACKAGE_ID" ] || [ "$PACKAGE_ID" == "null" ]; then
    print_error "无法提取 Package ID"
    exit 1
fi

# 打印部署信息
print_success "==================== 部署信息 ===================="
echo -e "${GREEN}Package ID:${NC}              $PACKAGE_ID"
echo -e "${GREEN}CoralAdminCap ID:${NC}        $ADMIN_CAP_ID"
echo -e "${GREEN}VersionAdminCap ID:${NC}     $VERSION_ADMIN_CAP_ID"
echo -e "${GREEN}GlobalConfig ID:${NC}        $GLOBAL_CONFIG_ID"
echo -e "${GREEN}Market ID:${NC}              $MARKET_ID"
echo -e "${GREEN}MarketConfig ID:${NC}        $MARKET_CONFIG_ID"
echo -e "${GREEN}Display ID:${NC}             $DISPLAY_ID"
echo -e "${GREEN}Publisher ID:${NC}           $PUBLISHER_ID"
echo -e "${GREEN}Deployer Address:${NC}       $DEPLOYER"
echo -e "${GREEN}Network:${NC}                $NETWORK"
print_success "================================================="

# 生成配置文件
CONFIG_FILE="deployed_addresses_${NETWORK}.json"
cat > "$CONFIG_FILE" <<EOF
{
  "network": "$NETWORK",
  "packageId": "$PACKAGE_ID",
  "deployerAddress": "$DEPLOYER",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "objects": {
    "coralAdminCap": "$ADMIN_CAP_ID",
    "versionAdminCap": "$VERSION_ADMIN_CAP_ID",
    "globalConfig": "$GLOBAL_CONFIG_ID",
    "market": "$MARKET_ID",
    "marketConfig": "$MARKET_CONFIG_ID",
    "display": "$DISPLAY_ID",
    "publisher": "$PUBLISHER_ID"
  },
  "moduleNames": {
    "market": "${PACKAGE_ID}::coral_market",
    "sync": "${PACKAGE_ID}::coral_sync",
    "event": "${PACKAGE_ID}::coral_event",
    "version": "${PACKAGE_ID}::coral_version",
    "util": "${PACKAGE_ID}::coral_util"
  }
}
EOF

print_success "配置文件已保存: $CONFIG_FILE"

# 生成 TypeScript 配置
TS_CONFIG_FILE="deployed_addresses_${NETWORK}.ts"
cat > "$TS_CONFIG_FILE" <<EOF
// Auto-generated deployment configuration for $NETWORK
// Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

export const CORAL_CONFIG = {
  network: '$NETWORK',
  packageId: '$PACKAGE_ID',
  deployerAddress: '$DEPLOYER',
  
  objects: {
    coralAdminCap: '$ADMIN_CAP_ID',
    versionAdminCap: '$VERSION_ADMIN_CAP_ID',
    globalConfig: '$GLOBAL_CONFIG_ID',
    market: '$MARKET_ID',
    marketConfig: '$MARKET_CONFIG_ID',
    display: '$DISPLAY_ID',
    publisher: '$PUBLISHER_ID',
  },
  
  types: {
    CoralAdminCap: \`\${this.packageId}::coral_market::CoralAdminCap\`,
    CoralVersionAdminCap: \`\${this.packageId}::coral_version::CoralVersionAdminCap\`,
    GlobalConfig: \`\${this.packageId}::coral_version::GlobalConfig\`,
    Market: \`\${this.packageId}::coral_market::Market\`,
    MarketConfig: \`\${this.packageId}::coral_market::MarketConfig\`,
    Column: \`\${this.packageId}::coral_market::Column\`,
    ColumnCap: \`\${this.packageId}::coral_market::ColumnCap\`,
    Installment: \`\${this.packageId}::coral_market::Installment\`,
    SubscriptionCap: \`\${this.packageId}::coral_market::SubscriptionCap\`,
    PaymentMethod: \`\${this.packageId}::coral_market::PaymentMethod\`,
    UpdateMethod: \`\${this.packageId}::coral_market::UpdateMethod\`,
    File: \`\${this.packageId}::coral_sync::File\`,
    Directory: \`\${this.packageId}::coral_sync::Directory\`,
  },
  
  functions: {
    // Market functions
    createPaymentMethod: \`\${this.packageId}::coral_market::create_payment_method\`,
    createUpdateMethod: \`\${this.packageId}::coral_market::create_update_method\`,
    createColumn: \`\${this.packageId}::coral_market::create_column\`,
    publishColumn: \`\${this.packageId}::coral_market::publish_column\`,
    addInstallment: \`\${this.packageId}::coral_market::add_installment\`,
    publishInstallment: \`\${this.packageId}::coral_market::publish_installment\`,
    subscriptionColumn: \`\${this.packageId}::coral_market::subscription_column\`,
    renewSubscription: \`\${this.packageId}::coral_market::renew_subscription\`,
    
    // Sync functions
    newRootDirectory: \`\${this.packageId}::coral_sync::new_root_directory\`,
    newFile: \`\${this.packageId}::coral_sync::new_file\`,
    
    // Seal approve functions
    sealApproveSub: \`\${this.packageId}::coral_market::seal_approve_sub\`,
    sealApproveCreator: \`\${this.packageId}::coral_market::seal_approve_creator\`,
  },
} as const;

export type CoralConfig = typeof CORAL_CONFIG;
EOF

print_success "TypeScript 配置已保存: $TS_CONFIG_FILE"

# 初始化版本配置
print_info "正在初始化版本配置..."
ADD_VERSION_TX=$(sui client call \
  --package "$PACKAGE_ID" \
  --module coral_version \
  --function add_version \
  --args "$VERSION_ADMIN_CAP_ID" "$GLOBAL_CONFIG_ID" 1 \
  --gas-budget 10000000 \
  --json 2>&1)

if echo "$ADD_VERSION_TX" | jq -e '.effects.status.status == "success"' > /dev/null 2>&1; then
    print_success "版本配置初始化成功 (version: 1)"
else
    print_error "版本配置初始化失败"
    echo "$ADD_VERSION_TX" | jq '.'
fi

# 生成部署报告
REPORT_FILE="deployment_report_${NETWORK}_$(date +%Y%m%d_%H%M%S).md"
cat > "$REPORT_FILE" <<EOF
# Coral Contracts Deployment Report

**Network:** $NETWORK  
**Deployed At:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Deployer:** $DEPLOYER

## Contract Addresses

| Object | Address |
|--------|---------|
| Package ID | \`$PACKAGE_ID\` |
| CoralAdminCap | \`$ADMIN_CAP_ID\` |
| VersionAdminCap | \`$VERSION_ADMIN_CAP_ID\` |
| GlobalConfig | \`$GLOBAL_CONFIG_ID\` |
| Market | \`$MARKET_ID\` |
| MarketConfig | \`$MARKET_CONFIG_ID\` |
| Display | \`$DISPLAY_ID\` |
| Publisher | \`$PUBLISHER_ID\` |

## Explorer Links

- **Package:** https://suiscan.xyz/$NETWORK/object/$PACKAGE_ID
- **Market:** https://suiscan.xyz/$NETWORK/object/$MARKET_ID
- **Deployer:** https://suiscan.xyz/$NETWORK/account/$DEPLOYER

## Configuration Files

- JSON Config: \`$CONFIG_FILE\`
- TypeScript Config: \`$TS_CONFIG_FILE\`
- Deployment Report: \`$REPORT_FILE\`

## Next Steps

1. **Verify Contract:**
   \`\`\`bash
   sui client object $PACKAGE_ID
   \`\`\`

2. **Test Market Config:**
   \`\`\`bash
   sui client object $MARKET_CONFIG_ID
   \`\`\`

3. **Check Version Config:**
   \`\`\`bash
   sui client object $GLOBAL_CONFIG_ID
   \`\`\`

4. **Update Frontend Config:**
   Copy the TypeScript config to your frontend project:
   \`\`\`bash
   cp $TS_CONFIG_FILE ../frontend/src/config/
   \`\`\`

## Important Notes

- ⚠️  Keep \`CoralAdminCap\` (\`$ADMIN_CAP_ID\`) safe - it controls market fees
- ⚠️  Keep \`VersionAdminCap\` (\`$VERSION_ADMIN_CAP_ID\`) safe - it controls version compatibility
- 📝 Market fee is set to 15/10000 (0.15%)
- ✅ Version 1 is now active in GlobalConfig

## Contract Modules

- \`coral_market\` - Core marketplace logic
- \`coral_sync\` - File and directory management
- \`coral_event\` - Event definitions
- \`coral_version\` - Version management
- \`coral_util\` - Utility functions

---
*Generated by Coral deployment script*
EOF

print_success "部署报告已保存: $REPORT_FILE"

# 打印后续步骤
print_success "==================== 部署完成 ===================="
print_info "配置文件:"
echo "  - $CONFIG_FILE"
echo "  - $TS_CONFIG_FILE"
echo "  - $REPORT_FILE"
echo ""
print_info "浏览器查看:"
echo "  Package: https://suiscan.xyz/$NETWORK/object/$PACKAGE_ID"
echo "  Market:  https://suiscan.xyz/$NETWORK/object/$MARKET_ID"
echo ""
print_info "后续步骤:"
echo "  1. 验证合约: sui client object $PACKAGE_ID"
echo "  2. 将配置文件复制到前端项目"
echo "  3. 测试创建专栏功能"
echo ""
print_warning "重要提示:"
echo "  - 请妥善保管 AdminCap 对象 ID"
echo "  - 建议将配置文件加入版本控制"
echo "  - 记录此次部署的 Package ID 以便后续升级"
print_success "================================================="

