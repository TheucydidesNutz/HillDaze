'use client';

import { UploadFilePicker } from './UploadManager';

export default function ResearchDocumentUploader({
  orgId,
  targetId,
  defaultFolder = 'deep_dive',
  onComplete,
  onClose,
}: {
  orgId: string;
  targetId: string;
  defaultFolder?: 'deep_dive' | 'reference';
  onComplete: () => void;
  onClose: () => void;
}) {
  return (
    <UploadFilePicker
      orgId={orgId}
      folder={defaultFolder}
      researchTargetId={targetId}
      onClose={() => { onComplete(); onClose(); }}
    />
  );
}
