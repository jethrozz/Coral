"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/lib/i18n/context"
import { useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit"
import { useNetworkVariable } from "@/lib/networkConfig"
import { SuiClient } from "@mysten/sui/client"
import { RPC_URL, PACKAGE_ID, SHOW_SUBSCRIPTION_STATS } from "@/constants"
import { 
  getColumnById,
  getUserOwnedInstallments,
  getOneInstallment
} from "@/contract/coral_column"
import { getUserOwnedColumns } from "@/contract/coral_column"
import type { ColumnOtherInfo, Installment, InstallmentWithFiles, File } from "@/shared/data"
import { 
  FileText, 
  ChevronRight, 
  ChevronDown,
  Loader2,
  Eye,
  Lock,
  Calendar,
  Clock
} from "lucide-react"
import { 
  downloadAndDecrypt, 
  constructCreatorMoveCall,
  constructSubscribeMoveCall,
  MoveCallConstructor,
  MoveCallConstructorWithIds
} from "@/lib/sealUtil"
import { SessionKey } from "@mysten/seal"
import { getMySubscriptions } from "@/contract/coral_column"
import ReactMarkdown from "react-markdown"

const TTL_MIN = 10

export default function ColumnDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast} = useToast()
  const { t, language } = useI18n()
  const currentAccount = useCurrentAccount()
  const { mutate: signPersonalMessage } = useSignPersonalMessage()
  const packageId = useNetworkVariable("packageId")
  
  // 从 pathname 解析 ID，支持静态导出
  const columnId = id || pathname.split('/').pop() || ''
  const [column, setColumn] = useState<ColumnOtherInfo | null>(null)
  const [installments, setInstallments] = useState<Installment[]>([])
  const [expandedInstallments, setExpandedInstallments] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedInstallment, setSelectedInstallment] = useState<InstallmentWithFiles | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptedFiles, setDecryptedFiles] = useState<Map<string, string>>(new Map())
  const [currentSessionKey, setCurrentSessionKey] = useState<SessionKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCreator, setIsCreator] = useState(false)
  const [columnCap, setColumnCap] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)

  // 加载专栏信息
  useEffect(() => {
    if (columnId) {
      loadColumn()
    }
  }, [columnId])

  // 检查访问权限
  useEffect(() => {
    if (column?.id && currentAccount?.address) {
      checkAccess()
    }
  }, [column?.id, currentAccount?.address])

  // 加载期刊列表（在权限检查后）
  useEffect(() => {
    if (column?.id && currentAccount?.address) {
      loadInstallments()
    }
  }, [column?.id, currentAccount?.address, isCreator])

  const loadColumn = async () => {
    setLoading(true)
    try {
      const columnData = await getColumnById(columnId)
      if (columnData) {
        setColumn(columnData)
      } else {
        toast({
          title: "错误",
          description: "未找到该专栏",
          variant: "destructive",
        })
        router.push("/")
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
    if (!column?.id || !currentAccount?.address) return
    
    try {
      const installmentList = await getUserOwnedInstallments(column.id, currentAccount.address)
      
      // 如果是创作者，显示所有期刊；否则只显示已发布的
      let filteredInstallments = installmentList
      if (!isCreator) {
        filteredInstallments = installmentList.filter((i) => i.is_published)
      }
      
      setInstallments(filteredInstallments.sort((a, b) => b.no - a.no))
    } catch (error) {
      console.error("加载期刊失败:", error)
    }
  }

  const checkAccess = async () => {
    if (!currentAccount?.address || !column) return

    try {
      // 检查是否是创作者
      const userColumns = await getUserOwnedColumns(currentAccount.address)
      const foundColumn = userColumns.find((col) => col.column_id === column.id)
      if (foundColumn) {
        setIsCreator(true)
        setColumnCap(foundColumn)
        return
      }

      // 检查是否有订阅
      const subscriptions = await getMySubscriptions(currentAccount.address)
      const foundSubscription = subscriptions.find((sub) => sub.column_id === column.id)
      if (foundSubscription) {
        setSubscription(foundSubscription)
      }
    } catch (error) {
      console.error("检查访问权限失败:", error)
    }
  }

  const toggleInstallment = async (installmentId: string) => {
    const newExpanded = new Set(expandedInstallments)
    if (newExpanded.has(installmentId)) {
      newExpanded.delete(installmentId)
      setSelectedFile(null)
      setSelectedInstallment(null)
    } else {
      newExpanded.add(installmentId)
      // 加载期刊详情
      try {
        const installmentDetail = await getOneInstallment(installmentId)
        if (installmentDetail) {
          setSelectedInstallment(installmentDetail)
        }
      } catch (error) {
        console.error("加载期刊详情失败:", error)
      }
    }
    setExpandedInstallments(newExpanded)
  }

  const handleFileClick = async (file: File) => {
    if (!selectedInstallment) return

    // 检查文件是否已解密
    if (decryptedFiles.has(file.id)) {
      setSelectedFile(file)
      return
    }

    // 检查是否有访问权限
    if (!isCreator && !subscription) {
      toast({
        title: "无访问权限",
        description: "请先订阅该专栏",
        variant: "destructive",
      })
      return
    }

    // 弹出签名提示
    setSelectedFile(file)
    await handleDecryptFile(file)
  }

  const handleDecryptFile = async (file: File) => {
    if (!selectedInstallment || !currentAccount?.address) return

    setIsDecrypting(true)
    setError(null)

    try {
      // 检查 session key
      if (
        currentSessionKey &&
        !currentSessionKey.isExpired() &&
        currentSessionKey.getAddress() === currentAccount.address
      ) {
        await decryptFile(file, currentSessionKey)
        return
      }

      // 创建新的 session key
      setCurrentSessionKey(null)
      const suiClient = new SuiClient({ url: RPC_URL })
      const sessionKey = await SessionKey.create({
        address: currentAccount.address,
        packageId: PACKAGE_ID,
        ttlMin: TTL_MIN,
        suiClient,
      })

      // 请求签名
      signPersonalMessage(
        {
          message: sessionKey.getPersonalMessage(),
        },
        {
          onSuccess: async (result) => {
            await sessionKey.setPersonalMessageSignature(result.signature)
            setCurrentSessionKey(sessionKey)
            await decryptFile(file, sessionKey)
          },
          onError: (error: any) => {
            console.error("签名失败:", error)
            setError("签名失败，请重试")
            setIsDecrypting(false)
          },
        }
      )
    } catch (error: any) {
      console.error("解密失败:", error)
      setError(error.message || "解密失败，请重试")
      setIsDecrypting(false)
    }
  }

  const decryptFile = async (file: File, sessionKey: SessionKey) => {
    if (!selectedInstallment || !column) return

    try {
      // 确保所有 ID 都是字符串
      const fileId = typeof file.id === 'string' ? file.id : (file.id as any)?.id || String(file.id)
      const installmentId = typeof selectedInstallment.id === 'string' ? selectedInstallment.id : (selectedInstallment.id as any)?.id || String(selectedInstallment.id)
      const columnIdForMoveCall = typeof column.id === 'string' ? column.id : (column.id as any)?.id || String(column.id)
      
      // 确保订阅相关的 ID 都是字符串
      const subscriptionId = subscription?.id ? (typeof subscription.id === 'string' ? subscription.id : (subscription.id as any)?.id || String(subscription.id)) : ''
      const paymentMethodId = column.payment_method?.id ? (typeof column.payment_method.id === 'string' ? column.payment_method.id : (column.payment_method.id as any)?.id || String(column.payment_method.id)) : ''
      const columnCapId = columnCap?.id ? (typeof columnCap.id === 'string' ? columnCap.id : (columnCap.id as any)?.id || String(columnCap.id)) : ''
      
      console.log("decryptFile - 使用的 ID:", {
        packageId: PACKAGE_ID,
        fileId,
        installmentId,
        columnIdForMoveCall,
        columnCapId,
        subscriptionId,
        paymentMethodId
      })

      // 验证所有必需的 ID 都存在且为有效字符串
      if (!fileId || !installmentId || !columnIdForMoveCall) {
        throw new Error("缺少必需的文件或期刊信息")
      }

      let moveCallConstructor: MoveCallConstructor | MoveCallConstructorWithIds

      if (isCreator && columnCap && columnCapId) {
        // 创作者
        console.log("decryptFile - creator")
        if (!columnCapId) {
          throw new Error("缺少 ColumnCap ID")
        }
        moveCallConstructor = constructCreatorMoveCall(
          PACKAGE_ID,
          columnCapId,
          columnIdForMoveCall,
          fileId
        )
      } else if (subscription && column.payment_method && subscriptionId && paymentMethodId) {
        // 订阅者
        console.log("decryptFile - sub")

        if (!subscriptionId || !paymentMethodId) {
          throw new Error("缺少订阅或支付方式信息")
        }
        moveCallConstructor = constructSubscribeMoveCall(
          PACKAGE_ID,
          subscriptionId,
          columnIdForMoveCall,
          paymentMethodId,
          fileId,
          installmentId
        )
      } else {
        throw new Error("无访问权限")
      }

      // 创建临时文件数组用于解密
      const filesToDecrypt: File[] = [{ ...file }]

      await downloadAndDecrypt(
        filesToDecrypt,
        sessionKey,
        moveCallConstructor,
        setError,
        (decryptedFiles) => {
          // 更新解密后的文件内容
          const decryptedFile = decryptedFiles.find((f) => f.id === file.id)
          if (decryptedFile && decryptedFile.content) {
            const newDecrypted = new Map<string, string>()
            newDecrypted.set(file.id, decryptedFile.content)
            setDecryptedFiles(newDecrypted)
            setSelectedFile({ ...file, content: decryptedFile.content })
          }
        }
      )

      setIsDecrypting(false)
    } catch (error: any) {
      console.error("解密文件失败:", error)
      setError(error.message || "解密失败")
      setIsDecrypting(false)
    }
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
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <Card className="p-12 text-center">
            <h2 className="text-2xl font-bold mb-4">专栏未找到</h2>
            <Button onClick={() => router.push("/")}>返回首页</Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="flex h-[calc(100vh-4rem)]">
        {/* 左侧：期刊列表 */}
        <div className="w-80 border-r border-border bg-muted/30 flex flex-col">
          <div className="p-6 border-b border-border">
            <h2 className="text-lg font-semibold mb-2">{column.name}</h2>
            <p className="text-sm text-muted-foreground line-clamp-2">{column.desc}</p>
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <span>{installments.length} {t("myColumns.issues")}</span>
              {SHOW_SUBSCRIPTION_STATS && (
                <span>{column.subscriptions} {t("myColumns.subscribers")}</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {installments.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-sm text-muted-foreground">暂无期刊</p>
              </div>
            ) : (
              installments.map((installment) => {
                const isExpanded = expandedInstallments.has(installment.id)
                return (
                  <Card key={installment.id} className="overflow-hidden">
                    <button
                      onClick={() => toggleInstallment(installment.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="font-medium text-sm">
                            {t("myColumns.issue")}{installment.no}{t("myColumns.period")}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {installment.files.length} {t("myColumns.files")}
                          </div>
                        </div>
                        {installment.is_published && (
                          <Badge variant="default" className="bg-green-500 text-xs">
                            {t("myColumns.published")}
                          </Badge>
                        )}
                      </div>
                    </button>

                    {isExpanded && selectedInstallment && (
                      <div className="border-t border-border p-2 space-y-1">
                        {selectedInstallment.files.map((file, index) => {
                          const isDecrypted = decryptedFiles.has(file.id)
                          const isSelected = selectedFile?.id === file.id
                          return (
                            <button
                              key={file.id || `file-${index}`}
                              onClick={() => handleFileClick(file)}
                              className={`w-full p-2 rounded text-left text-sm transition-colors ${
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-muted/50"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="truncate flex-1">{file.title}</span>
                                {isDecrypted ? (
                                  <Eye className="h-3.5 w-3.5 flex-shrink-0" />
                                ) : (
                                  <Lock className="h-3.5 w-3.5 flex-shrink-0" />
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        </div>

        {/* 右侧：文件内容 */}
        <div className="flex-1 flex flex-col">
          {selectedFile ? (
            <>
              {/* 文件头部 */}
              <div className="p-6 border-b border-border bg-muted/30">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold mb-2 truncate">{selectedFile.title}</h1>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {t("myColumns.createdAt")}:{" "}
                          {selectedFile.created_at.toLocaleDateString(
                            language === "zh" ? "zh-CN" : "en-US"
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          {t("myColumns.updatedAt")}:{" "}
                          {selectedFile.updated_at.toLocaleDateString(
                            language === "zh" ? "zh-CN" : "en-US"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!decryptedFiles.has(selectedFile.id) && (
                    <Button
                      onClick={() => handleDecryptFile(selectedFile)}
                      disabled={isDecrypting || (!isCreator && !subscription)}
                    >
                      {isDecrypting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("common.loading")}
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          解密
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* 文件内容 */}
              <div className="flex-1 overflow-y-auto p-8">
                {error && (
                  <Card className="mb-4 border-destructive">
                    <CardContent className="p-4">
                      <p className="text-sm text-destructive">{error}</p>
                    </CardContent>
                  </Card>
                )}
                {decryptedFiles.has(selectedFile.id) ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-p:text-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground">
                    <ReactMarkdown>
                      {decryptedFiles.get(selectedFile.id) || ""}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Lock className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="text-xl font-semibold mb-2">文件已加密</h3>
                    <p className="text-muted-foreground mb-4">
                      {isCreator || subscription
                        ? "点击上方解密按钮查看文件内容"
                        : "请先订阅该专栏以查看内容"}
                    </p>
                    {(!isCreator && !subscription) && (
                      <Button onClick={() => router.push(`/columns/${columnId}`)}>
                        前往订阅
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-20 w-20 text-muted-foreground mx-auto mb-6 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">选择文件</h3>
                <p className="text-muted-foreground">
                  从左侧选择一个期刊，然后点击文件查看内容
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

