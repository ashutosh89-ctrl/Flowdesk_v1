import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FlowDesk — Freelancer Operating System',
    short_name: 'FlowDesk',
    description:
      'FlowDesk is a freelancer operating system for managing clients, projects, deliverables, approvals, documents, invoices, and payment tracking in one organized workspace.',
    start_url: '/',
    display: 'standalone',
    background_color: '#070708',
    theme_color: '#070708',
    icons: [
      {
        src: '/branding/flowdesk-favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/branding/flowdesk-symbol.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/branding/flowdesk-logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
  };
}
