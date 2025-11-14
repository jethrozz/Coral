"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ExternalLink, Loader2 } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { formatAddress, getAddressColor } from "@/lib/address-utils"
import { useI18n } from "@/lib/i18n/context"
import { useCurrentAccount } from "@mysten/dapp-kit"
import { getMySubscriptions } from "@/contract/coral_column"
import type { Subscription } from "@/shared/data"

export default function SubscriptionsPage() {
  const { toast } = useToast()
  const currentAccount = useCurrentAccount()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const { t, language } = useI18n()

  // 加载用户的订阅
  useEffect(() => {
    if (currentAccount?.address) {
      loadSubscriptions()
    } else {
      setLoading(false)
    }
  }, [currentAccount?.address])

  const loadSubscriptions = async () => {
    if (!currentAccount?.address) return

    setLoading(true)
    try {
      const userSubscriptions = await getMySubscriptions(currentAccount.address)
      setSubscriptions(userSubscriptions)
    } catch (error) {
      console.error("加载订阅失败:", error)
      toast({
        title: language === "zh" ? "加载失败" : "Load Failed",
        description: language === "zh" ? "无法加载订阅列表" : "Failed to load subscriptions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCancelSubscription = async (id: string, title: string) => {
    // TODO: 实现区块链取消订阅交易
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setSubscriptions(subscriptions.filter((sub) => sub.id !== id))

    toast({
      title: language === "zh" ? "已取消订阅" : "Subscription Cancelled",
      description: language === "zh" ? `你已取消订阅 ${title}` : `You have cancelled subscription to ${title}`,
    })
  }

  // 格式化日期
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  }

  // 计算下次支付日期
  const getNextPaymentDate = (subStartTime: Date, subscriptionTime: number) => {
    const nextDate = new Date(subStartTime)
    nextDate.setDate(nextDate.getDate() + subscriptionTime)
    return nextDate
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">{t("subscriptions.title")}</h1>
            {!loading && (
              <p className="text-muted-foreground">
                {currentAccount?.address ? (
                  language === "zh"
                    ? `你正在订阅 ${subscriptions.length} 个专栏`
                    : `You are subscribed to ${subscriptions.length} columns`
                ) : (
                  language === "zh" ? "请先连接钱包" : "Please connect your wallet"
                )}
              </p>
            )}
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
              <p className="text-muted-foreground">
                {language === "zh" ? "加载中..." : "Loading..."}
              </p>
            </div>
          ) : !currentAccount?.address ? (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">
                  {language === "zh" ? "未连接钱包" : "Wallet Not Connected"}
                </h3>
                <p className="text-muted-foreground">
                  {language === "zh" ? "请连接钱包以查看你的订阅" : "Please connect your wallet to view your subscriptions"}
                </p>
              </div>
            </Card>
          ) : subscriptions.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {subscriptions.map((subscription) => {
                const column = subscription.column
                const subscriptionTime = column.payment_method?.subscription_time || 30
                const nextPayment = getNextPaymentDate(subscription.sub_start_time, subscriptionTime)

                return (
                  <Card key={subscription.id} className="flex flex-col hover:border-primary transition-all duration-300">
                    <CardHeader className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="secondary">
                          {language === "zh" ? "专栏" : "Column"}
                        </Badge>
                        <div className="text-sm">
                          <span className="font-bold">{column.payment_method?.fee || 0} SUI</span>
                          <span className="text-muted-foreground">/{t("common.month")}</span>
                        </div>
                      </div>

                      <Link href={`/column/${column.id}`} className="hover:text-accent transition-colors">
                        <h3 className="text-xl font-bold text-balance">{column.name}</h3>
                      </Link>
                    </CardHeader>

                    <CardContent className="flex-1 space-y-4">
                      {/* Description */}
                      <p className="text-sm text-muted-foreground line-clamp-2">{column.desc}</p>

                      {/* Author */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-full ${getAddressColor(column.creator)} flex items-center justify-center text-white text-sm font-mono font-semibold flex-shrink-0`}
                        >
                          {formatAddress(column.creator, 4).slice(-4)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground font-mono truncate">
                            {column.creator.slice(0, 8)}...{column.creator.slice(-6)}
                          </p>
                        </div>
                      </div>

                      {/* Column Stats */}
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">{language === "zh" ? "订阅者" : "Subscribers"}</p>
                            <p className="font-medium">{column.subscriptions}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">{language === "zh" ? "期数" : "Issues"}</p>
                            <p className="font-medium">{column.all_installment.length}/{column.plan_installment_number}</p>
                          </div>
                        </div>
                      </div>

                      {/* Subscription Info */}
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {t("subscriptions.subscribedOn")} {formatDate(subscription.created_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {t("subscriptions.nextBilling")} {formatDate(nextPayment)}
                          </span>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="flex gap-3">
                      <Button variant="outline" className="flex-1 bg-transparent" asChild>
                        <Link href={`/column/${column.id}`}>{t("subscriptions.viewColumn")}</Link>
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleCancelSubscription(subscription.id, column.name)}
                      >
                        {t("subscriptions.cancelSubscription")}
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">{t("subscriptions.noSubscriptions")}</h3>
                <p className="text-muted-foreground">{t("subscriptions.noSubscriptionsDesc")}</p>
                <Button asChild>
                  <Link href="/search">{t("subscriptions.browseColumns")}</Link>
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
