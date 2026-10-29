/**
 * Detecta o tipo real de um arquivo pelos primeiros bytes (magic numbers),
 * em vez de confiar no `file.type` reportado pelo navegador ou na extensão
 * do nome — ambos são só metadados que o client controla. Cobre só os
 * formatos aceitos pelo Catálogo Online (JPEG/PNG/WEBP/GIF/MP4).
 */
export function sniffMimeType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'

  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'image/png'

  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'image/webp'

  if (
    buffer.toString('ascii', 0, 3) === 'GIF' &&
    (buffer.toString('ascii', 3, 6) === '87a' || buffer.toString('ascii', 3, 6) === '89a')
  ) return 'image/gif'

  // MP4/MOV (ISO base media file format): bytes 4-7 identificam a box
  // "ftyp" que sempre abre esse tipo de arquivo, logo após os 4 bytes de
  // tamanho da box.
  if (buffer.toString('ascii', 4, 8) === 'ftyp') return 'video/mp4'

  return null
}
