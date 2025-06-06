import weaviate from "weaviate-client";
import { WeaviateClient } from "weaviate-client";

export class WeaviateService {
  private static instance: WeaviateService;
  // @ts-expect-error
  client: WeaviateClient;

  constructor() {}

  static async initialize() {
    if (WeaviateService.instance) {
      throw new Error("WeaviateService is already initialized");
    }

    WeaviateService.instance = new WeaviateService();

    WeaviateService.instance.client = await weaviate.connectToCustom({
      httpHost: process.env.WEAVIATE_URL_DOMAIN,
      httpPort: parseInt(process.env.WEAVIATE_URL_PORT!),
      grpcHost: process.env.WEAVIATE_URL_DOMAIN,
      headers: {
        "X-OpenAI-Api-Key": process.env.OPENAI_API_KEY!,
      },
    });
  }

  static getInstance() {
    if (!WeaviateService.instance) {
      throw new Error(
        "WeaviateService.initialize needs to be called first to get instance"
      );
    }

    return WeaviateService.instance;
  }
}
