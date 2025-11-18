import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { graphql } from "@mysten/sui/graphql/schemas/latest";
import {
  COLUMN_CAP_TYPE,
  COLUMN_CAP_TYPE_OLD,
  INSTALLMENT_TYPE,
  INSTALLMENT_TYPE_OLD,
  UPDATE_TYPE,
  UPDATE_TYPE_OLD,
  PAYMENT_TYPE,
  PAYMENT_TYPE_OLD,
  SUBSCRIPTION_TYPE,
  GRAPHQL_URL,
  COLUMN_TYPE,
  COLUMN_TYPE_OLD,
} from "@/constants";
import {
  ColumnCap,
  ColumnOtherInfo,
  Installment,
  UpdateMethod,
  PaymentMethod,
  InstallmentWithFiles,
  Subscription,
  File,
} from "@/shared/data";
import {
  queryByAddressAndType,
  queryByAddress,
  getObjectsByType,
  queryObjectsByIds,
} from "@/contract/coral_server";
import { Transaction } from '@mysten/sui/transactions';

// 获取我的订阅
export async function getMySubscriptions(
  address: string
): Promise<Array<Subscription>> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: GRAPHQL_URL });
  const type = SUBSCRIPTION_TYPE;
  let endCursor: string | null | undefined = null;

  const parseSubscriptionData = (data: any) => {
    return (
      data?.address?.objects?.edges.map((edge: any) => {
        const json = edge.node.contents?.json;
        return {
          id: json.id,
          column_id: json.column_id,
          created_at: new Date(parseInt(json.created_at)),
          sub_start_time: new Date(parseInt(json.sub_start_time)),
          column: {} as ColumnOtherInfo,
        } as Subscription;
      }) || []
    );
  };

  const result: Subscription[] = [];
  let hasNextPage = false;

  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { address, type, cursor: endCursor },
    });
    let subCap = parseSubscriptionData(currentPage.data);
    result.push(...subCap);

    const columnIds = subCap.map((c: Subscription) => c.column_id);
    const otherInfos = await getColumnsByIds(columnIds);
    for (const otherInfo of otherInfos) {
      const subscription = result.find((c) => c.column_id === otherInfo.id);
      if (subscription) {
        subscription.column = otherInfo;
      }
    }

    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  return result;
}

// 获取所有专栏
export async function getAllColumns(): Promise<Array<ColumnOtherInfo>> {
  try {
    let data: any;

    // 在浏览器环境中，使用 API 代理避免 CORS 问题
      // 在服务器端，直接使用 GraphQL 客户端
      console.log('服务器端直接查询 GraphQL');
      const urls = [GRAPHQL_URL];
      let lastError: Error | null = null;

      for (const url of urls) {
        try {
          const suiGraphQLClient = new SuiGraphQLClient({ url });
          const result = await suiGraphQLClient.query({
            query: getObjectsByType,
            variables: { type: COLUMN_TYPE, limit: 20, cursor: null },
          });
          data = result.data;
          break;
        } catch (error) {
          console.error(`GraphQL 端点 ${url} 请求失败:`, error);
          lastError = error as Error;
          continue;
        }
      }

      if (!data) {
        throw lastError || new Error("无法连接到任何 GraphQL 端点");
      }

    console.log("getAllColumns data", data);

    let nodes = data?.objects?.nodes as any[];
    let ids = [];
    if (nodes && nodes.length > 0) {
      for (let i = 0; i < nodes.length; i++) {
        const json = nodes[i].asMoveObject?.contents?.json;
        if (json && json.id) {
          ids.push(json.id);
        }
      }
      return getColumnsByIds(ids);
    }
    return [];
  } catch (error) {
    console.error("getAllColumns 失败:", error);
    throw error;
  }
}

// 获取单个期刊
export async function getOneInstallment(
  id: string
): Promise<InstallmentWithFiles | null> {
  const objects = await queryObjectsByIds([id]);
  
  if (objects.length === 0) {
    return null;
  }

  const json = objects[0].json;
  const fileIds = json.files || [];

  let installment: InstallmentWithFiles = {
    id: json.id,
    belong_column: json.belong_column,
    no: json.no,
    files: [],
  };

  if (fileIds.length > 0) {
    const fileObjects = await queryObjectsByIds(fileIds);
    for (const fileObj of fileObjects) {
      const fileJson = fileObj.json;
      installment.files.push({
        id: fileJson.id,
        title: fileJson.title,
        belong_dir: fileJson.belong_dir,
        blob_id: fileJson.blob_id,
        end_epoch: fileJson.end_epoch,
        created_at: new Date(parseInt(fileJson.created_at)),
        updated_at: new Date(parseInt(fileJson.updated_at)),
        content: "",
      });
    }
  }

  return installment;
}

// 获取用户拥有的期刊（通过 Column ID，兼容新旧版本）
export async function getUserOwnedInstallments(
  columnId: string,
  userAddress?: string
): Promise<Array<Installment>> {
  let result: Installment[] = [];

  // 通过对象 ID 查询 Column（不依赖类型，兼容新旧版本）
  const objects = await queryObjectsByIds([columnId]);
  console.log("getUserOwnedInstallments objects", objects);

  let installmentIds: string[] = [];
  if (objects.length > 0) {
    const json = objects[0].json;
    console.log("getUserOwnedInstallments json", json);
    if (json && json.all_installment && Array.isArray(json.all_installment)) {
      // 确保所有 ID 都是字符串类型
      installmentIds = json.all_installment
        .map((id: any) => String(id).trim())
        .filter((id: string) => id.length > 0);
    }
  }

  // 如果从 Column 获取到了期刊 ID，直接通过对象 ID 查询
  if (installmentIds.length > 0) {
    console.log("getUserOwnedInstallments - 准备查询期刊 IDs:", installmentIds);
    const installmentObjects = await queryObjectsByIds(installmentIds);
    console.log("getUserOwnedInstallments - 查询到的期刊对象:", installmentObjects);
    console.log("getUserOwnedInstallments - 查询到的期刊对象数量:", installmentObjects.length);
    
    for (const obj of installmentObjects) {
      const installmentJson = obj.json;
      console.log("getUserOwnedInstallments - 检查期刊:", {
        id: installmentJson?.id,
        belong_column: installmentJson?.belong_column,
        columnId: columnId,
        match: installmentJson?.belong_column === columnId,
        no: installmentJson?.no,
        is_published: installmentJson?.is_published
      });
      
      if (installmentJson) {
        // 不检查 belong_column，因为我们已经通过 Column 的 all_installment 获取了这些 ID
        result.push({
          id: installmentJson.id,
          belong_column: installmentJson.belong_column,
          no: installmentJson.no,
          files: installmentJson.files || [],
          is_published: installmentJson.is_published || false,
          published_at: installmentJson.published_at,
        });
      }
    }
    console.log("getUserOwnedInstallments - 最终结果:", result);
  } else {
    // 如果没有从 Column 获取到期刊 ID，尝试通过类型查询（需要用户地址）
    if (userAddress) {
      console.log(`Column ${columnId} 中未找到期刊 ID，尝试通过类型查询用户 ${userAddress} 的所有期刊`);
      result = await getAllInstallmentsByColumnId(columnId, userAddress);
    } else {
      console.warn(`无法从 Column ${columnId} 获取期刊列表，且未提供用户地址，无法通过类型查询`);
    }
  }

  return result;
}

// 通过类型查询所有期刊，然后过滤出属于指定 Column 的（兼容新旧版本）
// 注意：这个函数需要用户地址来查询，如果 Column 查询失败时使用
async function getAllInstallmentsByColumnId(
  columnId: string,
  userAddress?: string
): Promise<Array<Installment>> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: GRAPHQL_URL });
  const result: Installment[] = [];

  // 如果没有用户地址，无法通过类型查询，返回空数组
  if (!userAddress) {
    return result;
  }

  const parseInstallmentData = (data: any, columnId: string) => {
    return (
      data?.address?.objects?.edges
        ?.map((edge: any) => {
          const json = edge.node.contents?.json;
          // 只返回属于指定 Column 的期刊
          if (json && json.belong_column === columnId) {
            return {
              id: json.id,
              belong_column: json.belong_column,
              no: json.no,
              files: json.files || [],
              is_published: json.is_published || false,
              published_at: json.published_at,
            } as Installment;
          }
          return null;
        })
        .filter((item: Installment | null) => item !== null) || []
    );
  };

  // 查询新版本的期刊
  let endCursor: string | null | undefined = null;
  let hasNextPage = false;
  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { 
        address: userAddress,
        type: INSTALLMENT_TYPE, 
        cursor: endCursor 
      },
    });
    result.push(...parseInstallmentData(currentPage.data, columnId));
    
    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 查询旧版本的期刊
  endCursor = null;
  hasNextPage = false;
  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { 
        address: userAddress,
        type: INSTALLMENT_TYPE_OLD, 
        cursor: endCursor 
      },
    });
    result.push(...parseInstallmentData(currentPage.data, columnId));
    
    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 去重（基于对象 ID）
  const uniqueResult = Array.from(
    new Map(result.map((inst) => [inst.id, inst])).values()
  );

  return uniqueResult;
}

// 获取用户拥有的专栏（同时查询新旧版本）
export async function getUserOwnedColumns(
  address: string
): Promise<Array<ColumnCap>> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: GRAPHQL_URL });
  const result: ColumnCap[] = [];

  const parseColumnData = (data: any) => {
    return (
      data?.address?.objects?.edges.map((edge: any) => {
        const json = edge.node.contents?.json;
        return {
          id: json.id,
          name: json.name,
          description: json.description,
          column_id: json.column_id,
          link: json.link,
          image_url: json.image_url,
          project_url: json.project_url,
          creator: json.creator,
          other: {
            update_method: null,
            payment_method: null,
          } as ColumnOtherInfo,
          created_at: new Date(parseInt(json.created_at)),
        } as ColumnCap;
      }) || []
    );
  };

  // 查询新版本的专栏
  let endCursor: string | null | undefined = null;
  let hasNextPage = false;

  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { address, type: COLUMN_CAP_TYPE, cursor: endCursor },
    });
    let columnCap = parseColumnData(currentPage.data);
    result.push(...columnCap);

    const columnIds = columnCap.map((c: ColumnCap) => c.column_id);
    const otherInfos = await getColumnsByIds(columnIds);
    for (const otherInfo of otherInfos) {
      const columnCapItem = result.find((c) => c.column_id === otherInfo.id);
      if (columnCapItem) {
        columnCapItem.other = otherInfo;
      }
    }

    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 查询旧版本的专栏
  endCursor = null;
  hasNextPage = false;

  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { address, type: COLUMN_CAP_TYPE_OLD, cursor: endCursor },
    });
    let columnCap = parseColumnData(currentPage.data);
    result.push(...columnCap);

    const columnIds = columnCap.map((c: ColumnCap) => c.column_id);
    const otherInfos = await getColumnsByIds(columnIds);
    for (const otherInfo of otherInfos) {
      const columnCapItem = result.find((c) => c.column_id === otherInfo.id);
      if (columnCapItem) {
        columnCapItem.other = otherInfo;
      }
    }

    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 去重（基于对象 ID）
  const uniqueResult = Array.from(
    new Map(result.map((col) => [col.id, col])).values()
  );

  return uniqueResult;
}

export async function createColumn({
  address,
  name,
  desc,
  cover_img_url,
  plan_installment_number,
  is_rated,
  update_since_date,
  update_day_number,
  update_installment_number,
  pay_type,
  fee,
  subscription_time,
  
}: {
  address: string;
  name: string;
  desc: string;
  cover_img_url: string;
  plan_installment_number: string;
  is_rated: boolean;
  update_since_date: string;
  update_day_number: string;
  update_installment_number: string;
  pay_type: string;
  fee: number;
  subscription_time: string;
}, signAndExecuteTransaction: any) {
  try {
    const tx = new Transaction();
    tx.setSender(address);

    // ========= 1. create_payment_method =========
    // price (SUI) -> fee (最小单位，* 10^9)
    const priceNumber = Number(fee);
    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      toast({
        title: "Error",
        description: "Invalid price",
        variant: "destructive",
      });
      return;
    }
    const fee = BigInt(Math.round(priceNumber * 1e9));

    const payment = tx.moveCall({
      target: `${packageId}::coral_market::create_payment_method`,
      arguments: [
        tx.pure.u8(parseInt(pay_type, 10)), // pay_type: u8
        tx.pure.string("0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
        ), // 取你实际支持的 coin_type 字符串
        tx.pure.u64(9), // decimals
        tx.pure.u64(fee), // fee
        tx.pure.u64(parseInt(subscription_time, 10) || 0), // subscription_time
        tx.object(marketConfigId), // &MarketConfig
        tx.object(globalConfigId), // &GlobalConfig
      ],
    });

    // ========= 2. create_update_method =========
    const sinceMs = new Date(update_since_date).getTime(); // 毫秒
    if (!sinceMs || Number.isNaN(sinceMs)) {
      toast({
        title: "Error",
        description: "Invalid start date",
        variant: "destructive",
      });
      return;
    }

    const updateMethod = tx.moveCall({
      target: `${packageId}::perlite_market::create_update_method`,
      arguments: [
        tx.pure.u64(BigInt(sinceMs)), // since: u64 (ms)
        tx.pure.u64(parseInt(update_day_number, 10) || 0), // day_number
        tx.pure.u64(parseInt(update_installment_number, 10) || 0), // installment_number
        tx.object(globalConfigId), // &GlobalConfig
      ],
    });

    // ========= 3. create_column =========
    tx.moveCall({
      target: `${packageId}::perlite_market::create_column`,
      arguments: [
        tx.pure.string(name), // name
        tx.pure.string(desc), // desc
        tx.pure.string(cover_img_url), // cover_img_url
        tx.object(updateMethod), // UpdateMethod
        tx.object(payment), // PaymentMethod
        tx.pure.bool(is_rated), // is_rated
        tx.pure.u64(parseInt(plan_installment_number, 10) || 0), // plan_installment_number
        tx.object("0x6"), // Clock
        tx.object(globalConfigId), // &GlobalConfig
      ],
    });

    // ========= 4. 发送交易 =========
    signAndExecuteTransaction(
      { transaction: tx, chain },
      {
        onSuccess: (result) => {
          alert("Create successful: " + result.digest);
          setShowCreateModal(false);
          setTimeout(() => {
            window.location.reload();
          }, 800);
        },
        onError: (error) => {
          alert("Failed to create column. " + JSON.stringify(error));
          console.error("Transaction failed:", error);
        },
      },
    );
  } catch (error) {
    alert("Failed to create column. Please try again.");
    console.error("Failed to create column:", error);
  }
}

// 根据ID获取单个专栏详细信息
export async function getColumnById(id: string): Promise<ColumnOtherInfo | null> {
  const columns = await getColumnsByIds([id]);
  return columns.length > 0 ? columns[0] : null;
}

// 根据ID数组获取专栏详细信息
async function getColumnsByIds(ids: string[]): Promise<ColumnOtherInfo[]> {
  let result: ColumnOtherInfo[] = [];

  if (!ids || ids.length === 0) {
    return result;
  }

  try {
    const objects = await queryObjectsByIds(ids);

    let waitQueryIds: string[] = [];
    let colOtherInfoMap = new Map<string, ColumnOtherInfo>();

    // 第一次封装，拿到基本信息
    for (const obj of objects) {
      const json = obj.json;
      if (!json) continue;

      let colOtherInfo = {
        id: json.id,
        name: json.name,
        desc: json.desc,
        cover_img_url: json.cover_img_url,
        update_method: null,
        payment_method: null,
        plan_installment_number: parseInt(json.plan_installment_number) || 0,
        all_installment: [],
        all_installment_ids: json.all_installment || [],
        balance: json.balance?.value ? parseInt(json.balance.value) : 0,
        is_rated: json.is_rated || false,
        status: parseInt(json.status) || 0,
        subscriptions: json.subscriptions
          ? parseInt(json.subscriptions?.size || "0")
          : 0,
        update_at: new Date(parseInt(json.updated_at)),
        creator: json.creator,
      } as ColumnOtherInfo;

      result.push(colOtherInfo);

      // 收集需要查询的ID，确保都是字符串类型
      if (json.update_method) {
        const updateMethodId = String(json.update_method).trim();
        if (updateMethodId) {
          colOtherInfoMap.set(updateMethodId, colOtherInfo);
          waitQueryIds.push(updateMethodId);
        }
      }
      if (json.payment_method) {
        const paymentMethodId = String(json.payment_method).trim();
        if (paymentMethodId) {
          colOtherInfoMap.set(paymentMethodId, colOtherInfo);
          waitQueryIds.push(paymentMethodId);
        }
      }
      if (json.all_installment && Array.isArray(json.all_installment)) {
        json.all_installment.forEach((i: any) => {
          const installmentId = String(i).trim();
          if (installmentId) {
            colOtherInfoMap.set(installmentId, colOtherInfo);
            waitQueryIds.push(installmentId);
          }
        });
      }
    }

    // 第二次封装，拿到update_method和payment_method
    if (waitQueryIds.length > 0) {
      const otherObjects = await queryObjectsByIds(waitQueryIds);

      for (const obj of otherObjects) {
        const type = obj.type;
        const json = obj.json;
        if (!json) continue;

        if (type === UPDATE_TYPE || type === UPDATE_TYPE_OLD) {
          let otherInfo = colOtherInfoMap.get(json.id);
          if (otherInfo) {
            otherInfo.update_method = {
              id: json.id,
              since: new Date(parseInt(json.since)),
              day_number: json.day_number,
              installment_number: json.installment_number,
            };
          }
        } else if (type === PAYMENT_TYPE || type === PAYMENT_TYPE_OLD) {
          let otherInfo = colOtherInfoMap.get(json.id);
          if (otherInfo) {
            otherInfo.payment_method = {
              id: json.id,
              pay_type: json.pay_type,
              coin_type: json.coin_type,
              decimals: json.decimals,
              fee: json.fee / 1000000000, // 转换为SUI单位
              subscription_time: json.subscription_time,
            };
          }
        } else if (type === INSTALLMENT_TYPE || type === INSTALLMENT_TYPE_OLD) {
          // 兼容新旧版本的 Installment 类型
          let otherInfo = colOtherInfoMap.get(json.id);
          if (otherInfo) {
            otherInfo.all_installment.push({
              id: json.id,
              belong_column: json.belong_column,
              no: json.no,
              files: json.files || [],
              is_published: json.is_published || false,
              published_at: json.published_at,
            });
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error("Failed to fetch columns:", error);
    return [];
  }
}

// 添加期刊（支持1-7个文件）
export async function addInstallment({
  columnCapId,
  columnId,
  fileIds,
  packageId,
  globalConfigId,
  chain,
  signAndExecuteTransaction,
}: {
  columnCapId: string;
  columnId: string;
  fileIds: string[];
  packageId: string;
  globalConfigId: string;
  chain: string;
  signAndExecuteTransaction: any;
}) {
  if (!fileIds || fileIds.length === 0) {
    throw new Error("至少需要选择一个文件");
  }

  if (fileIds.length > 7) {
    throw new Error("一个期刊最多只能关联7个文件");
  }

  const tx = new Transaction();
  
  // 根据文件数量调用不同的合约函数
  const functionName = fileIds.length === 1
    ? "add_installment"
    : `add_installment_with_${fileIds.length}_files`;

  // 构建参数：column_cap, column, file1, file2, ..., clock, global_config
  const args: any[] = [
    tx.object(columnCapId), // column_cap: &ColumnCap
    tx.object(columnId), // column: &mut Column
  ];

  // 添加所有文件对象
  fileIds.forEach((fileId) => {
    args.push(tx.object(fileId)); // file: &mut File
  });

  // 添加 clock 和 global_config
  args.push(tx.object("0x6")); // clock: &Clock
  args.push(tx.object(globalConfigId)); // global_config: &GlobalConfig

  tx.moveCall({
    target: `${packageId}::coral_market::${functionName}`,
    arguments: args,
  });

  return new Promise((resolve, reject) => {
    signAndExecuteTransaction(
      { transaction: tx, chain },
      {
        onSuccess: (result: any) => {
          resolve(result);
        },
        onError: (error: any) => {
          reject(error);
        },
      }
    );
  });
}

// 向期刊添加文件
export async function addFileToInstallment({
  fileId,
  installmentId,
  packageId,
  signAndExecuteTransaction,
  chain,
}: {
  fileId: string;
  installmentId: string;
  packageId: string;
  chain: string;
  signAndExecuteTransaction: any;
}) {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${packageId}::coral_market::add_file_to_installment`,
    arguments: [
      tx.object(fileId), // file: &mut File
      tx.object(installmentId), // installment: &mut Installment
    ],
  });

  return new Promise((resolve, reject) => {
    signAndExecuteTransaction(
      { transaction: tx, chain },
      {
        onSuccess: (result: any) => {
          resolve(result);
        },
        onError: (error: any) => {
          reject(error);
        },
      }
    );
  });
}

// 发布期刊
export async function publishInstallment({
  columnCapId,
  columnId,
  installmentId,
  packageId,
  chain,
  signAndExecuteTransaction,
}: {
  columnCapId: string;
  columnId: string;
  installmentId: string;
  packageId: string;
  chain: string;
  signAndExecuteTransaction: any;
}) {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${packageId}::coral_market::publish_installment`,
    arguments: [
      tx.object(columnCapId), // column_cap: &ColumnCap
      tx.object(columnId), // column: &mut Column
      tx.object(installmentId), // installment: &mut Installment
      tx.object("0x6"), // clock: &Clock
    ],
  });

  return new Promise((resolve, reject) => {
    signAndExecuteTransaction(
      { transaction: tx, chain },
      {
        onSuccess: (result: any) => {
          resolve(result);
        },
        onError: (error: any) => {
          reject(error);
        },
      }
    );
  });
}

