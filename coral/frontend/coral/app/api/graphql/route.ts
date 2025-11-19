import { NextRequest, NextResponse } from 'next/server';
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { GRAPHQL_URL } from "@/constants";

/**
 * GraphQL API 代理路由
 * 
 * 这个路由作为服务器端代理，用于：
 * 1. 避免浏览器 CORS 限制
 * 2. 提供备用端点重试逻辑
 * 3. 统一错误处理
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const urls = [GRAPHQL_URL];
    let lastError: Error | null = null;

    // 尝试使用多个 GraphQL 端点
    for (const url of urls) {
      try {
        console.log(`[GraphQL Proxy] 尝试端点: ${url}`);
        const suiGraphQLClient = new SuiGraphQLClient({ url });
        
        const result = await suiGraphQLClient.query({
          query: body.query,
          variables: body.variables || {},
        });

        console.log(`[GraphQL Proxy] 成功获取数据，端点: ${url}`);
        return NextResponse.json(result);
      } catch (error) {
        console.error(`[GraphQL Proxy] 端点 ${url} 失败:`, error);
        lastError = error as Error;
        // 继续尝试下一个端点
        continue;
      }
    }

    // 如果所有端点都失败了
    console.error('[GraphQL Proxy] 所有端点都失败了');
    return NextResponse.json(
      { 
        error: '无法连接到 GraphQL 服务',
        details: lastError?.message || 'Unknown error'
      },
      { status: 503 }
    );
  } catch (error) {
    console.error('[GraphQL Proxy] 请求处理错误:', error);
    return NextResponse.json(
      { 
        error: '服务器内部错误',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

