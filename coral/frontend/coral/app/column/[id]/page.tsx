import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Users, Clock, BookOpen } from "lucide-react"

// 模拟专栏详情
const mockColumnDetail = {
  id: "1",
  title: "Web3开发实战指南",
  description:
    "从零开始学习智能合约开发，涵盖Solidity、Hardhat、Ethers.js等核心技术栈。本专栏将带你深入了解Web3开发的方方面面，从基础概念到实战项目，帮助你成为一名优秀的Web3开发者。",
  author: {
    name: "李明",
    address: "0x1234567890123456789012345678901234567890",
    avatar: "/diverse-avatars.png",
    bio: "资深区块链开发者，5年Web3开发经验",
  },
  category: "技术",
  subscribers: 1234,
  price: "0.05",
  articles: 45,
  updateFrequency: "每周3篇",
  coverImage: "/web3-development.png",
  recentArticles: [
    { title: "Solidity 基础语法详解", date: "2天前" },
    { title: "使用Hardhat搭建开发环境", date: "5天前" },
    { title: "智能合约安全最佳实践", date: "1周前" },
  ],
}

export default function ColumnDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Cover Image */}
        <div className="aspect-[21/9] w-full overflow-hidden rounded-xl bg-muted mb-8">
          <img
            src={mockColumnDetail.coverImage || "/placeholder.svg"}
            alt={mockColumnDetail.title}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-sm">
                  {mockColumnDetail.category}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{mockColumnDetail.subscribers} 订阅者</span>
                </div>
              </div>

              <h1 className="text-4xl font-bold text-balance">{mockColumnDetail.title}</h1>

              <p className="text-lg text-muted-foreground leading-relaxed">{mockColumnDetail.description}</p>
            </div>

            {/* Author Info */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={mockColumnDetail.author.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{mockColumnDetail.author.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="font-semibold">{mockColumnDetail.author.name}</div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {mockColumnDetail.author.address.slice(0, 6)}...{mockColumnDetail.author.address.slice(-4)}
                    </div>
                    <p className="text-sm text-muted-foreground">{mockColumnDetail.author.bio}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Articles */}
            <Card>
              <CardHeader>
                <CardTitle>最新文章</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockColumnDetail.recentArticles.map((article, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{article.title}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{article.date}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="sticky top-20">
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-primary">{mockColumnDetail.price}</span>
                    <span className="text-muted-foreground">ETH / 月</span>
                  </div>

                  <Button size="lg" className="w-full">
                    立即订阅
                  </Button>

                  <div className="pt-4 space-y-3 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        <span>文章数量</span>
                      </div>
                      <span className="font-medium">{mockColumnDetail.articles} 篇</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>更新频率</span>
                      </div>
                      <span className="font-medium">{mockColumnDetail.updateFrequency}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>订阅人数</span>
                      </div>
                      <span className="font-medium">{mockColumnDetail.subscribers}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
