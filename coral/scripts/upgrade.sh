#!/bin/bash

# Coral Move Contracts 升级脚本
# 用法: ./scripts/upgrade.sh [network] [upgrade_cap_id]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 获取参数
NETWORK=${1:-testnet}
UPGRADE_CAP_ID=$2

if [ -z "$UPGRADE_CAP_ID" ]; then
    print_error "请提供 UpgradeCap ID"
    echo "用法: ./scripts/upgrade.sh [network] [upgrade_cap_id]"
    exit 1
fi

print_info "升级网络: $NETWORK"
print_info "UpgradeCap ID: $UPGRADE_CAP_ID"

# 检查配置文件
CONFIG_FILE="deployed_addresses_${NETWORK}.json"
if [ ! -f "$CONFIG_FILE" ]; then
    print_error "找不到配置文件: $CONFIG_FILE"
    print_info "请先运行部署脚本: ./scripts/deploy.sh $NETWORK"
    exit 1
fi

# 读取旧的 Package ID
OLD_PACKAGE_ID=$(jq -r '.packageId' "$CONFIG_FILE")
print_info "旧 Package ID: $OLD_PACKAGE_ID"

# 切换网络
CURRENT_ENV=$(sui client active-env)
if [ "$CURRENT_ENV" != "$NETWORK" ]; then
    sui client switch --env $NETWORK
fi

# 构建合约
print_info "构建新版本合约..."
cd "$(dirname "$0")/.."
sui move build

# 升级合约
print_info "正在升级合约..."
UPGRADE_OUTPUT=$(sui client upgrade \
  --upgrade-capability "$UPGRADE_CAP_ID" \
  --gas-budget 500000000 \
  --json 2>&1)

echo "$UPGRADE_OUTPUT" > upgrade_output.json

# 检查升级是否成功
if echo "$UPGRADE_OUTPUT" | jq -e '.effects.status.status == "success"' > /dev/null 2>&1; then
    print_success "合约升级成功！"
else
    print_error "合约升级失败"
    echo "$UPGRADE_OUTPUT" | jq '.'
    exit 1
fi

# 提取新的 Package ID
NEW_PACKAGE_ID=$(echo "$UPGRADE_OUTPUT" | jq -r '.objectChanges[] | select(.type == "published") | .packageId')

print_success "==================== 升级信息 ===================="
echo -e "${GREEN}旧 Package ID:${NC} $OLD_PACKAGE_ID"
echo -e "${GREEN}新 Package ID:${NC} $NEW_PACKAGE_ID"
print_success "================================================="

# 更新配置文件
print_info "更新配置文件..."
jq --arg new_pkg "$NEW_PACKAGE_ID" --arg old_pkg "$OLD_PACKAGE_ID" \
  '.previousPackageId = $old_pkg | .packageId = $new_pkg | .upgradedAt = now | .upgradeCount = (.upgradeCount // 0) + 1' \
  "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

print_success "升级完成！新 Package ID: $NEW_PACKAGE_ID"

