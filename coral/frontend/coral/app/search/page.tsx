"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { ColumnCard } from "@/components/column-card"
import { Input } from "@/components/ui/input"
import { Search, Loader2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useI18n } from "@/lib/i18n/context"
import { useCurrentAccount } from "@mysten/dapp-kit"
import { getAllColumns, getUserOwnedColumns, getColumnsByIds } from "@/contract/coral_column"
import { ColumnOtherInfo } from "@/shared/data"
import { SHOW_SUBSCRIPTION_STATS } from "@/constants"

type SearchType = "title" | "creator"

export default function SearchPage() {
  const { t, language } = useI18n()
  const currentAccount = useCurrentAccount()
  const [columns, setColumns] = useState<ColumnOtherInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchType, setSearchType] = useState<SearchType>("title")
  const [sortBy, setSortBy] = useState("price-low")

  // 根据搜索类型加载数据
  useEffect(() => {
    async function fetchColumns() {
      try {
        setLoading(true)
        
        if (searchType === "title") {
          // 标题搜索：获取所有专栏
          console.log("搜索页 - 标题搜索：开始获取所有专栏")
          const data = await getAllColumns()
          console.log("搜索页 - 标题搜索：获取到的专栏数量（过滤前）:", data.length)
          console.log("搜索页 - 标题搜索：专栏列表（过滤前）:", data.map(col => ({ id: col.id, name: col.name, status: col.status })))
          
          // 只显示已发布的专栏（status === 1）
          const publishedColumns = data.filter(col => col.status === 1)
          console.log("搜索页 - 标题搜索：已发布的专栏数量:", publishedColumns.length)
          setColumns(publishedColumns)
        } else if (searchType === "creator") {
          // 作者搜索：根据输入的地址获取该用户拥有的专栏
          if (!searchQuery.trim()) {
            // 如果没有输入查询，显示所有已发布的专栏（使用标题搜索的逻辑）
            console.log("搜索页 - 作者搜索（无输入）：开始获取所有专栏")
            const data = await getAllColumns()
            console.log("搜索页 - 作者搜索（无输入）：获取到的专栏数量（过滤前）:", data.length)
            
            // 只显示已发布的专栏（status === 1）
            const publishedColumns = data.filter(col => col.status === 1)
            console.log("搜索页 - 作者搜索（无输入）：已发布的专栏数量:", publishedColumns.length)
            setColumns(publishedColumns)
            return
          }
          
          const creatorAddress = searchQuery.trim()
          console.log("搜索页 - 作者搜索：查询地址:", creatorAddress)
          
          // 获取指定地址拥有的 ColumnCap
          const userColumnCaps = await getUserOwnedColumns(creatorAddress)
          console.log("搜索页 - 作者搜索：获取到的 ColumnCap 数量:", userColumnCaps.length)
          
          // 提取所有 Column ID
          const columnIds = userColumnCaps.map((cap) => cap.column_id)
          console.log("搜索页 - 作者搜索：Column IDs:", columnIds)
          
          if (columnIds.length === 0) {
            console.log("搜索页 - 作者搜索：没有找到专栏")
            setColumns([])
            return
          }
          
          // 批量查询专栏详细信息
          const columnDetails = await getColumnsByIds(columnIds)
          console.log("搜索页 - 作者搜索：获取到的专栏详细信息数量（过滤前）:", columnDetails.length)
          
          // 只显示已发布的专栏（status === 1）
          const publishedColumns = columnDetails.filter(col => col.status === 1)
          console.log("搜索页 - 作者搜索：已发布的专栏数量:", publishedColumns.length)
          setColumns(publishedColumns)
        }
      } catch (error) {
        console.error("Failed to fetch columns:", error)
        setColumns([])
      } finally {
        setLoading(false)
      }
    }
    fetchColumns()
  }, [searchType, searchQuery])

  // 将 ColumnOtherInfo 转换为 ColumnCard 所需的格式
  const convertToCardProps = (column: ColumnOtherInfo) => {
    const isCreator = currentAccount?.address?.toLowerCase() === column.creator.toLowerCase()
    return {
      id: column.id,
      title: column.name,
      description: column.desc,
      author: {
        name: column.creator,
        address: column.creator,
      },
      category: t("search.column"),
      subscribers: column.subscriptions,
      price: column.payment_method?.fee?.toString() || "0",
      coverImage: column.cover_img_url,
      isCreator,
      updateMethod: column.update_method,
      paymentMethod: column.payment_method,
    }
  }

  // 搜索匹配逻辑
  const matchesSearch = (column: ColumnOtherInfo) => {
    if (!searchQuery.trim()) {
      // 没有查询时显示所有专栏
      return true
    }

    const query = searchQuery.toLowerCase().trim()
    const name = column.name.toLowerCase()
    const desc = column.desc.toLowerCase()
    const creator = column.creator.toLowerCase()

    switch (searchType) {
      case "title":
        // 仅搜索标题和描述
        return name.includes(query) || desc.includes(query)
      case "creator":
        // 作者搜索：已经在 useEffect 中根据地址过滤了，这里只需要精确匹配
        return creator === query
      default:
        return true
    }
  }

  // Filter and sort columns
  const filteredColumns = columns
    .filter(matchesSearch)
    .sort((a, b) => {
      if (sortBy === "subscribers" && SHOW_SUBSCRIPTION_STATS) {
        return b.subscriptions - a.subscriptions
      } else if (sortBy === "price-low") {
        const priceA = a.payment_method?.fee || 0
        const priceB = b.payment_method?.fee || 0
        return priceA - priceB
      } else if (sortBy === "price-high") {
        const priceA = a.payment_method?.fee || 0
        const priceB = b.payment_method?.fee || 0
        return priceB - priceA
      }
      return 0
    })

  // 获取搜索类型的显示文本
  const getSearchTypePlaceholder = () => {
    switch (searchType) {
      case "title":
        return t("search.searchByTitle")
      case "creator":
        return t("search.searchByCreator")
      default:
        return t("search.searchByTitle")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="space-y-8">
          {/* Search Header */}
          <div className="space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold text-balance">{t("search.title")}</h1>

            {/* Search Input with Type Selector */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 flex gap-2">
                <Select value={searchType} onValueChange={(value) => setSearchType(value as SearchType)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="title">
                      {t("search.searchTypeTitle")}
                    </SelectItem>
                    <SelectItem value="creator">
                      {t("search.searchTypeCreator")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={getSearchTypePlaceholder()}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t("search.sortBy")} />
                </SelectTrigger>
                <SelectContent>
                  {SHOW_SUBSCRIPTION_STATS && (
                    <SelectItem value="subscribers">{t("search.sortBySubscribers")}</SelectItem>
                  )}
                  <SelectItem value="price-low">{t("search.priceLowToHigh")}</SelectItem>
                  <SelectItem value="price-high">
                    {t("search.priceHighToLow")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Tips */}
            {searchType === "creator" && (
              <div className="text-sm text-muted-foreground">
                💡 {t("search.creatorTip")}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
                <p className="text-muted-foreground">
                  {t("common.loading")}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t("search.found")}{" "}
                    <span className="font-semibold text-foreground">{filteredColumns.length}</span>{" "}
                    {t("search.columns")}
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-sm text-primary hover:text-accent transition-colors"
                    >
                      {t("search.clearSearch")}
                    </button>
                  )}
                </div>

                {filteredColumns.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredColumns.map((column) => (
                      <ColumnCard key={column.id} {...convertToCardProps(column)} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Search className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      {searchQuery 
                        ? t("search.noMatchingColumns")
                        : t("search.noColumnsAvailable")}
                    </h3>
                    <p className="text-muted-foreground">
                      {searchQuery
                        ? t("search.tryAdjustingSearch")
                        : t("search.noColumnsPublished")}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
