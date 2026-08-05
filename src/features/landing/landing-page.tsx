import React from 'react';
import { LandingNav } from './landing-nav';
import { Hero } from './hero';
import { FeatureShowcase } from './feature-showcase';
import { WorkflowSection } from './workflow';
import { BenefitsSection } from './benefits';
import { TestimonialsSection } from './testimonials';
import { PricingPreview } from './pricing-preview';
import { FAQSection } from './faq';
import { LandingFooter } from './landing-footer';

export interface LandingPageProps {
  onLaunchApp: () => void;
  onOpenAuth: (view: 'login' | 'signup') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp, onOpenAuth }) => {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-white selection:text-zinc-950 font-sans">
      <LandingNav onOpenAuth={onOpenAuth} onLaunchApp={onLaunchApp} />
      <main className="pt-8">
        <Hero onLaunchApp={onLaunchApp} onOpenAuth={onOpenAuth} />
        <FeatureShowcase />
        <WorkflowSection />
        <BenefitsSection />
        <TestimonialsSection />
        <PricingPreview onOpenAuth={onOpenAuth} onLaunchApp={onLaunchApp} />
        <FAQSection />
      </main>
      <LandingFooter />
    </div>
  );
};
