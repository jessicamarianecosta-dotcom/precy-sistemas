import { describe, expect, it } from 'vitest'
import { dilateMask, dilateMaskByRadius, erodeMaskByRadius, findConnectedComponents, polygonArea, simplifyPolygon, traceBoundary, traceMaskContours } from './contourTrace'

function makeMask(width: number, height: number, fill: (x: number, y: number) => boolean): Uint8Array {
  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (fill(x, y)) mask[y * width + x] = 1
    }
  }
  return mask
}

describe('dilateMask', () => {
  it('expande um único pixel para um bloco 3x3 após 1 iteração', () => {
    const mask = makeMask(10, 10, (x, y) => x === 5 && y === 5)
    const dilated = dilateMask(mask, 10, 10, 1)
    let count = 0
    for (let y = 4; y <= 6; y++) for (let x = 4; x <= 6; x++) if (dilated[y * 10 + x]) count++
    expect(count).toBe(9)
  })
})

describe('dilateMaskByRadius', () => {
  it('raio 0 não altera a máscara', () => {
    const mask = makeMask(10, 10, (x, y) => x === 5 && y === 5)
    const dilated = dilateMaskByRadius(mask, 10, 10, 0)
    expect(Array.from(dilated)).toEqual(Array.from(mask))
  })

  it('cresce um pixel isolado num círculo aproximado, maior que o raio 1 em xadrez', () => {
    const mask = makeMask(21, 21, (x, y) => x === 10 && y === 10)
    const dilated = dilateMaskByRadius(mask, 21, 21, 3)
    // Ortogonal a 3px deve estar dentro do raio.
    expect(dilated[10 * 21 + 13]).toBe(1)
    expect(dilated[10 * 21 + 7]).toBe(1)
    // Diagonal bem mais longe que o raio (ex: 3,3 ~ 4.24) deve ficar de fora.
    expect(dilated[(10 + 3) * 21 + (10 + 3)]).toBe(0)
  })

  it('une dois quadrados próximos a partir de um certo raio', () => {
    const mask = makeMask(30, 30, (x, y) =>
      (x >= 5 && x <= 9 && y >= 5 && y <= 9) ||
      (x >= 13 && x <= 17 && y >= 5 && y <= 9),
    )
    const smallRadius = dilateMaskByRadius(mask, 30, 30, 1)
    expect(findConnectedComponents(smallRadius, 30, 30)).toHaveLength(2)

    const bigRadius = dilateMaskByRadius(mask, 30, 30, 3)
    expect(findConnectedComponents(bigRadius, 30, 30)).toHaveLength(1)
  })
})

describe('erodeMaskByRadius', () => {
  it('raio 0 não altera a máscara', () => {
    const mask = makeMask(20, 20, (x, y) => x >= 5 && x <= 14 && y >= 5 && y <= 14)
    const eroded = erodeMaskByRadius(mask, 20, 20, 0)
    expect(Array.from(eroded)).toEqual(Array.from(mask))
  })

  it('encolhe um retângulo, mantendo o centro e removendo a borda', () => {
    const mask = makeMask(20, 20, (x, y) => x >= 5 && x <= 14 && y >= 5 && y <= 14)
    const eroded = erodeMaskByRadius(mask, 20, 20, 2)
    expect(eroded[9 * 20 + 9]).toBe(1) // centro continua de frente
    expect(eroded[5 * 20 + 5]).toBe(0) // canto da borda original é removido
  })
})

describe('findConnectedComponents', () => {
  it('encontra um retângulo cheio como um único componente, com a área correta', () => {
    const mask = makeMask(20, 20, (x, y) => x >= 5 && x <= 14 && y >= 5 && y <= 14)
    const components = findConnectedComponents(mask, 20, 20)
    expect(components).toHaveLength(1)
    expect(components[0].area).toBe(100)
    expect(components[0].startX).toBe(5)
    expect(components[0].startY).toBe(5)
  })

  it('encontra dois quadrados distantes como dois componentes separados', () => {
    const mask = makeMask(30, 30, (x, y) =>
      (x >= 2 && x <= 6 && y >= 2 && y <= 6) ||
      (x >= 20 && x <= 24 && y >= 20 && y <= 24),
    )
    const components = findConnectedComponents(mask, 30, 30)
    expect(components).toHaveLength(2)
  })
})

describe('traceBoundary + simplifyPolygon', () => {
  it('traça um retângulo cheio e simplifica para os 4 cantos', () => {
    const mask = makeMask(20, 20, (x, y) => x >= 5 && x <= 14 && y >= 5 && y <= 14)
    const raw = traceBoundary(mask, 20, 20, 5, 5)
    expect(raw.length).toBeGreaterThan(4) // o contorno bruto segue pixel a pixel

    const simplified = simplifyPolygon(raw, 0.5)
    // Um retângulo perfeito simplifica para ~4-5 pontos (o ponto inicial pode repetir no fim)
    expect(simplified.length).toBeLessThanOrEqual(6)

    const xs = simplified.map((p) => p.x)
    const ys = simplified.map((p) => p.y)
    expect(Math.min(...xs)).toBe(5)
    expect(Math.max(...xs)).toBe(14)
    expect(Math.min(...ys)).toBe(5)
    expect(Math.max(...ys)).toBe(14)
  })

  it('a área do contorno traçado é próxima da área do retângulo original', () => {
    const mask = makeMask(20, 20, (x, y) => x >= 5 && x <= 14 && y >= 5 && y <= 14)
    const raw = traceBoundary(mask, 20, 20, 5, 5)
    const area = polygonArea(raw)
    // 10x10 pixels de frente ~ área de contorno entre 81 (9x9, bordas internas) e 100 (10x10)
    expect(area).toBeGreaterThan(70)
    expect(area).toBeLessThanOrEqual(100)
  })
})

describe('traceMaskContours', () => {
  it('sem dilatação, dois quadrados distantes geram dois contornos', () => {
    const mask = makeMask(40, 40, (x, y) =>
      (x >= 2 && x <= 8 && y >= 2 && y <= 8) ||
      (x >= 30 && x <= 36 && y >= 30 && y <= 36),
    )
    const contours = traceMaskContours(mask, 40, 40, { dilateIterations: 0, simplifyEpsilon: 0.5 })
    expect(contours).toHaveLength(2)
  })

  it('com dilatação suficiente, dois quadrados próximos se fundem em um único contorno', () => {
    // dois quadrados de 5x5 separados por um vão de 3px (ex: letras próximas de um logotipo)
    const mask = makeMask(30, 30, (x, y) =>
      (x >= 5 && x <= 9 && y >= 5 && y <= 9) ||
      (x >= 13 && x <= 17 && y >= 5 && y <= 9),
    )
    const noDilation = traceMaskContours(mask, 30, 30, { dilateIterations: 0 })
    expect(noDilation).toHaveLength(2)

    const withDilation = traceMaskContours(mask, 30, 30, { dilateIterations: 3 })
    expect(withDilation).toHaveLength(1)
  })

  it('descarta componentes menores que o limiar de área (ruído)', () => {
    const mask = makeMask(20, 20, (x, y) => (x === 1 && y === 1) || (x >= 5 && x <= 14 && y >= 5 && y <= 14))
    const contours = traceMaskContours(mask, 20, 20, { minAreaPx: 4 })
    expect(contours).toHaveLength(1)
  })
})
