import type { Presentation, PresentationSummary } from './types';
import { getAuthHeaders, getEditToken, storeEditToken, getShareToken } from './auth';

const BASE = '/api/presentations';

export async function listPresentations(): Promise<PresentationSummary[]> {
  const res = await fetch(BASE, { headers: getAuthHeaders() });
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
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ title }),
  });
  const data: Presentation = await res.json();
  if (data.editToken) {
    storeEditToken(data.id, data.editToken);
  }
  return data;
}

function writeHeaders(id: string): Record<string, string> {
  return {
    ...getAuthHeaders(),
    'x-edit-token': getEditToken(id) ?? '',
    'x-share-token': getShareToken(id) ?? '',
  };
}

export async function savePresentation(presentation: Presentation): Promise<Presentation> {
  const res = await fetch(`${BASE}/${presentation.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...writeHeaders(presentation.id) },
    body: JSON.stringify(presentation),
  });
  return res.json();
}

export async function deletePresentation(id: string): Promise<void> {
  await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: writeHeaders(id) });
}

export async function uploadFile(presentationId: string, file: File): Promise<{ path: string; filename: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/${presentationId}/upload`, {
    method: 'POST',
    headers: writeHeaders(presentationId),
    body: form,
  });
  return res.json();
}

export async function fetchShareToken(id: string): Promise<string> {
  const res = await fetch(`${BASE}/${id}/share-token`, { headers: writeHeaders(id) });
  if (!res.ok) throw new Error('Cannot get share token');
  const data = await res.json();
  return data.shareToken;
}
