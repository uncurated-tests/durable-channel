import { SSETestPageClient } from "./client";

export default async function SSETestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SSETestPageClient id={id} />;
}
