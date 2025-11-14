"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Calendar, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { formatAddress, getAddressColor } from "@/lib/address-utils"
import { useI18n } from "@/lib/i18n/context"

// Mock data - in a real app, this would be fetched based on the ID
const mockColumnData = {
  "1": {
    id: "1",
    title: "Web3开发实战指南",
    description:
      "从零开始学习智能合约开发,涵盖Solidity、Hardhat、Ethers.js等核心技术栈。本专栏将带你深入理解区块链技术,掌握智能合约开发的核心知识和最佳实践。",
    author: {
      name: "李明",
      address: "0x7d20dcdb2bca4f508ea9613994683eb4e76e9c4ed1e59256b8dddf14e4f00000",
      avatar: "/diverse-avatars.png",
      bio: "资深区块链开发工程师,拥有5年智能合约开发经验",
    },
    category: "技术",
    subscribers: 1234,
    price: "0.5",
    coverImage: "/web3-blockchain-development.jpg",
    posts: [
      {
        id: "p1",
        title: "智能合约基础:Solidity入门",
        excerpt: "了解Solidity基本语法和核心概念...",
        publishedAt: "2024-01-15",
      },
      {
        id: "p2",
        title: "使用Hardhat构建开发环境",
        excerpt: "配置完整的智能合约开发和测试环境...",
        publishedAt: "2024-01-20",
      },
      {
        id: "p3",
        title: "Ethers.js实战:与智能合约交互",
        excerpt: "学习如何在前端应用中调用智能合约...",
        publishedAt: "2024-01-25",
      },
    ],
  },
}

export default function ColumnDetailPage({ params }: { params: { id: string } }) {
  const { toast } = useToast()
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const { t, language } = useI18n()

  // Get column data
  const column = mockColumnData[params.id as keyof typeof mockColumnData] || mockColumnData["1"]

  const handleSubscribe = async () => {
    setIsSubscribing(true)

    // Simulate blockchain transaction
    await new Promise((resolve) => setTimeout(resolve, 2000))

    setIsSubscribed(true)
    setIsSubscribing(false)

    toast({
      title: language === "zh" ? "订阅成功！" : "Subscribed Successfully!",
      description: language === "zh" ? `你已成功订阅 ${column.title}` : `You have subscribed to ${column.title}`,
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="space-y-8">
          {/* Cover Image */}
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
            <img
              src={column.coverImage || "/placeholder.svg"}
              alt={column.title}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Column Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{column.category}</Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {column.subscribers.toLocaleString()} {t("column.subscribers")}
                    </span>
                  </div>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-balance">{column.title}</h1>

                <p className="text-lg text-muted-foreground text-pretty">{column.description}</p>
              </div>

              {/* Author Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">{t("column.aboutAuthor")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-4">
                    <div
                      className={`h-16 w-16 rounded-full ${getAddressColor(column.author.address)} flex items-center justify-center text-white text-lg font-mono font-semibold flex-shrink-0`}
                    >
                      {formatAddress(column.author.address, 6).slice(-6)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm text-muted-foreground font-mono break-all">{column.author.address}</p>
                      <p className="text-sm text-muted-foreground pt-2">{column.author.bio}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Posts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">{t("column.latestArticles")}</CardTitle>
                  <CardDescription>
                    {isSubscribed
                      ? language === "zh"
                        ? "你可以查看所有文章"
                        : "You can view all articles"
                      : language === "zh"
                        ? "订阅后即可查看完整内容"
                        : "Subscribe to view full content"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {column.posts.map((post) => (
                      <Link
                        key={post.id}
                        href={isSubscribed ? `/posts/${post.id}` : "#"}
                        className={`block p-4 rounded-lg border border-border hover:border-primary transition-colors ${
                          !isSubscribed && "opacity-60 cursor-not-allowed"
                        }`}
                        onClick={(e) => {
                          if (!isSubscribed) {
                            e.preventDefault()
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <h4 className="font-semibold">{post.title}</h4>
                            <p className="text-sm text-muted-foreground">{post.excerpt}</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                            <Calendar className="h-3 w-3" />
                            {post.publishedAt}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Subscription Sidebar */}
            <div className="lg:col-span-1">
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle>{language === "zh" ? "订阅专栏" : "Subscribe"}</CardTitle>
                  <CardDescription>{language === "zh" ? "解锁所有内容" : "Unlock all content"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{column.price} SUI</span>
                      <span className="text-muted-foreground">/{t("common.month")}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {language === "zh" ? "约" : "~"} ${(Number.parseFloat(column.price) * 2).toFixed(2)} USD
                    </p>
                  </div>

                  {isSubscribed ? (
                    <Button className="w-full" disabled>
                      <Check className="mr-2 h-4 w-4" />
                      {t("column.subscribed")}
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={handleSubscribe} disabled={isSubscribing}>
                      {isSubscribing ? (language === "zh" ? "订阅中..." : "Subscribing...") : t("column.subscribe")}
                    </Button>
                  )}

                  <div className="space-y-3 pt-4 border-t border-border">
                    <h4 className="font-semibold text-sm">
                      {language === "zh" ? "订阅包含：" : "Subscription includes:"}
                    </h4>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                        <span>{language === "zh" ? "访问所有历史文章" : "Access all past articles"}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                        <span>{language === "zh" ? "第一时间获取新文章" : "Get new articles first"}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                        <span>{language === "zh" ? "支持创作者持续创作" : "Support creator"}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                        <span>{language === "zh" ? "随时取消订阅" : "Cancel anytime"}</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
