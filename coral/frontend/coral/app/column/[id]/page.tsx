import ColumnDetailClient from "./ColumnDetailClient"

export default async function ColumnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ColumnDetailClient id={id} />
}
