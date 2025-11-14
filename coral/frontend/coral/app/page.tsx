"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { ColumnCard } from "@/components/column-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/lib/i18n/context"
import { getAllColumns } from "@/contract/coral_column"
import { ColumnOtherInfo } from "@/shared/data"

export default function HomePage() {
  const { t, language } = useI18n()
  const [columns, setColumns] = useState<ColumnOtherInfo[]>([])
  const [loading, setLoading] = useState(true)

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
      category: language === "zh" ? "专栏" : "Column",
      subscribers: column.subscriptions,
      price: column.payment_method?.fee?.toString() || "0",
      coverImage: column.cover_img_url,
    }
  }

  const categories =
    language === "zh" ? ["全部"] : ["All"]

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="border-b border-border bg-gradient-to-b from-muted/50 to-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance">
              {t("home.hero.title")}
              <span className="block text-primary mt-2">{t("home.hero.subtitle")}</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
              {language === "zh"
                ? "基于Web3的去中心化专栏平台，让创作者直接连接读者，用加密货币订阅你喜欢的内容"
                : "Decentralized content subscription platform connecting creators and readers with cryptocurrency"}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="text-lg px-8">
                {t("home.hero.cta")}
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 bg-transparent">
                {language === "zh" ? "成为创作者" : "Become Creator"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Columns Section */}
      <section className="py-12 md:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold">{language === "zh" ? "热门专栏" : "Popular Columns"}</h2>
            </div>

            <Tabs defaultValue={categories[0]} className="w-full">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                {categories.map((category) => (
                  <TabsTrigger
                    key={category}
                    value={category}
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                  >
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>

              {categories.map((category) => (
                <TabsContent key={category} value={category} className="mt-8">
                  {loading ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">
                        {language === "zh" ? "加载中..." : "Loading..."}
                      </p>
                    </div>
                  ) : columns.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">
                        {language === "zh" ? "暂无专栏" : "No columns available"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {columns.map((column) => (
                        <ColumnCard key={column.id} {...convertToCardProps(column)} />
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border bg-muted/30 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="space-y-2">
              <div className="text-4xl font-bold text-primary">1,234</div>
              <div className="text-muted-foreground">{language === "zh" ? "活跃专栏" : "Active Columns"}</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-primary">6,789</div>
              <div className="text-muted-foreground">{language === "zh" ? "订阅用户" : "Subscribers"}</div>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-bold text-primary">2,340 SUI</div>
              <div className="text-muted-foreground">{language === "zh" ? "累计交易" : "Total Volume"}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
