#!/bin/bash

# 调用 add_version 函数的命令行脚本
# 
# 使用方法：
# 1. 确保已安装 Sui CLI 并配置好钱包
# 2. 修改下面的配置参数
# 3. 运行: bash add-version.sh

# ========== 配置参数 ==========
PACKAGE_ID="0x7558d0a1edea062bd92561b07035f332fa0ef4b757af8d43374bd814ccc31e76"
VERSION_ADMIN_CAP_ID="0x905219c4f4ebfe1391e18ee88860e081d6b56667e33b8fb060c0e5247d91c8b0"  # 请替换为实际的 VERSION_ADMIN_CAP_ID
GLOBAL_CONFIG_ID="0xe651015dd1c87f2e8bf170cc8ea260097914c54c89b11937d3e2a2f166af2e3c"      # 请替换为实际的 GLOBAL_CONFIG_ID
VERSION=1  # 要添加的版本号 (u16)
GAS_BUDGET=10000000  # Gas 预算

# ========== 颜色输出 ==========
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ========== 打印信息 ==========
print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ========== 检查参数 ==========
if [ -z "$VERSION_ADMIN_CAP_ID" ] || [ "$VERSION_ADMIN_CAP_ID" = "0x..." ]; then
    print_error "请设置 VERSION_ADMIN_CAP_ID"
    exit 1
fi

if [ -z "$GLOBAL_CONFIG_ID" ] || [ "$GLOBAL_CONFIG_ID" = "0x..." ]; then
    print_error "请设置 GLOBAL_CONFIG_ID"
    exit 1
fi

# ========== 显示配置信息 ==========
print_info "准备调用 add_version 函数..."
echo "Package ID: $PACKAGE_ID"
echo "Version Admin Cap ID: $VERSION_ADMIN_CAP_ID"
echo "Global Config ID: $GLOBAL_CONFIG_ID"
echo "Version: $VERSION"
echo "Gas Budget: $GAS_BUDGET"
echo ""

# ========== 调用 add_version ==========
print_info "正在调用 add_version..."

RESULT=$(sui client call \
  --package "$PACKAGE_ID" \
  --module coral_version \
  --function add_version \
  --args "$VERSION_ADMIN_CAP_ID" "$GLOBAL_CONFIG_ID" "$VERSION" \
  --gas-budget "$GAS_BUDGET" \
  --json 2>&1)

# ========== 检查结果 ==========
if echo "$RESULT" | jq -e '.effects.status.status == "success"' > /dev/null 2>&1; then
    print_success "版本添加成功！"
    echo ""
    echo "交易摘要:"
    echo "$RESULT" | jq -r '.effects.transactionDigest'
    echo ""
    echo "完整结果:"
    echo "$RESULT" | jq '.'
else
    print_error "版本添加失败"
    echo ""
    echo "错误信息:"
    echo "$RESULT" | jq '.' 2>/dev/null || echo "$RESULT"
    exit 1
fi

