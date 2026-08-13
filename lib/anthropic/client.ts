import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

// Lazily instantiated so the app doesn't crash at import-time in
// environments/demo setups where ANTHROPIC_API_KEY isn't set yet —
// callers should handle the thrown error and fall back to a template.
export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}
