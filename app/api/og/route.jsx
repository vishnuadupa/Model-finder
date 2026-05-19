import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export function GET(req) {
  const { searchParams } = new URL(req.url);
  const gpu = searchParams.get('gpu') || 'Your GPU';
  const top = searchParams.get('top')?.split(',').filter(Boolean) || [];

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#080B12',
          width: 1200,
          height: 630,
          padding: 80,
          fontFamily: 'monospace',
          border: '1px solid #1E2D45',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ background: '#38BDF8', width: 8, height: 8, borderRadius: 2 }} />
          <span style={{ color: '#64748B', fontSize: 18 }}>Local LLM Matcher</span>
        </div>
        <h1 style={{ color: '#38BDF8', fontSize: 52, margin: 0, marginBottom: 32, lineHeight: 1.2 }}>
          {gpu} can run these LLMs
        </h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {top.slice(0, 4).map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ color: '#22C55E', fontSize: 24 }}>✓</span>
              <span style={{ color: '#E2E8F0', fontSize: 28, fontFamily: 'monospace' }}>{m}</span>
            </div>
          ))}
        </div>
        <div style={{ color: '#334155', marginTop: 'auto', fontSize: 18 }}>llmmatcher.app</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
