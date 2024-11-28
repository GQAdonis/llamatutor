import {
    createParser,
    ParsedEvent,
    ReconnectInterval,
} from "eventsource-parser";
import { ChatGPTMessage } from "@/types/chatgpt";

export interface OpenAIStreamPayload {
    model: string;
    messages: ChatGPTMessage[];
    temperature?: number;
    max_tokens?: number;
    stream: boolean;
}

export class OpenAIStreamError extends Error {
    constructor(
        message: string,
        public readonly status?: number,
        public readonly statusText?: string,
        public readonly body?: string
    ) {
        super(message);
        this.name = 'OpenAIStreamError';
    }
}

export async function OpenAIStream(payload: OpenAIStreamPayload) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    try {
        const OPENAI_API_KEY = process.env.OPENAI_SERVICE_API_KEY;
        if (!OPENAI_API_KEY) {
            throw new OpenAIStreamError("OPENAI_API_KEY is required");
        }

        const OPENAI_BASE_URL = process.env.OPENAI_SERVICE_BASE_URL;
        if (!OPENAI_BASE_URL) {
            throw new OpenAIStreamError("OPENAI_BASE_URL is required");
        }

        console.log(`Initiating stream request to: ${OPENAI_BASE_URL}`);

        const apiVersion = process.env.API_VERSION;
        const url = OPENAI_BASE_URL + `/chat/completions${apiVersion ? `?api-version=${apiVersion}` : ''}`;

        console.log(`Sending request to: ${url}`);

        const res = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "api-key": OPENAI_API_KEY, // Added for Azure compatibility
            },
            method: "POST",
            body: JSON.stringify({
                ...payload,
                stream: true, // Ensure stream is always true
            }),
        });

        if (!res.ok) {
            const errorData = await res.text();
            console.error(`Stream request failed: ${res.status} ${res.statusText}`, errorData);
            throw new OpenAIStreamError(
                "Stream request failed",
                res.status,
                res.statusText,
                errorData
            );
        }

        const readableStream = new ReadableStream({
            async start(controller) {
                let streamError: Error | null = null;

                const onParse = (event: ParsedEvent | ReconnectInterval) => {
                    if (event.type === "event") {
                        const data = event.data;
                        
                        // Handle specific [DONE] message
                        if (data === "[DONE]") {
                            controller.close();
                            return;
                        }

                        try {
                            const json = JSON.parse(data);
                            // Log any errors from the API
                            if (json.error) {
                                console.error("API Error:", json.error);
                                streamError = new Error(json.error.message);
                                controller.error(streamError);
                                return;
                            }
                            controller.enqueue(encoder.encode(data));
                        } catch (e) {
                            console.error("Parse error in stream:", e);
                            streamError = e as Error;
                            controller.error(streamError);
                        }
                    }
                };

                const parser = createParser(onParse);

                try {
                    for await (const chunk of res.body as any) {
                        parser.feed(decoder.decode(chunk));
                    }
                } catch (e) {
                    console.error("Stream reading error:", e);
                    controller.error(e);
                }
            }
        });

        let counter = 0;
        const transformStream = new TransformStream({
            async transform(chunk, controller) {
                const data = decoder.decode(chunk);

                try {
                    const json = JSON.parse(data);
                    
                    // Handle Azure OpenAI and standard OpenAI response formats
                    const text = json.choices?.[0]?.delta?.content || 
                               json.choices?.[0]?.text || 
                               '';

                    if (counter < 2 && (text.match(/\n/) || []).length) {
                        // Skip prefix characters
                        return;
                    }

                    const payload = { text };
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
                    );
                    counter++;
                } catch (e) {
                    console.error("Transform error:", e);
                    controller.error(e);
                }
            },
            flush(controller) {
                controller.terminate();
            }
        });

        return readableStream.pipeThrough(transformStream);

    } catch (error) {
        console.error("OpenAIStream fatal error:", error);
        throw error instanceof OpenAIStreamError ? error : new OpenAIStreamError(
            (error as Error).message
        );
    }
}