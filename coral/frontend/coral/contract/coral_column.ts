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
} from "@/contract/coral_server";

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
  const suiGraphQLClient = new SuiGraphQLClient({ url: GRAPHQL_URL });
  const { data } = await suiGraphQLClient.query({
    query: queryByAddress,
    variables: { ids: [id] },
  });

  let edges = data?.objects?.edges as any[];
  let fileIds = [];

  if (edges && edges.length > 0) {
    const json = edges[0].node.asMoveObject?.contents?.json;
    fileIds.push(...json.files);

    let installment: InstallmentWithFiles = {
      id: json.id,
      belong_column: json.belong_column,
      no: json.no,
      files: [],
    };

    const { data: fileData } = await suiGraphQLClient.query({
      query: queryByAddress,
      variables: { ids: fileIds },
    });

    let fileEdges = fileData?.objects?.edges as any[];
    for (const edge of fileEdges) {
      const fileJson = edge.node.asMoveObject?.contents?.json;
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

    return installment;
  }

  return null;
}

// 获取用户拥有的期刊
export async function getUserOwnedInstallments(
  columnId: string
): Promise<Array<Installment>> {
  let result: Installment[] = [];
  const suiGraphQLClient = new SuiGraphQLClient({ url: GRAPHQL_URL });

  const { data } = await suiGraphQLClient.query({
    query: queryByAddress,
    variables: { ids: [columnId] },
  });

  let edges = data?.objects?.edges as any[];
  let installmentIds = [];

  if (edges && edges.length > 0) {
    const json = edges[0].node.asMoveObject?.contents?.json;
    installmentIds.push(...json.all_installment);

    const { data: installmentData } = await suiGraphQLClient.query({
      query: queryByAddress,
      variables: { ids: installmentIds },
    });

    let installmentEdges = installmentData?.objects?.edges as any[];
    for (const edge of installmentEdges) {
      const installmentJson = edge.node.asMoveObject?.contents?.json;
      result.push({
        id: installmentJson.id,
        belong_column: installmentJson.belong_column,
        no: installmentJson.no,
        files: installmentJson.files,
        is_published: installmentJson.is_published,
        published_at: installmentJson.published_at,
      });
    }
  }

  return result;
}

// 获取用户拥有的专栏
export async function getUserOwnedColumns(
  address: string
): Promise<Array<ColumnCap>> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: GRAPHQL_URL });
  const type = COLUMN_CAP_TYPE;

  let endCursor: string | null | undefined = null;
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

  let hasNextPage = false;

  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { address, type, cursor: endCursor },
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

  return result;
}

// 根据ID数组获取专栏详细信息
async function getColumnsByIds(ids: string[]): Promise<ColumnOtherInfo[]> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: GRAPHQL_URL });
  let result: ColumnOtherInfo[] = [];

  if (!ids || ids.length === 0) {
    return result;
  }

  try {
    const { data } = await suiGraphQLClient.query({
      query: queryByAddress,
      variables: { ids },
    });

    let waitQueryIds: string[] = [];
    let colOtherInfoMap = new Map<string, ColumnOtherInfo>();

    // 第一次封装，拿到基本信息
    for (const edge of (data?.objects?.edges as any[]) || []) {
      const json = edge.node.asMoveObject?.contents?.json;
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

      // 收集需要查询的ID
      if (json.update_method) {
        colOtherInfoMap.set(json.update_method, colOtherInfo);
        waitQueryIds.push(json.update_method);
      }
      if (json.payment_method) {
        colOtherInfoMap.set(json.payment_method, colOtherInfo);
        waitQueryIds.push(json.payment_method);
      }
      if (json.all_installment) {
        json.all_installment?.forEach((i: string) => {
          colOtherInfoMap.set(i, colOtherInfo);
          waitQueryIds.push(i);
        });
      }
    }

    // 第二次封装，拿到update_method和payment_method
    if (waitQueryIds.length > 0) {
      const { data: otherDatas } = await suiGraphQLClient.query({
        query: queryByAddress,
        variables: { ids: waitQueryIds },
      });

      for (const edge of (otherDatas?.objects?.edges as any[]) || []) {
        const type = edge.node.asMoveObject?.contents?.type.repr;
        const json = edge.node.asMoveObject?.contents?.json;
        if (!json) continue;

        if (type === UPDATE_TYPE) {
          let otherInfo = colOtherInfoMap.get(json.id);
          if (otherInfo) {
            otherInfo.update_method = {
              id: json.id,
              since: new Date(parseInt(json.since)),
              day_number: json.day_number,
              installment_number: json.installment_number,
            };
          }
        } else if (type === PAYMENT_TYPE) {
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
        } else if (type === INSTALLMENT_TYPE) {
          let otherInfo = colOtherInfoMap.get(json.id);
          if (otherInfo) {
            otherInfo.all_installment.push({
              id: json.id,
              belong_column: json.belong_column,
              no: json.no,
              files: json.files,
              is_published: json.is_published,
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

