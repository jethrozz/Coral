// Coral 合约配置常量
export const PACKAGE_ID = "0x9598e4dde06d097a3dcfbda181ecaa3d8b8ff91699c2d43af6d9e7d8a441dac6";

// 合约对象类型
export const DIR_TYPE = PACKAGE_ID + "::coral_sync::Directory";
export const FILE_TYPE = PACKAGE_ID + "::coral_sync::File";
export const COLUMN_CAP_TYPE = PACKAGE_ID + "::coral_market::ColumnCap";
export const COLUMN_TYPE = PACKAGE_ID + "::coral_market::Column";
export const INSTALLMENT_TYPE = PACKAGE_ID + "::coral_market::Installment";
export const UPDATE_TYPE = PACKAGE_ID + "::coral_market::UpdateMethod";
export const PAYMENT_TYPE = PACKAGE_ID + "::coral_market::PaymentMethod";
export const SUBSCRIPTION_TYPE = PACKAGE_ID + "::coral_market::SubscriptionCap";

// 合约对象ID
export const CORAL_ADMIN_CAP = "0xecfd05759ac3b652661ca5daee03be8f50ebb862b243ff89ba00359d53ee9cd1";
export const VERSION_ADMIN_CAP = "0xd97ad295bc60f14595a74eeff9ee47f3297a6637d5fde141b3fab4dc43a0ed23";
export const GLOBAL_CONFIG_ID = "0xa9b8ccf530e1086c4b2a593a9a04480f75363de9a5bb7bb7d51b105238ebc546";
export const MARKET_ID = "0x0003915c2c586d08044543994f48054be0c7d751860aca1e0e38341cb253edfe";
export const MARKET_CONFIG_ID = "0x056f95af79a2bc16ae92d39cffa57de953e7eeb0bcb21a1ba9dc6997bbc68cd3";
export const DISPLAY_ID = "0x02e2b7369a3fb20c4582c76afa1319edd80e51386bb8f78e88126615113af3d5";
export const PUBLISHER_ID = "0x96dcbf4999767aa279bb1a207ad91004944db3ed4c34e8b7ebce99025951db9e";

// 网络配置
// Sui testnet GraphQL 端点
// 注意：如果 Mysten Labs 的端点不可用，可能需要使用自己的 RPC 节点
export const GRAPHQL_URL = "https://graphql.testnet.sui.io/graphql";
// RPC 端点 - 使用官方格式: https://fullnode.NETWORK.sui.io:443
export const RPC_URL = "https://fullnode.testnet.sui.io:443";
// 备用端点 - 可以尝试使用其他 RPC 提供商
export const NET_WORK = "testnet";

// UI 功能配置
// 是否显示订阅统计数据（订阅者数量等）
// 设置为 false 可以在打包时移除订阅统计相关的 UI
export const SHOW_SUBSCRIPTION_STATS = false;

