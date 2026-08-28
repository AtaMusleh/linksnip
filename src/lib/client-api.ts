import type { ApiErrorBody, ApiErrorCode, ApiErrorDetail, LinkResponse } from '@/lib/api';
import type { CreateLinkInput } from '@/lib/validation';

/** A structured failure from the API, so callers can branch on `code`. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: ApiErrorCode, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.code === 'string'
  );
}

async function readError(response: Response): Promise<ApiRequestError> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (isApiErrorBody(body)) {
    return new ApiRequestError(
      response.status,
      body.error.code,
      body.error.message,
      body.error.details ?? [],
    );
  }

  return new ApiRequestError(
    response.status,
    'internal_error',
    'Something went wrong. Please try again.',
  );
}

export async function createLink(input: CreateLinkInput): Promise<LinkResponse> {
  const response = await fetch('/api/links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as { link: LinkResponse };

  return body.link;
}

export async function deleteLink(id: string): Promise<void> {
  const response = await fetch(`/api/links/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    throw await readError(response);
  }
}
