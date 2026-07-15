import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleVercelRequest } from '../apps/api/src/vercel.js';

export default function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return handleVercelRequest(req, res);
}
