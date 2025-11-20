// Coral 合约配置常量
// 环境配置：通过 NEXT_PUBLIC_ENV 环境变量切换，默认为 testnet
// 设置方式：
//   - 开发环境：在 .env.local 文件中设置 NEXT_PUBLIC_ENV=mainnet
//   - 构建时：NEXT_PUBLIC_ENV=mainnet npm run build
//   - 或者在 package.json 的 scripts 中设置
// 获取环境变量（Next.js 客户端需要使用 NEXT_PUBLIC_ 前缀）
const getEnv = () => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NEXT_PUBLIC_ENV || 'testnet';
  }
  return 'testnet';
};

const ENV = getEnv();

// 测试环境配置
const TESTNET_CONFIG = {
  // 合约 Package ID
  PACKAGE_ID: "0x9f2aa2af9a2d7f0725af3fa1be11babb86762847f0b367d947f022229531a514",
  
  // 合约对象ID
  CORAL_ADMIN_CAP: "0x67ab32eb0caa5cab6b3d719de89a7025a18933256e054d075b7d9ca00905c9c3",
  VERSION_ADMIN_CAP: "0x862ce5518c6e5bf68bbad8165a27857c8ff1807d1a0a305bee57d28c7048a094",
  GLOBAL_CONFIG_ID: "0xd9e10f9934cd4db0b4b27b01f275673f121efd0d252d91ec4d5211bfd8dbc5e1",
  MARKET_ID: "0x1fa178259a3768eb6dca808a6dba87a703bab8362370ba49a25177365b4dc641",
  MARKET_CONFIG_ID: "0xd226fc918db7eeba58c4d24303d9ac03b0cc44de81bd3d2c92c2386a4f2ec0a6",
  DISPLAY_ID: "0x4d92d5cc5dc0a11f1ece7e6ba73eae5301aa34400dbf9f16307d72cf5814b0a4",
  PUBLISHER_ID: "0x5957465362e2dc8d4c1ac5ab4cd3b74f2d3704767761979bc6702323e3fd3a2d",
  
  // 网络配置
  GRAPHQL_URL: "https://graphql.testnet.sui.io/graphql",
  RPC_URL: "https://fullnode.testnet.sui.io:443",
  NET_WORK: "testnet",
  
  // Seal key server object IDs
  SEAL_SERVER_OBJECT_IDS: [
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8"
  ],
};

// 生产环境配置（mainnet）
const MAINNET_CONFIG = {
  // 合约 Package ID（需要部署到 mainnet 后更新）
  PACKAGE_ID: "", // TODO: 部署到 mainnet 后填入实际的 Package ID
  
  // 合约对象ID（需要部署到 mainnet 后更新）
  CORAL_ADMIN_CAP: "", // TODO: 部署到 mainnet 后填入实际的 ID
  VERSION_ADMIN_CAP: "", // TODO: 部署到 mainnet 后填入实际的 ID
  GLOBAL_CONFIG_ID: "", // TODO: 部署到 mainnet 后填入实际的 ID
  MARKET_ID: "", // TODO: 部署到 mainnet 后填入实际的 ID
  MARKET_CONFIG_ID: "", // TODO: 部署到 mainnet 后填入实际的 ID
  DISPLAY_ID: "", // TODO: 部署到 mainnet 后填入实际的 ID
  PUBLISHER_ID: "", // TODO: 部署到 mainnet 后填入实际的 ID
  
  // 网络配置
  GRAPHQL_URL: "https://graphql.mainnet.sui.io/graphql",
  RPC_URL: "https://fullnode.mainnet.sui.io:443",
  NET_WORK: "mainnet",
  
  // Seal key server object IDs（mainnet 的 Seal server IDs）
  SEAL_SERVER_OBJECT_IDS: [
    // TODO: 部署到 mainnet 后填入实际的 Seal server object IDs
  ],
};

// 根据环境选择配置
const CONFIG = ENV === 'mainnet' ? MAINNET_CONFIG : TESTNET_CONFIG;

// 导出当前环境的配置
export const PACKAGE_ID = CONFIG.PACKAGE_ID;
export const CORAL_ADMIN_CAP = CONFIG.CORAL_ADMIN_CAP;
export const VERSION_ADMIN_CAP = CONFIG.VERSION_ADMIN_CAP;
export const GLOBAL_CONFIG_ID = CONFIG.GLOBAL_CONFIG_ID;
export const MARKET_ID = CONFIG.MARKET_ID;
export const MARKET_CONFIG_ID = CONFIG.MARKET_CONFIG_ID;
export const DISPLAY_ID = CONFIG.DISPLAY_ID;
export const PUBLISHER_ID = CONFIG.PUBLISHER_ID;
export const GRAPHQL_URL = CONFIG.GRAPHQL_URL;
export const RPC_URL = CONFIG.RPC_URL;
export const NET_WORK = CONFIG.NET_WORK;
export const SEAL_SERVER_OBJECT_IDS = CONFIG.SEAL_SERVER_OBJECT_IDS;

// 合约对象类型（基于 PACKAGE_ID）
export const DIR_TYPE = PACKAGE_ID + "::coral_sync::Directory";
export const FILE_TYPE = PACKAGE_ID + "::coral_sync::File";
export const COLUMN_CAP_TYPE = PACKAGE_ID + "::coral_market::ColumnCap";
export const COLUMN_TYPE = PACKAGE_ID + "::coral_market::Column";
export const INSTALLMENT_TYPE = PACKAGE_ID + "::coral_market::Installment";
export const UPDATE_TYPE = PACKAGE_ID + "::coral_market::UpdateMethod";
export const PAYMENT_TYPE = PACKAGE_ID + "::coral_market::PaymentMethod";
export const SUBSCRIPTION_TYPE = PACKAGE_ID + "::coral_market::SubscriptionCap";

// UI 功能配置
// 是否显示订阅统计数据（订阅者数量等）
// 设置为 false 可以在打包时移除订阅统计相关的 UI
export const SHOW_SUBSCRIPTION_STATS = false;

// 导出当前环境信息（用于调试）
export const CURRENT_ENV = ENV;
