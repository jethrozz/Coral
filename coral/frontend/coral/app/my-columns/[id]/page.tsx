"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/context"
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { useNetworkVariable } from "@/lib/networkConfig"
import { SHOW_SUBSCRIPTION_STATS } from "@/constants"
import { 
  getUserOwnedColumns, 
  getUserOwnedInstallments,
  addInstallment,
  addFileToInstallment,
  publishInstallment,
  getOneInstallment,
  getColumnBalance,
  withdrawColumnBalance
} from "@/contract/coral_column"
import { getUserOwnDirectory, getUserOwnFile } from "@/contract/coral_server"
import type { ColumnCap, Installment, Directory, File, InstallmentWithFiles } from "@/shared/data"
import { 
  Plus, 
  FileText, 
  Folder, 
  FolderOpen, 
  Loader2, 
  ChevronRight, 
  ChevronDown,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Wallet,
  ArrowDownCircle
} from "lucide-react"

export default function ColumnManagePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { t, language } = useI18n()
  const currentAccount = useCurrentAccount()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const chain = useNetworkVariable("chain")
  const packageId = useNetworkVariable("packageId")
  const globalConfigId = useNetworkVariable("globalConfigId")

  const columnId = params.id as string
  const [column, setColumn] = useState<ColumnCap | null>(null)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(true)
  const [directories, setDirectories] = useState<Directory[]>([])
  const [allDirectories, setAllDirectories] = useState<Directory[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [vaultLoading, setVaultLoading] = useState(false)
  const [expandedDirs, setExpandedDirs] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [isAddInstallmentOpen, setIsAddInstallmentOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [isPublishing, setIsPublishing] = useState<string | null>(null)
  const [browsingInstallment, setBrowsingInstallment] = useState<InstallmentWithFiles | null>(null)
  const [isBrowsingInstallment, setIsBrowsingInstallment] = useState(false)
  const [isLoadingInstallment, setIsLoadingInstallment] = useState(false)
  const [columnBalance, setColumnBalance] = useState<number>(0)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  // 加载专栏信息
  useEffect(() => {
    if (currentAccount?.address && columnId) {
      loadColumn()
    }
  }, [currentAccount?.address, columnId])

  // 加载专栏余额
  useEffect(() => {
    if (column?.column_id) {
      loadBalance()
    }
  }, [column?.column_id])

  // 加载期刊列表
  useEffect(() => {
    if (column?.column_id) {
      loadInstallments()
    }
  }, [column?.column_id])

  const loadColumn = async () => {
    if (!currentAccount?.address) return
    
    setLoading(true)
    try {
      const userColumns = await getUserOwnedColumns(currentAccount.address)
      const foundColumn = userColumns.find((col) => col.column_id === columnId)
      if (foundColumn) {
        setColumn(foundColumn)
      } else {
        toast({
          title: "错误",
          description: "未找到该专栏",
          variant: "destructive",
        })
        router.push("/my-columns")
      }
    } catch (error) {
      console.error("加载专栏失败:", error)
      toast({
        title: "错误",
        description: "加载专栏失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadInstallments = async () => {
    if (!column?.column_id || !currentAccount?.address) return
    
    try {
      // 传入用户地址作为备用查询方案
      const installmentList = await getUserOwnedInstallments(column.column_id, currentAccount.address)
      setInstallments(installmentList)
    } catch (error) {
      console.error("加载期刊失败:", error)
      toast({
        title: "错误",
        description: "加载期刊失败",
        variant: "destructive",
      })
    }
  }

  const loadBalance = async () => {
    if (!column?.column_id) return
    
    setIsLoadingBalance(true)
    try {
      const balance = await getColumnBalance(column.column_id)
      setColumnBalance(balance)
    } catch (error) {
      console.error("加载余额失败:", error)
    } finally {
      setIsLoadingBalance(false)
    }
  }

  const handleWithdraw = async () => {
    if (!column || !currentAccount?.address) return
    
    if (columnBalance <= 0) {
      toast({
        title: t("myColumns.noBalance") || "无余额",
        description: t("myColumns.noBalanceDesc") || "当前专栏没有可提取的余额",
        variant: "destructive",
      })
      return
    }

    setIsWithdrawing(true)
    try {
      await withdrawColumnBalance({
        columnCapId: column.id,
        columnId: column.column_id,
        packageId,
        chain,
        signAndExecuteTransaction,
      })

      toast({
        title: t("myColumns.withdrawSuccess") || "提款成功",
        description: (t("myColumns.withdrawSuccessDesc") || "成功提取 {amount} SUI").replace("{amount}", columnBalance.toFixed(4)),
      })

      // 重新加载余额
      setTimeout(() => {
        loadBalance()
      }, 2000)
    } catch (error: any) {
      console.error("提款失败:", error)
      toast({
        title: t("myColumns.withdrawFailed") || "提款失败",
        description: error.message || t("myColumns.withdrawFailedDesc") || "提款操作失败，请重试",
        variant: "destructive",
      })
    } finally {
      setIsWithdrawing(false)
    }
  }

  const loadVaultFiles = async () => {
    if (!currentAccount?.address) return
    
    setVaultLoading(true)
    try {
      const [userDirs, userFiles] = await Promise.all([
        getUserOwnDirectory(currentAccount.address),
        getUserOwnFile(currentAccount.address),
      ])

      setAllDirectories(userDirs)
      const rootDirs = userDirs.filter((dir) => dir.is_root)
      setDirectories(rootDirs)
      setFiles(userFiles)
    } catch (error) {
      console.error("加载Vault失败:", error)
      toast({
        title: "错误",
        description: "加载Vault文件失败",
        variant: "destructive",
      })
    } finally {
      setVaultLoading(false)
    }
  }

  const renderDirectoryTree = (dir: Directory) => {
    const childDirs = allDirectories.filter((d) => d.parent === dir.id)
    const dirFiles = files.filter((f) => f.belong_dir === dir.id)

    const isRoot = dir.is_root
    const isExpanded = isRoot || expandedDirs.includes(dir.id)

    const toggleDir = () => {
      if (isRoot) return
      setExpandedDirs((prev) =>
        prev.includes(dir.id) ? prev.filter((id) => id !== dir.id) : [...prev, dir.id]
      )
    }

    return (
      <div key={dir.id} className="space-y-1">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm hover:bg-muted/60 rounded px-1 py-1"
          onClick={toggleDir}
        >
          <div className="flex items-center gap-2">
            {childDirs.length > 0 || dirFiles.length > 0 ? (
              isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )
            ) : (
              <span className="inline-block w-3" />
            )}
            <Folder className="h-3 w-3 text-primary" />
            <span className="font-medium truncate">{dir.name}</span>
          </div>
        </button>

        {isExpanded && dirFiles.length > 0 && (
          <div className="mt-1 space-y-1 pl-4 border-l border-border/40">
            {dirFiles.map((file) => {
              const isSelected = selectedFiles.includes(file.id)
              const canSelect = !isSelected && selectedFiles.length < 7
              return (
                <div
                  key={file.id}
                  className={`flex items-center justify-between text-xs rounded px-2 py-1 ${
                    canSelect ? "hover:bg-muted/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedFiles(selectedFiles.filter((id) => id !== file.id))
                        } else if (canSelect) {
                          setSelectedFiles([...selectedFiles, file.id])
                        }
                      }}
                      disabled={!isSelected && !canSelect}
                      className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? "bg-primary border-primary"
                          : canSelect
                          ? "border-muted-foreground/40 cursor-pointer"
                          : "border-muted-foreground/20 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                    </button>
                    <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{file.title}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {isExpanded && childDirs.length > 0 && (
          <div className="mt-2 space-y-2 pl-4 border-l border-border/60">
            {childDirs.map((child) => renderDirectoryTree(child))}
          </div>
        )}
      </div>
    )
  }

  const handleAddInstallment = async () => {
    if (!column || selectedFiles.length === 0) {
      toast({
        title: "错误",
        description: "请至少选择一个文件",
        variant: "destructive",
      })
      return
    }

    if (selectedFiles.length > 7) {
      toast({
        title: "错误",
        description: "一个期刊最多只能关联7个文件",
        variant: "destructive",
      })
      return
    }

    setIsAdding(true)
    try {
      // 调用合约创建期刊（支持1-7个文件）
      await addInstallment({
        columnCapId: column.id,
        columnId: column.column_id,
        fileIds: selectedFiles,
        packageId,
        chain,
        signAndExecuteTransaction,
      })

      toast({
        title: "成功",
        description: `期刊创建成功，已关联 ${selectedFiles.length} 个文件`,
      })

      // 刷新期刊列表
      setTimeout(() => {
        loadInstallments()
        setIsAddInstallmentOpen(false)
        setSelectedFiles([])
      }, 2000)
    } catch (error: any) {
      console.error("创建期刊失败:", error)
      toast({
        title: "错误",
        description: error.message || "创建期刊失败",
        variant: "destructive",
      })
    } finally {
      setIsAdding(false)
    }
  }

  const handlePublishInstallment = async (installmentId: string | { id: string }) => {
    if (!column) return

    // 确保 installmentId 是字符串
    const installmentIdStr = typeof installmentId === 'string' ? installmentId : (installmentId as any)?.id || String(installmentId)
    const columnCapIdStr = typeof column.id === 'string' ? column.id : (column.id as any)?.id || String(column.id)
    const columnIdStr = typeof column.column_id === 'string' ? column.column_id : (column.column_id as any)?.id || String(column.column_id)

    setIsPublishing(installmentIdStr)
    try {
      await publishInstallment({
        columnCapId: columnCapIdStr,
        columnId: columnIdStr,
        installmentId: installmentIdStr,
        packageId,
        chain,
        signAndExecuteTransaction,
      })

      toast({
        title: "成功",
        description: "期刊发布成功",
      })

      // 刷新期刊列表
      setTimeout(() => {
        loadInstallments()
      }, 2000)
    } catch (error: any) {
      console.error("发布期刊失败:", error)
      toast({
        title: "错误",
        description: error.message || "发布期刊失败",
        variant: "destructive",
      })
    } finally {
      setIsPublishing(null)
    }
  }

  const openAddInstallment = () => {
    setIsAddInstallmentOpen(true)
    setSelectedFiles([])
    loadVaultFiles()
  }

  const handleBrowseInstallment = async (installmentId: string) => {
    setIsLoadingInstallment(true)
    setIsBrowsingInstallment(true)
    try {
      const installmentDetail = await getOneInstallment(installmentId)
      if (installmentDetail) {
        setBrowsingInstallment(installmentDetail)
      } else {
        toast({
          title: "错误",
          description: "无法加载期刊详情",
          variant: "destructive",
        })
        setIsBrowsingInstallment(false)
      }
    } catch (error) {
      console.error("加载期刊详情失败:", error)
      toast({
        title: "错误",
        description: "加载期刊详情失败",
        variant: "destructive",
      })
      setIsBrowsingInstallment(false)
    } finally {
      setIsLoadingInstallment(false)
    }
  }

  if (!currentAccount) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <Card className="p-12 text-center">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">{t("common.connectWalletTitle")}</h2>
              <p className="text-muted-foreground">{t("common.connectWalletHint")}</p>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <Card className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">{t("common.loading")}</p>
          </Card>
        </div>
      </div>
    )
  }

  if (!column) {
    return null
  }

  const publishedInstallments = installments.filter((i) => i.is_published)
  const draftInstallments = installments.filter((i) => !i.is_published)

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="space-y-8">
          {/* 专栏信息 */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-2xl">{column.name}</CardTitle>
                    <Badge variant={column.other?.status === 1 ? "default" : "secondary"}>
                      {column.other?.status === 1 ? t("myColumns.published") : t("myColumns.draft")}
                    </Badge>
                  </div>
                  <CardDescription>{column.description}</CardDescription>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                    {SHOW_SUBSCRIPTION_STATS && (
                      <>
                        <span>
                          {column.other?.subscriptions || 0} {t("myColumns.subscribers")}
                        </span>
                        <span>·</span>
                      </>
                    )}
                    <span>
                      {installments.length} {t("myColumns.issues")}
                    </span>
                    <span>·</span>
                    <span>
                      {publishedInstallments.length} {t("myColumns.published")}
                    </span>
                    <span>·</span>
                    <span>
                      {draftInstallments.length} {t("myColumns.draft")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" asChild>
                    <a href={`/columns/${column.column_id}`} target="_blank">
                      <Eye className="mr-2 h-4 w-4" />
                      {t("myColumns.view")}
                    </a>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {t("myColumns.availableBalance") || "可提取余额"}
                    </div>
                    <div className="text-2xl font-bold">
                      {isLoadingBalance ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        `${columnBalance.toFixed(4)} SUI`
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || isLoadingBalance || columnBalance <= 0}
                  className="gap-2"
                >
                  {isWithdrawing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("myColumns.withdrawing") || "提款中..."}
                    </>
                  ) : (
                    <>
                      <ArrowDownCircle className="h-4 w-4" />
                      {t("myColumns.withdraw") || "提取"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 操作栏 */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {t("myColumns.installmentManagement")}
            </h2>
            <Button onClick={openAddInstallment}>
              <Plus className="mr-2 h-4 w-4" />
              {t("myColumns.addInstallment")}
            </Button>
          </div>

          {/* 已发布期刊 */}
          {publishedInstallments.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                {t("myColumns.publishedInstallments")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publishedInstallments
                  .sort((a, b) => b.no - a.no)
                  .map((installment) => (
                    <Card key={installment.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {t("myColumns.issue")}
                              {installment.no}
                              {t("myColumns.period")}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {installment.files.length}{" "}
                              {t("myColumns.files")}
                            </CardDescription>
                          </div>
                          <Badge variant="default" className="bg-green-500">
                            {t("myColumns.published")}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {installment.published_at && (
                          <p className="text-xs text-muted-foreground">
                            {t("myColumns.publishedAt")}:{" "}
                            {new Date(installment.published_at).toLocaleDateString(
                              language === "zh" ? "zh-CN" : "en-US"
                            )}
                          </p>
                        )}
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => handleBrowseInstallment(installment.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {t("myColumns.browse")}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* 未发布期刊 */}
          {draftInstallments.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <XCircle className="h-5 w-5 text-orange-500" />
                {t("myColumns.draftInstallments")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {draftInstallments
                  .sort((a, b) => b.no - a.no)
                  .map((installment) => (
                    <Card key={installment.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              {t("myColumns.issue")}
                              {installment.no}
                              {t("myColumns.period")}
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {installment.files.length}{" "}
                              {t("myColumns.files")}
                            </CardDescription>
                          </div>
                          <Badge variant="secondary">
                            {t("myColumns.draft")}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Button
                          className="w-full"
                          variant="outline"
                          onClick={() => handleBrowseInstallment(installment.id)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {t("myColumns.browse")}
                        </Button>
                        <Button
                          className="w-full"
                          onClick={() => handlePublishInstallment(installment.id)}
                          disabled={(() => {
                            const installmentIdStr = typeof installment.id === 'string' ? installment.id : (installment.id as any)?.id || String(installment.id)
                            return isPublishing === installmentIdStr
                          })()}
                        >
                          {(() => {
                            const installmentIdStr = typeof installment.id === 'string' ? installment.id : (installment.id as any)?.id || String(installment.id)
                            return isPublishing === installmentIdStr
                          })() ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("myColumns.publishingInstallment")}
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              {t("myColumns.publishInstallment")}
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* 空状态 */}
          {installments.length === 0 && (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                <h3 className="text-xl font-semibold">
                  {t("myColumns.noInstallments")}
                </h3>
                <p className="text-muted-foreground">
                  {t("myColumns.clickToCreateFirst")}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* 浏览期刊抽屉 */}
      {isBrowsingInstallment && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-background/80 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => {
            setIsBrowsingInstallment(false)
            setBrowsingInstallment(null)
          }} />
          <Card className="relative z-10 h-full w-full max-w-md md:max-w-lg flex flex-col shadow-xl border-l border-border rounded-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {browsingInstallment
                    ? `${t("myColumns.issue")}${browsingInstallment.no}${t("myColumns.period")}`
                    : t("myColumns.browseInstallment")}
                </CardTitle>
                <CardDescription className="mt-1">
                  {browsingInstallment
                    ? `${browsingInstallment.files.length} ${t("myColumns.files")}`
                    : t("myColumns.installmentFiles")}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2"
                onClick={() => {
                  setIsBrowsingInstallment(false)
                  setBrowsingInstallment(null)
                }}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto space-y-4">
              {isLoadingInstallment ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : browsingInstallment && browsingInstallment.files.length > 0 ? (
                <div className="border rounded-md p-4 bg-muted/40">
                  <p className="text-sm font-medium mb-2">
                    {t("myColumns.installmentFiles")}
                  </p>
                  <div className="space-y-2">
                    {browsingInstallment.files.map((file, index) => {
                      // 确保 key 是唯一的字符串
                      const fileKey = typeof file.id === 'string' ? file.id : `file-${index}-${browsingInstallment.id}`;
                      return (
                        <div
                          key={fileKey}
                          className="flex items-start gap-2 text-sm text-muted-foreground p-2 rounded hover:bg-background/50 transition-colors"
                        >
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                            <span className="text-xs font-medium text-primary">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium text-foreground truncate">{file.title}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground pl-5">
                              <span>
                                {t("myColumns.createdAt")}:{" "}
                                {file.created_at.toLocaleDateString(
                                  language === "zh" ? "zh-CN" : "en-US"
                                )}
                              </span>
                              <span>
                                {t("myColumns.updatedAt")}:{" "}
                                {file.updated_at.toLocaleDateString(
                                  language === "zh" ? "zh-CN" : "en-US"
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {t("myColumns.noFilesInInstallment")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 新增期刊弹窗 */}
      {isAddInstallmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border">
              <div>
                <CardTitle>
                  {t("myColumns.addInstallment")}
                </CardTitle>
                <CardDescription>
                  {t("myColumns.selectFilesFromVault")}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsAddInstallmentOpen(false)
                  setSelectedFiles([])
                }}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto space-y-4 pt-6">
              {vaultLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
                  <p className="text-muted-foreground">
                    {t("common.loading")}
                  </p>
                </div>
              ) : directories.length > 0 ? (
                <div className="space-y-4">
                  {directories.map((dir) => (
                    <div key={dir.id} className="border rounded-md p-4 bg-muted/40">
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-primary" />
                        {dir.name}
                      </p>
                      <div className="text-sm text-muted-foreground space-y-2">
                        {renderDirectoryTree(dir)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {t("myColumns.noVaultFiles")}
                  </p>
                </div>
              )}

              {selectedFiles.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium mb-2">
                    {t("myColumns.selected")}: {selectedFiles.length}/7{" "}
                    {t("myColumns.files")}
                  </p>
                  {selectedFiles.length >= 7 && (
                    <p className="text-xs text-muted-foreground">
                      {t("myColumns.maxFileLimit")}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
            <div className="border-t border-border p-4 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsAddInstallmentOpen(false)
                  setSelectedFiles([])
                }}
                disabled={isAdding}
              >
                {t("myColumns.cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddInstallment}
                disabled={isAdding || selectedFiles.length === 0 || selectedFiles.length > 7}
              >
                {isAdding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("myColumns.creating")}
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("myColumns.createInstallment")}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

