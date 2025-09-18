import {
  forwardChannelMessage,
  subscribeChannelMessages,
} from "@/lib/durable-channel";

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  const body = await request.text();
  const result = await forwardChannelMessage(id, body);
  return Response.json({ result });
};

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        await subscribeChannelMessages(
          id,
          (message) => {
            controller.enqueue(encoder.encode(formatEventStream(message)));
          },
          60000
        );
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
      },
    }
  );
};

function formatEventStream(message: string) {
  return `data: ${message}\n\n`;
}
