"use client"

import Link from "next/link"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatAddress, getAddressColor } from "@/lib/address-utils"
import { useI18n } from "@/lib/i18n/context"

interface ColumnCardProps {
  id: string
  title: string
  description: string
  author: {
    name: string
    address: string
    avatar?: string
  }
  category: string
  subscribers: number
  price: string
  coverImage?: string
}

export function ColumnCard({
  id,
  title,
  description,
  author,
  category,
  subscribers,
  price,
  coverImage,
}: ColumnCardProps) {
  const { t } = useI18n()

  return (
    <Link href={`/column/${id}`}>
      <Card className="flex flex-col hover:shadow-lg hover:border-primary transition-all duration-300">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <Badge variant="secondary" className="text-xs">
              {category}
            </Badge>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{subscribers.toLocaleString()}</span>
            </div>
          </div>

          <h3 className="text-xl font-bold leading-tight text-balance">{title}</h3>
        </CardHeader>

        <CardContent className="flex-1">
          <p className="text-sm text-muted-foreground text-pretty line-clamp-3">{description}</p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <div className="flex items-center gap-3 w-full">
            <div
              className={`h-8 w-8 rounded-full ${getAddressColor(author.address)} flex items-center justify-center text-white text-xs font-mono font-semibold`}
            >
              {formatAddress(author.address, 4).slice(-4)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground font-mono truncate">
                {author.address.slice(0, 8)}...{author.address.slice(-6)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between w-full gap-3">
            <div className="text-sm">
              <span className="font-bold text-lg">{price} SUI</span>
              <span className="text-muted-foreground">/{t("common.month")}</span>
            </div>
            <Link href={`/columns/${id}`}>
              <Button>{t("column.subscribe")}</Button>
            </Link>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
