import type { Presentation, PresentationSummary } from './types';

const BASE = '/api/presentations';

export async function listPresentations(): Promise<PresentationSummary[]> {
  const res = await fetch(BASE);
  return res.json();
}

export async function getPresentation(id: string): Promise<Presentation> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error('Presentation not found');
  return res.json();
}

export async function createPresentation(title?: string): Promise<Presentation> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return res.json();
}

export async function savePresentation(presentation: Presentation): Promise<Presentation> {
  const res = await fetch(`${BASE}/${presentation.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(presentation),
  });
  return res.json();
}

export async function deletePresentation(id: string): Promise<void> {
  await fetch(`${BASE}/${id}`, { method: 'DELETE' });
}

export async function uploadFile(presentationId: string, file: File): Promise<{ path: string; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/${presentationId}/upload`, {
    method: 'POST',
    body: form,
  });
  return res.json();
}
