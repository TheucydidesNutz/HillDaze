import { supabaseAdmin } from '@/lib/supabase';

export async function logApiUsage(params: {
  orgId: string;
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const costPerInputToken = params.model.includes('opus') ? 0.000015 : 0.000003;
  const costPerOutputToken = params.model.includes('opus') ? 0.000075 : 0.000015;
  const estimatedCost =
    params.inputTokens * costPerInputToken +
    params.outputTokens * costPerOutputToken;

  await supabaseAdmin.from('intel_api_usage').insert({
    org_id: params.orgId,
    endpoint: params.endpoint,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    estimated_cost: estimatedCost,
  });
}
