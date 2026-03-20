import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let anthropicClient: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    anthropicClient = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export async function callClaude(system: string, userMessage: string, maxTokens = 4096) {
  const client = getAnthropic();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });
  const textBlock = response.content.find(b => b.type === 'text');
  return {
    text: textBlock?.text || '',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export async function logApiUsage(orgId: string, endpoint: string, model: string, inputTokens: number, outputTokens: number) {
  const costPerInput = model.includes('opus') ? 0.000015 : 0.000003;
  const costPerOutput = model.includes('opus') ? 0.000075 : 0.000015;
  await supabase.from('intel_api_usage').insert({
    org_id: orgId,
    endpoint,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost: inputTokens * costPerInput + outputTokens * costPerOutput,
  });
}

export function log(worker: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [${worker}] ${msg}`);
}
