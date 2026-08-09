// ============================================================
// Generar logo profesional para SoftLBA
// ============================================================

import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'

const OUTPUT_DIR = '/home/z/my-project/public'
const LOGO_PATH = path.join(OUTPUT_DIR, 'softlba-logo.png')
const LOGO_SQUARE_PATH = path.join(OUTPUT_DIR, 'softlba-logo-square.png')
const FAVICON_PATH = path.join(OUTPUT_DIR, 'softlba-favicon.png')

async function generateLogos() {
  console.log('🎨 Generando logo profesional de SoftLBA...')
  const zai = await ZAI.create()

  // 1. Logo principal (cuadrado, para sidebar, headers, etc.)
  console.log('  → Logo principal cuadrado...')
  const resp1 = await zai.images.generations.create({
    prompt: 'Professional modern minimalist logo for software system called SoftLBA, the letters "S" stylized in a geometric rounded shape, deep blue color (#2563eb) with subtle darker blue gradient, clean professional design, on white background, simple flat vector style, no text below the logo, just the icon, high quality, centered',
    size: '1024x1024',
  })
  if (resp1.data && resp1.data[0]) {
    fs.writeFileSync(LOGO_PATH, Buffer.from(resp1.data[0].base64, 'base64'))
    console.log(`  ✓ Logo guardado en ${LOGO_PATH}`)
  }

  // 2. Logo cuadrado compacto (favicon)
  console.log('  → Favicon cuadrado...')
  const resp2 = await zai.images.generations.create({
    prompt: 'Minimalist geometric logo icon letter S, blue gradient #2563eb to #1e40af, simple flat design, rounded square shape, white background, suitable for favicon, no text, just icon, professional clean',
    size: '1024x1024',
  })
  if (resp2.data && resp2.data[0]) {
    fs.writeFileSync(FAVICON_PATH, Buffer.from(resp2.data[0].base64, 'base64'))
    console.log(`  ✓ Favicon guardado en ${FAVICON_PATH}`)
  }

  console.log('✅ Todos los logos generados')
}

generateLogos().catch(e => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
