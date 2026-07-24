import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
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
          color: 'white',
          fontSize: 84,
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
