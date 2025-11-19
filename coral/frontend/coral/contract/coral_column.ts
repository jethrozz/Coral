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
import { MARKET_ID, GLOBAL_CONFIG_ID } from "@/constants";

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
    const subscriptions = parseSubscriptionData(currentPage.data);
    result.push(...subscriptions);
    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 收集所有 column_id，批量查询专栏详细信息
  const columnIds = result.map((sub) => {
    const columnId = typeof sub.column_id === 'string' ? sub.column_id : (sub.column_id as any)?.id || String(sub.column_id)
    return columnId
  }).filter((id) => id && id.length > 0)

  if (columnIds.length > 0) {
    // 批量查询专栏详细信息
    const columns = await getColumnsByIds(columnIds)
    const columnMap = new Map<string, ColumnOtherInfo>()
    columns.forEach((col) => {
      const colId = typeof col.id === 'string' ? col.id : (col.id as any)?.id || String(col.id)
      columnMap.set(colId, col)
    })

    // 填充订阅中的 column 信息
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

// 获取专栏的详细信息（包括更新方式、支付方式、所有期刊等）
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

    const json = objects[0].json;
    let installmentIds: string[] = [];

    // 确保 all_installment 是数组
    if (json.all_installment && Array.isArray(json.all_installment)) {
      // 确保所有 ID 都是字符串类型
      installmentIds = json.all_installment
        .map((id: any) => String(id).trim())
        .filter((id: string) => id.length > 0);
    }

    if (installmentIds.length === 0) {
      console.log("getUserOwnedInstallments - 专栏没有期刊");
      return [];
    }

    console.log("getUserOwnedInstallments - 准备查询期刊 IDs:", installmentIds);
    const installmentObjects = await queryObjectsByIds(installmentIds);
    console.log("getUserOwnedInstallments - 查询到的期刊对象:", installmentObjects);
    console.log("getUserOwnedInstallments - 查询到的期刊对象数量:", installmentObjects.length);

    const result: Installment[] = [];
    for (const obj of installmentObjects) {
      const json = obj.json;
      if (!json) continue;

      // 确保 ID 是字符串类型
      const installmentId = typeof json.id === 'string' ? json.id : (json.id as any)?.id || String(json.id)
      const belongColumnId = typeof json.belong_column === 'string' ? json.belong_column : (json.belong_column as any)?.id || String(json.belong_column)
      
      // 检查是否属于该专栏（虽然理论上应该都是，但为了安全还是检查一下）
      const columnIdToMatch = typeof columnId === 'string' ? columnId : (columnId as any)?.id || columnIdStr
      console.log("getUserOwnedInstallments - 检查期刊:", {
        id: installmentId,
        belong_column: belongColumnId,
        columnId: columnIdToMatch,
        match: belongColumnId === columnIdToMatch,
        no: json.no,
      });

      result.push({
        id: installmentId,
        belong_column: belongColumnId,
        no: parseInt(json.no) || 0,
        files: json.files || [],
        is_published: json.is_published || false,
        published_at: json.published_at,
      });
    }

    console.log("getUserOwnedInstallments - 最终结果:", result);
    return result;
  } catch (error) {
    console.error("getUserOwnedInstallments 失败:", error);
    // 如果出错，尝试使用 getAllInstallmentsByColumnId 作为后备方案
    const columnIdStr = typeof columnId === 'string' ? columnId : (columnId as any)?.id || String(columnId)
    return await getAllInstallmentsByColumnId(columnIdStr, address);
  }
}

// 根据专栏 ID 获取所有期刊（通过类型查询）
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
      variables: { type: INSTALLMENT_TYPE, limit: 20, cursor: endCursor },
    });
    const data = currentPage.data;
    const nodes = data?.objects?.nodes as any[];
    if (nodes && nodes.length > 0) {
      for (let i = 0; i < nodes.length; i++) {
        const json = nodes[i].asMoveObject?.contents?.json;
        if (json && json.belong_column) {
          const belongColumnId = typeof json.belong_column === 'string' ? json.belong_column : (json.belong_column as any)?.id || String(json.belong_column)
          const columnIdStr = typeof columnId === 'string' ? columnId : (columnId as any)?.id || String(columnId)
          if (belongColumnId === columnIdStr) {
            const installmentId = typeof json.id === 'string' ? json.id : (json.id as any)?.id || String(json.id)
            // 避免重复添加
            if (!result.find((r) => r.id === installmentId)) {
              result.push({
                id: installmentId,
                belong_column: belongColumnId,
                no: parseInt(json.no) || 0,
                files: json.files || [],
                is_published: json.is_published || false,
                published_at: json.published_at,
              });
            }
          }
        }
      }
    }
    endCursor = data?.objects?.pageInfo?.endCursor;
    hasNextPage = data?.objects?.pageInfo?.hasNextPage || false;
  } while (hasNextPage);

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
  console.log("getUserOwnedColumns - 收集到的 column_ids:", uniqueColumnIds);
  console.log("getUserOwnedColumns - ColumnCap 映射数量:", columnCapMap.size);

  // 根据 column_id 查询所有 Column 对象的详细信息
  const columnInfos = await getColumnsByIds(uniqueColumnIds);
  console.log("getUserOwnedColumns - 查询到的 Column 详细信息数量:", columnInfos.length);

  // 将 Column 的详细信息填充到 ColumnCap 中
  for (const columnInfo of columnInfos) {
    // 确保 columnInfo.id 是字符串类型
    const columnIdStr = typeof columnInfo.id === 'string' ? columnInfo.id : (columnInfo.id as any)?.id || String(columnInfo.id);
    const columnCap = columnCapMap.get(columnIdStr);
    if (columnCap) {
      const fullColumnCap: ColumnCap = {
        id: columnCap.id!,
        column_id: columnIdStr,
        name: columnInfo.name, // 从 Column 对象获取
        description: columnInfo.desc, // 从 Column 对象获取
        link: "", // ColumnCap 中可能没有，使用空字符串
        image_url: columnInfo.cover_img_url, // 从 Column 对象获取
        project_url: "", // ColumnCap 中可能没有，使用空字符串
        creator: columnInfo.creator, // 从 Column 对象获取
        created_at: columnCap.created_at!,
        other: columnInfo, // 完整的 ColumnOtherInfo
      };
      result.push(fullColumnCap);
    } else {
      console.warn(`getUserOwnedColumns - 未找到对应的 ColumnCap，column_id:`, columnInfo.id, `(类型: ${typeof columnInfo.id})`);
      console.log(`getUserOwnedColumns - columnCapMap keys:`, Array.from(columnCapMap.keys()));
    }
  }

  console.log("getUserOwnedColumns - 最终结果数量:", result.length);
  return result;
}

export async function getAllColumns(): Promise<Array<ColumnOtherInfo>> {
  try {
    const urls = [GRAPHQL_URL];
    let lastError: Error | null = null;
    const allIds: string[] = [];

    for (const url of urls) {
      try {
        const suiGraphQLClient = new SuiGraphQLClient({ url });
        let endCursor: string | null | undefined = null;
        let hasNextPage = false;

        do {
          const result: any = await suiGraphQLClient.query({
            query: getObjectsByType,
            variables: { type: COLUMN_TYPE, limit: 20, cursor: endCursor },
          });
          const data: any = result.data;
          const nodes = data?.objects?.nodes as any[];
          if (nodes && nodes.length > 0) {
            for (let i = 0; i < nodes.length; i++) {
              const json = nodes[i].asMoveObject?.contents?.json;
              if (json && json.id) {
                // 只收集已发布的专栏（status === 1）
                const status = parseInt(json.status) || 0;
                if (status === 1) {
                  const columnId = typeof json.id === 'string' ? json.id : (json.id as any)?.id || String(json.id);
                  // 避免重复添加
                  if (!allIds.includes(columnId)) {
                    allIds.push(columnId);
                  }
                }
              }
            }
          }
          endCursor = data?.objects?.pageInfo?.endCursor;
          hasNextPage = data?.objects?.pageInfo?.hasNextPage || false;
        } while (hasNextPage);

        break;
      } catch (error) {
        console.error(`GraphQL 端点 ${url} 请求失败:`, error);
        lastError = error as Error;
        continue;
      }
    }

    if (allIds.length === 0) {
      console.log("getAllColumns - 未找到已发布的专栏");
      return [];
    }

    console.log(`getAllColumns - 收集到的已发布专栏 IDs: ${allIds.length}`, allIds);

    const columns = await getColumnsByIds(allIds);
    // 再次过滤确保只返回已发布的专栏
    const publishedColumns = columns.filter((col) => col.status === 1);
    console.log(`getAllColumns - 查询到的专栏总数: ${columns.length}, 已发布: ${publishedColumns.length}`);
    return publishedColumns;
  } catch (error) {
    console.error("getAllColumns 失败:", error);
    throw error;
  }
}

// 根据ID获取单个专栏详细信息
export async function getColumnById(id: string): Promise<ColumnOtherInfo | null> {
  const columns = await getColumnsByIds([id]);
  return columns.length > 0 ? columns[0] : null;
}

// 根据ID获取单个期刊详细信息（包括文件列表）
export async function getOneInstallment(installmentId: string): Promise<InstallmentWithFiles | null> {
  try {
    const objects = await queryObjectsByIds([installmentId]);
    if (objects.length === 0 || !objects[0]?.json) {
      return null;
    }

    const json = objects[0].json;
    const installmentIdStr = typeof json.id === 'string' ? json.id : (json.id as any)?.id || String(json.id)
    const belongColumnId = typeof json.belong_column === 'string' ? json.belong_column : (json.belong_column as any)?.id || String(json.belong_column)

    // 查询文件列表
    const fileIds: string[] = [];
    if (json.files && Array.isArray(json.files)) {
      for (const fileId of json.files) {
        const id = typeof fileId === 'string' ? fileId : (fileId as any)?.id || String(fileId)
        if (id) {
          fileIds.push(id);
        }
      }
    }

    const files: File[] = [];
    if (fileIds.length > 0) {
      const fileObjects = await queryObjectsByIds(fileIds);
      for (const obj of fileObjects) {
        const fileJson = obj.json;
        if (!fileJson) continue;
        const fileId = typeof fileJson.id === 'string' ? fileJson.id : (fileJson.id as any)?.id || String(fileJson.id)
        files.push({
          id: fileId,
          title: fileJson.title || "",
          blob_id: fileJson.blob_id || "",
          belong_dir: fileJson.directory_id || fileJson.belong_dir || "",
          end_epoch: fileJson.end_epoch || 0,
          created_at: fileJson.created_at ? new Date(parseInt(fileJson.created_at)) : new Date(),
          updated_at: fileJson.updated_at ? new Date(parseInt(fileJson.updated_at)) : new Date(),
        });
      }
    }

    return {
      id: installmentIdStr,
      belong_column: belongColumnId,
      no: parseInt(json.no) || 0,
      files: files,
    };
  } catch (error) {
    console.error("getOneInstallment 失败:", error);
    return null;
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
  // 确保所有 ID 都是字符串类型
  const columnCapIdStr = typeof columnCapId === 'string' ? columnCapId : (columnCapId as any)?.id || String(columnCapId)
  const columnIdStr = typeof columnId === 'string' ? columnId : (columnId as any)?.id || String(columnId)
  
  if (!fileIds || fileIds.length === 0) {
    throw new Error("至少需要一个文件")
  }
  
  if (fileIds.length > 7) {
    throw new Error("一个期刊最多只能关联7个文件")
  }

  // 确保所有文件 ID 都是字符串类型
  const validFileIds = fileIds.map((id) => {
    if (typeof id === 'string') return id.trim()
    if (id && typeof id === 'object' && 'id' in id) {
      return String((id as any).id).trim()
    }
    return String(id).trim()
  }).filter((id) => id.length > 0)

  if (validFileIds.length === 0) {
    throw new Error("没有有效的文件 ID")
  }

  const tx = new Transaction();
  
  // 根据文件数量调用不同的 Move 函数
  const fileCount = validFileIds.length
  const fileObjects = validFileIds.map((id) => tx.object(id))
  
  if (fileCount === 1) {
    tx.moveCall({
      target: `${packageId}::coral_market::add_installment`,
      arguments: [
        tx.object(columnCapIdStr), // column_cap: &ColumnCap
        tx.object(columnIdStr), // column: &mut Column
        fileObjects[0], // file1: &mut File
        tx.object("0x6"), // clock: &Clock
        tx.object(globalConfigId), // global_config: &GlobalConfig
      ],
    });
  } else if (fileCount === 2) {
    tx.moveCall({
      target: `${packageId}::coral_market::add_installment_with_2_files`,
      arguments: [
        tx.object(columnCapIdStr),
        tx.object(columnIdStr),
        fileObjects[0],
        fileObjects[1],
        tx.object("0x6"),
        tx.object(globalConfigId),
      ],
    });
  } else if (fileCount === 3) {
    tx.moveCall({
      target: `${packageId}::coral_market::add_installment_with_3_files`,
      arguments: [
        tx.object(columnCapIdStr),
        tx.object(columnIdStr),
        fileObjects[0],
        fileObjects[1],
        fileObjects[2],
        tx.object("0x6"),
        tx.object(globalConfigId),
      ],
    });
  } else if (fileCount === 4) {
    tx.moveCall({
      target: `${packageId}::coral_market::add_installment_with_4_files`,
      arguments: [
        tx.object(columnCapIdStr),
        tx.object(columnIdStr),
        fileObjects[0],
        fileObjects[1],
        fileObjects[2],
        fileObjects[3],
        tx.object("0x6"),
        tx.object(globalConfigId),
      ],
    });
  } else if (fileCount === 5) {
    tx.moveCall({
      target: `${packageId}::coral_market::add_installment_with_5_files`,
      arguments: [
        tx.object(columnCapIdStr),
        tx.object(columnIdStr),
        fileObjects[0],
        fileObjects[1],
        fileObjects[2],
        fileObjects[3],
        fileObjects[4],
        tx.object("0x6"),
        tx.object(globalConfigId),
      ],
    });
  } else if (fileCount === 6) {
    tx.moveCall({
      target: `${packageId}::coral_market::add_installment_with_6_files`,
      arguments: [
        tx.object(columnCapIdStr),
        tx.object(columnIdStr),
        fileObjects[0],
        fileObjects[1],
        fileObjects[2],
        fileObjects[3],
        fileObjects[4],
        fileObjects[5],
        tx.object("0x6"),
        tx.object(globalConfigId),
      ],
    });
  } else if (fileCount === 7) {
    tx.moveCall({
      target: `${packageId}::coral_market::add_installment_with_7_files`,
      arguments: [
        tx.object(columnCapIdStr),
        tx.object(columnIdStr),
        fileObjects[0],
        fileObjects[1],
        fileObjects[2],
        fileObjects[3],
        fileObjects[4],
        fileObjects[5],
        fileObjects[6],
        tx.object("0x6"),
        tx.object(globalConfigId),
      ],
    });
  } else {
    throw new Error(`不支持的文件数量: ${fileCount}`)
  }

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
      tx.object(fileId), // file: File
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
  // 确保所有 ID 都是字符串类型
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
  // 确保所有 ID 都是字符串类型
  const columnIdStr = typeof columnId === 'string' ? columnId : (columnId as any)?.id || String(columnId)
  const paymentMethodIdStr = typeof paymentMethodId === 'string' ? paymentMethodId : (paymentMethodId as any)?.id || String(paymentMethodId)
  
  // 先查询 PaymentMethod 获取 fee
  const paymentMethodObjects = await queryObjectsByIds([paymentMethodIdStr])
  if (paymentMethodObjects.length === 0) {
    throw new Error("未找到支付方式")
  }
  const paymentMethod = paymentMethodObjects[0].json
  const feeAmount = BigInt(paymentMethod.fee) // fee 已经是最小单位（10^9）
  
  // 查询 Market 获取 cut 值（假设 cut 是 500，即 5%）
  // 为了简化，我们假设 cut 是 5%（500/10000）
  // 如果需要精确值，可以查询 Market 对象
  const MARKET_CUT = 500 // 5% = 500/10000
  const cutFeeAmount = (feeAmount * BigInt(MARKET_CUT)) / BigInt(10000)
  const subFeeAmount = feeAmount - cutFeeAmount
  
  const tx = new Transaction();
  
  // 拆分 SUI coin：先获取总金额，然后拆分为手续费和订阅费
  // 用户需要支付的总金额是 feeAmount
  // splitCoins 返回数组，第一个元素是拆分出的 coin
  const [totalCoin] = tx.splitCoins(tx.gas, [feeAmount])
  
  // 从 totalCoin 中拆分出手续费
  // splitCoins 会从源 coin 中移除指定金额，所以 totalCoin 剩余的就是 subFeeAmount
  const [cutFeeCoin] = tx.splitCoins(totalCoin, [cutFeeAmount])
  // totalCoin 现在剩余的就是 subFeeAmount，直接使用它作为订阅费
  const subFeeCoin = totalCoin
  
  tx.moveCall({
    target: `${packageId}::coral_market::subscription_column`,
    arguments: [
      tx.object(MARKET_ID), // market: &mut Market
      tx.object(columnIdStr), // column: &mut Column
      tx.object(paymentMethodIdStr), // payment_method: &PaymentMethod
      subFeeCoin, // fee: Coin<SUI> (订阅费)
      cutFeeCoin, // cut_fee: Coin<SUI> (手续费)
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
