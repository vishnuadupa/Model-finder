import { useState } from 'react';
import { X } from 'lucide-react';

export default function AutoDetectModal({ onClose }) {
  const [copiedCmd, setCopiedCmd] = useState(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#15151A]/85 backdrop-blur-xl p-6 shadow-2xl space-y-5">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-300">
            <span>🔌</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              Hardware Auto-Detection
            </h3>
            <p className="text-[11px] text-[#8E919A] mt-0.5">
              Auto-populate the LLM Matcher with your exact local specs.
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed">
          Paste this one-line command into your terminal. It will scan your CPU cores, RAM bandwidth, GPU VRAM, OS, and drive type, then reload this page with the parameters pre-filled.
        </p>

        {/* Terminal Command Boxes */}
        <div className="space-y-4">
          
          {/* Windows Tab */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-bold">
              <span>🪟 Windows (PowerShell)</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('powershell -c "irm https://llm-matcher.vercel.app/detect-specs.ps1 | iex"');
                  setCopiedCmd('win');
                  setTimeout(() => setCopiedCmd(null), 2000);
                }}
                className="text-[10px] text-zinc-300 hover:text-white transition-colors uppercase font-sans font-semibold"
              >
                {copiedCmd === 'win' ? '✓ Copied!' : 'Copy Command'}
              </button>
            </div>
            <div className="relative rounded-lg bg-black/40 border border-white/5 p-3 text-xs font-mono text-zinc-300 select-all overflow-x-auto whitespace-nowrap">
              powershell -c &quot;irm https://llm-matcher.vercel.app/detect-specs.ps1 | iex&quot;
            </div>
          </div>

          {/* macOS / Linux Tab */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-bold">
              <span>🍎 macOS / 🐧 Linux (Bash)</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('curl -s https://llm-matcher.vercel.app/detect-specs.sh | bash');
                  setCopiedCmd('unix');
                  setTimeout(() => setCopiedCmd(null), 2000);
                }}
                className="text-[10px] text-zinc-300 hover:text-white transition-colors uppercase font-sans font-semibold"
              >
                {copiedCmd === 'unix' ? '✓ Copied!' : 'Copy Command'}
              </button>
            </div>
            <div className="relative rounded-lg bg-black/40 border border-white/5 p-3 text-xs font-mono text-zinc-300 select-all overflow-x-auto whitespace-nowrap">
              curl -s https://llm-matcher.vercel.app/detect-specs.sh | bash
            </div>
          </div>

        </div>

        {/* Note & Security Disclaimer */}
        <div className="rounded-xl border border-white/5 bg-white/[0.01] p-3.5 text-[10px] text-zinc-500 leading-relaxed font-sans">
          🔒 <strong className="text-white">Privacy &amp; Security:</strong> The script is completely open-source and runs strictly on your machine. No telemetry or hardware statistics are uploaded or saved to any server—they are simply encoded into the local URL query parameters.
        </div>

        {/* Done button */}
        <button
          onClick={onClose}
          className="btn-ghost w-full py-2 text-xs text-zinc-400 hover:text-white"
        >
          Done / Close
        </button>

      </div>
    </div>
  );
}
