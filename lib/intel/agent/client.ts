import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return client;
}

export async function callClaude(options: {
  system: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: options.model || 'claude-sonnet-4-20250514',
    max_tokens: options.maxTokens || 4096,
    system: options.system,
    messages: [{ role: 'user', content: options.userMessage }],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  return {
    text: textBlock?.text || '',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
