// @ts-expect-error bundle gerado no build (scripts/bundle-vercel-api.mjs)
import { handleVercelRequest } from './handler.cjs';

type VercelReq = { method?: string; url?: string; headers?: Record<string, string | string[] | undefined>; body?: unknown };
type VercelRes = {
  statusCode: number;
  setHeader: (key: string, value: string) => void;
  end: (payload?: string) => void;
};

export default function handler(req: VercelReq, res: VercelRes): Promise<void> {
  return handleVercelRequest(req, res);
}
