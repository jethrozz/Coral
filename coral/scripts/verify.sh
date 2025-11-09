#!/bin/bash

# Coral 合约验证脚本
# 用法: ./scripts/verify.sh [network]

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
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

NETWORK=${1:-testnet}
CONFIG_FILE="deployed_addresses_${NETWORK}.json"

if [ ! -f "$CONFIG_FILE" ]; then
    print_error "找不到配置文件: $CONFIG_FILE"
    exit 1
fi

print_info "验证 $NETWORK 上的合约..."

# 读取配置
PACKAGE_ID=$(jq -r '.packageId' "$CONFIG_FILE")
MARKET_ID=$(jq -r '.objects.market' "$CONFIG_FILE")
GLOBAL_CONFIG_ID=$(jq -r '.objects.globalConfig' "$CONFIG_FILE")
MARKET_CONFIG_ID=$(jq -r '.objects.marketConfig' "$CONFIG_FILE")

# 切换网络
sui client switch --env $NETWORK > /dev/null 2>&1

echo ""
print_info "==================== 合约验证 ===================="

# 验证 Package
print_info "验证 Package..."
if sui client object "$PACKAGE_ID" > /dev/null 2>&1; then
    print_success "Package 存在: $PACKAGE_ID"
else
    print_error "Package 不存在: $PACKAGE_ID"
    exit 1
fi

# 验证 Market
print_info "验证 Market..."
MARKET_INFO=$(sui client object "$MARKET_ID" --json)
MARKET_CUT=$(echo "$MARKET_INFO" | jq -r '.content.fields.cut')
print_success "Market 手续费: $MARKET_CUT/10000 ($(echo "scale=2; $MARKET_CUT/100" | bc)%)"

# 验证 GlobalConfig
print_info "验证 GlobalConfig..."
GLOBAL_INFO=$(sui client object "$GLOBAL_CONFIG_ID" --json)
VERSIONS=$(echo "$GLOBAL_INFO" | jq -r '.content.fields.version.fields.contents[]')
print_success "支持的版本: $VERSIONS"

# 验证 MarketConfig
print_info "验证 MarketConfig..."
MARKET_CONFIG_INFO=$(sui client object "$MARKET_CONFIG_ID" --json)
SUPPORT_COINS=$(echo "$MARKET_CONFIG_INFO" | jq -r '.content.fields.support_coin.fields.contents[]')
SUPPORT_PAY_TYPES=$(echo "$MARKET_CONFIG_INFO" | jq -r '.content.fields.support_pay_type.fields.contents[]')
print_success "支持的币种: $SUPPORT_COINS"
print_success "支持的支付类型: $SUPPORT_PAY_TYPES"

echo ""
print_success "==================== 验证完成 ===================="
print_info "浏览器查看: https://suiscan.xyz/$NETWORK/object/$PACKAGE_ID"

