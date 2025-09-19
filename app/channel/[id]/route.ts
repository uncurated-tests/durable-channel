import { durableGET, durablePOST } from "@/lib/durable-channel/base";

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  await durablePOST(id, request);
  return new Response(null, { status: 204 });
};

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  return durableGET(id, request);
};
