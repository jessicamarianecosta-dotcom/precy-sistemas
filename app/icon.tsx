import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #8B6C4F 0%, #B8956A 50%, #C4A47B 100%)',
          borderRadius: 7,
          color: 'white',
          fontSize: 15,
          fontWeight: 700,
          fontFamily: 'sans-serif',
        }}
      >
        P+
      </div>
    ),
    { ...size }
  )
}
