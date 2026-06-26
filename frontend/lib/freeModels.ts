/**
 * Curated list of free OpenRouter models for the admin model picker.
 *
 * Hardcoded (no live API call) on purpose:
 *  - OpenRouter returns ~340 models; filtering to "free" still leaves audio/image
 *    models that aren't useful here.
 *  - The picker needs stable labels & ordering, not OpenRouter's alphabetical sort.
 *  - Live fetching would slow down the admin page and risk UI breakage if the
 *    response shape changes.
 *
 * Update this file when models come/go. The default model is at the top of
 * the "Recommended" group.
 */

export type ModelGroup =
  | "Recommended"
  | "Qwen"
  | "Meta Llama"
  | "OpenAI"
  | "Google"
  | "NVIDIA"
  | "Other";

export interface FreeModel {
  /** OpenRouter model id sent verbatim in the request body. */
  id: string;
  /** Short label shown in the picker dropdown. */
  label: string;
  /** One-line hint about strengths / context. */
  hint: string;
  /** Provider grouping for visual separation in the dropdown. */
  group: ModelGroup;
}

export const FREE_MODELS: FreeModel[] = [
  // Recommended — pinned at the top, sorted by our preference for STAR/summary tasks
  { id: "qwen/qwen3-next-80b-a3b-instruct:free", label: "Qwen 3 Next 80B", hint: "262K context · top pick for STAR", group: "Recommended" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B", hint: "131K · reliable all-rounder", group: "Recommended" },
  { id: "openai/gpt-oss-120b:free", label: "GPT-OSS 120B", hint: "131K · OpenAI's open-source", group: "Recommended" },
  { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B", hint: "262K · Google's newest", group: "Recommended" },

  // Qwen
  { id: "qwen/qwen3-coder:free", label: "Qwen 3 Coder", hint: "1M · structured output", group: "Qwen" },
  { id: "qwen/qwen3-next-80b-a3b-instruct:free", label: "Qwen 3 Next 80B", hint: "262K", group: "Qwen" },

  // Meta Llama
  { id: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B", hint: "131K", group: "Meta Llama" },
  { id: "meta-llama/llama-3.2-3b-instruct:free", label: "Llama 3.2 3B", hint: "131K · very fast, lower quality", group: "Meta Llama" },
  { id: "nousresearch/hermes-3-llama-3.1-405b:free", label: "Hermes 3 (Llama 405B)", hint: "131K · very large, slower", group: "Meta Llama" },

  // OpenAI
  { id: "openai/gpt-oss-120b:free", label: "GPT-OSS 120B", hint: "131K", group: "OpenAI" },
  { id: "openai/gpt-oss-20b:free", label: "GPT-OSS 20B", hint: "131K · faster", group: "OpenAI" },

  // Google
  { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B", hint: "262K", group: "Google" },
  { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B", hint: "262K", group: "Google" },

  // NVIDIA
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra 550B", hint: "1M · massive MoE", group: "NVIDIA" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 3 Super 120B", hint: "1M", group: "NVIDIA" },
  { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", label: "Nemotron 3 Nano Reasoning 30B", hint: "256K · reasoning", group: "NVIDIA" },
  { id: "nvidia/nemotron-3-nano-30b-a3b:free", label: "Nemotron 3 Nano 30B", hint: "256K", group: "NVIDIA" },

  // Other
  { id: "openrouter/free", label: "OpenRouter auto-router", hint: "200K · auto-picks best free model", group: "Other" },
  { id: "poolside/laguna-xs.2:free", label: "Poolside Laguna XS.2", hint: "262K · code-focused", group: "Other" },
  { id: "poolside/laguna-m.1:free", label: "Poolside Laguna M.1", hint: "262K · code-focused", group: "Other" },
  { id: "cohere/north-mini-code:free", label: "Cohere North Mini Code", hint: "256K · code", group: "Other" },
  { id: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free", label: "Dolphin Mistral 24B Venice", hint: "32K · uncensored", group: "Other" },
  { id: "liquid/lfm-2.5-1.2b-thinking:free", label: "LFM 2.5 1.2B Thinking", hint: "32K · tiny, for testing", group: "Other" },
  { id: "liquid/lfm-2.5-1.2b-instruct:free", label: "LFM 2.5 1.2B Instruct", hint: "32K · tiny", group: "Other" },
];

export const DEFAULT_MODEL_ID = "qwen/qwen3-next-80b-a3b-instruct:free";

/** De-duplicated list (the "Recommended" group has duplicates of entries below). */
export const UNIQUE_FREE_MODEL_IDS = Array.from(new Set(FREE_MODELS.map((m) => m.id)));