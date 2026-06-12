import type {
  CreateTemplate,
  FieldOp,
  TemplateDetail,
  TemplateSampleList,
  TemplateSummaryList,
  UpdateLayout,
} from '@nts/shared';

async function readError(r: Response): Promise<string> {
  try {
    const body = (await r.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(', ');
    if (body.message) return body.message;
  } catch {
    /* fall through */
  }
  return `Request failed (${r.status})`;
}

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(await readError(r));
  return r.json() as Promise<T>;
}

export const templatesKey = ['templates'] as const;
export const templateKey = (modelId: number) => ['templates', modelId] as const;
export const samplesKey = (modelId: number) =>
  ['templates', modelId, 'samples'] as const;

export async function fetchTemplates(): Promise<TemplateSummaryList> {
  return json(await fetch('/api/templates'));
}

export async function fetchTemplate(modelId: number): Promise<TemplateDetail> {
  return json(await fetch(`/api/templates/${modelId}`));
}

export async function fetchSamples(
  modelId: number
): Promise<TemplateSampleList> {
  return json(await fetch(`/api/templates/${modelId}/samples`));
}

export async function createTemplate(
  body: CreateTemplate
): Promise<TemplateDetail> {
  return json(
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

export async function applyFieldOp(
  modelId: number,
  op: FieldOp
): Promise<TemplateDetail> {
  return json(
    await fetch(`/api/templates/${modelId}/fields`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(op),
    })
  );
}

export async function saveLayout(
  modelId: number,
  body: UpdateLayout
): Promise<TemplateDetail> {
  return json(
    await fetch(`/api/templates/${modelId}/layout`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

export async function resetLayout(modelId: number): Promise<TemplateDetail> {
  return json(
    await fetch(`/api/templates/${modelId}/reset`, { method: 'POST' })
  );
}
