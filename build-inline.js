import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const appHtmlPath = resolve('public/static/app.html')
const serviceLeadsHtmlPath = resolve('public/static/serviceleads.html')
const appJsPath = resolve('public/static/app.js')

// Check files exist
const warnings = []
if (!existsSync(appHtmlPath)) warnings.push('⚠️  public/static/app.html not found')
if (!existsSync(serviceLeadsHtmlPath)) warnings.push('⚠️  public/static/serviceleads.html not found')
if (!existsSync(appJsPath)) warnings.push('⚠️  public/static/app.js not found')

if (warnings.length) {
  console.warn('build-inline.js warnings:')
  warnings.forEach(w => console.warn(w))
  console.warn('pages.ts will be generated with empty placeholders')
}

const read = (path) => {
  try { return readFileSync(path, 'utf8') } catch { return '' }
}

const appHtml = read(appHtmlPath)
const serviceLeadsHtml = read(serviceLeadsHtmlPath)
const appJs = read(appJsPath)

const output = `// AUTO-GENERATED — do not edit manually
// Run: node build-inline.js to regenerate from public/static/

export const APP_HTML = ${JSON.stringify(appHtml)}

export const SERVICE_LEADS_HTML = ${JSON.stringify(serviceLeadsHtml)}

export const APP_JS = ${JSON.stringify(appJs)}
`

writeFileSync(resolve('src/pages.ts'), output)
console.log('✅ build-inline.js: src/pages.ts generated successfully')
