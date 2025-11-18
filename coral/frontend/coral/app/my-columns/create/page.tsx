"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/context"
import { Loader2, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useNetworkVariable } from "@/lib/networkConfig";
import { Transaction } from '@mysten/sui/transactions';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";

export default function CreateColumnPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)
  const { t, language } = useI18n()
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const chain = useNetworkVariable("chain");
  const packageId = useNetworkVariable("packageId");
  const globalConfigId = useNetworkVariable("globalConfigId");
  const marketConfigId = useNetworkVariable("marketConfigId");
  const [formData, setFormData] = useState({
    // 基本信息
    name: "",
    desc: "",
    cover_img_url: "",
    plan_installment_number: "",
    is_rated: false,
    
    // 更新方式 UpdateMethod
    update_since_date: "", // 改为日期时间字符串，格式：YYYY-MM-DDTHH:mm
    update_day_number: "",
    update_installment_number: "",
    
    // 支付方式 PaymentMethod
    pay_type: "2", // 0买断，1质押，2订阅
    fee: "",
    subscription_time: "30", // 订阅时长（天）
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentAccount) {
      toast({
        title: t("wallet.noconnect"),
        description: t("wallet.noconnect"),
        variant: "destructive",
      });
      return;
    }
    // 验证必填字段
    if (!formData.name || !formData.desc || !formData.cover_img_url || 
        !formData.plan_installment_number || !formData.update_since_date ||
        !formData.update_day_number || !formData.update_installment_number ||
        !formData.fee) {
      toast({
        title: t("createColumn.toastRequiredTitle"),
        description: t("createColumn.toastRequiredDesc"),
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)

    try {
      // 将日期时间转换为时间戳（毫秒）
      const updateSinceTimestamp = new Date(formData.update_since_date).getTime()
      
      // TODO: 实现区块链创建专栏交易
      // 需要调用合约的创建方法，传入：
      // - name, desc, cover_img_url, plan_installment_number, is_rated
      // - UpdateMethod: since (使用 updateSinceTimestamp), day_number, installment_number
      // - PaymentMethod: pay_type, fee, subscription_time
      
      console.log("提交数据：", {
        ...formData,
        update_since_timestamp: updateSinceTimestamp
      })


          // price (SUI) -> fee (最小单位，* 10^9)
    const priceNumber = Number(formData.fee);
    if (Number.isNaN(priceNumber) || priceNumber <= 0) {
      toast({
        title: "Error",
        description: "Invalid price",
        variant: "destructive",
      });
      setIsCreating(false);
      return;
    }
      const tx = new Transaction();
      tx.setSender(currentAccount.address);
      const price = BigInt(Math.round(priceNumber * 1e9));

      const payment = tx.moveCall({
      target: `${packageId}::coral_market::create_payment_method`,
      arguments: [
        tx.pure.u8(parseInt(formData.pay_type, 10)), // pay_type: u8
        tx.pure.string("0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
        ), // 取你实际支持的 coin_type 字符串
        tx.pure.u64(9), // decimals
        tx.pure.u64(price), // fee
        tx.pure.u64(parseInt(formData.subscription_time, 10) || 0), // subscription_time
        tx.object(marketConfigId), // &MarketConfig
        tx.object(globalConfigId), // &GlobalConfig
      ],
    });
          // ========= 2. create_update_method =========
    const sinceMs = new Date(formData.update_since_date).getTime(); // 毫秒
    if (!sinceMs || Number.isNaN(sinceMs)) {
      toast({
        title: "Error",
        description: "Invalid start date",
        variant: "destructive",
      });
      setIsCreating(false);
      return;
    }
        const updateMethod = tx.moveCall({
      target: `${packageId}::coral_market::create_update_method`,
      arguments: [
        tx.pure.u64(BigInt(sinceMs)), // since: u64 (ms)
        tx.pure.u64(parseInt(formData.update_day_number, 10) || 0), // day_number
        tx.pure.u64(parseInt(formData.update_installment_number, 10) || 0), // installment_number
        tx.object(globalConfigId), // &GlobalConfig
      ],
    });

        // ========= 3. create_column =========
    tx.moveCall({
      target: `${packageId}::coral_market::create_column`,
      arguments: [
        tx.pure.string(formData.name), // name
        tx.pure.string(formData.desc), // desc
        tx.pure.string(formData.cover_img_url), // cover_img_url
        tx.object(updateMethod), // UpdateMethod
        tx.object(payment), // PaymentMethod
        tx.pure.bool(formData.is_rated), // is_rated
        tx.pure.u64(parseInt(formData.plan_installment_number, 10) || 0), // plan_installment_number
        tx.object("0x6"), // Clock
        tx.object(globalConfigId), // &GlobalConfig
      ],
    });

        // ========= 4. 发送交易 =========
      // 将 signAndExecuteTransaction 包装为 Promise，等待交易完成
      await new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx, chain },
          {
            onSuccess: (result) => {
              console.log("Create successful:", result.digest);
              resolve();
            },
            onError: (error) => {
              console.error("Transaction failed:", error);
              reject(error);
            },
          },
        );
      });

      // 等待交易完成后再显示成功消息并导航
      toast({
        title: t("createColumn.toastSuccessTitle"),
        description: t("createColumn.toastSuccessDesc"),
      })

      // 延迟一下再导航，让用户看到成功消息
      await new Promise((resolve) => setTimeout(resolve, 1000))
      router.push("/my-columns")
    } catch (error) {
      console.error("创建专栏失败:", error)
      toast({
        title: t("createColumn.toastFailedTitle"),
        description: t("createColumn.toastFailedDesc"),
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold">
              {t("createColumn.title")}
            </h1>
            <p className="text-muted-foreground">
              {t("createColumn.pageSubtitle")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle>{t("createColumn.basicInfo")}</CardTitle>
                <CardDescription>
                  {t("createColumn.basicInfoDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {t("createColumn.columnTitle")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder={t("createColumn.columnTitlePlaceholder")}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc">
                    {t("createColumn.columnDescription")} <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="desc"
                    placeholder={t("createColumn.columnDescriptionPlaceholder")}
                    rows={5}
                    value={formData.desc}
                    onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("createColumn.columnDescriptionHelp")}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cover_img_url">
                    {t("createColumn.coverImageUrl")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cover_img_url"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={formData.cover_img_url}
                    onChange={(e) => setFormData({ ...formData, cover_img_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("createColumn.coverImageUrlHelp")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="plan_installment_number">
                      {t("createColumn.planIssues")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="plan_installment_number"
                      type="number"
                      min="1"
                      placeholder={t("createColumn.planIssuesPlaceholder")}
                      value={formData.plan_installment_number}
                      onChange={(e) => setFormData({ ...formData, plan_installment_number: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="is_rated">
                      {t("createColumn.isRatedLabel")}
                    </Label>
                    <Select
                      value={formData.is_rated ? "true" : "false"}
                      onValueChange={(value) => setFormData({ ...formData, is_rated: value === "true" })}
                    >
                      <SelectTrigger id="is_rated">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">{t("createColumn.isRatedNo")}</SelectItem>
                        <SelectItem value="true">{t("createColumn.isRatedYes")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 更新方式 */}
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t("createColumn.updateMethodTitle")}
                  <Badge variant="outline" className="text-xs border-primary text-primary">UpdateMethod</Badge>
                </CardTitle>
                <CardDescription>
                  {t("createColumn.updateMethodDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
                  <div className="flex gap-2">
                    <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-foreground">
                      {t("createColumn.updateRuleHint")}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="update_since_date">
                    {t("createColumn.updateStartTime")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="update_since_date"
                    type="datetime-local"
                    value={formData.update_since_date}
                    onChange={(e) => setFormData({ ...formData, update_since_date: e.target.value })}
                    className="block w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("createColumn.updateStartTimeHelp")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="update_day_number">
                      {t("createColumn.updateIntervalDays")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="update_day_number"
                      type="number"
                      min="1"
                      placeholder={t("createColumn.updateIntervalDaysPlaceholder")}
                      value={formData.update_day_number}
                      onChange={(e) => setFormData({ ...formData, update_day_number: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("createColumn.updateIntervalDaysHelp")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="update_installment_number">
                      {t("createColumn.updateIssuesPerUpdate")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="update_installment_number"
                      type="number"
                      min="1"
                      placeholder={t("createColumn.updateIssuesPerUpdatePlaceholder")}
                      value={formData.update_installment_number}
                      onChange={(e) => setFormData({ ...formData, update_installment_number: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("createColumn.updateIssuesPerUpdateHelp")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 支付方式 */}
            <Card className="hover:border-accent/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {t("createColumn.paymentMethodTitle")}
                  <Badge variant="outline" className="text-xs border-accent text-accent">PaymentMethod</Badge>
                </CardTitle>
                <CardDescription>
                  {t("createColumn.paymentMethodDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="pay_type">
                    {t("createColumn.payTypeLabel")} <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.pay_type}
                    onValueChange={(value) => setFormData({ ...formData, pay_type: value })}
                  >
                    <SelectTrigger id="pay_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">
                        {t("createColumn.payTypeBuyOut")}
                      </SelectItem>
                      <SelectItem value="1">
                        {t("createColumn.payTypeStake")}
                      </SelectItem>
                      <SelectItem value="2">
                        {t("createColumn.payTypeSubscribe")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {t("createColumn.payTypeHelp")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fee">
                      {t("createColumn.priceLabel")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fee"
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder={t("createColumn.pricePlaceholder")}
                      value={formData.fee}
                      onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("createColumn.priceHelp")}
                    </p>
                  </div>

                  {(formData.pay_type === "1" || formData.pay_type === "2") && (
                    <div className="space-y-2">
                      <Label htmlFor="subscription_time">
                        {t("createColumn.subscriptionPeriodLabel")} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="subscription_time"
                        type="number"
                        min="1"
                        placeholder={t("createColumn.subscriptionPeriodPlaceholder")}
                        value={formData.subscription_time}
                        onChange={(e) => setFormData({ ...formData, subscription_time: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("createColumn.subscriptionPeriodHelp")}
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-accent/10 border border-accent/20 p-4">
                  <div className="text-sm">
                    <p className="font-medium mb-2 text-accent">{t("createColumn.pricingTipsTitle")}</p>
                    <ul className="space-y-1.5 ml-4 text-foreground/80">
                      <li>
                        {t("createColumn.pricingTipsBuyOut")}
                      </li>
                      <li>
                        {t("createColumn.pricingTipsStake")}
                      </li>
                      <li>
                        {t("createColumn.pricingTipsSubscribe")}
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 提交按钮 */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 bg-transparent hover:bg-muted transition-colors"
                onClick={() => router.back()}
                disabled={isCreating}
              >
                {t("createColumn.cancel")}
              </Button>
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("createColumn.creating")}
                  </>
                ) : (
                  t("createColumn.create")
                )}
              </Button>
            </div>
          </form>

          {/* 创作建议 */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">{t("createColumn.tipsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>{t("createColumn.tipsItem1")}</li>
                <li>{t("createColumn.tipsItem2")}</li>
                <li>{t("createColumn.tipsItem3")}</li>
                <li>{t("createColumn.tipsItem4")}</li>
                <li>{t("createColumn.tipsItem5")}</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
