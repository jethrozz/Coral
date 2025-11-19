"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Calendar, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatAddress, getAddressColor } from "@/lib/address-utils"
import { useI18n } from "@/lib/i18n/context"
import { SHOW_SUBSCRIPTION_STATS } from "@/constants"
import type { UpdateMethod, PaymentMethod } from "@/shared/data"
import { useCurrentAccount } from "@mysten/dapp-kit"
import { useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { useNetworkVariable } from "@/lib/networkConfig"
import { subscribeColumn, getMySubscriptions } from "@/contract/coral_column"
import { useToast } from "@/hooks/use-toast"

interface ColumnCardProps {
  id: string
  title: string
  description: string
  author: {
    name: string
    address: string
    avatar?: string
  }
  category: string
  subscribers: number
  price: string
  coverImage?: string
  isCreator?: boolean // 是否是当前用户创建的专栏
  updateMethod?: UpdateMethod | null // 更新方式
  paymentMethod?: PaymentMethod | null // 支付方式
}

export function ColumnCard({
  id,
  title,
  description,
  author,
  category,
  subscribers,
  price,
  coverImage,
  isCreator = false,
  updateMethod,
  paymentMethod,
}: ColumnCardProps) {
  const { t } = useI18n()
  const router = useRouter()
  const { toast } = useToast()
  const currentAccount = useCurrentAccount()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const packageId = useNetworkVariable("packageId")
  const chain = useNetworkVariable("chain")
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [checkingSubscription, setCheckingSubscription] = useState(false)

  // 检查是否已订阅该专栏
  useEffect(() => {
    const checkSubscription = async () => {
      if (!currentAccount?.address || isCreator) {
        setIsSubscribed(false)
        return
      }

      setCheckingSubscription(true)
      try {
        const subscriptions = await getMySubscriptions(currentAccount.address)
        const columnIdStr = typeof id === 'string' ? id : (id as any)?.id || String(id)
        const foundSubscription = subscriptions.find((sub) => {
          const subColumnId = typeof sub.column_id === 'string' ? sub.column_id : (sub.column_id as any)?.id || String(sub.column_id)
          return subColumnId === columnIdStr
        })
        setIsSubscribed(!!foundSubscription)
      } catch (error) {
        console.error("检查订阅状态失败:", error)
        setIsSubscribed(false)
      } finally {
        setCheckingSubscription(false)
      }
    }

    checkSubscription()
  }, [currentAccount?.address, id, isCreator])

  // 获取支付类型文本
  const getPaymentTypeText = (payType: number) => {
    switch (payType) {
      case 0:
        return t("createColumn.payTypeBuyOut")
      case 1:
        return t("createColumn.payTypeStake")
      case 2:
        return t("createColumn.payTypeSubscribe")
      default:
        return ""
    }
  }

  // 格式化更新频率
  const formatUpdateFrequency = () => {
    if (!updateMethod) return null
    // 手动替换占位符
    return t("column.updateFrequency")
      .replace("{days}", String(updateMethod.day_number))
      .replace("{count}", String(updateMethod.installment_number))
  }

  // 处理订阅
  const handleSubscribe = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!currentAccount?.address) {
      toast({
        title: t("common.error"),
        description: "请先连接钱包",
        variant: "destructive",
      })
      return
    }

    if (!paymentMethod?.id) {
      toast({
        title: t("common.error"),
        description: "支付方式信息缺失",
        variant: "destructive",
      })
      return
    }

    if (!packageId || !chain) {
      toast({
        title: t("common.error"),
        description: "配置错误，请检查网络设置",
        variant: "destructive",
      })
      return
    }

    setIsSubscribing(true)
    try {
      await subscribeColumn({
        columnId: id,
        paymentMethodId: paymentMethod.id,
        packageId,
        chain,
        signAndExecuteTransaction,
      })

      toast({
        title: t("common.success"),
        description: "订阅成功！",
      })

      // 更新订阅状态
      setIsSubscribed(true)

      // 跳转到专栏详情页
      setTimeout(() => {
        router.push(`/columns/${id}`)
      }, 1000)
    } catch (error: any) {
      console.error("订阅失败:", error)
      toast({
        title: t("common.error"),
        description: error.message || "订阅失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsSubscribing(false)
    }
  }

  return (
    <Card className="flex flex-col hover:shadow-lg hover:border-primary transition-all duration-300 h-full border-border/50 bg-card">
      <Link href={`/column/${id}`} className="flex flex-col flex-1">
        <CardHeader className="space-y-2.5 pb-3 relative">
          {/* 价格显示在右上角 */}
          <div className="absolute top-0 right-7 text-right">
            <div className="text-lg font-bold text-primary leading-tight">{price} SUI</div>
            <div className="text-xs text-muted-foreground">
              {paymentMethod?.pay_type === 0 ? t("column.oneTime") : ``}
            </div>
          </div>
          
          <div className="flex items-start justify-between gap-2 pr-20">
            <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
              {category}
            </Badge>
            {SHOW_SUBSCRIPTION_STATS && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{subscribers.toLocaleString()}</span>
              </div>
            )}
          </div>

          <h3 className="text-xl font-bold leading-tight text-balance line-clamp-2 text-foreground pr-20">{title}</h3>
        </CardHeader>

        <CardContent className="flex-1 space-y-2.5 pb-3">
          <p className="text-sm text-muted-foreground text-pretty line-clamp-2">{description}</p>
          
          {/* 更新方式和支付方式信息 */}
          {(updateMethod || paymentMethod) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-border/50">
              {updateMethod && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span className="line-clamp-1">{formatUpdateFrequency()}</span>
                </div>
              )}
              {paymentMethod && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span className="line-clamp-1">
                    {getPaymentTypeText(paymentMethod.pay_type)}
                    {paymentMethod.pay_type !== 0 && (
                      <span className="text-muted-foreground/70 ml-1">
                        ({Math.round(paymentMethod.subscription_time / 86400000)}{t("common.days")})
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Link>

      <CardFooter className="pt-3 border-t border-border/50 bg-muted/30">
        <div className="flex items-center justify-between w-full gap-3">
          {/* 作者信息 */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`h-7 w-7 shrink-0 rounded-full ${getAddressColor(author.address)} flex items-center justify-center text-white text-xs font-mono font-semibold`}
            >
              {formatAddress(author.address, 4).slice(-4)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground font-mono truncate">
                {author.address.slice(0, 6)}...{author.address.slice(-4)}
              </p>
            </div>
          </div>

          {/* 订阅按钮 */}
          {isCreator ? (
            <Button disabled variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
              {t("column.subscribe")}
            </Button>
          ) : isSubscribed ? (
            <Button 
              disabled 
              variant="outline" 
              size="sm" 
              onClick={(e) => e.stopPropagation()}
            >
              {t("column.subscribed") || "已订阅"}
            </Button>
          ) : (
            <Button 
              size="sm" 
              onClick={handleSubscribe}
              disabled={isSubscribing || checkingSubscription}
            >
              {isSubscribing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  订阅中...
                </>
              ) : (
                t("column.subscribe")
              )}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
