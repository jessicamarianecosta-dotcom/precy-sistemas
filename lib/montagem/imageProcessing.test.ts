import { describe, expect, it } from 'vitest'
import { computeBackgroundRemovalMask } from './imageProcessing'

/** Monta um buffer RGBA width*height a partir de uma função que dá a cor de cada pixel. */
function makeRgba(width: number, height: number, colorAt: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const [r, g, b] = colorAt(x, y)
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255
    }
  }
  return data
}

const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [0, 0, 0]

describe('computeBackgroundRemovalMask', () => {
  it('remove só o fundo branco ao redor, nunca a arte no meio', () => {
    // 20x20, fundo branco, um quadrado preto sólido de 8x8 no meio (sem buraco).
    const size = 20
    const data = makeRgba(size, size, (x, y) => (x >= 6 && x <= 13 && y >= 6 && y <= 13 ? BLACK : WHITE))

    const mask = computeBackgroundRemovalMask(data, size, size, 30, false)

    // Cantos (fundo) devem virar transparentes.
    expect(mask[0]).toBe(1)
    expect(mask[size * size - 1]).toBe(1)
    // O quadrado preto nunca deve ser marcado.
    for (let y = 6; y <= 13; y++) {
      for (let x = 6; x <= 13; x++) {
        expect(mask[y * size + x]).toBe(0)
      }
    }
  })

  it('não remove um "buraco" de fundo cercado pela arte quando removeHoles=false', () => {
    // Anel preto (moldura) de 20x20 com um miolo branco de 6x6 no centro —
    // simula o interior de uma letra "O": a cor bate com o fundo, mas não
    // tem caminho até a borda da imagem sem atravessar o preto.
    const size = 20
    const data = makeRgba(size, size, (x, y) => {
      const insideRing = x >= 4 && x <= 15 && y >= 4 && y <= 15
      const insideHole = x >= 7 && x <= 12 && y >= 7 && y <= 12
      if (insideHole) return WHITE // buraco (mesma cor do fundo)
      if (insideRing) return BLACK // anel da arte
      return WHITE // fundo de verdade
    })

    const maskKeepHole = computeBackgroundRemovalMask(data, size, size, 30, false)
    // Fundo externo removido...
    expect(maskKeepHole[0]).toBe(1)
    // ...mas o buraco interno (mesma cor) permanece intacto.
    expect(maskKeepHole[9 * size + 9]).toBe(0)
    // O anel preto nunca é removido.
    expect(maskKeepHole[4 * size + 4]).toBe(0)

    const maskRemoveHole = computeBackgroundRemovalMask(data, size, size, 30, true)
    // Com removeHoles=true, o buraco interno também vira transparente.
    expect(maskRemoveHole[9 * size + 9]).toBe(1)
    // O fundo externo continua removido e o anel preto continua intacto.
    expect(maskRemoveHole[0]).toBe(1)
    expect(maskRemoveHole[4 * size + 4]).toBe(0)
  })
})
