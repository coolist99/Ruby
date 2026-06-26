// 探测项目所在的 pooler 地域：用凭据逐个地域尝试连接，找到能连上的那个
import pg from 'pg'

const raw = process.env.SUPABASE_DB_URL // postgresql://postgres:PASS@db.<ref>...
const u = new URL(raw)
const pass = decodeURIComponent(u.password)
const ref = 'vtkxfmivxvpmkzymzfyj'

const regions = [
  'us-east-1', 'us-west-1', 'us-west-2', 'us-east-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-southeast-4',
  'ap-east-1', 'ap-south-1', 'ap-south-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1', 'eu-south-1', 'eu-south-2',
  'me-central-1', 'me-south-1', 'il-central-1', 'af-south-1',
  'sa-east-1', 'ca-central-1', 'ca-west-1', 'mx-central-1',
]

async function tryRegion(r) {
  const conn = `postgresql://postgres.${ref}:${encodeURIComponent(pass)}@aws-0-${r}.pooler.supabase.com:5432/postgres`
  const c = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 7000 })
  try {
    await c.connect()
    await c.end()
    return { r, ok: true }
  } catch (e) {
    return { r, ok: false, msg: (e.message || '').split('\n')[0] }
  }
}

const results = await Promise.all(regions.map(tryRegion))
const hit = results.find((x) => x.ok)
if (hit) {
  console.log('✅ 找到地域：', hit.r)
  console.log(
    `连接串：postgresql://postgres.${ref}:<密码>@aws-0-${hit.r}.pooler.supabase.com:5432/postgres`,
  )
} else {
  console.log('❌ 所有地域都连不上。各地域反馈：')
  for (const x of results) console.log(`  ${x.r}: ${x.msg}`)
}
