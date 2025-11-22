import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { I18nProvider } from "@/lib/i18n/context"
import { getTranslation } from "@/lib/i18n/translations"
import { Providers } from "./providers"
import { Toaster } from "@/components/ui/toaster"
import "@mysten/dapp-kit/dist/index.css"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

// 静态导出：使用默认语言，客户端会处理语言切换
export const metadata: Metadata = {
  title: getTranslation("zh", "metadata.title"),
  description: getTranslation("zh", "metadata.description"),
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // 静态导出：默认使用中文，客户端会处理语言切换
  const lang = "zh-CN"

  return (
    <html lang={lang}>
      <body className={`font-sans antialiased`}>
        <Providers>
          <I18nProvider>{children}</I18nProvider>
          <Toaster />
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
