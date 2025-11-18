"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { ColumnCard } from "@/components/column-card"
import { Input } from "@/components/ui/input"
import { Search, Loader2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useI18n } from "@/lib/i18n/context"
import { getAllColumns } from "@/contract/coral_column"
import { ColumnOtherInfo } from "@/shared/data"

type SearchType = "all" | "title" | "creator"

export default function SearchPage() {
  const { t, language } = useI18n()
  const [columns, setColumns] = useState<ColumnOtherInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchType, setSearchType] = useState<SearchType>("all")
  const [sortBy, setSortBy] = useState("subscribers")

  useEffect(() => {
    async function fetchColumns() {
      try {
        setLoading(true)
        const data = await getAllColumns()
        setColumns(data)
      } catch (error) {
        console.error("Failed to fetch columns:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchColumns()
  }, [])

  // 将 ColumnOtherInfo 转换为 ColumnCard 所需的格式
  const convertToCardProps = (column: ColumnOtherInfo) => {
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
    }
  }

  // 搜索匹配逻辑
  const matchesSearch = (column: ColumnOtherInfo) => {
    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase().trim()
    const name = column.name.toLowerCase()
    const desc = column.desc.toLowerCase()
    const creator = column.creator.toLowerCase()

    switch (searchType) {
      case "title":
        // 仅搜索标题和描述
        return name.includes(query) || desc.includes(query)
      case "creator":
        // 仅搜索创作者地址
        return creator.includes(query)
      case "all":
      default:
        // 搜索所有字段
        return name.includes(query) || desc.includes(query) || creator.includes(query)
    }
  }

  // Filter and sort columns
  const filteredColumns = columns
    .filter(matchesSearch)
    .sort((a, b) => {
      if (sortBy === "subscribers") {
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
      case "all":
      default:
        return t("search.searchAll")
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
                    <SelectItem value="all">
                      {t("search.all")}
                    </SelectItem>
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
                  <SelectItem value="subscribers">{t("search.sortBySubscribers")}</SelectItem>
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
