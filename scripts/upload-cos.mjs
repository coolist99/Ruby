// 一键部署到腾讯云 COS 静态网站托管
// 运行：node --env-file=.env scripts/upload-cos.mjs
// 需要在 .env 里配：COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET(含appid) / COS_REGION
import COS from 'cos-nodejs-sdk-v5'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const { COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET, COS_REGION } = process.env
if (!COS_SECRET_ID || !COS_SECRET_KEY || !COS_BUCKET || !COS_REGION) {
  console.error('❌ 请在 .env 配置 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION')
  process.exit(1)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = join(here, '..', 'dist')

const cos = new COS({ SecretId: COS_SECRET_ID, SecretKey: COS_SECRET_KEY })

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = walk(distDir)
console.log(`上传 ${files.length} 个文件到 ${COS_BUCKET} (${COS_REGION}) ...`)

for (const f of files) {
  const key = relative(distDir, f).split(sep).join('/')
  await cos.putObject({
    Bucket: COS_BUCKET,
    Region: COS_REGION,
    Key: key,
    Body: readFileSync(f),
    ContentType: MIME[path.extname(f).toLowerCase()] || 'application/octet-stream',
  }).catch((e) => {
    throw new Error(`上传 ${key} 失败: ${e.message}`)
  })
  console.log('  ✓', key)
}

// 桶设为公有读
await cos.putBucketAcl({ Bucket: COS_BUCKET, Region: COS_REGION, ACL: 'public-read' })
console.log('✅ 桶已设为公有读')

// 静态网站托管：错误文档也指向 index.html，让前端路由（/students 等）能正常工作
await cos.putBucketWebsite({
  Bucket: COS_BUCKET,
  Region: COS_REGION,
  WebsiteConfiguration: {
    IndexDocument: { Suffix: 'index.html' },
    ErrorDocument: { Key: 'index.html' },
  },
})
console.log('✅ 已开启静态网站托管（SPA 路由）')

console.log('\n🌐 访问地址（大陆可直连）：')
console.log(`   https://${COS_BUCKET}.cos-website.${COS_REGION}.myqcloud.com`)
