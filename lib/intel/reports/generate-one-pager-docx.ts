import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  ImageRun,
  ShadingType,
  TabStopPosition,
  TabStopType,
} from 'docx';
import type { BrandingConfig } from '../types';

export interface OnePagerContent {
  headline: string;
  subheadline: string;
  the_issue: string;
  our_position: string;
  key_points: string[];
  pullout_stat: {
    number: string;
    context: string;
  };
  the_ask: string;
  contact: {
    name: string;
    title: string;
    email: string;
    phone?: string;
  };
}

export async function generateOnePagerDocx(
  content: OnePagerContent,
  orgName: string,
  branding?: BrandingConfig,
  logoBuffer?: Buffer
): Promise<Buffer> {
  const primaryColor = branding?.primary_color?.replace('#', '') || '3b82f6';
  const bodySize = 21; // 10.5pt in half-points
  const sectionHeaderSize = 22; // 11pt

  const children: Paragraph[] = [];

  // Header: org name (with optional logo)
  const headerRuns: (TextRun | ImageRun)[] = [];

  if (logoBuffer) {
    try {
      headerRuns.push(
        new ImageRun({
          data: logoBuffer,
          transformation: { width: 80, height: 40 },
          type: 'png',
        })
      );
      headerRuns.push(new TextRun({ text: '  ', font: 'Calibri', size: 20 }));
    } catch {
      // Skip logo if it fails
    }
  }

  headerRuns.push(
    new TextRun({
      text: orgName.toUpperCase(),
      bold: true,
      font: 'Calibri',
      size: 20,
      color: primaryColor,
    })
  );

  children.push(
    new Paragraph({
      children: headerRuns,
      spacing: { after: 80 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 2, color: primaryColor },
      },
      tabStops: [
        {
          type: TabStopType.RIGHT,
          position: TabStopPosition.MAX,
        },
      ],
    })
  );

  // Headline
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: content.headline,
          bold: true,
          font: 'Calibri',
          size: 36, // 18pt
          color: primaryColor,
        }),
      ],
      spacing: { before: 160, after: 40 },
    })
  );

  // Subheadline
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: content.subheadline,
          italics: true,
          font: 'Calibri',
          size: 22, // 11pt
          color: '555555',
        }),
      ],
      spacing: { after: 160 },
    })
  );

  // THE ISSUE
  children.push(makeSectionHeader('THE ISSUE', primaryColor));
  children.push(makeBodyParagraph(content.the_issue, bodySize));

  // OUR POSITION
  children.push(makeSectionHeader('OUR POSITION', primaryColor));
  children.push(makeBodyParagraph(content.our_position, bodySize));

  // KEY POINTS
  children.push(makeSectionHeader('KEY POINTS', primaryColor));
  for (const point of content.key_points) {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [
          new TextRun({ text: point, font: 'Calibri', size: bodySize }),
        ],
        spacing: { after: 40 },
      })
    );
  }

  // PULLOUT STAT
  if (content.pullout_stat?.number) {
    children.push(new Paragraph({ text: '', spacing: { after: 40 } }));
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: content.pullout_stat.number,
            bold: true,
            font: 'Calibri',
            size: 48, // 24pt
            color: primaryColor,
          }),
        ],
        spacing: { before: 80, after: 20 },
        shading: {
          type: ShadingType.SOLID,
          fill: 'F0F4F8',
          color: 'F0F4F8',
        },
      })
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: content.pullout_stat.context,
            font: 'Calibri',
            size: 20, // 10pt
            color: '555555',
          }),
        ],
        spacing: { after: 80 },
        shading: {
          type: ShadingType.SOLID,
          fill: 'F0F4F8',
          color: 'F0F4F8',
        },
      })
    );
  }

  // THE ASK
  children.push(makeSectionHeader('THE ASK', primaryColor));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: content.the_ask,
          bold: true,
          font: 'Calibri',
          size: 22, // 11pt
        }),
      ],
      spacing: { after: 120 },
    })
  );

  // Contact bar
  if (content.contact?.name) {
    children.push(
      new Paragraph({
        border: {
          top: { style: BorderStyle.SINGLE, size: 1, color: primaryColor },
        },
        spacing: { before: 120, after: 0 },
        children: [],
      })
    );

    const contactParts = [content.contact.name];
    if (content.contact.title) contactParts.push(content.contact.title);
    if (content.contact.email) contactParts.push(content.contact.email);
    if (content.contact.phone) contactParts.push(content.contact.phone);

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contactParts.join('  |  '),
            font: 'Calibri',
            size: 18, // 9pt
            color: '666666',
          }),
        ],
        spacing: { before: 40 },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1080, // 0.75 inch
              bottom: 1080,
              left: 1080,
              right: 1080,
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

function makeSectionHeader(text: string, primaryColor: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [
      new TextRun({
        text,
        bold: true,
        font: 'Calibri',
        size: 22, // 11pt
        color: primaryColor,
        allCaps: true,
      }),
    ],
    spacing: { before: 140, after: 60 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: primaryColor },
    },
  });
}

function makeBodyParagraph(text: string, size: number): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Calibri', size })],
    spacing: { after: 80 },
  });
}
