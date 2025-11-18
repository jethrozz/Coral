"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Plus, Users, TrendingUp, DollarSign, FileText, BarChart3, Folder, FolderOpen, Loader2, ChevronRight, ChevronDown, Trash2 } from "lucide-react"
import Link from "next/link"
import { useI18n } from "@/lib/i18n/context"
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit"
import { useNetworkVariable } from "@/lib/networkConfig"
import { useToast } from "@/hooks/use-toast"
import { getUserOwnedColumns } from "@/contract/coral_column"
import { getUserOwnDirectory, getUserOwnFile, deleteDirectory } from "@/contract/coral_server"
import type { ColumnCap, Directory, File } from "@/shared/data"

// Mock creator data
const mockCreatorData = {
  columns: [
    {
      id: "1",
      title: "Web3开发实战指南",
      category: "技术",
      subscribers: 1234,
      monthlyRevenue: "617",
      totalRevenue: "3702",
      posts: 24,
      status: "active",
    },
  ],
  totalSubscribers: 1234,
  monthlyRevenue: "617",
  totalRevenue: "3702",
  recentSubscribers: [
    {
      address: "0x7d20dcdb2bca4f508ea9613994683eb4e76e9c4ed1e59256b8dddf14e4f00111",
      subscribedAt: "2024-01-28",
      column: "Web3开发实战指南",
    },
    {
      address: "0x9c3b634ac05d0af393e0f93b9b19e6b67d8e85f8b5c9d4f4c7a5b6e9a8d70222",
      subscribedAt: "2024-01-27",
      column: "Web3开发实战指南",
    },
    {
      address: "0x5f4e8d6c9b2a1f3e7d5c4b8a9e6f1d2c3a4b5c6d7e8f9a0b1c2d3e4f5a6b0333",
      subscribedAt: "2024-01-26",
      column: "Web3开发实战指南",
    },
  ],
}

export default function MyColumnsPage() {
  const [data] = useState(mockCreatorData)
  const { t, language } = useI18n()
  const currentAccount = useCurrentAccount()
  const { toast } = useToast()
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const chain = useNetworkVariable("chain")
  const packageId = useNetworkVariable("packageId")
  const [columns, setColumns] = useState<ColumnCap[]>([])
  const [directories, setDirectories] = useState<Directory[]>([])
  const [allDirectories, setAllDirectories] = useState<Directory[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [vaultLoading, setVaultLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<"columns" | "vaults">("columns")
  const [selectedVault, setSelectedVault] = useState<Directory | null>(null)
  const [isVaultBrowserOpen, setIsVaultBrowserOpen] = useState(false)
  const [expandedDirs, setExpandedDirs] = useState<string[]>([])
  const [vaultToDelete, setVaultToDelete] = useState<Directory | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // 加载用户的专栏
  useEffect(() => {
    if (currentAccount?.address) {
      loadColumns()
    }
  }, [currentAccount?.address])
  
  // 加载用户的 Vault（root directories）
  useEffect(() => {
    if (currentAccount?.address && activeTab === "vaults") {
      loadVaults()
    }
  }, [currentAccount?.address, activeTab])
  
  const loadColumns = async () => {
    if (!currentAccount?.address) return
    
    setLoading(true)
    try {
      const userColumns = await getUserOwnedColumns(currentAccount.address)
      setColumns(userColumns)
    } catch (error) {
      console.error("加载专栏失败:", error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadVaults = async () => {
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
    } finally {
      setVaultLoading(false)
    }
  }

  const handleDeleteVault = async () => {
    if (!vaultToDelete || !currentAccount?.address) return

    setIsDeleting(true)
    try {
      await deleteDirectory({
        directoryId: vaultToDelete.id,
        packageId,
        chain,
        signAndExecuteTransaction,
      })

      toast({
        title: t("myColumns.deleteVaultSuccess"),
        description: t("myColumns.deleteVaultSuccessDesc"),
      })

      // 重新加载vault列表
      await loadVaults()
      setVaultToDelete(null)
    } catch (error) {
      console.error("删除Vault失败:", error)
      toast({
        title: t("myColumns.deleteVaultError"),
        description: t("myColumns.deleteVaultErrorDesc"),
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
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
          {isRoot && (
            <span className="text-xs text-muted-foreground">Vault Root</span>
          )}
        </button>

        {isExpanded && dirFiles.length > 0 && (
          <div className="mt-1 space-y-1 pl-4 border-l border-border/40">
            {dirFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="truncate mr-2">{file.title}</span>
                <span className="shrink-0">
                  {file.updated_at.toLocaleDateString(
                    language === "zh" ? "zh-CN" : "en-US",
                    {
                      year: "2-digit",
                      month: "short",
                      day: "numeric",
                    }
                  )}
                </span>
              </div>
            ))}
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
  
  // 如果未连接钱包，显示提示
  if (!currentAccount) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <Card className="p-12 text-center">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">{t("common.connectWalletTitle")}</h2>
              <p className="text-muted-foreground">
                {t("common.connectWalletHint")}
              </p>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-bold">
                {t("myColumns.mainTitle")}
              </h1>
              <p className="text-muted-foreground">
                {t("myColumns.mainDescription")}
              </p>
            </div>
          </div>

          {/* 主标签页：我的专栏 vs Vault管理 */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "columns" | "vaults")} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="columns" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t("myColumns.tabColumns")}
              </TabsTrigger>
              <TabsTrigger value="vaults" className="flex items-center gap-2">
                <Folder className="h-4 w-4" />
                {t("myColumns.tabVaults")}
              </TabsTrigger>
            </TabsList>

            {/* 专栏管理标签页 */}
            <TabsContent value="columns" className="space-y-6 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{t("myColumns.title")}</h2>
                  <p className="text-muted-foreground">{t("myColumns.description")}</p>
                </div>
                <Button asChild>
                  <Link href="/my-columns/create">
                    <Plus className="mr-2 h-4 w-4" />
                    {t("myColumns.createColumn")}
                  </Link>
                </Button>
              </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("myColumns.totalSubscribers")}
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalSubscribers.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-primary">+12.5%</span> {t("myColumns.fromLastMonth")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("myColumns.monthlyRevenue")}
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.monthlyRevenue} SUI</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("common.approx")} ${(Number.parseFloat(data.monthlyRevenue) * 2).toFixed(0)} USD
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("myColumns.totalRevenue")}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalRevenue} SUI</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("common.approx")} ${(Number.parseFloat(data.totalRevenue) * 2).toFixed(0)} USD
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t("myColumns.totalArticles")}
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.columns.reduce((sum, col) => sum + col.posts, 0)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("myColumns.across")} {data.columns.length} {t("myColumns.columnsUnit")}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 专栏内部的子标签页 */}
          <Tabs defaultValue="my-columns" className="w-full">
            <TabsList>
              <TabsTrigger value="my-columns">{t("myColumns.tabColumns")}</TabsTrigger>
              <TabsTrigger value="subscribers">{t("myColumns.tabSubscribers")}</TabsTrigger>
              <TabsTrigger value="analytics">{t("myColumns.analytics")}</TabsTrigger>
            </TabsList>

            {/* Columns 子Tab */}
            <TabsContent value="my-columns" className="space-y-6 mt-6">
              {loading ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">{t("common.loading")}</p>
                </Card>
              ) : columns.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                  {columns.map((column) => (
                    <Card key={column.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3">
                              <CardTitle className="text-xl">{column.name}</CardTitle>
                              <Badge variant={column.other?.status === 1 ? "default" : "secondary"}>
                                {column.other?.status === 1 ? t("myColumns.published") : t("myColumns.draft")}
                              </Badge>
                            </div>
                            <CardDescription>
                              {column.other?.subscriptions || 0} {t("myColumns.subscribers")} · {column.other?.all_installment?.length || 0} {t("myColumns.issues")}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" asChild>
                              <Link href={`/columns/${column.column_id}`}>{t("myColumns.view")}</Link>
                            </Button>
                            <Button variant="outline" asChild>
                              <Link href={`/my-columns/${column.column_id}`}>{t("myColumns.manage")}</Link>
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">{t("myColumns.totalBalance")}</p>
                            <p className="text-2xl font-bold">{column.other?.balance || 0} SUI</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">{t("myColumns.subscriptionPrice")}</p>
                            <p className="text-2xl font-bold">{column.other?.payment_method?.fee || 0} SUI</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">{t("myColumns.subscribersCount")}</p>
                            <p className="text-2xl font-bold">{column.other?.subscriptions || 0}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">{t("myColumns.noColumns")}</h3>
                    <p className="text-muted-foreground">{t("myColumns.createFirstColumn")}</p>
                    <Button asChild>
                      <Link href="/my-columns/create">
                        <Plus className="mr-2 h-4 w-4" />
                        {t("myColumns.createColumn")}
                      </Link>
                    </Button>
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* Subscribers Tab */}
            <TabsContent value="subscribers" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("myColumns.recentSubscribers")}</CardTitle>
                  <CardDescription>{t("myColumns.viewRecentSubscribers")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.recentSubscribers.map((subscriber, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-3 border-b border-border last:border-0"
                      >
                        <div className="space-y-1">
                          <p className="font-medium font-mono text-sm">{subscriber.address}</p>
                          <p className="text-sm text-muted-foreground">{subscriber.column}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">{subscriber.subscribedAt}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    {t("myColumns.analytics")}
                  </CardTitle>
                  <CardDescription>{t("myColumns.viewColumnPerformance")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h4 className="font-semibold">{t("myColumns.subscriberGrowth")}</h4>
                        <div className="h-48 flex items-end justify-between gap-2">
                          {[420, 520, 680, 820, 950, 1100, 1234].map((value, index) => (
                            <div key={index} className="flex-1 flex flex-col items-center gap-2">
                              <div
                                className="w-full bg-primary rounded-t"
                                style={{ height: `${(value / 1234) * 100}%` }}
                              />
                              <span className="text-xs text-muted-foreground">
                                {index === 6 ? t("myColumns.today") : `${7 - index} ${t("myColumns.daysAgo")}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold">{t("myColumns.revenueTrend")}</h4>
                        <div className="h-48 flex items-end justify-between gap-2">
                          {[21, 26, 34, 41, 47.5, 55, 61.7].map((value, index) => (
                            <div key={index} className="flex-1 flex flex-col items-center gap-2">
                              <div
                                className="w-full bg-chart-1 rounded-t"
                                style={{ height: `${(value / 61.7) * 100}%` }}
                              />
                              <span className="text-xs text-muted-foreground">
                                {index === 6 ? t("myColumns.today") : `${7 - index} ${t("myColumns.daysAgo")}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                      <h4 className="font-semibold mb-4">{t("myColumns.columnPerformance")}</h4>
                      <div className="space-y-4">
                        {data.columns.map((column) => (
                          <div key={column.id} className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="font-medium">{column.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {column.subscribers} {t("myColumns.subscribers")}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{column.monthlyRevenue} SUI</p>
                              <p className="text-sm text-muted-foreground">{t("myColumns.monthlyRevenue")}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
            </TabsContent>

            {/* Vault 管理标签页 */}
            <TabsContent value="vaults" className="space-y-6 mt-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold">{t("myColumns.vaultTitle")}</h2>
                <p className="text-muted-foreground">
                  {t("myColumns.vaultDescription")}
                </p>
              </div>

              {vaultLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
                  <p className="text-muted-foreground">
                    {t("myColumns.vaultLoading")}
                  </p>
                </div>
              ) : directories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {directories.map((dir) => (
                    <Card key={dir.id} className="hover:shadow-lg hover:border-primary transition-all duration-300">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-lg bg-primary/10">
                              <FolderOpen className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{dir.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {t("myColumns.vaultRoot")}
                                </Badge>
                                {dir.is_root && (
                                  <Badge variant="outline" className="text-xs border-primary text-primary">
                                    Vault
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-sm space-y-2">
                          <div className="flex justify-between py-2 border-b border-border/50">
                            <span className="text-muted-foreground">{t("myColumns.vaultCreatedAt")}:</span>
                            <span className="font-medium">
                              {dir.created_at.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric"
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-border/50">
                            <span className="text-muted-foreground">{t("myColumns.vaultUpdatedAt")}:</span>
                            <span className="font-medium">
                              {dir.updated_at.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric"
                              })}
                            </span>
                          </div>
                          <div className="flex justify-between py-2">
                            <span className="text-muted-foreground">Vault ID:</span>
                            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                              {dir.id.slice(0, 6)}...{dir.id.slice(-4)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            className="flex-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                            onClick={() => {
                              setSelectedVault(dir)
                              setIsVaultBrowserOpen(true)
                            }}
                          >
                            <FolderOpen className="mr-2 h-4 w-4" />
                            {t("myColumns.browse")}
                          </Button>
                          <Button
                            variant="outline"
                            className="hover:bg-destructive hover:text-destructive-foreground transition-colors"
                            onClick={() => setVaultToDelete(dir)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <div className="p-4 rounded-full bg-muted">
                        <Folder className="h-12 w-12 text-muted-foreground" />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold">
                      {t("myColumns.noVaults")}
                    </h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {t("myColumns.noVaultsDesc")}
                    </p>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {isVaultBrowserOpen && selectedVault && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-background/80 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setIsVaultBrowserOpen(false)} />
          <Card className="relative z-10 h-full w-full max-w-md md:max-w-lg flex flex-col shadow-xl border-l border-border rounded-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  {selectedVault.name}
                </CardTitle>
                <CardDescription className="mt-1">
                  {t("myColumns.browseVaultDocuments")}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2"
                onClick={() => setIsVaultBrowserOpen(false)}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto space-y-4">
              <div className="text-sm text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
                <span>
                  {t("myColumns.created")}: {selectedVault.created_at.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span>
                  {t("myColumns.updated")}: {selectedVault.updated_at.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span>
                  Vault ID: <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                    {selectedVault.id.slice(0, 6)}...{selectedVault.id.slice(-4)}
                  </span>
                </span>
              </div>

              <div className="border rounded-md p-4 bg-muted/40">
                <p className="text-sm font-medium mb-2">
                  {t("myColumns.documents")}
                </p>
                <div className="text-sm text-muted-foreground space-y-2">
                  {renderDirectoryTree(selectedVault)}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 删除确认对话框 */}
      {vaultToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>{t("myColumns.deleteVaultConfirm")}</CardTitle>
              <CardDescription>{t("myColumns.deleteVaultConfirmDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">{vaultToDelete.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vault ID: {vaultToDelete.id.slice(0, 8)}...{vaultToDelete.id.slice(-6)}
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setVaultToDelete(null)}
                    disabled={isDeleting}
                  >
                    {t("myColumns.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteVault}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("myColumns.deleting")}
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("myColumns.delete")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
