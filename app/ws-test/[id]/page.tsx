import { WSTestPageClient } from "./client";

export default async function WSTestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WSTestPageClient id={id} />;
}