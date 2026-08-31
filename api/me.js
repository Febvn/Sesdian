import { requireAuth, send } from './_auth.js';

export default async function handler(req, res) {
  const auth = requireAuth(req, res);
  if (!auth) return;
  return send(res, 200, { user: { nip: auth.nip, name: auth.name, role: auth.role } });
}
