import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { graphql } from "@mysten/sui/graphql/schemas/latest";
import {
  COLUMN_CAP_TYPE,
  INSTALLMENT_TYPE,
  UPDATE_TYPE,
  PAYMENT_TYPE,
  SUBSCRIPTION_TYPE,
  GRAPHQL_URL,
  COLUMN_TYPE,
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
import { MARKET_ID, GLOBAL_CONFIG_ID, RPC_URL } from "@/constants";
import { SuiClient } from "@mysten/sui/client";

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
        // 确保 column_id 是字符串类型
        const columnId = typeof json.column_id === 'string' ? json.column_id : (json.column_id as any)?.id || String(json.column_id)
        return {
          id: json.id,
          column_id: columnId,
          created_at: new Date(parseInt(json.created_at)),
          sub_start_time: new Date(parseInt(json.sub_start_time)),
          column: {} as ColumnOtherInfo, // 稍后填充
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
    let subscriptions = parseSubscriptionData(currentPage.data);
    result.push(...subscriptions);

    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 收集所有 column_id
  const columnIds = result.map((sub) => sub.column_id);
  
  // 批量获取专栏详细信息
  if (columnIds.length > 0) {
    const columns = await getColumnsByIds(columnIds)
    const columnMap = new Map<string, ColumnOtherInfo>()
    columns.forEach((col) => {
      columnMap.set(col.id, col)
    })
    
    // 填充每个订阅的专栏信息
    result.forEach((sub) => {
      const columnId = typeof sub.column_id === 'string' ? sub.column_id : (sub.column_id as any)?.id || String(sub.column_id)
      const columnInfo = columnMap.get(columnId)
      if (columnInfo) {
        sub.column = columnInfo
      }
    })
  }

  return result;
}

export async function getColumnsByIds(
  ids: string[]
): Promise<Array<ColumnOtherInfo>> {
  if (!ids || ids.length === 0) {
    return [];
  }

  // 确保所有 ID 都是字符串类型
  const validIds = ids
    .map((id) => {
      if (id && typeof id === "object" && "id" in id) {
        return String((id as any).id).trim();
      }
      if (typeof id === "string") {
        return id.trim();
      }
      return id != null ? String(id).trim() : "";
    })
    .filter((id) => id.length > 0);

  if (validIds.length === 0) {
    console.warn("getColumnsByIds: No valid IDs provided", ids);
    return [];
  }

  console.log("getColumnsByIds - 查询专栏 IDs:", validIds);

  // 使用 RPC 查询专栏对象
  const columnObjects = await queryObjectsByIds(validIds);
  console.log("getColumnsByIds - 查询到的专栏对象数量:", columnObjects.length);

  const colOtherInfoMap = new Map<string, ColumnOtherInfo>();

  // 建立 update_method 和 payment_method ID 到 column ID 的映射
  const updateMethodToColumnMap = new Map<string, string>()
  const paymentMethodToColumnMap = new Map<string, string>()

  // 解析 Column 对象
  for (const obj of columnObjects) {
    const type = obj.type;
    const json = obj.json;
    if (!json) continue;

    if (type === COLUMN_TYPE) {
      // 确保 ID 是字符串类型
      const objectId = typeof json.id === 'string' ? json.id : (json.id as any)?.id || String(json.id)
      
      const colOtherInfo: ColumnOtherInfo = {
        id: objectId,
        name: json.name || "",
        desc: json.desc || "",
        cover_img_url: json.cover_img_url || "",
        creator: json.creator || "",
        update_at: json.updated_at ? new Date(parseInt(json.updated_at)) : new Date(parseInt(json.created_at || "0")),
        status: parseInt(json.status) || 0,
        subscriptions: json.subscriptions ? (typeof json.subscriptions === 'object' && 'size' in json.subscriptions ? json.subscriptions.size : 0) : 0,
        plan_installment_number: parseInt(json.plan_installment_number) || 0,
        all_installment: [],
        all_installment_ids: [],
        update_method: null,
        payment_method: null,
        balance: 0,
        is_rated: json.is_rated || false,
      };
      colOtherInfoMap.set(objectId, colOtherInfo);

      // 建立 update_method 和 payment_method 到 column 的映射
      if (json.update_method) {
        const updateMethodId = typeof json.update_method === 'string' ? json.update_method : (json.update_method as any)?.id || String(json.update_method)
        if (updateMethodId) {
          updateMethodToColumnMap.set(updateMethodId, objectId)
        }
      }
      if (json.payment_method) {
        const paymentMethodId = typeof json.payment_method === 'string' ? json.payment_method : (json.payment_method as any)?.id || String(json.payment_method)
        if (paymentMethodId) {
          paymentMethodToColumnMap.set(paymentMethodId, objectId)
        }
      }
    }
  }

  // 收集所有需要查询的相关对象 ID
  const allRelatedIds: string[] = [];
  for (const obj of columnObjects) {
    const json = obj.json;
    if (!json) continue;

    // 收集 update_method, payment_method, all_installment 的 ID
    if (json.update_method) {
      const updateMethodId = typeof json.update_method === 'string' ? json.update_method : (json.update_method as any)?.id || String(json.update_method)
      if (updateMethodId && !allRelatedIds.includes(updateMethodId)) {
        allRelatedIds.push(updateMethodId);
      }
    }
    if (json.payment_method) {
      const paymentMethodId = typeof json.payment_method === 'string' ? json.payment_method : (json.payment_method as any)?.id || String(json.payment_method)
      if (paymentMethodId && !allRelatedIds.includes(paymentMethodId)) {
        allRelatedIds.push(paymentMethodId);
      }
    }
    if (json.all_installment && Array.isArray(json.all_installment)) {
      for (const installmentId of json.all_installment) {
        const id = typeof installmentId === 'string' ? installmentId : (installmentId as any)?.id || String(installmentId)
        if (id && !allRelatedIds.includes(id)) {
          allRelatedIds.push(id);
        }
      }
    }
  }

  console.log("getColumnsByIds - 收集到的相关对象 IDs:", allRelatedIds.length);

  // 批量查询所有相关对象
  const otherObjects = await queryObjectsByIds(allRelatedIds);
  console.log("getColumnsByIds - 查询到的相关对象数量:", otherObjects.length);

  // 解析相关对象并填充到 ColumnOtherInfo 中
  for (const obj of otherObjects) {
    const type = obj.type;
    const json = obj.json;
    if (!json) continue;

    // 确保 ID 是字符串类型
    const objectId = typeof json.id === 'string' ? json.id : (json.id as any)?.id || String(json.id)

    if (type === UPDATE_TYPE) {
      // 通过映射找到对应的 column ID
      const columnId = updateMethodToColumnMap.get(objectId)
      if (columnId) {
        const otherInfo = colOtherInfoMap.get(columnId)
        if (otherInfo) {
          otherInfo.update_method = {
            id: objectId,
            since: new Date(parseInt(json.since)),
            day_number: json.day_number,
            installment_number: json.installment_number,
          };
        }
      }
    } else if (type === PAYMENT_TYPE) {
      // 通过映射找到对应的 column ID
      const columnId = paymentMethodToColumnMap.get(objectId)
      if (columnId) {
        const otherInfo = colOtherInfoMap.get(columnId)
        if (otherInfo) {
          otherInfo.payment_method = {
            id: objectId,
            pay_type: json.pay_type,
            coin_type: json.coin_type,
            decimals: json.decimals,
            fee: json.fee / 1000000000, // 转换为SUI单位
            subscription_time: json.subscription_time,
          };
        }
      }
    } else if (type === INSTALLMENT_TYPE) {
      const belongColumnId = typeof json.belong_column === 'string' ? json.belong_column : (json.belong_column as any)?.id || String(json.belong_column)
      const otherInfo = colOtherInfoMap.get(belongColumnId)
      if (otherInfo) {
        otherInfo.all_installment.push({
          id: objectId,
          belong_column: belongColumnId,
          no: json.no,
          files: json.files || [],
          is_published: json.is_published || false,
          published_at: json.published_at,
        });
      } else {
        console.warn(`getColumnsByIds - 未找到对应的 ColumnOtherInfo，installment ID: ${objectId}, belong_column: ${belongColumnId}`)
        console.log(`getColumnsByIds - colOtherInfoMap keys:`, Array.from(colOtherInfoMap.keys()))
      }
    }
  }

  // 为每个 ColumnOtherInfo 填充 all_installment_ids
  for (const [id, info] of colOtherInfoMap.entries()) {
    info.all_installment_ids = info.all_installment.map((i) => i.id);
  }

  return Array.from(colOtherInfoMap.values());
}

// 获取用户拥有的所有期刊（通过 Column 对象查询）
export async function getUserOwnedInstallments(
  columnId: string | { id: string },
  address: string
): Promise<Array<Installment>> {
  try {
    // 确保 columnId 是字符串类型
    const columnIdStr = typeof columnId === 'string' ? columnId : (columnId as any)?.id || String(columnId)
    
    console.log("getUserOwnedInstallments objects", [columnIdStr]);
    const objects = await queryObjectsByIds([columnIdStr]);
    console.log("getUserOwnedInstallments json", objects[0]?.json);

    if (objects.length === 0 || !objects[0]?.json) {
      console.warn("getUserOwnedInstallments - 未找到专栏对象");
      // 如果直接查询失败，尝试使用 getAllInstallmentsByColumnId
      return await getAllInstallmentsByColumnId(columnIdStr, address);
    }

    const columnJson = objects[0].json;
    const installmentIds = columnJson.all_installment || [];

    if (installmentIds.length === 0) {
      return [];
    }

    // 确保所有 ID 都是字符串类型
    const validInstallmentIds = installmentIds.map((id: any) => {
      if (typeof id === 'string') {
        return id.trim();
      }
      if (id && typeof id === 'object' && 'id' in id) {
        return String((id as any).id).trim();
      }
      return id != null ? String(id).trim() : "";
    }).filter((id: string) => id.length > 0);

    console.log("getUserOwnedInstallments - 查询期刊 IDs:", validInstallmentIds);

    // 批量查询所有期刊对象
    const installmentObjects = await queryObjectsByIds(validInstallmentIds);
    console.log("getUserOwnedInstallments - 查询到的期刊对象数量:", installmentObjects.length);

    // 解析期刊对象
    const installments: Installment[] = [];
    for (const obj of installmentObjects) {
      const json = obj.json;
      if (!json) continue;

      const installmentId = typeof json.id === 'string' ? json.id : (json.id as any)?.id || String(json.id)
      const belongColumnId = typeof json.belong_column === 'string' ? json.belong_column : (json.belong_column as any)?.id || String(json.belong_column)

      installments.push({
        id: installmentId,
        belong_column: belongColumnId,
        no: json.no || 0,
        files: json.files || [],
        is_published: json.is_published || false,
        published_at: json.published_at,
      });
    }

    // 按 no 排序
    installments.sort((a, b) => a.no - b.no);

    return installments;
  } catch (error) {
    console.error("getUserOwnedInstallments 失败:", error);
    throw error;
  }
}

// 获取所有期刊（通过 Column 对象查询，不限制用户）
export async function getAllInstallmentsByColumnId(
  columnId: string,
  address: string
): Promise<Array<Installment>> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: GRAPHQL_URL });
  const result: Installment[] = [];
  let endCursor: string | null | undefined = null;
  let hasNextPage = false;

  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: getObjectsByType,
      variables: { type: INSTALLMENT_TYPE, cursor: endCursor },
    });

    const edges = currentPage.data?.objects?.edges || [];
    for (const edge of edges) {
      const json = edge.node.asMoveObject?.contents?.json;
      if (!json) continue;

      const belongColumnId = typeof json.belong_column === 'string' ? json.belong_column : (json.belong_column as any)?.id || String(json.belong_column)
      if (belongColumnId === columnId) {
        const installmentId = typeof json.id === 'string' ? json.id : (json.id as any)?.id || String(json.id)
        result.push({
          id: installmentId,
          belong_column: belongColumnId,
          no: json.no || 0,
          files: json.files || [],
          is_published: json.is_published || false,
          published_at: json.published_at,
        });
      }
    }

    endCursor = currentPage.data?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 按 no 排序
  result.sort((a, b) => a.no - b.no);

  return result;
}

export async function getUserOwnedColumns(
  address: string
): Promise<Array<ColumnCap>> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: GRAPHQL_URL });
  const result: ColumnCap[] = [];

  // 解析 ColumnCap 对象（权限对象，只包含基本权限信息）
  const parseColumnCapData = (data: any) => {
    return (
      data?.address?.objects?.edges.map((edge: any) => {
        const json = edge.node.contents?.json;
        // 确保 ID 都是字符串类型
        const capId = typeof json.id === 'string' ? json.id : (json.id as any)?.id || String(json.id);
        const columnId = typeof json.column_id === 'string' ? json.column_id : (json.column_id as any)?.id || String(json.column_id);
        return {
          id: capId,
          column_id: columnId, // ColumnCap 中的 column_id 指向实际的 Column 对象
          creator: json.creator,
          created_at: new Date(parseInt(json.created_at)),
        } as Partial<ColumnCap>;
      }) || []
    );
  };

  let endCursor: string | null | undefined = null;
  let hasNextPage = false;
  const allColumnIds: string[] = [];
  const columnCapMap = new Map<string, Partial<ColumnCap>>();

  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { address, type: COLUMN_CAP_TYPE, cursor: endCursor },
    });
    let columnCaps = parseColumnCapData(currentPage.data);
    
    // 收集所有 column_id 并建立映射
    for (const cap of columnCaps) {
      if (cap.column_id) {
        allColumnIds.push(cap.column_id);
        if (cap.id) {
          // 如果同一个 column_id 有多个 ColumnCap，保留第一个
          if (!columnCapMap.has(cap.column_id)) {
            columnCapMap.set(cap.column_id, cap);
          }
        }
      }
    }

    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 去重 column_id
  const uniqueColumnIds = Array.from(new Set(allColumnIds));
  console.log("getUserOwnedColumns - 去重后的专栏 IDs:", uniqueColumnIds.length);

  // 批量获取专栏详细信息
  const columnInfos = await getColumnsByIds(uniqueColumnIds);
  console.log("getUserOwnedColumns - 获取到的专栏信息数量:", columnInfos.length);

  // 组合 ColumnCap 和 ColumnOtherInfo
  for (const columnInfo of columnInfos) {
    const cap = columnCapMap.get(columnInfo.id);
    if (cap) {
      result.push({
        id: cap.id!,
        column_id: columnInfo.id,
        created_at: cap.created_at!,
        name: columnInfo.name,
        description: columnInfo.desc,
        link: "",
        image_url: columnInfo.cover_img_url,
        project_url: "",
        creator: columnInfo.creator,
        other: columnInfo, // 完整的 ColumnOtherInfo
      });
    }
  }

  return result;
}

export async function getAllColumns(): Promise<Array<ColumnOtherInfo>> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: GRAPHQL_URL });
  const result: ColumnOtherInfo[] = [];
  let endCursor: string | null | undefined = null;
  let hasNextPage = false;
  const allIds: string[] = [];

  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: getObjectsByType,
      variables: { type: COLUMN_TYPE, cursor: endCursor },
    });

    // GraphQL 返回的是 nodes 而不是 edges
    const nodes = currentPage.data?.objects?.nodes || [];
    console.log("getAllColumns - 获取到的专栏对象:", currentPage);
    console.log("getAllColumns - nodes 数量:", nodes.length);

    for (const node of nodes) {
      const json = node.asMoveObject?.contents?.json;
      console.log("getAllColumns - 处理节点:", { hasJson: !!json, jsonId: json?.id });
      if (json && json.id) {
        const objectId = typeof json.id === 'string' ? json.id : (json.id as any)?.id || String(json.id)
        console.log("getAllColumns - 添加 ID:", objectId);
        allIds.push(objectId);
      }
    }

    endCursor = currentPage.data?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);
  console.log("getAllColumns - 收集到的专栏 IDs:", allIds.length);
  // 批量查询所有专栏
  const columns = await getColumnsByIds(allIds);
  console.log("getAllColumns - 获取到的专栏信息数量:", columns.length);
  return columns;
}

export async function getColumnById(id: string): Promise<ColumnOtherInfo | null> {
  const columns = await getColumnsByIds([id]);
  return columns.length > 0 ? columns[0] : null;
}

// 添加期刊（支持多个文件）
export async function addInstallment({
  columnCapId,
  columnId,
  fileIds,
  packageId,
  chain,
  signAndExecuteTransaction,
}: {
  columnCapId: string;
  columnId: string;
  fileIds: string[];
  packageId: string;
  chain: string;
  signAndExecuteTransaction: any;
}) {
  if (fileIds.length === 0) {
    throw new Error("至少需要一个文件");
  }

  if (fileIds.length > 7) {
    throw new Error("最多只能添加7个文件");
  }

  // 确保所有 ID 都是字符串类型
  const columnCapIdStr = typeof columnCapId === 'string' ? columnCapId : (columnCapId as any)?.id || String(columnCapId)
  const columnIdStr = typeof columnId === 'string' ? columnId : (columnId as any)?.id || String(columnId)
  const fileIdStrs = fileIds.map((id) => typeof id === 'string' ? id : (id as any)?.id || String(id))

  const tx = new Transaction();

  // 根据文件数量选择不同的函数
  const functionName = `add_installment${fileIds.length > 1 ? `_with_${fileIds.length}_files` : ''}`;
  
  // 构建参数：column_cap, column, file1, file2, ..., clock, global_config
  const args: any[] = [
    tx.object(columnCapIdStr),
    tx.object(columnIdStr),
  ];

  // 添加文件参数
  for (const fileId of fileIdStrs) {
    args.push(tx.object(fileId));
  }

  // 添加 clock 和 global_config
  args.push(tx.object("0x6")); // clock
  args.push(tx.object(GLOBAL_CONFIG_ID));

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

// 添加文件到期刊
export async function addFileToInstallment({
  fileId,
  installmentId,
  packageId,
  chain,
  signAndExecuteTransaction,
}: {
  fileId: string;
  installmentId: string;
  packageId: string;
  chain: string;
  signAndExecuteTransaction: any;
}) {
  const fileIdStr = typeof fileId === 'string' ? fileId : (fileId as any)?.id || String(fileId)
  const installmentIdStr = typeof installmentId === 'string' ? installmentId : (installmentId as any)?.id || String(installmentId)
  
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${packageId}::coral_sync::add_file_to_installment`,
    arguments: [
      tx.object(fileIdStr),
      tx.object(installmentIdStr),
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

// 发布专栏
export async function publishColumn({
  columnCapId,
  columnId,
  packageId,
  chain,
  signAndExecuteTransaction,
}: {
  columnCapId: string;
  columnId: string;
  packageId: string;
  chain: string;
  signAndExecuteTransaction: any;
}) {
  const columnCapIdStr = typeof columnCapId === 'string' ? columnCapId : (columnCapId as any)?.id || String(columnCapId)
  const columnIdStr = typeof columnId === 'string' ? columnId : (columnId as any)?.id || String(columnId)
  
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${packageId}::coral_market::publish_column`,
    arguments: [
      tx.object(columnCapIdStr), // column_cap: &ColumnCap
      tx.object(columnIdStr), // column: &mut Column
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
  // 确保所有 ID 都是字符串类型
  const columnCapIdStr = typeof columnCapId === 'string' ? columnCapId : (columnCapId as any)?.id || String(columnCapId)
  const columnIdStr = typeof columnId === 'string' ? columnId : (columnId as any)?.id || String(columnId)
  const installmentIdStr = typeof installmentId === 'string' ? installmentId : (installmentId as any)?.id || String(installmentId)
  
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${packageId}::coral_market::publish_installment`,
    arguments: [
      tx.object(columnCapIdStr), // column_cap: &ColumnCap
      tx.object(columnIdStr), // column: &mut Column
      tx.object(installmentIdStr), // installment: &mut Installment
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

// 获取单个期刊详情（包含文件列表）
export async function getOneInstallment(
  installmentId: string
): Promise<InstallmentWithFiles | null> {
  try {
    const objects = await queryObjectsByIds([installmentId]);
    if (objects.length === 0 || !objects[0]?.json) {
      return null;
    }

    const json = objects[0].json;
    const installmentIdStr = typeof json.id === 'string' ? json.id : (json.id as any)?.id || String(json.id)
    const belongColumnId = typeof json.belong_column === 'string' ? json.belong_column : (json.belong_column as any)?.id || String(json.belong_column)

    const fileIds = json.files || [];
    const files: File[] = [];

    if (fileIds.length > 0) {
      const fileObjects = await queryObjectsByIds(fileIds);
      for (const obj of fileObjects) {
        const fileJson = obj.json;
        if (!fileJson) continue;

        const fileId = typeof fileJson.id === 'string' ? fileJson.id : (fileJson.id as any)?.id || String(fileJson.id)
        const belongDirId = typeof fileJson.belong_dir === 'string' ? fileJson.belong_dir : (fileJson.belong_dir as any)?.id || String(fileJson.belong_dir)

        files.push({
          id: fileId,
          title: fileJson.title || "",
          belong_dir: belongDirId,
          blob_id: fileJson.blob_id || "",
          end_epoch: parseInt(fileJson.end_epoch) || 0,
          created_at: new Date(parseInt(fileJson.created_at)),
          updated_at: new Date(parseInt(fileJson.updated_at)),
        });
      }
    }

    return {
      id: installmentIdStr,
      belong_column: belongColumnId,
      no: json.no || 0,
      files: files,
    };
  } catch (error) {
    console.error("getOneInstallment 失败:", error);
    return null;
  }
}

// 获取专栏余额
export async function getColumnBalance(columnId: string): Promise<number> {
  const client = new SuiClient({ url: RPC_URL });
  
  try {
    const columnIdStr = typeof columnId === 'string' ? columnId : (columnId as any)?.id || String(columnId)
    
    // 使用 showContent 和 showBcs 选项来获取对象数据
    const response = await client.getObject({
      id: columnIdStr,
      options: {
        showContent: true,
        showBcs: true,
      },
    });

    if (!response.data || !response.data.content) {
      return 0;
    }

    const content = response.data.content;
    
    // 方法1: 尝试从 JSON fields 中获取 balance
    if ('fields' in content && content.fields) {
      const fields = content.fields as any;
      
      // 添加调试日志
      console.log("Column fields:", Object.keys(fields));
      console.log("Balance field:", fields.balance);
      console.log("Balance type:", typeof fields.balance);
      
      if (fields.balance !== undefined && fields.balance !== null) {
        let balanceValue: bigint | null = null;
        
        // Balance<SUI> 在 JSON 中可能显示为对象，包含 value 字段
        if (typeof fields.balance === 'object') {
          // 尝试多种可能的字段名
          if ('value' in fields.balance) {
            balanceValue = BigInt(fields.balance.value || 0);
          } else if ('fields' in fields.balance && fields.balance.fields && 'value' in fields.balance.fields) {
            balanceValue = BigInt(fields.balance.fields.value || 0);
          } else {
            // 如果对象只有一个数字属性，可能是 value
            const keys = Object.keys(fields.balance);
            if (keys.length === 1 && typeof fields.balance[keys[0]] === 'string') {
              balanceValue = BigInt(fields.balance[keys[0]]);
            }
          }
        } else if (typeof fields.balance === 'string') {
          // 如果 balance 是字符串格式的数字
          balanceValue = BigInt(fields.balance);
        } else if (typeof fields.balance === 'number') {
          balanceValue = BigInt(fields.balance);
        }
        
        if (balanceValue !== null) {
          const suiAmount = Number(balanceValue) / 1e9; // 转换为 SUI（精度9位）
          console.log("解析到的余额:", balanceValue.toString(), "SUI:", suiAmount);
          return suiAmount;
        }
      }
    }

    // 方法2: 如果 JSON 中没有，尝试从 BCS 解析
    if (response.data.bcs && typeof response.data.bcs === 'string') {
      try {
        // Column 对象的字段顺序：id, update_method, payment_method, name, desc, cover_img_url, 
        // all_installment, balance, is_rated, status, created_at, updated_at, plan_installment_number, 
        // subscriptions, creator
        // Balance 字段在 BCS 中的位置需要根据实际编码确定
        // 但更简单的方法是查找 balance 字段的 BCS 编码
        
        // 使用 @mysten/bcs 库来解码（如果可用）
        // 或者尝试从 JSON 中获取 balance 字段的索引位置
        
        // 简化方案：直接读取整个 BCS，查找 balance 字段
        // 由于 Column 是共享对象，BCS 编码比较复杂
        // 我们优先使用 JSON 方式
      } catch (parseError) {
        console.error("BCS 解析余额失败:", parseError);
      }
    }

    // 如果都失败了，返回 0
    console.warn("无法从 Column 对象中解析余额，返回 0");
    return 0;
  } catch (error) {
    console.error("获取专栏余额失败:", error);
    return 0;
  }
}

// 专栏管理员提款
export async function withdrawColumnBalance({
  columnCapId,
  columnId,
  packageId,
  chain,
  signAndExecuteTransaction,
}: {
  columnCapId: string;
  columnId: string;
  packageId: string;
  chain: string;
  signAndExecuteTransaction: any;
}) {
  const columnCapIdStr = typeof columnCapId === 'string' ? columnCapId : (columnCapId as any)?.id || String(columnCapId)
  const columnIdStr = typeof columnId === 'string' ? columnId : (columnId as any)?.id || String(columnId)
  
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${packageId}::coral_market::column_admin_withdraw`,
    arguments: [
      tx.object(columnCapIdStr), // column_cap: &ColumnCap
      tx.object(columnIdStr), // column: &mut Column
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

// 订阅专栏
export async function subscribeColumn({
  columnId,
  paymentMethodId,
  packageId,
  chain,
  signAndExecuteTransaction,
}: {
  columnId: string;
  paymentMethodId: string;
  packageId: string;
  chain: string;
  signAndExecuteTransaction: any;
}) {
  const columnIdStr = typeof columnId === 'string' ? columnId : (columnId as any)?.id || String(columnId)
  const paymentMethodIdStr = typeof paymentMethodId === 'string' ? paymentMethodId : (paymentMethodId as any)?.id || String(paymentMethodId)
  
  // 获取 payment_method 和 market 对象以计算费用
  const client = new SuiClient({ url: RPC_URL });
  const [paymentMethodObj, marketObj] = await Promise.all([
    client.getObject({
      id: paymentMethodIdStr,
      options: { showContent: true },
    }),
    client.getObject({
      id: MARKET_ID,
      options: { showContent: true },
    }),
  ]);

  if (!paymentMethodObj.data || !marketObj.data) {
    throw new Error("无法获取支付方式或市场信息");
  }

  const paymentMethodFields = (paymentMethodObj.data.content as any)?.fields;
  const marketFields = (marketObj.data.content as any)?.fields;

  if (!paymentMethodFields || !marketFields) {
    throw new Error("无法解析支付方式或市场信息");
  }

  // 获取费用和手续费比例
  const totalFee = BigInt(paymentMethodFields.fee || 0);
  const marketCut = BigInt(marketFields.cut || 1500); // 默认 15% (1500/10000)

  // 计算手续费和订阅费
  // cut_fee = totalFee * marketCut / 10000
  // fee = totalFee - cut_fee
  const cutFee = (totalFee * marketCut) / BigInt(10000);
  const subFee = totalFee - cutFee;

  const tx = new Transaction();

  // 获取 gas coin 并拆分为两个 coin
  const splitResult = tx.splitCoins(tx.gas, [cutFee, subFee]);
  
  // 第一个拆分出的 coin 作为手续费
  const cutFeeCoin = splitResult[0];
  // 第二个拆分出的 coin 作为订阅费
  const feeCoin = splitResult[1];

  tx.moveCall({
    target: `${packageId}::coral_market::subscription_column`,
    arguments: [
      tx.object(MARKET_ID), // market: &mut Market
      tx.object(columnIdStr), // column: &mut Column
      tx.object(paymentMethodIdStr), // payment_method: &PaymentMethod
      feeCoin, // fee: Coin<SUI>
      cutFeeCoin, // cut_fee: Coin<SUI>
      tx.object("0x6"), // clock: &Clock
      tx.object(GLOBAL_CONFIG_ID), // global_config: &GlobalConfig
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
