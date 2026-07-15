import { File, FileArchive, FileImage, FileType, type LucideIcon } from 'lucide-react'

export interface FileKindInfo {
  label: string
  Icon: LucideIcon
  isImage: boolean
  isPdf: boolean
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif']

const KNOWN: Record<string, Omit<FileKindInfo, 'isImage' | 'isPdf'>> = {
  pdf:  { label: 'PDF', Icon: FileType },
  ai:   { label: 'Adobe Illustrator', Icon: FileType },
  eps:  { label: 'Encapsulated PostScript', Icon: FileType },
  cdr:  { label: 'CorelDRAW', Icon: FileType },
  zip:  { label: 'ZIP', Icon: FileArchive },
  rar:  { label: 'RAR', Icon: FileArchive },
  jpg:  { label: 'JPG', Icon: FileImage },
  jpeg: { label: 'JPEG', Icon: FileImage },
  png:  { label: 'PNG', Icon: FileImage },
  webp: { label: 'WEBP', Icon: FileImage },
  gif:  { label: 'GIF', Icon: FileImage },
}

export function getFileExt(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

export function getFileKind(fileName: string): FileKindInfo {
  const ext = getFileExt(fileName)
  const known = KNOWN[ext]
  return {
    label: known?.label ?? (ext.toUpperCase() || 'Arquivo'),
    Icon: known?.Icon ?? File,
    isImage: IMAGE_EXTS.includes(ext),
    isPdf: ext === 'pdf',
  }
}

/**
 * Supabase Storage aceita ?download=<nome> na URL pública para forçar
 * Content-Disposition: attachment — o atributo HTML `download` sozinho é
 * ignorado pelo navegador em URLs cross-origin (o Storage é outro domínio),
 * então sem isso o clique em "Baixar" só abriria o arquivo em nova aba.
 */
export function getDownloadUrl(fileUrl: string, fileName: string): string {
  const separator = fileUrl.includes('?') ? '&' : '?'
  return `${fileUrl}${separator}download=${encodeURIComponent(fileName)}`
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}
