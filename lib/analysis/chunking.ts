export interface TextChunk {
  text: string;
  index: number;
}

export function chunkText(
  text: string,
  maxChars: number = 2000,
  overlapChars: number = 400
): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let lastParagraph = '';
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    // If a single paragraph exceeds maxChars, split on sentence boundaries
    if (paragraph.length > maxChars) {
      // Flush current chunk first
      if (currentChunk.trim()) {
        chunks.push({ text: currentChunk.trim(), index: chunkIndex++ });
        currentChunk = '';
      }

      const sentences = paragraph.match(/[^.!?]+[.!?]+\s*/g) || [paragraph];
      let sentenceChunk = '';

      for (const sentence of sentences) {
        if ((sentenceChunk + sentence).length > maxChars && sentenceChunk.trim()) {
          chunks.push({ text: sentenceChunk.trim(), index: chunkIndex++ });
          // Overlap: keep last portion of the sentence chunk
          const overlapStart = Math.max(0, sentenceChunk.length - overlapChars);
          sentenceChunk = sentenceChunk.substring(overlapStart) + sentence;
        } else {
          sentenceChunk += sentence;
        }
      }

      if (sentenceChunk.trim()) {
        currentChunk = sentenceChunk;
        lastParagraph = sentenceChunk;
      }
      continue;
    }

    const candidate = currentChunk
      ? currentChunk + '\n\n' + paragraph
      : paragraph;

    if (candidate.length > maxChars && currentChunk.trim()) {
      chunks.push({ text: currentChunk.trim(), index: chunkIndex++ });
      // Overlap: start next chunk with the last paragraph
      currentChunk = lastParagraph ? lastParagraph + '\n\n' + paragraph : paragraph;
    } else {
      currentChunk = candidate;
    }

    lastParagraph = paragraph;
  }

  // Flush remaining
  if (currentChunk.trim()) {
    chunks.push({ text: currentChunk.trim(), index: chunkIndex });
  }

  return chunks;
}
