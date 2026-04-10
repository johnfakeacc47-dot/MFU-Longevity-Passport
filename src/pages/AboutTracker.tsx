import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { BottomNav } from '../components/BottomNav';
import { FaBed, FaCircle, FaDumbbell, FaFlask, FaGraduationCap, FaHourglassHalf, FaLeaf } from "react-icons/fa";
import { BackButton } from '../components/BackButton';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker';

interface AboutTrackerProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const AboutTracker: React.FC<AboutTrackerProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();

  const pillars = [
    { title: 'Nutrition', icon: <FaLeaf />, desc: 'Personalized AI-tracking to optimize nutrient density and caloric balance.' },
    { title: 'Fasting', icon: <FaHourglassHalf />, desc: 'Harnessing autophagy and metabolic flexibility through structured windows.' },
    { title: 'Activity', icon: <FaDumbbell />, desc: 'Enhancing mitochondrial health and VO2 max via consistent movement.' },
    { title: 'Sleep', icon: <FaBed />, desc: 'Critical regenerative phases for cognitive health and DNA repair.' },
  ];

  return (
    <div className="profile-container pb-24 premium-gradient" style={{ minHeight: '100vh' }}>
      <header className="profile-top-header" style={{ background: 'transparent', border: 'none' }}>
        <BackButton onClick={() => onNavigate('profile')} ariaLabel="Go back to profile" />
        <h1 className="header-title text-gradient">The Science</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="profile-content page-content p-4 space-y-8">
        {/* University Info */}
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-24 h-24 bg-white/50 backdrop-blur-md rounded-3xl flex items-center justify-center mb-4 shadow-xl border border-white">
            <span className="text-5xl"><FaGraduationCap /></span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 leading-tight">MFU Longevity Passport</h2>
          <p className="text-gray-500 text-sm mt-2">Mae Fah Luang University Research Project</p>
        </div>

        {/* The 4 Pillars */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest pl-2">The Four Pillars</h3>
          <div className="grid grid-cols-2 gap-4">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="glass-card p-4 rounded-2xl flex flex-col items-center text-center" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
                <span className="text-4xl mb-3">{pillar.icon}</span>
                <div className="font-bold text-base text-gray-900">{pillar.title}</div>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed break-words" style={{ overflowWrap: 'break-word' }}>{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scientific Foundation */}
        <div className="glass-card p-6 rounded-3xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-4">
            <span className="section-icon"><FaFlask /></span>
            <span className="section-title text-gray-900 font-bold">Research Methodology</span>
          </div>
          <div className="space-y-4 text-sm text-gray-600 leading-relaxed break-words" style={{ overflowWrap: 'break-word' }}>
            <p>
              Our Longevity Score is derived from the **"Blue Zones"** lifestyle research and modern geroscience. We analyze real-time data to provide a holistic view of your health trajectory.
            </p>
            <p>
              Developed by the **School of Information Technology** and **School of Medicine** at MFU, this platform integrates advanced AI and clinical insights to democratize longevity.
            </p>
          </div>
        </div>

        {/* Legal/Links */}
        <div className="pt-6 border-t border-gray-200 flex flex-wrap justify-center gap-4 text-xs font-bold text-blue-700 uppercase tracking-tighter">
          <button className="hover:underline">Terms of Service</button>
          <span><FaCircle size={8} aria-hidden="true" /></span>
          <button className="hover:underline">Privacy Policy (PDPA)</button>
          <span><FaCircle size={8} aria-hidden="true" /></span>
          <button className="hover:underline">API Documentation</button>
        </div>

        <div className="text-center text-xs text-gray-400 pb-10">
          © 2026 Mae Fah Luang University. All rights reserved.
        </div>
      </div>

      <BottomNav
        active="profile"
        onNavigate={onNavigate}
        onOpenFoodRecognition={onOpenFoodRecognition}
        t={t}
        className="bottom-nav glass-card"
      />
    </div>
  );
};
