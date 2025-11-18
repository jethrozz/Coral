"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { translations, type Language } from "./translations"

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
      // 同步到 cookie，以便服务端可以读取
      document.cookie = `language=${savedLang}; path=/; max-age=31536000` // 1 year
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("language", lang)
    // 同步到 cookie，以便服务端可以读取
    document.cookie = `language=${lang}; path=/; max-age=31536000` // 1 year
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
