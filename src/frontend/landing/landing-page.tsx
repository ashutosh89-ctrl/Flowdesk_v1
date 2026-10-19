import React from 'react';
import { LandingNav } from './landing-nav';
import { Hero } from './hero';
import { FeatureShowcase } from './feature-showcase';
import { WorkflowSection } from './workflow';
import { BenefitsSection } from './benefits';
import { PricingPreview } from './pricing-preview';
import { FAQSection } from './faq';
import { LandingFooter } from './landing-footer';

export interface LandingPageProps {
  onLaunchApp: () => void;
  onOpenAuth: (view: 'login' | 'signup') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp, onOpenAuth }) => {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F7FA] selection:bg-[#0047AB] selection:text-white font-sans relative overflow-x-hidden">
      <LandingNav onOpenAuth={onOpenAuth} onLaunchApp={onLaunchApp} />
      <main className="pt-8 relative z-10">
        <Hero onLaunchApp={onLaunchApp} onOpenAuth={onOpenAuth} />
        <FeatureShowcase />
        <WorkflowSection />
        <BenefitsSection />
        <PricingPreview onOpenAuth={onOpenAuth} onLaunchApp={onLaunchApp} />
        <FAQSection />
      </main>
      <LandingFooter onLaunchApp={onLaunchApp} onOpenAuth={onOpenAuth} />
    </div>
  );
};
