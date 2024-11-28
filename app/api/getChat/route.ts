import {
  TogetherAIStream,
  TogetherAIStreamPayload,
} from "@/utils/TogetherAIStream";
import { OpenAIStream, OpenAIStreamPayload } from "@/utils/OpenAIStream";
export const maxDuration = 60;

export async function POST(request: Request) {
  let { messages } = await request.json();

  try {
    const OPENAI_API_KEY = process.env.OPENAI_SERVICE_API_KEY;

    if (!OPENAI_API_KEY) {
      console.log("[getChat] Fetching answer stream from Together API");
      const payload: TogetherAIStreamPayload = {
        model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        messages,
        stream: true,
      };
      const stream = await TogetherAIStream(payload);

      return new Response(stream, {
        headers: new Headers({
          "Cache-Control": "no-cache",
        }),
      });
    } else {
      console.log("[getChat] Fetching answer stream from OpenAI API");
      const payload: OpenAIStreamPayload = {
        model: "llama3.2:latest",
        messages,
        stream: true,
      };
      const stream = await OpenAIStream(payload);

      return new Response(stream, {
        headers: new Headers({
          "Cache-Control": "no-cache",
        }),
      });
    }
  } catch (e) {
    return new Response("Error. Answer stream failed.", { status: 202 });
  }
}
