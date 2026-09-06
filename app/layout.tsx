import type { Metadata } from 'next';
import './globals.css';
import { RootProviders } from '@/frontend/shared/providers/root-providers';
import { getAppBaseUrl } from '@/shared/utils/url';

const baseUrl = getAppBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'FlowDesk | Freelancer Operating System',
    template: '%s | FlowDesk',
  },
  description:
    'FlowDesk is a freelancer operating system for managing clients, projects, deliverables, approvals, documents, invoices, and payment tracking in one organized workspace.',
  applicationName: 'FlowDesk',
  authors: [{ name: 'FlowDesk' }],
  keywords: [
    'freelancer operating system',
    'freelance workspace',
    'freelance project management',
    'client portal for freelancers',
    'freelance deliverables',
    'freelance invoice tracking',
    'client approvals',
  ],
  creator: 'FlowDesk',
  publisher: 'FlowDesk',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'FlowDesk | Freelancer Operating System',
    description:
      'FlowDesk is a freelancer operating system for managing clients, projects, deliverables, approvals, documents, invoices, and payment tracking in one organized workspace.',
    url: '/',
    siteName: 'FlowDesk',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FlowDesk | Freelancer Operating System',
    description:
      'FlowDesk is a freelancer operating system for managing clients, projects, deliverables, approvals, documents, invoices, and payment tracking in one organized workspace.',
  },
  icons: {
    icon: [
      { url: '/branding/flowdesk-favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/branding/flowdesk-favicon.svg',
    apple: '/branding/flowdesk-symbol.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': `${baseUrl}/#software`,
      name: 'FlowDesk',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web Browser',
      description:
        'FlowDesk is a freelancer operating system for managing clients, projects, deliverables, approvals, documents, invoices, and payment tracking.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
    {
      '@type': 'Organization',
      '@id': `${baseUrl}/#organization`,
      name: 'FlowDesk',
      url: baseUrl,
      logo: `${baseUrl}/branding/flowdesk-symbol.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${baseUrl}/#website`,
      url: baseUrl,
      name: 'FlowDesk',
      description: 'The Freelancer Operating System',
      publisher: {
        '@id': `${baseUrl}/#organization`,
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${baseUrl}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'How is FlowDesk different from a project management tool?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'FlowDesk is designed around the complete freelancer-client workflow, connecting client work, projects, deliverables, approvals, documents, invoices, and payment tracking in one workspace.',
          },
        },
        {
          '@type': 'Question',
          name: 'Do clients need an account?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Clients use the dedicated client portal to access the work shared with them. The exact access flow depends on the portal setup for their workspace.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I create professional invoices?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. FlowDesk lets you create itemized invoices with configurable taxes, supported currencies, payment terms, discounts where available, and professional PDF and print output.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I accept payments through FlowDesk?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'FlowDesk currently focuses on invoice creation and payment tracking. You can record payments received and keep outstanding balances organized.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can clients request revisions?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Clients can review deliverables and submit structured revision requests so feedback stays connected to the work being reviewed.',
          },
        },
        {
          '@type': 'Question',
          name: 'How is my client work protected?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'FlowDesk keeps client work organized within the appropriate workspace and controls access to information based on the user’s role and workspace.',
          },
        },
      ],
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className="bg-[#09090b] text-white min-h-screen font-sans selection:bg-white selection:text-zinc-950 antialiased"
        suppressHydrationWarning
      >
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}
