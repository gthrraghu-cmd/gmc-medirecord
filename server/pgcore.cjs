const { Pool } = require('pg')

const TABLES = ['patients', 'visits', 'appointments', 'cases', 'packages', 'photos', 'documents', 'templates', 'expenses', 'settings']
const SCHEMA = 'medirecord'

module.exports = function createPg(store) {
  let pool = null
  let current = null

  function clean(form) {
    return {
      host: String(form.host || 'localhost').trim() || 'localhost',
      port: Number(form.port) || 5432,
      user: String(form.user || 'postgres').trim() || 'postgres',
      password: String(form.password || ''),
      database: String(form.database || 'gmc_medirecord').trim().replace(/[^A-Za-z0-9_]/g, '_') || 'gmc_medirecord'
    }
  }

  function makePool(c, database) {
    const p = new Pool({ host: c.host, port: c.port, user: c.user, password: c.password, database: database || c.database, max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 })
    p.on('error', () => {})
    return p
  }

  function explain(err) {
    const code = err && err.code
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'EHOSTUNREACH' || /timeout/i.test(String(err && err.message))) {
      return { ok: false, offline: true, error: 'PostgreSQL is not running or not reachable on this laptop.' }
    }
    if (code === '28P01' || code === '28000') return { ok: false, error: 'PostgreSQL user name or password is wrong.' }
    if (code === '42501') return { ok: false, error: 'This PostgreSQL user is not allowed to create the database or tables.' }
    return { ok: false, error: (err && err.message) || 'PostgreSQL error' }
  }

  async function openPool(c) {
    const p = makePool(c)
    try {
      await p.query('select 1')
      return p
    } catch (err) {
      await p.end().catch(() => {})
      if (err.code !== '3D000') throw err
    }
    const admin = makePool(c, 'postgres')
    try {
      await admin.query(`create database "${c.database}"`)
    } finally {
      await admin.end().catch(() => {})
    }
    const fresh = makePool(c)
    await fresh.query('select 1')
    return fresh
  }

  function schemaSql() {
    const parts = [
      `create schema if not exists ${SCHEMA}`,
      `create or replace function ${SCHEMA}.touch() returns trigger language plpgsql as $$
  begin
    if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
      return null;
    end if;
    new.changed_at := clock_timestamp();
    return new;
  end $$`
    ]
    for (const t of TABLES) {
      parts.push(`create table if not exists ${SCHEMA}.${t} (
    id text primary key,
    data jsonb,
    updated_at bigint not null,
    deleted boolean not null default false,
    device text,
    changed_at timestamptz not null default clock_timestamp()
  )`)
      parts.push(`create index if not exists ${t}_changed_at on ${SCHEMA}.${t} (changed_at)`)
      parts.push(`drop trigger if exists touch on ${SCHEMA}.${t}`)
      parts.push(`create trigger touch before insert or update on ${SCHEMA}.${t} for each row execute function ${SCHEMA}.touch()`)
    }
    parts.push(`create table if not exists ${SCHEMA}.files (
    tbl text not null,
    id text not null,
    field text not null,
    mime text,
    content bytea,
    primary key (tbl, id, field)
  )`)
    parts.push(`create or replace function ${SCHEMA}.num(v text) returns numeric language sql immutable as $$
    select case when v ~ '^-?[0-9]+(\\.[0-9]+)?$' then v::numeric else null end
  $$`)
    parts.push(`create or replace function ${SCHEMA}.day(v text) returns date language sql immutable as $$
    select case when v ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then v::date else null end
  $$`)
    parts.push(`create or replace view ${SCHEMA}.patient_list as
  select p.data->>'code' as code, p.data->>'name' as name, p.data->>'phone' as phone, p.data->>'gender' as gender,
    p.data->>'age' as age, p.data->>'city' as city, p.data->>'department' as department,
    ${SCHEMA}.day(p.data->>'lastVisit') as last_visit,
    to_timestamp(${SCHEMA}.num(p.data->>'createdAt') / 1000) as registered_at
  from ${SCHEMA}.patients p where not p.deleted`)
    parts.push(`create or replace view ${SCHEMA}.consultation_list as
  select ${SCHEMA}.day(v.data->>'date') as date, v.data->>'receiptNo' as receipt_no, p.data->>'code' as patient_code,
    p.data->>'name' as patient_name, v.data->>'department' as department, v.data->>'complaints' as complaints,
    v.data->>'diagnosis' as diagnosis, ${SCHEMA}.num(v.data->>'fee') as fee, v.data->>'payMode' as pay_mode,
    ${SCHEMA}.day(v.data->>'paidOn') as paid_on, ${SCHEMA}.day(v.data->>'followUp') as follow_up
  from ${SCHEMA}.visits v left join ${SCHEMA}.patients p on p.id = v.data->>'patientId' and not p.deleted
  where not v.deleted`)
    parts.push(`create or replace view ${SCHEMA}.expense_list as
  select ${SCHEMA}.day(e.data->>'date') as date, e.data->>'category' as category, ${SCHEMA}.num(e.data->>'amount') as amount,
    e.data->>'mode' as mode, e.data->>'note' as note
  from ${SCHEMA}.expenses e where not e.deleted`)
    return parts
  }

  async function ensureSchema(p) {
    const client = await p.connect()
    try {
      await client.query('begin')
      for (const sql of schemaSql()) await client.query(sql)
      await client.query('commit')
    } catch (err) {
      await client.query('rollback').catch(() => {})
      throw err
    } finally {
      client.release()
    }
  }

  async function getPool() {
    if (pool) return pool
    const c = current || store.read()
    if (!c) throw Object.assign(new Error('PostgreSQL is not set up.'), { code: 'NOCFG' })
    current = c
    pool = makePool(c)
    return pool
  }

  async function resetPool() {
    if (pool) await pool.end().catch(() => {})
    pool = null
  }

  async function connect(form) {
    const c = clean(form)
    try {
      const p = await openPool(c)
      await ensureSchema(p)
      const { rows } = await p.query(`select (select count(*) from ${SCHEMA}.patients where not deleted)::int as patients, (select count(*) from ${SCHEMA}.visits where not deleted)::int as visits`)
      await resetPool()
      pool = p
      current = c
      store.write(c)
      return { ok: true, data: { host: c.host, port: c.port, user: c.user, database: c.database, ...rows[0] } }
    } catch (err) {
      return explain(err)
    }
  }

  async function status() {
    const c = current || store.read()
    if (!c) return { ok: true, data: null }
    return { ok: true, data: { host: c.host, port: c.port, user: c.user, database: c.database } }
  }

  async function forget() {
    await resetPool()
    current = null
    store.remove()
    return { ok: true }
  }

  async function push(rows) {
    let client
    try {
      const p = await getPool()
      client = await p.connect()
      await client.query('begin')
      let applied = 0
      for (const r of rows) {
        if (!TABLES.includes(r.t)) continue
        const res = await client.query(
          `insert into ${SCHEMA}.${r.t} (id, data, updated_at, deleted, device) values ($1, $2, $3, $4, $5)
           on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, device = excluded.device
           returning id`,
          [r.id, r.deleted ? null : r.data, r.mt, !!r.deleted, r.device || null]
        )
        if (!res.rowCount) continue
        applied++
        const fields = (r.files || []).map(f => f.field)
        await client.query(`delete from ${SCHEMA}.files where tbl = $1 and id = $2 and not (field = any($3::text[]))`, [r.t, r.id, r.deleted ? [] : fields])
        if (r.deleted) continue
        for (const f of r.files || []) {
          await client.query(
            `insert into ${SCHEMA}.files (tbl, id, field, mime, content) values ($1, $2, $3, $4, $5)
             on conflict (tbl, id, field) do update set mime = excluded.mime, content = excluded.content`,
            [r.t, r.id, f.field, f.mime || 'application/octet-stream', Buffer.from(f.bytes)]
          )
        }
      }
      await client.query('commit')
      return { ok: true, data: { applied } }
    } catch (err) {
      if (client) await client.query('rollback').catch(() => {})
      if (err.code === 'NOCFG') return { ok: false, error: err.message }
      if (explain(err).offline) await resetPool()
      return explain(err)
    } finally {
      if (client) client.release()
    }
  }

  async function pull(since, offset, limit) {
    try {
      const p = await getPool()
      const union = TABLES.map(t => `select '${t}' as t, id, data, updated_at, deleted, changed_at from ${SCHEMA}.${t} where changed_at >= $1::timestamptz`).join(' union all ')
      const { rows } = await p.query(`${union} order by changed_at, t, id limit $2 offset $3`, [since || '1970-01-01T00:00:00Z', limit, offset])
      const wanted = rows.filter(r => !r.deleted && (r.t === 'photos' || r.t === 'documents')).map(r => r.t + '|' + r.id)
      const files = {}
      if (wanted.length) {
        const res = await p.query(`select tbl, id, field, mime, content from ${SCHEMA}.files where tbl || '|' || id = any($1::text[])`, [wanted])
        for (const f of res.rows) {
          const k = f.tbl + '|' + f.id
          ;(files[k] = files[k] || []).push({ field: f.field, mime: f.mime, bytes: new Uint8Array(f.content) })
        }
      }
      return {
        ok: true,
        data: rows.map(r => ({ t: r.t, id: r.id, data: r.data, mt: Number(r.updated_at), deleted: r.deleted, ts: r.changed_at.toISOString(), files: files[r.t + '|' + r.id] || [] }))
      }
    } catch (err) {
      if (err.code === 'NOCFG') return { ok: false, error: err.message }
      if (explain(err).offline) await resetPool()
      return explain(err)
    }
  }

  async function shutdown() {
    await resetPool()
  }

  return { connect, status, forget, push, pull, shutdown }
}
