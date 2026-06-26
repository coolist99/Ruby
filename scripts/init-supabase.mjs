// 用数据库连接串直连，把 supabase/schema.sql 跑进去（建表 + RLS）
// 运行：node --env-file=.env scripts/init-supabase.mjs   （.env 里要有 SUPABASE_DB_URL）
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import dns from 'node:dns/promises'

const conn = process.env.SUPABASE_DB_URL
if (!conn || conn.includes('YOUR-PASSWORD')) {
  console.error('❌ 请在 .env 里设置 SUPABASE_DB_URL（含真实密码的完整连接串）')
  process.exit(1)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(path.join(here, '..', 'supabase', 'schema.sql'), 'utf8')

const url = new URL(conn)

// Supabase 直连主机可能只有 IPv6：解析 AAAA，拿到 v6 地址直连
let client
try {
  const v6 = await dns.resolve6(url.hostname)
  const host = v6[0]
  console.log('使用 IPv6 直连：', host)
  client = new pg.Client({
    host,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1) || 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  })
  await client.connect()
  console.log('✅ 已连接数据库')
} catch (e) {
  console.error('❌ IPv6 直连失败：', e.message)
  process.exit(1)
}

try {
  console.log('⏳ 执行 schema.sql ...')
  await client.query(sql) // 简单查询协议，支持多条语句
  console.log('✅ 表已创建/更新。当前行数：')
  for (const t of ['classes', 'students', 'transactions']) {
    const r = await client.query(`select count(*)::int as n from public.${t}`)
    console.log(`   ${t}: ${r.rows[0].n} 行`)
  }
} catch (e) {
  console.error('❌ 执行失败：', e.message)
  process.exit(1)
} finally {
  await client.end()
}
