// 连通性自检：用 .env 里的凭据测试能否访问你的 Supabase 项目
// 运行：node --env-file=.env scripts/ping-supabase.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.log('⚠️  没读到 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，请用 --env-file=.env 运行')
  process.exit(1)
}

console.log('项目地址:', url)
const sb = createClient(url, key)

for (const t of ['classes', 'students', 'transactions']) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true })
  if (error) {
    // "relation ... does not exist" = 连得通，只是还没建表
    const msg = error.message || String(error)
    if (/does not exist|Could not find|schema|relation/i.test(msg)) {
      console.log(`  ${t}: 📡 连得通，但表还没建（请先在 Supabase 跑 supabase/schema.sql）`)
    } else {
      console.log(`  ${t}: ❌ ${msg}`)
    }
  } else {
    console.log(`  ${t}: ✅ 已存在，共 ${count} 行`)
  }
}
