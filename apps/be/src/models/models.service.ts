import { Injectable } from '@nestjs/common';
import type { ModelDto } from '@nts/shared';
import { SettingsService } from '../settings/settings.service.js';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
// The catalog is ~300 models and the picker re-queries on every debounced
// keystroke, so cache the upstream response briefly rather than refetching.
const CATALOG_TTL_MS = 5 * 60 * 1000;

// Minimal shape of the upstream OpenRouter model entry we read.
interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture?: { output_modalities?: string[] };
}

// Text models are those that emit text — excludes image/audio generators while
// keeping multimodal-input chat models that still reply in text.
function isTextModel(m: OpenRouterModel): boolean {
  const out = m.architecture?.output_modalities;
  return !out || out.includes('text');
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

@Injectable()
export class ModelsService {
  private cache: { at: number; models: OpenRouterModel[] } | null = null;

  constructor(private readonly settings: SettingsService) {}

  async getModels(
    search?: string,
    limit = 20,
    free = false,
  ): Promise<ModelDto[]> {
    const all = (await this.fetchCatalog()).filter(isTextModel).map(toModelDto);

    const query = search?.toLowerCase();
    const filtered = all.filter((m) => {
      if (free && !(m.pricing.prompt === '0' && m.pricing.completion === '0')) {
        return false;
      }
      if (
        query &&
        !m.id.toLowerCase().includes(query) &&
        !m.name.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });

    return filtered.slice(0, limit);
  }

  private async fetchCatalog(): Promise<OpenRouterModel[]> {
    if (this.cache && Date.now() - this.cache.at < CATALOG_TTL_MS) {
      return this.cache.models;
    }

    // The endpoint is public, but pass the key when present so per-account
    // pricing/availability is reflected.
    const apiKey = await this.settings.getApiKey();
    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });
    if (!response.ok) {
      throw new Error(
        `OpenRouter models failed: ${response.status} ${response.statusText}`,
      );
    }
    const json = (await response.json()) as OpenRouterModelsResponse;
    this.cache = { at: Date.now(), models: json.data };
    return json.data;
  }
}

function toModelDto(m: OpenRouterModel): ModelDto {
  return {
    id: m.id,
    name: m.name,
    description: m.description ?? null,
    contextLength: m.context_length,
    pricing: { prompt: m.pricing.prompt, completion: m.pricing.completion },
  };
}
