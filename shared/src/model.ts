// Per-token prices as decimal strings (USD), exactly as OpenRouter returns them.
export interface ModelPricing {
  prompt: string;
  completion: string;
}

// A single OpenRouter model, trimmed to what the model picker needs.
export interface ModelDto {
  id: string;
  name: string;
  description: string | null;
  contextLength: number;
  pricing: ModelPricing;
}
