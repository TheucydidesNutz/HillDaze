import Link from 'next/link';
import { ClipboardList, Bot, Radio } from 'lucide-react';

export default function IntelLandingPage() {
  return (
    <div className="min-h-screen bg-[#1a1a2e] text-[#e0e0e0] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
            CI
          </div>
          <span className="text-lg font-semibold text-white">Covaled Intelligence</span>
        </div>
        <Link
          href="/intel/login"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Login
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-5xl font-bold text-white mb-6 tracking-tight">
            Policy Intelligence,<br />Powered by AI
          </h1>
          <p className="text-lg text-[#a0a0b8] mb-8 leading-relaxed">
            Covaled Intelligence gives government affairs teams an AI-powered command center.
            Upload your policy documents, define your strategic priorities, and get real-time
            recommendations on legislation, regulatory actions, and advocacy opportunities.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/intel/login"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* Feature Grid */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="mb-3"><ClipboardList size={24} className="text-blue-400" /></div>
              <h3 className="text-white font-semibold mb-2">Soul Document</h3>
              <p className="text-sm text-[#a0a0b8]">
                Define your organization&apos;s constitution &mdash; priorities, tone, and strategic objectives that guide every AI interaction.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="mb-3"><Bot size={24} className="text-blue-400" /></div>
              <h3 className="text-white font-semibold mb-2">AI Advisory Chat</h3>
              <p className="text-sm text-[#a0a0b8]">
                Ask questions about policy implications, get strategic recommendations, and draft communications informed by your documents.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="mb-3"><Radio size={24} className="text-blue-400" /></div>
              <h3 className="text-white font-semibold mb-2">Real-time Feeds</h3>
              <p className="text-sm text-[#a0a0b8]">
                Monitor legislation, regulations, and news. Get AI-scored relevance ratings matched to your priority areas.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-4 text-center text-sm text-[#606080]">
        Covaled Intelligence &mdash; a product of Covaled
      </footer>
    </div>
  );
}
