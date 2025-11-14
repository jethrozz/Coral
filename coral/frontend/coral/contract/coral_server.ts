import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { graphql } from "@mysten/sui/graphql/schemas/latest";
import { DIR_TYPE, FILE_TYPE, GRAPHQL_URL } from "@/constants";
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

export const queryByAddress = graphql(`
  query GetObjectsByIDs($ids: [SuiAddress!]!) {
    objects(filter: { objectIds: $ids }) {
      edges {
        node {
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

// 获取用户拥有的目录
export async function getUserOwnDirectory(
  address: string,
  graphqlUrl: string = GRAPHQL_URL
): Promise<Array<Directory>> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: graphqlUrl });
  const type = DIR_TYPE;

  let endCursor: string | null | undefined = null;
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

  let hasNextPage = false;
  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { address, type, cursor: endCursor },
    });
    result.push(...parseDirData(currentPage.data));

    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  return result;
}

// 获取用户拥有的文件
export async function getUserOwnFile(
  address: string,
  graphqlUrl: string = GRAPHQL_URL
): Promise<Array<File>> {
  const suiGraphQLClient = new SuiGraphQLClient({ url: graphqlUrl });
  const type = FILE_TYPE;
  let endCursor: string | null | undefined = null;
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

  let hasNextPage = false;
  do {
    const currentPage: any = await suiGraphQLClient.query({
      query: queryByAddressAndType,
      variables: { address, type, cursor: endCursor },
    });

    result.push(...parseFileData(currentPage.data));

    endCursor = currentPage.data?.address?.objects?.pageInfo?.endCursor;
    hasNextPage = currentPage.data?.address?.objects?.pageInfo?.hasNextPage;
  } while (hasNextPage);

  return result;
}

