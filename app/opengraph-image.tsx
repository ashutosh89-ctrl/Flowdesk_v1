import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'FlowDesk — Freelancer Operating System';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#070708',
          fontFamily: 'sans-serif',
          position: 'relative',
          padding: '60px 80px',
        }}
      >
        {/* Subtle background glow */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '30%',
            width: '500px',
            height: '500px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '50%',
            filter: 'blur(100px)',
          }}
        />

        {/* Top badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 24px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#ffffff',
            }}
          />
          <span
            style={{
              fontSize: '16px',
              fontWeight: 600,
              letterSpacing: '2px',
              color: '#d4d4d8',
              textTransform: 'uppercase',
            }}
          >
            Operating System for Freelancers
          </span>
        </div>

        {/* Brand Name */}
        <div
          style={{
            fontSize: '84px',
            fontWeight: 800,
            letterSpacing: '-2px',
            color: '#ffffff',
            marginBottom: '16px',
            textAlign: 'center',
          }}
        >
          FlowDesk
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: 400,
            color: '#a1a1aa',
            maxWidth: '850px',
            textAlign: 'center',
            lineHeight: 1.4,
            marginBottom: '40px',
          }}
        >
          Manage clients, projects, deliverables, approvals, documents, and invoices in one workspace.
        </div>

        {/* Workflow Pipeline indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '14px',
            color: '#71717a',
            fontWeight: 500,
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '12px 28px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <span>Client</span>
          <span>→</span>
          <span>Project</span>
          <span>→</span>
          <span>Deliverables</span>
          <span>→</span>
          <span>Approval</span>
          <span>→</span>
          <span>Invoice</span>
          <span>→</span>
          <span>Payment</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
