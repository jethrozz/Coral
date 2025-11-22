import ColumnManageClient from "./ColumnManageClient"

export default async function ColumnManagePageWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ColumnManageClient id={id} />
}

