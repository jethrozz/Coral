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

export default function CreateColumnPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)
  const { t, language } = useI18n()

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

    // 验证必填字段
    if (!formData.name || !formData.desc || !formData.cover_img_url || 
        !formData.plan_installment_number || !formData.update_since_date ||
        !formData.update_day_number || !formData.update_installment_number ||
        !formData.fee) {
      toast({
        title: language === "zh" ? "请填写所有必填项" : "Please fill all required fields",
        description: language === "zh" ? "请完整填写表单后再提交" : "Complete the form before submitting",
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
      
      await new Promise((resolve) => setTimeout(resolve, 2000))

      toast({
        title: language === "zh" ? "专栏创建成功！" : "Column Created Successfully!",
        description: language === "zh" ? "你的专栏已经创建，可以开始创作了" : "Your column is now created",
      })

      router.push("/my-columns")
    } catch (error) {
      console.error("创建专栏失败:", error)
      toast({
        title: language === "zh" ? "创建失败" : "Creation Failed",
        description: language === "zh" ? "创建专栏时出错，请重试" : "Error creating column, please try again",
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
              {language === "zh" ? "创建新专栏" : "Create New Column"}
            </h1>
            <p className="text-muted-foreground">
              {language === "zh" 
                ? "填写专栏信息，设置更新和支付方式" 
                : "Fill in column details and set update and payment methods"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 基本信息 */}
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle>{language === "zh" ? "基本信息" : "Basic Information"}</CardTitle>
                <CardDescription>
                  {language === "zh" ? "设置专栏的基本信息" : "Set basic column information"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {language === "zh" ? "专栏名称" : "Column Name"} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder={language === "zh" ? "输入专栏名称" : "Enter column name"}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="desc">
                    {language === "zh" ? "专栏描述" : "Description"} <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="desc"
                    placeholder={language === "zh" ? "介绍你的专栏内容和特色" : "Describe your column content and features"}
                    rows={5}
                    value={formData.desc}
                    onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === "zh"
                      ? "详细的描述可以帮助读者更好地了解你的专栏"
                      : "Detailed description helps readers understand your column"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cover_img_url">
                    {language === "zh" ? "封面图片地址" : "Cover Image URL"} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cover_img_url"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={formData.cover_img_url}
                    onChange={(e) => setFormData({ ...formData, cover_img_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === "zh"
                      ? "推荐使用 16:9 比例的图片，支持 https 链接"
                      : "Recommended 16:9 ratio, supports https links"}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="plan_installment_number">
                      {language === "zh" ? "计划发布期数" : "Planned Issues"} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="plan_installment_number"
                      type="number"
                      min="1"
                      placeholder={language === "zh" ? "如：12" : "e.g., 12"}
                      value={formData.plan_installment_number}
                      onChange={(e) => setFormData({ ...formData, plan_installment_number: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="is_rated">
                      {language === "zh" ? "是否支持打分" : "Allow Rating"}
                    </Label>
                    <Select
                      value={formData.is_rated ? "true" : "false"}
                      onValueChange={(value) => setFormData({ ...formData, is_rated: value === "true" })}
                    >
                      <SelectTrigger id="is_rated">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="false">{language === "zh" ? "不支持" : "No"}</SelectItem>
                        <SelectItem value="true">{language === "zh" ? "支持" : "Yes"}</SelectItem>
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
                  {language === "zh" ? "更新方式" : "Update Method"}
                  <Badge variant="outline" className="text-xs border-primary text-primary">UpdateMethod</Badge>
                </CardTitle>
                <CardDescription>
                  {language === "zh" 
                    ? "设置专栏的更新频率和规则" 
                    : "Set column update frequency and rules"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
                  <div className="flex gap-2">
                    <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-foreground">
                      {language === "zh"
                        ? "更新规则：从开始时间起，每隔指定天数更新指定期数。例如：从2024年1月1日起，每7天更新1期。"
                        : "Update rule: From start time, update specified number of issues every specified days. E.g., from Jan 1, 2024, update 1 issue every 7 days."}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="update_since_date">
                    {language === "zh" ? "开始时间" : "Start Time"} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="update_since_date"
                    type="datetime-local"
                    value={formData.update_since_date}
                    onChange={(e) => setFormData({ ...formData, update_since_date: e.target.value })}
                    className="block w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === "zh"
                      ? "选择专栏的更新开始时间"
                      : "Select the start time for column updates"}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="update_day_number">
                      {language === "zh" ? "更新间隔（天）" : "Update Interval (days)"} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="update_day_number"
                      type="number"
                      min="1"
                      placeholder={language === "zh" ? "如：7" : "e.g., 7"}
                      value={formData.update_day_number}
                      onChange={(e) => setFormData({ ...formData, update_day_number: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {language === "zh" ? "每多少天更新一次" : "Days between updates"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="update_installment_number">
                      {language === "zh" ? "每次更新期数" : "Issues per Update"} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="update_installment_number"
                      type="number"
                      min="1"
                      placeholder={language === "zh" ? "如：1" : "e.g., 1"}
                      value={formData.update_installment_number}
                      onChange={(e) => setFormData({ ...formData, update_installment_number: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {language === "zh" ? "每次更新多少期" : "Number of issues per update"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 支付方式 */}
            <Card className="hover:border-accent/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {language === "zh" ? "支付方式" : "Payment Method"}
                  <Badge variant="outline" className="text-xs border-accent text-accent">PaymentMethod</Badge>
                </CardTitle>
                <CardDescription>
                  {language === "zh" 
                    ? "设置专栏的订阅价格和支付模式" 
                    : "Set subscription price and payment mode"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="pay_type">
                    {language === "zh" ? "支付类型" : "Payment Type"} <span className="text-destructive">*</span>
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
                        {language === "zh" ? "买断 (一次性付费)" : "Buy Out (One-time Payment)"}
                      </SelectItem>
                      <SelectItem value="1">
                        {language === "zh" ? "质押 (质押代币)" : "Stake (Stake Tokens)"}
                      </SelectItem>
                      <SelectItem value="2">
                        {language === "zh" ? "订阅 (周期性付费)" : "Subscribe (Recurring Payment)"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {language === "zh"
                      ? "选择适合你专栏的支付模式"
                      : "Choose a payment mode suitable for your column"}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fee">
                      {language === "zh" ? "价格 (SUI)" : "Price (SUI)"} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fee"
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder={language === "zh" ? "如：0.5" : "e.g., 0.5"}
                      value={formData.fee}
                      onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {language === "zh"
                        ? "设定合理的价格，精度为 9 位小数"
                        : "Set reasonable price, precision to 9 decimals"}
                    </p>
                  </div>

                  {(formData.pay_type === "1" || formData.pay_type === "2") && (
                    <div className="space-y-2">
                      <Label htmlFor="subscription_time">
                        {language === "zh" ? "订阅时长（天）" : "Subscription Period (days)"} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="subscription_time"
                        type="number"
                        min="1"
                        placeholder={language === "zh" ? "如：30" : "e.g., 30"}
                        value={formData.subscription_time}
                        onChange={(e) => setFormData({ ...formData, subscription_time: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        {language === "zh"
                          ? "质押或订阅的有效时长"
                          : "Valid period for stake or subscription"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-accent/10 border border-accent/20 p-4">
                  <div className="text-sm">
                    <p className="font-medium mb-2 text-accent">{language === "zh" ? "💡 定价建议" : "💡 Pricing Tips"}</p>
                    <ul className="space-y-1.5 ml-4 text-foreground/80">
                      <li>
                        {language === "zh"
                          ? "• 买断：适合有明确期数的专栏，用户一次性付费获得所有内容"
                          : "• Buy Out: Suitable for columns with fixed issues, one-time payment for all content"}
                      </li>
                      <li>
                        {language === "zh"
                          ? "• 质押：用户质押代币，到期后可赎回，适合长期订阅"
                          : "• Stake: Users stake tokens, redeemable after expiry, suitable for long-term"}
                      </li>
                      <li>
                        {language === "zh"
                          ? "• 订阅：按周期付费，灵活度高，适合持续更新的专栏"
                          : "• Subscribe: Periodic payment, flexible, suitable for ongoing updates"}
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
                {language === "zh" ? "取消" : "Cancel"}
              </Button>
              <Button 
                type="submit" 
                className="flex-1" 
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {language === "zh" ? "创建中..." : "Creating..."}
                  </>
                ) : (
                  language === "zh" ? "创建专栏" : "Create Column"
                )}
              </Button>
            </div>
          </form>

          {/* 创作建议 */}
          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-lg">{language === "zh" ? "创作建议" : "Tips"}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  {language === "zh"
                    ? "• 选择一个清晰明确的主题，让读者容易理解"
                    : "• Choose a clear theme for easy understanding"}
                </li>
                <li>
                  {language === "zh"
                    ? "• 定期更新内容，保持与订阅者的互动"
                    : "• Update regularly and engage with subscribers"}
                </li>
                <li>
                  {language === "zh"
                    ? "• 价格设置要合理，可以参考同类专栏"
                    : "• Set reasonable prices, refer to similar columns"}
                </li>
                <li>
                  {language === "zh"
                    ? "• 用高质量的内容吸引和留住订阅者"
                    : "• Attract and retain subscribers with quality content"}
                </li>
                <li>
                  {language === "zh"
                    ? "• 制定合理的更新计划，避免过于频繁或稀疏"
                    : "• Plan reasonable update schedule, avoid too frequent or sparse"}
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
