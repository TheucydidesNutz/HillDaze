import { supabase, log } from './worker-utils';
import { OLLAMA_URL } from './config';

const POLL_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;

async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.embedding || null;
  } catch {
    return null;
  }
}

async function processQueue() {
  // Check for pending embedding jobs
  const { data: jobs } = await supabase.from('intel_embedding_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(10);

  if (!jobs?.length) return;

  for (const job of jobs) {
    // Mark as processing
    await supabase.from('intel_embedding_queue').update({ status: 'processing' }).eq('id', job.id);

    try {
      // Fetch content from source table
      let text = '';
      if (job.source_table === 'intel_documents') {
        const { data } = await supabase.from('intel_documents').select('summary, filename').eq('id', job.source_id).single();
        text = data?.summary || data?.filename || '';
      } else if (job.source_table === 'intel_news_items') {
        const { data } = await supabase.from('intel_news_items').select('title, summary, raw_content').eq('id', job.source_id).single();
        text = [data?.title, data?.summary || data?.raw_content].filter(Boolean).join('. ').substring(0, 2000);
      } else if (job.source_table === 'intel_conversation_archives') {
        const { data } = await supabase.from('intel_conversation_archives').select('summary').eq('id', job.source_id).single();
        text = data?.summary || '';
      }

      if (!text) {
        await supabase.from('intel_embedding_queue').update({ status: 'failed', error: 'No content found' }).eq('id', job.id);
        continue;
      }

      const embedding = await getEmbedding(text);
      if (!embedding) {
        const retries = (job.retries || 0) + 1;
        if (retries >= MAX_RETRIES) {
          await supabase.from('intel_embedding_queue').update({ status: 'failed', error: 'Max retries reached', retries }).eq('id', job.id);
        } else {
          await supabase.from('intel_embedding_queue').update({ status: 'pending', retries }).eq('id', job.id);
        }
        continue;
      }

      // Write embedding back to source table
      await supabase.from(job.source_table).update({ embedding, embedded_at: new Date().toISOString() }).eq('id', job.source_id);

      // Mark job complete
      await supabase.from('intel_embedding_queue').update({ status: 'completed' }).eq('id', job.id);
    } catch (err) {
      log('embed', `Error processing job ${job.id}: ${err}`);
      await supabase.from('intel_embedding_queue').update({ status: 'failed', error: String(err) }).eq('id', job.id);
    }
  }
}

async function main() {
  log('embed', 'Starting embedding worker (continuous)');

  // Check if Ollama is running
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) throw new Error('Ollama not responding');
    log('embed', 'Ollama connected');
  } catch {
    log('embed', 'Ollama not available — waiting...');
  }

  // Continuous polling loop
  while (true) {
    try {
      await processQueue();
    } catch (err) {
      log('embed', `Queue error: ${err}`);
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

main().catch(err => { log('embed', `Fatal: ${err}`); process.exit(1); });
