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
import { SHOW_SUBSCRIPTION_STATS } from "@/constants"

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
        title: t("subscriptions.loadFailed"),
        description: t("subscriptions.loadFailedDesc"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRenewSubscription = async (subscription: Subscription) => {
    // TODO: 实现续费功能
    toast({
      title: t("subscriptions.renewing") || "续费中",
      description: t("subscriptions.renewingDesc") || "正在处理续费请求...",
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
                  t("subscriptions.subscribingCount").replace("{count}", subscriptions.length.toString())
                ) : (
                  t("subscriptions.connectWallet")
                )}
              </p>
            )}
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
              <p className="text-muted-foreground">
                {t("common.loading")}
              </p>
            </div>
          ) : !currentAccount?.address ? (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold">
                  {t("subscriptions.walletNotConnected")}
                </h3>
                <p className="text-muted-foreground">
                  {t("subscriptions.connectWalletToView")}
                </p>
              </div>
            </Card>
          ) : subscriptions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
              {subscriptions.map((subscription) => {
                const column = subscription.column
                const paymentMethod = column.payment_method
                const payType = paymentMethod?.pay_type ?? 2
                
                // 计算到期日期或下次支付日期
                const getExpiryOrNextPayment = () => {
                  if (payType === 0) {
                    // 买断：不需要续费，显示永久有效
                    return null
                  }
                  
                  const timeMs = paymentMethod?.subscription_time || 30 * 86400000
                  const timeDays = Math.round(timeMs / 86400000)
                  const expiryDate = getNextPaymentDate(subscription.sub_start_time, timeDays)
                  
                  if (payType === 1) {
                    // 质押：显示到期日期
                    return { date: expiryDate, label: t("subscriptions.expiresOn") || "到期日期" }
                  } else {
                    // 订阅：显示下次支付日期
                    return { date: expiryDate, label: t("subscriptions.nextBilling") }
                  }
                }

                const expiryOrNextPayment = getExpiryOrNextPayment()

                return (
                  <Card key={subscription.id} className="flex flex-col hover:shadow-lg hover:border-primary transition-all duration-300 aspect-[4/3] border-border/50 bg-card w-full max-w-[331px]">
                    <CardHeader className="space-y-2.5 pb-3">
                      <Link href={`/column/${column.id}`} className="hover:text-accent transition-colors">
                        <h3 className="text-xl font-bold leading-tight text-balance text-foreground">{column.name || "未知专栏"}</h3>
                      </Link>
                    </CardHeader>

                    <CardContent className="flex-1 pb-3">
                      {/* 到期时间 */}
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 shrink-0 text-primary/70" />
                        {payType === 0 ? (
                          <span className="text-green-600 dark:text-green-400">
                            {t("subscriptions.permanentAccess")}
                          </span>
                        ) : expiryOrNextPayment ? (
                          <span>
                            {expiryOrNextPayment.label} {formatDate(expiryOrNextPayment.date)}
                          </span>
                        ) : null}
                      </div>
                    </CardContent>

                    <CardFooter className="pt-3 border-t border-border/50 bg-muted/30">
                      <div className={`flex items-center justify-between w-full gap-3 ${payType === 2 ? '' : 'justify-center'}`}>
                        <Button variant="outline" size="sm" className={payType === 2 ? "flex-1" : "w-full"} asChild>
                        <Link href={`/column/${column.id}`}>{t("subscriptions.viewColumn")}</Link>
                      </Button>
                        {payType === 2 && (
                      <Button
                            size="sm"
                        className="flex-1"
                            onClick={() => handleRenewSubscription(subscription)}
                      >
                            {t("subscriptions.renew")}
                      </Button>
                        )}
                      </div>
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
