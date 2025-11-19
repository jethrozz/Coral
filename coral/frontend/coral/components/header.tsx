"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { WalletButton } from "@/components/wallet-button"
import { LanguageSwitcher } from "@/components/language-switcher"
import { usePathname } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"
import { Waves } from "lucide-react"

export function Header() {
  const pathname = usePathname()
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
                <Waves className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t("header.title")}
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/" ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                {t("header.home")}
              </Link>
              <Link
                href="/search"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/search" ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                {t("header.search")}
              </Link>
              <Link
                href="/subscriptions"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/subscriptions" ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                {t("header.subscriptions")}
              </Link>
              <Link
                href="/my-columns"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/my-columns" ? "text-primary font-semibold" : "text-muted-foreground"
                }`}
              >
                {t("header.myColumns")}
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {mounted && (
              <>
                <LanguageSwitcher />
                <WalletButton />
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
