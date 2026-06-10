import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface PDFParams {
  budget:  Record<string, unknown>
  items:   Record<string, unknown>[]
  company: Record<string, unknown> | null
}

function hexToRgb(hex: string): [number, number, number] {
  const sanitized = hex.replace('#', '')
  const r = parseInt(sanitized.substring(0, 2), 16) || 0
  const g = parseInt(sanitized.substring(2, 4), 16) || 0
  const b = parseInt(sanitized.substring(4, 6), 16) || 0
  return [r, g, b]
}

function fmt(v: number) {
  return new Intl.NumberFormat(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  ).format(v)
}

export async function generateBudgetPDF({
  budget,
  items,
  company,
}: PDFParams) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Cores dinâmicas da empresa (fallback para cores padrão)
  const PRIMARY:   [number,number,number] = hexToRgb(
    String(company?.primary_color ?? '#8B6C4F')
  )
  const SECONDARY: [number,number,number] = hexToRgb(
    String(company?.secondary_color ?? '#B8956A')
  )
  const TEXT: [number,number,number] = [44, 32, 24]

  const MUTED = [
    184,
    168,
    152,
  ] as [number, number, number]

  const BG = [
    250,
    247,
    244,
  ] as [number, number, number]

  const WHITE = [
    255,
    255,
    255,
  ] as [number, number, number]

  const pageW = 210
  const pageH = 297
  const marginX = 14

  doc.setFillColor(...PRIMARY)

  doc.rect(
    0,
    0,
    pageW,
    42,
    'F'
  )

  doc.setTextColor(...WHITE)

  // Logo da empresa (se disponível)
  const logoUrl = company?.logo_url as string | undefined
  if (logoUrl) {
    try {
      // jsPDF suporta PNG/JPEG via URL para data URIs
      // Para URL externa, usamos texto como fallback
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text(String(company?.name ?? 'Precy+'), marginX, 20)
    } catch {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.text('Precy+', marginX, 18)
    }
  } else {
    doc.setFont(
      'helvetica',
      'bold'
    )
    doc.setFontSize(22)
    doc.text(
      'Precy+',
      marginX,
      18
    )
  }

  doc.setFontSize(9)

  doc.setFont(
    'helvetica',
    'normal'
  )

  doc.text(
    String(company?.name ?? ''),
    marginX,
    25
  )

  if (company?.email) {
    doc.text(
      String(company.email),
      marginX,
      30
    )
  }

  if (company?.phone) {
    doc.text(
      String(company.phone),
      marginX,
      35
    )
  }

  doc.setFont(
    'helvetica',
    'bold'
  )

  doc.setFontSize(16)

  doc.text(
    String(
      budget.budget_number ??
        'ORC-XXXX'
    ),
    pageW - marginX,
    18,
    {
      align: 'right',
    }
  )

  doc.setFont(
    'helvetica',
    'normal'
  )

  doc.setFontSize(9)

  doc.text(
    'ORÇAMENTO',
    pageW - marginX,
    25,
    {
      align: 'right',
    }
  )

  const createdAt =
    budget.created_at
      ? new Date(
          budget.created_at as string
        ).toLocaleDateString(
          'pt-BR'
        )
      : new Date().toLocaleDateString(
          'pt-BR'
        )

  doc.text(
    `Emitido em: ${createdAt}`,
    pageW - marginX,
    30,
    {
      align: 'right',
    }
  )

  if (budget.valid_until) {
    const validUntil =
      new Date(
        budget.valid_until as string
      ).toLocaleDateString(
        'pt-BR'
      )

    doc.text(
      `Válido até: ${validUntil}`,
      pageW - marginX,
      35,
      {
        align: 'right',
      }
    )
  }

  let y = 52

  doc.setFillColor(...BG)

  doc.roundedRect(
    marginX,
    y - 4,
    pageW - marginX * 2,
    22,
    3,
    3,
    'F'
  )

  doc.setTextColor(...MUTED)

  doc.setFontSize(7.5)

  doc.setFont(
    'helvetica',
    'bold'
  )

  doc.text(
    'CLIENTE',
    marginX + 4,
    y + 1
  )

  doc.setTextColor(...TEXT)

  doc.setFontSize(11)

  doc.setFont(
    'helvetica',
    'bold'
  )

  const customer =
    budget.customers as Record<
      string,
      unknown
    >

  doc.text(
    String(customer?.name ?? ''),
    marginX + 4,
    y + 7
  )

  doc.setFont(
    'helvetica',
    'normal'
  )

  doc.setFontSize(8.5)

  const contactParts: string[] =
    []

  if (customer?.email) {
    contactParts.push(
      String(customer.email)
    )
  }

  if (customer?.phone) {
    contactParts.push(
      String(customer.phone)
    )
  }

  if (customer?.city) {
    contactParts.push(
      `${customer.city}${
        customer.state
          ? `, ${customer.state}`
          : ''
      }`
    )
  }

  if (contactParts.length) {
    doc.text(
      contactParts.join('  ·  '),
      marginX + 4,
      y + 13
    )
  }

  y += 28

  const tableBody = items.map(
    (item, i) => [
      String(i + 1),

      String(
        (
          item.products as Record<
            string,
            unknown
          >
        )?.name ?? ''
      ),

      `${Number(item.quantity)} ${
        (
          item.products as Record<
            string,
            unknown
          >
        )?.unit ?? 'un'
      }`,

      fmt(
        Number(item.unit_price)
      ),

      fmt(
        Number(item.subtotal)
      ),
    ]
  )

  autoTable(doc, {
    startY: y,

    head: [
      [
        '#',
        'Produto / Serviço',
        'Qtd',
        'Unit.',
        'Subtotal',
      ],
    ],

    body: tableBody,

    margin: {
      left: marginX,
      right: marginX,
    },

    headStyles: {
      fillColor: PRIMARY,

      textColor: WHITE,

      fontSize: 9,

      fontStyle: 'bold',

      cellPadding: 4,
    },

    bodyStyles: {
      fontSize: 9,

      textColor: TEXT,

      cellPadding: 3.5,
    },

    alternateRowStyles: {
      fillColor: BG,
    },

    columnStyles: {
      0: {
        halign: 'center',
        cellWidth: 10,
      },

      2: {
        halign: 'center',
        cellWidth: 22,
      },

      3: {
        halign: 'right',
        cellWidth: 28,
      },

      4: {
        halign: 'right',
        cellWidth: 32,
      },
    },

    didDrawPage: () => {},
  })

  const finalY = (
    doc as jsPDF & {
      lastAutoTable?: {
        finalY: number
      }
    }
  ).lastAutoTable?.finalY ??
    y + 40

  const boxX =
    pageW - marginX - 70

  let totalY = finalY + 6

  doc.setFillColor(...BG)

  doc.roundedRect(
    boxX - 2,
    totalY - 4,
    72,
    34,
    3,
    3,
    'F'
  )

  const subtotal = Number(
    budget.subtotal
  )

  const discount = Number(
    budget.discount
  )

  const total = Number(
    budget.total
  )

  doc.setFontSize(9)

  doc.setTextColor(...MUTED)

  doc.text(
    'Subtotal',
    boxX,
    totalY + 2
  )

  doc.setTextColor(...TEXT)

  doc.text(
    fmt(subtotal),
    boxX + 68,
    totalY + 2,
    {
      align: 'right',
    }
  )

  totalY += 8

  if (discount > 0) {
    doc.setTextColor(...MUTED)

    doc.text(
      'Desconto',
      boxX,
      totalY + 2
    )

    doc.setTextColor(
      196,
      80,
      58
    )

    doc.text(
      `- ${fmt(discount)}`,
      boxX + 68,
      totalY + 2,
      {
        align: 'right',
      }
    )

    totalY += 8
  }

  doc.setFillColor(...PRIMARY)

  doc.roundedRect(
    boxX - 2,
    totalY - 1,
    72,
    11,
    2,
    2,
    'F'
  )

  doc.setTextColor(...WHITE)

  doc.setFont(
    'helvetica',
    'bold'
  )

  doc.setFontSize(10)

  doc.text(
    'Total',
    boxX + 2,
    totalY + 6
  )

  doc.text(
    fmt(total),
    boxX + 66,
    totalY + 6,
    {
      align: 'right',
    }
  )

  if (budget.notes) {
    totalY += 20

    doc.setFillColor(...BG)

    doc.roundedRect(
      marginX,
      totalY - 4,
      pageW - marginX * 2,
      24,
      3,
      3,
      'F'
    )

    doc.setFont(
      'helvetica',
      'bold'
    )

    doc.setFontSize(8)

    doc.setTextColor(...MUTED)

    doc.text(
      'OBSERVAÇÕES',
      marginX + 4,
      totalY + 2
    )

    doc.setFont(
      'helvetica',
      'normal'
    )

    doc.setFontSize(8.5)

    doc.setTextColor(...TEXT)

    const noteLines =
      doc.splitTextToSize(
        String(budget.notes),
        pageW -
          marginX * 2 -
          8
      )

    doc.text(
      noteLines,
      marginX + 4,
      totalY + 8
    )
  }

  doc.setFillColor(...PRIMARY)

  doc.rect(
    0,
    pageH - 12,
    pageW,
    12,
    'F'
  )

  doc.setFontSize(7.5)

  doc.setTextColor(...WHITE)

  doc.setFont(
    'helvetica',
    'normal'
  )

  doc.text(
    'Gerado pelo Precy+ Sistemas  ·  precy.app',
    pageW / 2,
    pageH - 5,
    {
      align: 'center',
    }
  )

  const filename = `orcamento-${String(
    budget.budget_number ??
      'precy'
  ).toLowerCase()}.pdf`

  doc.save(filename)
}
