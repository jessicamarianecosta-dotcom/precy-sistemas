import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          background: 'linear-gradient(135deg, #1C1410 0%, #2C2018 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 160,
            height: 160,
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #8B6C4F 0%, #B8956A 50%, #C4A47B 100%)',
            borderRadius: 36,
            color: 'white',
            fontSize: 72,
            fontWeight: 700,
            fontFamily: 'sans-serif',
          }}
        >
          P+
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 56,
            fontWeight: 700,
            color: '#FAF7F4',
            fontFamily: 'sans-serif',
          }}
        >
          Precy+
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            color: '#C4A47B',
            fontFamily: 'sans-serif',
          }}
        >
          Sistema de Gestão e Precificação para Pequenos Negócios
        </div>
      </div>
    ),
    { ...size }
  )
}
