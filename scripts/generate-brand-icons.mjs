/**
 * Gera os ícones estáticos da marca Precy+ (manifest PWA + favicon.ico
 * legado) a partir do mesmo logo "P+" com gradiente usado na Sidebar
 * (bg-gradient-primary: #8B6C4F → #B8956A → #C4A47B, 135°).
 *
 * O favicon principal (aba do navegador) e o apple-touch-icon usam a
 * convenção nativa do Next.js (app/icon.tsx e app/apple-icon.tsx) e são
 * gerados dinamicamente a cada request — este script cobre só os
 * arquivos que precisam existir como PNG estático no disco: os tamanhos
 * do manifest.webmanifest (PWA/Android) e um public/favicon.ico "PNG-in-ICO"
 * para navegadores/crawlers legados que pedem /favicon.ico diretamente.
 *
 * Rodar novamente sempre que o design do logo mudar:
 *   node scripts/generate-brand-icons.mjs
 */
import { ImageResponse } from 'next/og.js'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function logoElement(size) {
  const radius = Math.round(size * 0.22)
  const fontSize = Math.round(size * 0.46)
  return {
    type: 'div',
    props: {
      style: {
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #8B6C4F 0%, #B8956A 50%, #C4A47B 100%)',
        borderRadius: radius,
      },
      children: {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            color: 'white',
            fontSize,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            letterSpacing: -1,
          },
          children: 'P+',
        },
      },
    },
  }
}

async function renderPng(size) {
  const res = new ImageResponse(logoElement(size), { width: size, height: size })
  return Buffer.from(await res.arrayBuffer())
}

/** Empacota PNGs num container .ico válido (formato "PNG-in-ICO", suportado
 * desde Windows Vista / todos os navegadores modernos — sem depender de
 * nenhuma lib externa de conversão). */
function buildIco(entries) {
  const count = entries.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type = icon
  header.writeUInt16LE(count, 4)

  let offset = 6 + 16 * count
  const dirEntries = []
  const images = []
  for (const { size, buffer } of entries) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)  // width (0 = 256px)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)  // height
    entry.writeUInt8(0, 2)                        // color palette
    entry.writeUInt8(0, 3)                        // reserved
    entry.writeUInt16LE(1, 4)                     // color planes
    entry.writeUInt16LE(32, 6)                    // bits per pixel
    entry.writeUInt32LE(buffer.length, 8)         // tamanho da imagem
    entry.writeUInt32LE(offset, 12)               // offset no arquivo
    offset += buffer.length
    dirEntries.push(entry)
    images.push(buffer)
  }
  return Buffer.concat([header, ...dirEntries, ...images])
}

async function main() {
  const iconsDir = path.join(ROOT, 'public', 'icons')
  await mkdir(iconsDir, { recursive: true })

  // Tamanhos já referenciados em public/manifest.json
  const manifestSizes = [72, 96, 128, 192, 512]
  for (const size of manifestSizes) {
    const buf = await renderPng(size)
    const file = path.join(iconsDir, `icon-${size}x${size}.png`)
    await writeFile(file, buf)
    console.log(`✔ public/icons/icon-${size}x${size}.png (${buf.length} bytes)`)
  }

  // favicon.ico legado (16 + 32px embutidos)
  const png16 = await renderPng(16)
  const png32 = await renderPng(32)
  const ico = buildIco([{ size: 16, buffer: png16 }, { size: 32, buffer: png32 }])
  await writeFile(path.join(ROOT, 'public', 'favicon.ico'), ico)
  console.log(`✔ public/favicon.ico (${ico.length} bytes)`)
}

main().catch(err => { console.error('Falha ao gerar ícones:', err); process.exit(1) })
