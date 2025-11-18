// Coral 合约配置常量
export const PACKAGE_ID = "0x08e83229240788711c736a691f7a3d45d8d3c4a22ce6dc32943b9217ade263fe";
export const PREVIOUS_PACKAGE_ID = "0x7558d0a1edea062bd92561b07035f332fa0ef4b757af8d43374bd814ccc31e76";

// 合约对象类型（新版本）
export const DIR_TYPE = PACKAGE_ID + "::coral_sync::Directory";
export const FILE_TYPE = PACKAGE_ID + "::coral_sync::File";

// 合约对象类型（旧版本，用于查询历史数据）
export const DIR_TYPE_OLD = PREVIOUS_PACKAGE_ID + "::coral_sync::Directory";
export const FILE_TYPE_OLD = PREVIOUS_PACKAGE_ID + "::coral_sync::File";
export const COLUMN_CAP_TYPE = PACKAGE_ID + "::coral_market::ColumnCap";
export const COLUMN_TYPE = PACKAGE_ID + "::coral_market::Column";
export const INSTALLMENT_TYPE = PACKAGE_ID + "::coral_market::Installment";
export const UPDATE_TYPE = PACKAGE_ID + "::coral_market::UpdateMethod";
export const PAYMENT_TYPE = PACKAGE_ID + "::coral_market::PaymentMethod";
export const SUBSCRIPTION_TYPE = PACKAGE_ID + "::coral_market::SubscriptionCap";

// 旧版本类型（用于查询历史数据）
export const COLUMN_CAP_TYPE_OLD = PREVIOUS_PACKAGE_ID + "::coral_market::ColumnCap";
export const COLUMN_TYPE_OLD = PREVIOUS_PACKAGE_ID + "::coral_market::Column";
export const INSTALLMENT_TYPE_OLD = PREVIOUS_PACKAGE_ID + "::coral_market::Installment";
export const UPDATE_TYPE_OLD = PREVIOUS_PACKAGE_ID + "::coral_market::UpdateMethod";
export const PAYMENT_TYPE_OLD = PREVIOUS_PACKAGE_ID + "::coral_market::PaymentMethod";
export const SUBSCRIPTION_TYPE_OLD = PREVIOUS_PACKAGE_ID + "::coral_market::SubscriptionCap";

// 合约对象ID
export const CORAL_ADMIN_CAP = "0xff716b74e4cca5a74cbce527cb8b1010fd34e4a0d2ab443fa07b95dccdaecdfa";
export const VERSION_ADMIN_CAP = "0x905219c4f4ebfe1391e18ee88860e081d6b56667e33b8fb060c0e5247d91c8b0";
export const GLOBAL_CONFIG_ID = "0xe651015dd1c87f2e8bf170cc8ea260097914c54c89b11937d3e2a2f166af2e3c";
export const MARKET_ID = "0x531504723648760f210d39ccc8dd7a2b9d5798a81f744663af76e77d84f5a917";
export const MARKET_CONFIG_ID = "0xb30990c2aa2161186f92155bac101cd5e7519f81509d5e4cc2422b09611ee515";
export const DISPLAY_ID = "0xe99ab7933130a4b59e09c908e1065b33132a117b41560e7f0e9e6e5d952d0069";
export const PUBLISHER_ID = "0x90ffede2c84da33a21047c51b2ab1f5a7d408bc67c63a6dd10ce014658f75ca7";

// 网络配置
// Sui testnet GraphQL 端点
// 注意：如果 Mysten Labs 的端点不可用，可能需要使用自己的 RPC 节点
export const GRAPHQL_URL = "https://graphql.testnet.sui.io/graphql";
// RPC 端点 - 使用官方格式: https://fullnode.NETWORK.sui.io:443
export const RPC_URL = "https://fullnode.testnet.sui.io:443";
// 备用端点 - 可以尝试使用其他 RPC 提供商
export const NET_WORK = "testnet";

