// @ts-expect-error bundle gerado no build (scripts/bundle-vercel-api.mjs)
import { handleVercelRequest } from './handler.cjs';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return handleVercelRequest(req, res);
}
