/**
 * Gemini API Client for Image Generation
 *
 * Uses Google's Gemini Imagen API to generate high-quality images
 * from text prompts.
 */

export interface GeminiImageRequest {
  prompt: string;
  numberOfImages?: number;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  safetyFilterLevel?: 'block_none' | 'block_some' | 'block_most';
  personGeneration?: 'dont_allow' | 'allow_adult';
}

export interface GeminiImageResponse {
  generatedImages: Array<{
    image: {
      imageBytes: string; // base64 encoded
    };
  }>;
}

export class GeminiClient {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private model = 'imagen-3.0-generate-001';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Generate an image from a text prompt
   */
  async generateImage(request: GeminiImageRequest): Promise<Buffer> {
    const url = `${this.baseUrl}/models/${this.model}:generateImages`;

    const body = {
      prompt: request.prompt,
      numberOfImages: request.numberOfImages || 1,
      aspectRatio: request.aspectRatio || '9:16',
      safetyFilterLevel: request.safetyFilterLevel || 'block_some',
      personGeneration: request.personGeneration || 'allow_adult',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as GeminiImageResponse;

    if (!data.generatedImages || data.generatedImages.length === 0) {
      throw new Error('No images returned from Gemini API');
    }

    // Decode base64 to buffer
    const base64Image = data.generatedImages[0].image.imageBytes;
    return Buffer.from(base64Image, 'base64');
  }
}

/**
 * Create a Gemini client instance
 */
export function createGeminiClient(apiKey?: string): GeminiClient {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  return new GeminiClient(key);
}
