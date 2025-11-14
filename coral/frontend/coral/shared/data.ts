// Coral 数据类型定义

// 目录类型
export interface Directory {
  id: string;
  name: string;
  parent: string;
  is_root: boolean;
  created_at: Date;
  updated_at: Date;
}

// 文件类型
export interface File {
  id: string;
  title: string;
  belong_dir: string;
  blob_id: string;
  end_epoch: number;
  created_at: Date;
  updated_at: Date;
  content?: string;
  belong_installment?: string;
}

// 更新方式
export interface UpdateMethod {
  id: string;
  since: Date;
  day_number: number;
  installment_number: number;
}

// 支付方式
export interface PaymentMethod {
  id: string;
  pay_type: number; // 0买断，1质押, 2订阅
  coin_type: string;
  decimals: number;
  fee: number; // 目前只支持sui,精度9位
  subscription_time: number; // 订阅时长，用于支持质押模式和订阅模式，单位天
}

// 期刊类型
export interface Installment {
  id: string;
  belong_column: string;
  no: number;
  files: string[];
  is_published?: boolean;
  published_at?: number;
}

// 带文件的期刊类型
export interface InstallmentWithFiles {
  id: string;
  belong_column: string;
  no: number;
  files: File[];
}

// 专栏其他信息
export interface ColumnOtherInfo {
  id: string;
  name: string;
  desc: string;
  cover_img_url: string;
  update_method: UpdateMethod | null;
  payment_method: PaymentMethod | null;
  plan_installment_number: number; // 计划期数
  all_installment: Installment[];
  all_installment_ids: string[];
  balance: number;
  is_rated: boolean;
  status: number; // 0: 未发布, 1: 已发布, 2: 已下架
  subscriptions: number; // 订阅者数量
  update_at: Date;
  creator: string;
}

// 专栏Cap（NFT）
export interface ColumnCap {
  id: string;
  created_at: Date;
  column_id: string;
  name: string;
  description: string;
  link: string;
  image_url: string;
  project_url: string;
  creator: string;
  other: ColumnOtherInfo;
}

// 订阅Cap
export interface Subscription {
  id: string;
  column_id: string;
  created_at: Date;
  sub_start_time: Date;
  column: ColumnOtherInfo;
}

