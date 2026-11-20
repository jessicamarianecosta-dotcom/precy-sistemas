/**
 * PRECY MONTAGEM — rastreamento de contorno (linha de corte / "faca").
 *
 * Funções puras, sem DOM: operam sobre uma máscara binária (0/1) e por isso
 * são testáveis diretamente com vitest. A parte que extrai essa máscara de
 * uma imagem real (canvas) fica em cutContour.ts.
 *
 * Algoritmo: Moore-Neighbor boundary tracing (com critério de parada de
 * Jacob) para extrair o contorno externo de cada região conectada, com
 * dilatação morfológica opcional antes (pra unir elementos próximos num
 * único contorno de corte, como letras separadas de um mesmo logotipo) e
 * simplificação Douglas-Peucker depois (reduz milhares de pontos por pixel
 * a um polígono enxuto, sem distorcer o formato).
 */

export interface Point {
  x: number
  y: number
}

/** Direções no sentido horário a partir do Norte. */
const DIRS = [
  { dx: 0, dy: -1 },  // N
  { dx: 1, dy: -1 },  // NE
  { dx: 1, dy: 0 },   // E
  { dx: 1, dy: 1 },   // SE
  { dx: 0, dy: 1 },   // S
  { dx: -1, dy: 1 },  // SW
  { dx: -1, dy: 0 },  // W
  { dx: -1, dy: -1 }, // NW
] as const

/**
 * Transformada de distância (chamfer 1/√2, duas passadas) — para cada pixel,
 * a distância até o pixel de "fonte" (valor 1 em `sourceMask`) mais próximo.
 * Base para dilatação/erosão por raio em qualquer tamanho sem custo
 * proporcional ao raio (ao contrário de aplicar 1px por iteração).
 */
function distanceTransform(sourceMask: Uint8Array, width: number, height: number): Float32Array {
  const INF = 1e8
  const dist = new Float32Array(width * height)
  for (let p = 0; p < dist.length; p++) dist[p] = sourceMask[p] ? 0 : INF

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      let d = dist[idx]
      if (x > 0) d = Math.min(d, dist[idx - 1] + 1)
      if (y > 0) d = Math.min(d, dist[idx - width] + 1)
      if (x > 0 && y > 0) d = Math.min(d, dist[idx - width - 1] + Math.SQRT2)
      if (x < width - 1 && y > 0) d = Math.min(d, dist[idx - width + 1] + Math.SQRT2)
      dist[idx] = d
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const idx = y * width + x
      let d = dist[idx]
      if (x < width - 1) d = Math.min(d, dist[idx + 1] + 1)
      if (y < height - 1) d = Math.min(d, dist[idx + width] + 1)
      if (x < width - 1 && y < height - 1) d = Math.min(d, dist[idx + width + 1] + Math.SQRT2)
      if (x > 0 && y < height - 1) d = Math.min(d, dist[idx + width - 1] + Math.SQRT2)
      dist[idx] = d
    }
  }
  return dist
}

/** Cresce a região de frente (1) em `radiusPx` — mais rápido e mais arredondado (euclidiano) que iterar 1px por vez. */
export function dilateMaskByRadius(mask: Uint8Array, width: number, height: number, radiusPx: number): Uint8Array {
  if (radiusPx <= 0) return mask.slice()
  const dist = distanceTransform(mask, width, height)
  const out = new Uint8Array(mask.length)
  for (let p = 0; p < out.length; p++) out[p] = dist[p] <= radiusPx ? 1 : 0
  return out
}

/** Encolhe a região de frente (1) em `radiusPx` — usado pra limpar uma franja fina residual na borda de um recorte. */
export function erodeMaskByRadius(mask: Uint8Array, width: number, height: number, radiusPx: number): Uint8Array {
  if (radiusPx <= 0) return mask.slice()
  const inverted = new Uint8Array(mask.length)
  for (let p = 0; p < mask.length; p++) inverted[p] = mask[p] ? 0 : 1
  const distToBackground = distanceTransform(inverted, width, height)
  const out = new Uint8Array(mask.length)
  for (let p = 0; p < out.length; p++) out[p] = mask[p] === 1 && distToBackground[p] >= radiusPx ? 1 : 0
  return out
}

/** Dilatação morfológica binária (8-conectada), `iterations` vezes — crescimento em "xadrez", não arredondado. Mantida para o pipeline de contorno em pequena escala; para raios maiores, prefira `dilateMaskByRadius`. */
export function dilateMask(mask: Uint8Array, width: number, height: number, iterations: number): Uint8Array {
  let current = mask
  for (let it = 0; it < iterations; it++) {
    const next = new Uint8Array(current.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x
        if (current[idx]) { next[idx] = 1; continue }
        let grow = false
        for (const d of DIRS) {
          const nx = x + d.dx, ny = y + d.dy
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && current[ny * width + nx]) { grow = true; break }
        }
        next[idx] = grow ? 1 : 0
      }
    }
    current = next
  }
  return current
}

export interface Component {
  startX: number
  startY: number
  area: number
}

/** Rotulagem de componentes conectados (4-conexo) por flood fill iterativo. */
export function findConnectedComponents(mask: Uint8Array, width: number, height: number): Component[] {
  const visited = new Uint8Array(mask.length)
  const components: Component[] = []
  const stack: number[] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x
      if (!mask[start] || visited[start]) continue

      let area = 0
      stack.length = 0
      stack.push(start)
      visited[start] = 1
      while (stack.length) {
        const cur = stack.pop() as number
        area++
        const cx = cur % width
        const cy = (cur - cx) / width
        const neighbors4: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]]
        for (const [dx, dy] of neighbors4) {
          const nx = cx + dx, ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nidx = ny * width + nx
          if (mask[nidx] && !visited[nidx]) { visited[nidx] = 1; stack.push(nidx) }
        }
      }
      components.push({ startX: x, startY: y, area })
    }
  }
  return components
}

/**
 * Contorno externo de um componente via Moore-Neighbor tracing.
 * `startX,startY` deve ser o pixel de varredura raster (topo-esquerda) do
 * componente — garantidamente um pixel de borda válido.
 */
export function traceBoundary(mask: Uint8Array, width: number, height: number, startX: number, startY: number): Point[] {
  const isFg = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1

  const boundary: Point[] = [{ x: startX, y: startY }]
  let current = { x: startX, y: startY }
  // O pixel à esquerda do start é garantidamente fundo (foi o primeiro
  // pixel de frente encontrado varrendo da esquerda pra direita).
  let backtrack = { x: startX - 1, y: startY }
  const firstBacktrack = { ...backtrack }
  const maxSteps = width * height * 4 // trava de segurança contra formas degeneradas (1px de espessura)

  for (let steps = 0; steps < maxSteps; steps++) {
    const bdx = backtrack.x - current.x, bdy = backtrack.y - current.y
    let bIdx = DIRS.findIndex((d) => d.dx === bdx && d.dy === bdy)
    if (bIdx === -1) bIdx = 6 // fallback seguro (W) — não deveria ocorrer na prática

    let found: { x: number; y: number; dirIdx: number } | null = null
    for (let i = 1; i <= 8; i++) {
      const dirIdx = (bIdx + i) % 8
      const nx = current.x + DIRS[dirIdx].dx, ny = current.y + DIRS[dirIdx].dy
      if (isFg(nx, ny)) { found = { x: nx, y: ny, dirIdx }; break }
    }
    if (!found) break // pixel isolado, sem vizinhos de frente

    const prevDirIdx = (found.dirIdx + 7) % 8
    backtrack = { x: current.x + DIRS[prevDirIdx].dx, y: current.y + DIRS[prevDirIdx].dy }
    current = { x: found.x, y: found.y }

    if (current.x === startX && current.y === startY && backtrack.x === firstBacktrack.x && backtrack.y === firstBacktrack.y) {
      break
    }
    boundary.push({ ...current })
  }

  return boundary
}

/** Simplificação Douglas-Peucker — reduz pontos redundantes num segmento quase reto. */
export function simplifyPolygon(points: Point[], epsilon: number): Point[] {
  if (points.length < 3 || epsilon <= 0) return points
  return rdp(points, epsilon)
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points
  const first = points[0]
  const last = points[points.length - 1]
  let maxDist = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last)
    if (d > maxDist) { maxDist = d; index = i }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon)
    const right = rdp(points.slice(index), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [first, last]
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const magSq = dx * dx + dy * dy
  if (magSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / magSq
  const closestX = a.x + t * dx, closestY = a.y + t * dy
  return Math.hypot(p.x - closestX, p.y - closestY)
}

export interface TraceContoursOptions {
  /** Quantos passos de dilatação aplicar antes de traçar (une elementos próximos num só contorno). */
  dilateIterations?: number
  /** Tolerância (em px da máscara de trabalho) da simplificação Douglas-Peucker. */
  simplifyEpsilon?: number
  /** Componentes com área (em px²) menor que isso são descartados como ruído. */
  minAreaPx?: number
}

/** Pipeline completo: dilata (opcional) → encontra componentes → traça → simplifica. */
export function traceMaskContours(mask: Uint8Array, width: number, height: number, opts: TraceContoursOptions = {}): Point[][] {
  // Raio euclidiano (via transformada de distância), não "iterações" em xadrez:
  // mais arredondado e com custo independente do tamanho do raio.
  const dilated = opts.dilateIterations && opts.dilateIterations > 0
    ? dilateMaskByRadius(mask, width, height, opts.dilateIterations)
    : mask

  const components = findConnectedComponents(dilated, width, height)
  const minArea = opts.minAreaPx ?? 4
  const epsilon = opts.simplifyEpsilon ?? 1

  const contours: Point[][] = []
  for (const c of components) {
    if (c.area < minArea) continue
    const raw = traceBoundary(dilated, width, height, c.startX, c.startY)
    if (raw.length < 3) continue
    contours.push(simplifyPolygon(raw, epsilon))
  }
  return contours
}

/** Área de um polígono fechado pela fórmula do shoelace (valor absoluto). */
export function polygonArea(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}
