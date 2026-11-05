import { getSql } from './_db.js';
import { requireAuth, requireAdmin, requireRoles, send, readJson } from './_auth.js';
import { ensureSchema } from './_schema.js';
import { logAudit } from './_audit.js';

const CONDITIONS = ['Baik', 'Rusak Ringan', 'Rusak Berat'];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const sql = getSql();
  await ensureSchema(sql);

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return;
    try {
      const rows = await sql`select id, name, coalesce(code,'') as code, coalesce(pic,'') as pic from rooms order by id`;
      return send(res, 200, { rooms: rows });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'POST') {
    let b;
    try { b = await readJson(req); } catch (e) { return send(res, 400, { error: e.message }); }
    if (b.action === 'inventory') return saveInventory(sql, req, res, b);
    const auth = requireAdmin(req, res); if (!auth) return;
    try {
      if (!b.name) return send(res, 400, { error: 'Nama ruangan wajib diisi' });
      const rows = await sql`insert into rooms (name, code, pic) values (${b.name}, ${b.code || null}, ${b.pic || null}) returning id`;
      await logAudit(sql, auth, 'create', 'room', rows[0].id, { name: b.name, code: b.code || '' });
      return send(res, 200, { id: rows[0].id });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'PATCH') {
    const auth = requireAdmin(req, res); if (!auth) return;
    try {
      const b = await readJson(req);
      const id = parseInt(b.id, 10);
      if (!id) return send(res, 400, { error: 'ID tidak valid' });
      const rows = await sql`update rooms set name = coalesce(${b.name}, name), code = ${b.code || null}, pic = ${b.pic || null} where id = ${id} returning id, name`;
      if (!rows.length) return send(res, 404, { error: 'Ruangan tidak ditemukan' });
      await logAudit(sql, auth, 'update', 'room', id, { name: rows[0].name, code: b.code || '', pic: b.pic || '' });
      return send(res, 200, { ok: true });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  if (req.method === 'DELETE') {
    const auth = requireAdmin(req, res); if (!auth) return;
    try {
      const b = await readJson(req);
      const id = parseInt(b.id || (req.query && req.query.id), 10);
      if (!id) return send(res, 400, { error: 'ID tidak valid' });
      const gone = await sql`delete from rooms where id = ${id} returning name, code`;
      if (gone.length) await logAudit(sql, auth, 'delete', 'room', id, { name: gone[0].name, code: gone[0].code || '' });
      return send(res, 200, { ok: true });
    } catch (e) { return send(res, 500, { error: e.message }); }
  }

  return send(res, 405, { error: 'Method not allowed' });
}

// Inventarisasi ruangan (SES-4.3.1): save one physical stock-take of a room.
//   body { action:'inventory', room_id, items:[{ asset_id, found, condition }] }
// An item whose asset is recorded in another room but was found here is moved to
// this room (reconciliation). Changed conditions are written back to the asset.
// The whole session (who, when, found / missing per unit) is kept in audit_log,
// which is what the room's "Inventarisasi terakhir" and the Jejak Audit page read.
async function saveInventory(sql, req, res, b) {
  const auth = requireRoles(req, res, ['admin', 'verifikator']); if (!auth) return;
  try {
    const roomId = parseInt(b.room_id, 10);
    const items = Array.isArray(b.items) ? b.items : [];
    if (!roomId) return send(res, 400, { error: 'Ruangan tidak valid' });
    if (items.length > 5000) return send(res, 400, { error: 'Terlalu banyak unit dalam satu inventarisasi' });
    const room = await sql`select id, name, coalesce(code,'') as code from rooms where id = ${roomId}`;
    if (!room.length) return send(res, 404, { error: 'Ruangan tidak ditemukan' });

    const ids = items.map((it) => parseInt(it && it.asset_id, 10)).filter(Boolean);
    const cur = ids.length
      ? await sql`select a.id, a.code, a.name, a.room_id, coalesce(a.condition,'Baik') as condition,
                         coalesce(r.name,'') as room_name
                  from assets a left join rooms r on r.id = a.room_id where a.id = any(${ids})`
      : [];
    const byId = new Map(cur.map((a) => [String(a.id), a]));

    const upIds = [], upCond = [], upRoom = [], report = [];
    let found = 0, moved = 0, condChanged = 0;
    items.forEach((it) => {
      const a = byId.get(String(parseInt(it && it.asset_id, 10)));
      if (!a) return;
      const isFound = !!it.found;
      const inOther = String(a.room_id) !== String(roomId);
      if (inOther && !isFound) return;              // only a unit actually found here is reconciled into this room
      const cond = CONDITIONS.indexOf(it.condition) !== -1 ? it.condition : a.condition;
      const willMove = isFound && inOther;
      if (isFound) found++;
      if (willMove) moved++;
      if (cond !== a.condition) condChanged++;
      if (willMove || cond !== a.condition) { upIds.push(a.id); upCond.push(cond); upRoom.push(willMove ? roomId : a.room_id); }
      report.push({
        id: a.id, code: a.code, name: a.name, found: isFound, condition: cond,
        condition_before: a.condition, moved_from: willMove ? (a.room_name || '-') : undefined,
      });
    });

    const summary = {
      room: room[0].name, room_code: room[0].code, total: report.length, found: found,
      missing: report.length - found, moved: moved, condition_changed: condChanged, items: report,
    };
    // asset updates + the session record in ONE statement: the stock-take is either
    // saved completely or not at all (unlike logAudit, this one must not be lost).
    await sql`
      with upd as (
        update assets a set condition = v.condition, room_id = v.room_id
        from (select unnest(${upIds}::bigint[]) as id, unnest(${upCond}::text[]) as condition,
                     unnest(${upRoom}::bigint[]) as room_id) v
        where a.id = v.id
        returning a.id
      )
      insert into audit_log (user_id, user_name, user_role, action, entity, entity_id, detail)
      values (${auth.sub}, coalesce((select nullif(name, '') from users where id = ${auth.sub}), ${auth.name || ''}),
              ${auth.role}, 'inventory', 'room', ${roomId}, ${JSON.stringify(summary)}::jsonb)`;
    return send(res, 200, {
      ok: true, total: summary.total, found: found, missing: summary.missing,
      moved: moved, condition_changed: condChanged,
    });
  } catch (e) { return send(res, 500, { error: e.message }); }
}
