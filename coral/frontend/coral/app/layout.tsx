import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { cookies } from "next/headers"
import { I18nProvider } from "@/lib/i18n/context"
import { getTranslation } from "@/lib/i18n/translations"
import { Providers } from "./providers"
import { Toaster } from "@/components/ui/toaster"
import "@mysten/dapp-kit/dist/index.css"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const language = (cookieStore.get("language")?.value || "zh") as "zh" | "en"

  return {
    title: getTranslation(language, "metadata.title"),
    description: getTranslation(language, "metadata.description"),
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
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const language = (cookieStore.get("language")?.value || "zh") as "zh" | "en"
  const lang = language === "zh" ? "zh-CN" : "en"

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
