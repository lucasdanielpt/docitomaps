import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    ok: true,
    orsKeyConfigured: Boolean(process.env.ORS_API_KEY?.trim()),
    version: '1.0.0',
  });
}
