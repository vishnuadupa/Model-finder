import { useState } from 'react';
import { X, ShieldAlert, Scale, ShieldCheck } from 'lucide-react';

export default function LegalModal({ defaultTab = 'disclaimer', onClose }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#15151A]/85 backdrop-blur-xl p-6 shadow-2xl flex flex-col max-h-[85vh] space-y-5">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#84E1BC]">
            {activeTab === 'disclaimer' && <ShieldAlert size={20} />}
            {activeTab === 'terms' && <Scale size={20} />}
            {activeTab === 'privacy' && <ShieldCheck size={20} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              Legal Safeguards &amp; Policies
            </h3>
            <p className="text-[11px] text-[#8E919A] mt-0.5">
              Please review the Disclaimer, Terms of Use, and Privacy Policy for this application.
            </p>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-white/10 text-xs font-mono">
          <button
            onClick={() => setActiveTab('disclaimer')}
            className={`px-4 py-2.5 -mb-[1px] border-b-2 transition-all duration-200 ${
              activeTab === 'disclaimer'
                ? 'border-[#84E1BC] text-white font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Disclaimer
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-4 py-2.5 -mb-[1px] border-b-2 transition-all duration-200 ${
              activeTab === 'terms'
                ? 'border-[#84E1BC] text-white font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Terms of Use
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-4 py-2.5 -mb-[1px] border-b-2 transition-all duration-200 ${
              activeTab === 'privacy'
                ? 'border-[#84E1BC] text-white font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Privacy Policy
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="overflow-y-auto pr-1 text-xs text-zinc-400 space-y-4 leading-relaxed max-h-[50vh] scrollbar-thin">
          
          {activeTab === 'disclaimer' && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  1. Performance Simulation Estimates
                </h4>
                <p>
                  All speeds (tokens per second), memory capacities, VRAM constraints, and hardware calculations presented on this site are **simulated projections**. They are generated via mathematical scoring models using nominal memory bandwidths, standard float formats, and context sizing formulas.
                </p>
                <p className="mt-1.5 text-zinc-500">
                  Actual performance will vary based on current operating system background tasks, hardware drivers, memory channel configurations, GPU thermal throttling, specific quant layouts, and physical thermals. No guarantee of real-world speed is implied.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  2. Hardware Recommendations &amp; Liability
                </h4>
                <p>
                  Any hardware suggestions, comparison indices, or specifications listed on the upgrade planners are provided solely for informational and comparison purposes. 
                </p>
                <p className="mt-1.5 text-zinc-500">
                  We are not responsible for any hardware purchases, merchant compatibility disputes, shipping defects, system assembly errors, system damage, or physical/financial loss resulting from hardware modifications. Users are strictly urged to perform their own due diligence before investing in hardware.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  3. System-Scan Execution Scripts
                </h4>
                <p>
                  The terminal hardware detection commands (`detect-specs.ps1` and `detect-specs.sh`) are entirely optional, open-source utility scripts. They run completely locally on your system to inspect CPU cores, disk speed, RAM latency, and OS type, and encode these parameters into a simple URL redirect. 
                </p>
                <p className="mt-1.5 text-zinc-500">
                  Piping remote terminal scripts carries inherent risks. They are provided **&quot;AS IS&quot;** without express or implied warranties. By executing these commands, you assume all risk and liability for any issues, data corruptions, or script side-effects on your machine.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  4. Third-Party Software &amp; Links
                </h4>
                <p>
                  This site includes references and redirect links to platforms like HuggingFace, GitHub, and Ollama. We do not host, check, or accept any liability for third-party script assets, files, binary packages, models, or their compliance with license formats.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  1. Acceptance of Terms
                </h4>
                <p>
                  By visiting, loading, or interacting with the Local LLM Matcher site, you agree to be bound by these Terms of Use, our Privacy Policy, and all applicable regulations. If you do not agree, please exit the site immediately.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  2. Allowed Personal Use &amp; Non-Commercial License
                </h4>
                <p>
                  This project is a personal utility. You are granted a limited, personal, non-commercial, revocable, and non-transferable license to check hardware layouts and simulate model loads.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  3. Abuse, Scraping, &amp; API Restrictions
                </h4>
                <p>
                  You agree not to bypass rate-limiting shields, scrape bulk configurations, exploit Vercel KV stores, launch Denial of Service (DoS) strikes, or use API backend routes for other web properties. 
                </p>
                <p className="mt-1.5 text-zinc-500">
                  We actively monitor traffic spikes and will automatically block IP blocks or system queries displaying abusive or automated traffic patterns to safeguard Gemini API key quotas.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  4. As-Is Provision &amp; Limitation of Liability
                </h4>
                <p>
                  THE PLATFORM IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY OF ANY KIND. IN NO EVENT SHALL THE CREATORS OF THE LOCAL LLM MATCHER BE LIABLE FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, GENERAL, SPECIAL, OR INCIDENTAL DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE CALCULATOR PLATFORM.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  1. Zero User Profiling &amp; Data Collection
                </h4>
                <p>
                  The Local LLM Matcher is fully committed to user privacy. We do not require accounts, create identity profiles, send newsletter trackers, or place third-party marketing cookies on your system.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  2. Local Client-Side Calculation
                </h4>
                <p>
                  The core of the hardware matching engine runs completely local in your browser via client-side JavaScript. 
                </p>
                <p className="mt-1.5 text-zinc-500">
                  Selected hardware options are only transmitted to our Next.js API routes when fetching dynamic Gemini AI Speed Advice or generating AI-based model summaries. This data is handled strictly in-memory and is never persistent or stored in any database.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  3. Anti-Abuse Rate Limiting
                </h4>
                <p>
                  To secure the site from budget depletion, we process incoming client IP addresses in-memory on our serverless endpoint. This is matched against a temporary Vercel KV rate limits buffer. This data is strictly short-lived, anonymized, and never compiled into user history, sold, or shared.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase font-mono tracking-wider mb-1">
                  4. Anonymized Site Telemetry
                </h4>
                <p>
                  We utilize privacy-friendly, cookieless performance telemetry (Vercel Analytics) solely to track page load latencies, compile layout error rates, and monitor high-level traffic numbers without tracking individual identity profiles.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Done / Close Button */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="w-full btn-ghost py-2.5 text-xs text-zinc-400 hover:text-white"
          >
            I Accept / Close
          </button>
        </div>

      </div>
    </div>
  );
}
