import { pdfjs } from 'react-pdf'

// O worker é copiado de node_modules/pdfjs-dist/build/pdf.worker.min.mjs para
// public/ (precisa ficar em sincronia com a versão do pdfjs-dist resolvida
// pelo react-pdf — reexecutar a cópia se react-pdf for atualizado).
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
