import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { graphql } from "@mysten/sui/graphql/schemas/latest";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { DIR_TYPE, FILE_TYPE, DIR_TYPE_OLD, FILE_TYPE_OLD, GRAPHQL_URL, PACKAGE_ID, NET_WORK, RPC_URL } from "@/constants";
import { Directory, File } from "@/shared/data";

// GraphQL 查询定义
export const getObjectsByType = graphql(`
  query GetObjectsByType($type: String!, $cursor: String, $limit: Int) {
    objects(filter: { type: $type }, first: $limit, after: $cursor) {
      nodes {
        asMoveObject {
          contents {
            json
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`);

// 通过对象 ID 查询单个或多个对象（使用 JSON-RPC API）
// 使用 sui_multiGetObjects 批量查询对象，这是 Sui 官方推荐的查询方式
// 参考文档: https://docs.sui.io/sui-api-ref#sui_multiGetObjects
export async function queryObjectsByIds(
  ids: string[],
  rpcUrl?: string
): Promise<Array<{ type: string; json: any }>> {
  if (!ids || ids.length === 0) {
    return [];
  }

  // 过滤和验证 ID，确保所有值都是有效的字符串
  // 支持字符串数组或对象数组（对象需要有 id 属性）
  const validIds = ids
    .map((id) => {
      // 如果是对象，提取 id 字段
      if (id && typeof id === "object" && "id" in id) {
        return String((id as any).id).trim();
      }
      // 如果是字符串，直接使用
      if (typeof id === "string") {
        return id.trim();
      }
      // 其他情况转换为字符串
      return id != null ? String(id).trim() : "";
    })
    .filter((id) => id.length > 0);

  if (validIds.length === 0) {
    console.warn("queryObjectsByIds: No valid IDs provided", ids);
    return [];
  }

  // 使用明确的 RPC URL，格式: https://fullnode.NETWORK.sui.io:443
  const client = new SuiClient({
    url: rpcUrl || RPC_URL,
  });

  try {
    const responses = await client.multiGetObjects({
      ids: validIds,
      options: {
        showType: true,
        showContent: true,
      },
    });

    return responses
      .filter((response) => {
        // 过滤掉错误响应和没有数据的响应
        if (!response.data || !response.data.content) {
          return false;
        }
        // 只处理 MoveObject 类型的内容（有 fields 属性）
        return "fields" in response.data.content;
      })
      .map((response) => {
        const content = response.data!.content as { type: string; fields: any };
        // 使用 response.data.type 或 content.type 作为类型
        const objectType = response.data!.type || content.type || "";
        return {
          type: objectType,
          json: content.fields,
        };
      });
  } catch (error) {
    console.error("Failed to query objects by IDs:", error);
    throw error;
  }
}

// GraphQL 查询（保留作为备用）
export const queryByAddress = graphql(`
  query GetObjectsByIDs($ids: [SuiAddress!]!) {
    objects(objectIds: $ids) {
      nodes {
        asMoveObject {
          contents {
            type {
              repr
            }
            json
          }
        }
      }
    }
  }
`);

export const queryByAddressAndType = graphql(`
  query ($address: SuiAddress!, $type: String!, $cursor: String) {
    address(address: $address) {
      objects(filter: { type: $type }, first: 50, after: $cursor) {
        edges {
          node {
            contents {
              json
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`);

// 获取用户拥有的目录（同时查询新旧版本）
export async function getUserOwnDirectory(
  address: string,
  graphqlUrl: string = GRAPHQL_URL
): Promise<Array<Directory>> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: graphqlUrl });
  const result: Directory[] = [];

  const parseDirData = (data: any) => {
    return (
      data?.address?.objects?.edges.map((edge: any) => {
        const json = edge.node.contents?.json;
        return {
          id: json.id,
          name: json.name,
          parent: json.parent,
          is_root: json.is_root,
          created_at: new Date(parseInt(json.created_at)),
          updated_at: new Date(parseInt(json.updated_at)),
        } as Directory;
      }) || []
    );
  };

  // 查询新版本的目录
  let endCursor: string | null | undefined = null;
  let hasNextPage = false;
  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { address, type: DIR_TYPE, cursor: endCursor },
    });
    result.push(...parseDirData(currentPage.data));

    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 查询旧版本的目录
  endCursor = null;
  hasNextPage = false;
  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { address, type: DIR_TYPE_OLD, cursor: endCursor },
    });
    result.push(...parseDirData(currentPage.data));

    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 去重（基于对象 ID）
  const uniqueResult = Array.from(
    new Map(result.map((dir) => [dir.id, dir])).values()
  );

  return uniqueResult;
}

// 获取用户拥有的文件（同时查询新旧版本）
export async function getUserOwnFile(
  address: string,
  graphqlUrl: string = GRAPHQL_URL
): Promise<Array<File>> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: graphqlUrl });
  const result: File[] = [];

  const parseFileData = (data: any) => {
    return (
      data?.address?.objects?.edges.map((edge: any) => {
        const json = edge.node.contents?.json;
        return {
          id: json.id,
          title: json.title,
          belong_dir: json.belong_dir,
          blob_id: json.blob_id,
          end_epoch: json.end_epoch,
          created_at: new Date(parseInt(json.created_at)),
          updated_at: new Date(parseInt(json.updated_at)),
        } as File;
      }) || []
    );
  };

  // 查询新版本的文件
  let endCursor: string | null | undefined = null;
  let hasNextPage = false;
  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { address, type: FILE_TYPE, cursor: endCursor },
    });

    result.push(...parseFileData(currentPage.data));

    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 查询旧版本的文件
  endCursor = null;
  hasNextPage = false;
  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { address, type: FILE_TYPE_OLD, cursor: endCursor },
    });

    result.push(...parseFileData(currentPage.data));

    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  // 去重（基于对象 ID）
  const uniqueResult = Array.from(
    new Map(result.map((file) => [file.id, file])).values()
  );

  return uniqueResult;
}

// 删除文件
export async function deleteFile({
  fileId,
  packageId,
  chain,
  signAndExecuteTransaction,
}: {
  fileId: string;
  packageId: string;
  chain: string;
  signAndExecuteTransaction: any;
}) {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${packageId}::coral_sync::delete_file`,
    arguments: [
      tx.object(fileId), // file: File
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

// 删除目录
export async function deleteDirectory({
  directoryId,
  packageId,
  chain,
  signAndExecuteTransaction,
}: {
  directoryId: string;
  packageId: string;
  chain: string;
  signAndExecuteTransaction: any;
}) {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${packageId}::coral_sync::delete_directory`,
    arguments: [
      tx.object(directoryId), // dir: Directory
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

