"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

type Language = "zh" | "en"

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("zh")

  useEffect(() => {
    // Load saved language from localStorage
    const savedLang = localStorage.getItem("language") as Language
    if (savedLang && (savedLang === "zh" || savedLang === "en")) {
      setLanguageState(savedLang)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("language", lang)
  }

  const t = (key: string): string => {
    const keys = key.split(".")
    let value: any = translations[language]

    for (const k of keys) {
      if (value && typeof value === "object") {
        value = value[k]
      } else {
        return key
      }
    }

    return typeof value === "string" ? value : key
  }

  return <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider")
  }
  return context
}

const translations = {
  zh: {
    header: {
      title: "珊瑚礁",
      home: "首页",
      search: "搜索",
      subscriptions: "我订阅的",
      myColumns: "我的专栏",
    },
    wallet: {
      connect: "连接钱包",
      disconnect: "断开连接",
      connecting: "连接中...",
    },
    home: {
      hero: {
        title: "发现优质Web3专栏",
        subtitle: "去中心化的内容订阅平台，让创作者和读者直接连接",
        cta: "探索专栏",
      },
      categories: {
        all: "全部",
        tech: "技术",
        defi: "DeFi",
        nft: "NFT",
        dao: "DAO",
        metaverse: "元宇宙",
      },
      stats: {
        creators: "创作者",
        subscribers: "订阅者",
        columns: "专栏",
      },
    },
    column: {
      subscribers: "订阅者",
      pricePerMonth: "SUI/月",
      subscribe: "订阅",
      unsubscribe: "取消订阅",
      subscribed: "已订阅",
      latestArticles: "最新文章",
      readMore: "阅读全文",
      about: "关于专栏",
      aboutAuthor: "关于作者",
    },
    search: {
      title: "搜索专栏",
      placeholder: "搜索专栏标题、描述或作者...",
      filterByCategory: "筛选分类",
      sortBy: "排序",
      sortBySubscribers: "订阅数",
      sortByPrice: "价格",
      noResults: "未找到专栏",
      noResultsDesc: "尝试使用不同的关键词或筛选条件",
    },
    subscriptions: {
      title: "我的订阅",
      description: "管理您当前订阅的所有专栏",
      active: "活跃",
      subscribedOn: "订阅于",
      nextBilling: "下次扣费",
      cancelSubscription: "取消订阅",
      viewColumn: "查看专栏",
      noSubscriptions: "暂无订阅",
      noSubscriptionsDesc: "您还没有订阅任何专栏。浏览精彩内容并开始订阅！",
      browseColumns: "浏览专栏",
      confirmCancel: "确认取消",
      confirmCancelDesc: "您确定要取消订阅此专栏吗？",
      cancel: "取消",
      confirm: "确认",
    },
    myColumns: {
      title: "我的专栏",
      description: "管理您的专栏和内容",
      createColumn: "创建新专栏",
      analytics: "数据分析",
      totalRevenue: "总收入",
      activeSubscribers: "活跃订阅者",
      totalArticles: "总文章数",
      avgReadTime: "平均阅读时长",
      revenueOverview: "收入概览",
      subscriberGrowth: "订阅者增长",
      recentSubscribers: "最近订阅者",
      edit: "编辑",
      viewStats: "查看数据",
      noColumns: "暂无专栏",
      noColumnsDesc: "您还没有创建任何专栏。创建您的第一个专栏并开始分享内容！",
    },
    createColumn: {
      title: "创建新专栏",
      description: "填写信息创建您的专栏",
      basicInfo: "基本信息",
      columnTitle: "专栏标题",
      columnTitlePlaceholder: "输入专栏标题",
      columnDescription: "专栏描述",
      columnDescriptionPlaceholder: "描述您的专栏内容...",
      category: "分类",
      selectCategory: "选择分类",
      pricing: "定价",
      subscriptionPrice: "订阅价格 (SUI/月)",
      pricePlaceholder: "0.00",
      coverImage: "封面图片",
      coverImageDesc: "上传专栏封面图片（推荐尺寸：1200x600）",
      uploadImage: "上传图片",
      cancel: "取消",
      create: "创建专栏",
      creating: "创建中...",
    },
    common: {
      loading: "加载中...",
      error: "出错了",
      success: "成功",
      month: "月",
      sui: "SUI",
    },
  },
  en: {
    header: {
      title: "Coral Reef",
      home: "Home",
      search: "Search",
      subscriptions: "My Subscriptions",
      myColumns: "My Columns",
    },
    wallet: {
      connect: "Connect Wallet",
      disconnect: "Disconnect",
      connecting: "Connecting...",
    },
    home: {
      hero: {
        title: "Discover Quality Web3 Columns",
        subtitle: "Decentralized content subscription platform connecting creators and readers directly",
        cta: "Explore Columns",
      },
      categories: {
        all: "All",
        tech: "Technology",
        defi: "DeFi",
        nft: "NFT",
        dao: "DAO",
        metaverse: "Metaverse",
      },
      stats: {
        creators: "Creators",
        subscribers: "Subscribers",
        columns: "Columns",
      },
    },
    column: {
      subscribers: "Subscribers",
      pricePerMonth: "SUI/month",
      subscribe: "Subscribe",
      unsubscribe: "Unsubscribe",
      subscribed: "Subscribed",
      latestArticles: "Latest Articles",
      readMore: "Read More",
      about: "About Column",
      aboutAuthor: "About Author",
    },
    search: {
      title: "Search Columns",
      placeholder: "Search by title, description, or author...",
      filterByCategory: "Filter by Category",
      sortBy: "Sort By",
      sortBySubscribers: "Subscribers",
      sortByPrice: "Price",
      noResults: "No Columns Found",
      noResultsDesc: "Try different keywords or filters",
    },
    subscriptions: {
      title: "My Subscriptions",
      description: "Manage all your active column subscriptions",
      active: "Active",
      subscribedOn: "Subscribed on",
      nextBilling: "Next billing",
      cancelSubscription: "Cancel Subscription",
      viewColumn: "View Column",
      noSubscriptions: "No Subscriptions",
      noSubscriptionsDesc: "You haven't subscribed to any columns yet. Browse great content and start subscribing!",
      browseColumns: "Browse Columns",
      confirmCancel: "Confirm Cancellation",
      confirmCancelDesc: "Are you sure you want to cancel this subscription?",
      cancel: "Cancel",
      confirm: "Confirm",
    },
    myColumns: {
      title: "My Columns",
      description: "Manage your columns and content",
      createColumn: "Create New Column",
      analytics: "Analytics",
      totalRevenue: "Total Revenue",
      activeSubscribers: "Active Subscribers",
      totalArticles: "Total Articles",
      avgReadTime: "Avg. Read Time",
      revenueOverview: "Revenue Overview",
      subscriberGrowth: "Subscriber Growth",
      recentSubscribers: "Recent Subscribers",
      edit: "Edit",
      viewStats: "View Stats",
      noColumns: "No Columns",
      noColumnsDesc: "You haven't created any columns yet. Create your first column and start sharing content!",
    },
    createColumn: {
      title: "Create New Column",
      description: "Fill in the information to create your column",
      basicInfo: "Basic Information",
      columnTitle: "Column Title",
      columnTitlePlaceholder: "Enter column title",
      columnDescription: "Column Description",
      columnDescriptionPlaceholder: "Describe your column content...",
      category: "Category",
      selectCategory: "Select a category",
      pricing: "Pricing",
      subscriptionPrice: "Subscription Price (SUI/month)",
      pricePlaceholder: "0.00",
      coverImage: "Cover Image",
      coverImageDesc: "Upload a cover image for your column (Recommended: 1200x600)",
      uploadImage: "Upload Image",
      cancel: "Cancel",
      create: "Create Column",
      creating: "Creating...",
    },
    common: {
      loading: "Loading...",
      error: "Error",
      success: "Success",
      month: "month",
      sui: "SUI",
    },
  },
}
