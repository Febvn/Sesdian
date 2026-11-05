// Jejak audit (SES-4.3.3): append-only activity log, shared helper (not routed).
// Best-effort by design: a failed audit insert must never fail the action itself.
//   actor   the verified JWT payload ({ sub, name, role }) or null for the system (cron)
//   action  create | update | delete | status | inventory | notify | cron | import | ...
//   entity  borrowing | asset | room | category | user | setting | notification
export async function logAudit(sql, actor, action, entity, entityId, detail) {
  try {
    const uid = actor && actor.sub ? actor.sub : null;
    const name = actor ? (actor.name || '') : 'Sistem (terjadwal)';
    const role = actor ? (actor.role || '') : 'system';
    const id = entityId != null && entityId !== '' ? parseInt(entityId, 10) : null;
    await sql`
      insert into audit_log (user_id, user_name, user_role, action, entity, entity_id, detail)
      values (${uid},
              coalesce((select nullif(name, '') from users where id = ${uid}), ${name}),
              ${role}, ${action}, ${entity}, ${id},
              ${detail ? JSON.stringify(detail) : null}::jsonb)`;
  } catch (e) { /* never block the caller */ }
}
