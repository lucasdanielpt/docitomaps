/** Handler mínimo — sem @vercel/node para evitar falha de bundle no deploy. */
type VercelRes = {
  status: (code: number) => { json: (body: unknown) => void };
};

export default function handler(_req: unknown, res: VercelRes) {
  return res.status(200).json({
    ok: true,
    orsKeyConfigured: Boolean(process.env.ORS_API_KEY?.trim()),
    version: '1.0.0',
  });
}
