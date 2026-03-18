import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import type { BrandingConfig } from '../types';

export async function markdownToDocx(
  markdown: string,
  orgName: string,
  branding?: BrandingConfig
): Promise<Buffer> {
  const primaryColor = branding?.primary_color?.replace('#', '') || '3b82f6';
  const lines = markdown.split('\n');
  const children: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      children.push(new Paragraph({ text: '' }));
      continue;
    }

    // H1
    if (trimmed.startsWith('# ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: trimmed.replace(/^# /, ''), bold: true, size: 32, color: primaryColor, font: 'Calibri' })],
        spacing: { after: 200, before: 400 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: primaryColor } },
      }));
      continue;
    }

    // H2
    if (trimmed.startsWith('## ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: trimmed.replace(/^## /, ''), bold: true, size: 26, color: primaryColor, font: 'Calibri' })],
        spacing: { after: 150, before: 300 },
      }));
      continue;
    }

    // H3
    if (trimmed.startsWith('### ')) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: trimmed.replace(/^### /, ''), bold: true, size: 22, font: 'Calibri' })],
        spacing: { after: 100, before: 200 },
      }));
      continue;
    }

    // Bullet
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        children: parseInlineFormatting(trimmed.replace(/^[-*] /, '')),
        spacing: { after: 60 },
      }));
      continue;
    }

    // Numbered
    if (/^\d+\.\s/.test(trimmed)) {
      children.push(new Paragraph({
        numbering: { reference: 'default-numbering', level: 0 },
        children: parseInlineFormatting(trimmed.replace(/^\d+\.\s/, '')),
        spacing: { after: 60 },
      }));
      continue;
    }

    // Regular paragraph
    children.push(new Paragraph({
      children: parseInlineFormatting(trimmed),
      spacing: { after: 120 },
    }));
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT }],
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, font: 'Calibri', size: 20 }));
    } else {
      runs.push(new TextRun({ text: part, font: 'Calibri', size: 20 }));
    }
  }

  return runs;
}
