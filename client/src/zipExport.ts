import JSZip from 'jszip';
import type { Presentation, SlideElement } from './types';
import { createPresentation, savePresentation, uploadFile } from './api';

/** Collect all unique media src paths from a presentation */
function collectMediaPaths(pres: Presentation): string[] {
  const paths = new Set<string>();
  for (const slide of pres.slides) {
    for (const el of slide.elements) {
      if ((el.type === 'video' || el.type === 'image') && el.src) {
        paths.add(el.src);
      }
    }
  }
  return [...paths];
}

/** Extract just the filename from a src path like /uploads/{id}/filename */
function srcToFilename(src: string): string {
  return src.split('/').pop() || src;
}

/** Export a presentation as a .zip file and trigger download */
export async function exportPresentation(pres: Presentation): Promise<void> {
  const zip = new JSZip();
  const mediaPaths = collectMediaPaths(pres);

  // Fetch all media files and add to zip
  const mediaFolder = zip.folder('media')!;
  for (const src of mediaPaths) {
    try {
      const res = await fetch(src);
      if (res.ok) {
        const blob = await res.blob();
        mediaFolder.file(srcToFilename(src), blob);
      }
    } catch { /* skip missing files */ }
  }

  // Remap src paths in presentation JSON: /uploads/{id}/file → media/file
  const exportPres = JSON.parse(JSON.stringify(pres)) as Presentation;
  for (const slide of exportPres.slides) {
    for (const el of slide.elements) {
      if ((el.type === 'video' || el.type === 'image') && el.src) {
        (el as any).src = `media/${srcToFilename(el.src)}`;
      }
    }
  }

  zip.file('presentation.json', JSON.stringify(exportPres, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pres.title || 'presentation'}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import a .zip file and create a new presentation. Returns the new presentation ID. */
export async function importPresentation(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);

  // Read presentation.json
  const presFile = zip.file('presentation.json');
  if (!presFile) throw new Error('No presentation.json found in zip');
  const presJson = await presFile.async('string');
  const importedPres = JSON.parse(presJson) as Presentation;

  // Create a new presentation on the server
  const newPres = await createPresentation(importedPres.title);
  const newId = newPres.id;

  // Upload all media files and build a path mapping
  const pathMap = new Map<string, string>(); // media/filename → /uploads/{newId}/newFilename
  const mediaFolder = zip.folder('media');
  if (mediaFolder) {
    const mediaFiles: { name: string; file: JSZip.JSZipObject }[] = [];
    mediaFolder.forEach((relativePath, fileObj) => {
      if (!fileObj.dir) {
        mediaFiles.push({ name: relativePath, file: fileObj });
      }
    });

    for (const { name, file: fileObj } of mediaFiles) {
      const blob = await fileObj.async('blob');
      const f = new File([blob], name, { type: guessMimeType(name) });
      const result = await uploadFile(newId, f);
      pathMap.set(`media/${name}`, result.path);
    }
  }

  // Remap src paths back: media/file → /uploads/{newId}/uploaded-file
  for (const slide of importedPres.slides) {
    // Generate new IDs
    slide.id = crypto.randomUUID();
    for (const el of slide.elements) {
      el.id = crypto.randomUUID();
      if ((el.type === 'video' || el.type === 'image') && el.src) {
        const mapped = pathMap.get(el.src);
        if (mapped) (el as any).src = mapped;
      }
    }
  }

  // Save the imported presentation with remapped paths
  importedPres.id = newId;
  importedPres.createdAt = newPres.createdAt;
  importedPres.updatedAt = new Date().toISOString();
  await savePresentation(importedPres);

  return newId;
}

function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', mov: 'video/quicktime', avi: 'video/x-msvideo',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}
