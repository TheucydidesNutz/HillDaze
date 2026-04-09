const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  const batchSize = 10;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map(t => generateEmbedding(t)));
    results.push(...embeddings);
  }

  return results;
}
