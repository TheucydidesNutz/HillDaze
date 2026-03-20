'use client';

import { useState, useRef } from 'react';
import { X, Globe, Link2, Search, Loader2, Check, AlertCircle } from 'lucide-react';

interface DeepResearchModalProps {
  profileId: string;
  profileName: string;
  onClose: () => void;
  onComplete: () => void;
}

type TabMode = 'urls' | 'domain' | 'category';

interface ProgressEntry {
  message: string;
  timestamp: Date;
}

const CATEGORIES = [
  { key: 'speech', label: 'Speeches' },
  { key: 'legal_filing', label: 'Legal Filings' },
  { key: 'podcast', label: 'Podcasts' },
  { key: 'news', label: 'News / Op-eds' },
  { key: 'position', label: 'Policy Positions' },
];

export default function DeepResearchModal({ profileId, profileName, onClose, onComplete }: DeepResearchModalProps) {
  const [activeTab, setActiveTab] = useState<TabMode>('urls');
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // URLs tab
  const [urlText, setUrlText] = useState('');

  // Domain tab
  const [domain, setDomain] = useState('');
  const [depth, setDepth] = useState(20);

  // Category tab
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Progress
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [found, setFound] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [created, setCreated] = useState(0);

  const logRef = useRef<HTMLDivElement>(null);

  function addProgress(message: string) {
    setProgress(prev => [...prev, { message, timestamp: new Date() }]);
    // Auto-scroll to bottom
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    }, 50);
  }

  async function startResearch() {
    setRunning(true);
    setComplete(false);
    setError(null);
    setProgress([]);
    setFound(0);
    setProcessed(0);
    setCreated(0);

    let payload: Record<string, unknown> = {};

    if (activeTab === 'urls') {
      const urls = urlText
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0 && (u.startsWith('http://') || u.startsWith('https://')));
      if (urls.length === 0) {
        setError('Please enter at least one valid URL (starting with http:// or https://)');
        setRunning(false);
        return;
      }
      payload = { mode: 'urls', urls };
    } else if (activeTab === 'domain') {
      if (!domain.trim()) {
        setError('Please enter a domain');
        setRunning(false);
        return;
      }
      payload = { mode: 'domain', domain: domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''), depth };
    } else if (activeTab === 'category') {
      if (!selectedCategory) {
        setError('Please select a category');
        setRunning(false);
        return;
      }
      payload = { mode: 'category', category: selectedCategory };
    }

    addProgress(`Starting deep research (${activeTab} mode)...`);

    try {
      const res = await fetch(`/api/analysis/profiles/${profileId}/deep-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'progress') {
              addProgress(event.message);
              if (event.found !== undefined) setFound(event.found);
              if (event.processed !== undefined) setProcessed(event.processed);
              if (event.created !== undefined) setCreated(event.created);
            } else if (event.type === 'complete') {
              setFound(event.total_found ?? 0);
              setProcessed(event.total_processed ?? 0);
              setCreated(event.total_created ?? 0);
              addProgress(`Complete! Created ${event.total_created} new data items.`);
              setComplete(true);
            } else if (event.type === 'error') {
              setError(event.error);
              addProgress(`Error: ${event.error}`);
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      addProgress(`Fatal error: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setRunning(false);
    }
  }

  function handleDone() {
    onComplete();
    onClose();
  }

  const tabs: { mode: TabMode; label: string; icon: typeof Link2 }[] = [
    { mode: 'urls', label: 'Scrape URLs', icon: Link2 },
    { mode: 'domain', label: 'Crawl Domain', icon: Globe },
    { mode: 'category', label: 'Find More By Category', icon: Search },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl rounded-xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--analysis-bg, #0a0a0f)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--analysis-text)' }}>
              Deep Research
            </h2>
            <p className="text-xs opacity-50 mt-0.5" style={{ color: 'var(--analysis-text)' }}>
              {profileName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--analysis-text)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.mode;
            return (
              <button
                key={tab.mode}
                onClick={() => { if (!running) setActiveTab(tab.mode); }}
                disabled={running}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  active
                    ? 'border-b-2'
                    : 'opacity-50 hover:opacity-80'
                } ${running ? 'cursor-not-allowed' : ''}`}
                style={{
                  color: 'var(--analysis-text)',
                  borderBottomColor: active ? 'var(--analysis-primary)' : 'transparent',
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="px-6 py-5 space-y-4" style={{ minHeight: 200 }}>
          {/* URLs tab */}
          {activeTab === 'urls' && !running && !complete && (
            <div className="space-y-3">
              <label className="block text-sm font-medium opacity-70" style={{ color: 'var(--analysis-text)' }}>
                Enter URLs to scrape (one per line)
              </label>
              <textarea
                value={urlText}
                onChange={e => setUrlText(e.target.value)}
                placeholder={`https://example.com/speech-transcript\nhttps://example.com/press-release\nhttps://example.com/op-ed`}
                rows={6}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-30 focus:outline-none focus:ring-1 focus:border-transparent resize-none font-mono"
                style={{
                  color: 'var(--analysis-text)',
                  // @ts-expect-error CSS custom property
                  '--tw-ring-color': 'var(--analysis-primary)',
                }}
              />
              <p className="text-xs opacity-40" style={{ color: 'var(--analysis-text)' }}>
                Each URL will be fetched and analyzed with AI to extract key information.
              </p>
            </div>
          )}

          {/* Domain tab */}
          {activeTab === 'domain' && !running && !complete && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium opacity-70" style={{ color: 'var(--analysis-text)' }}>
                  Domain to crawl
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
                  placeholder="e.g. whitehouse.senate.gov"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.06] border border-white/10 text-sm placeholder:opacity-30 focus:outline-none focus:ring-1 focus:border-transparent"
                  style={{
                    color: 'var(--analysis-text)',
                    // @ts-expect-error CSS custom property
                    '--tw-ring-color': 'var(--analysis-primary)',
                  }}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium opacity-70" style={{ color: 'var(--analysis-text)' }}>
                  Max pages to discover
                </label>
                <div className="flex gap-2">
                  {[10, 20, 50].map(n => (
                    <button
                      key={n}
                      onClick={() => setDepth(n)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        depth === n ? 'border-transparent' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                      }`}
                      style={
                        depth === n
                          ? { backgroundColor: 'var(--analysis-primary)', color: '#fff' }
                          : { color: 'var(--analysis-text)' }
                      }
                    >
                      {n} pages
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs opacity-40" style={{ color: 'var(--analysis-text)' }}>
                AI will search the domain for relevant pages about {profileName} and ingest the content.
              </p>
            </div>
          )}

          {/* Category tab */}
          {activeTab === 'category' && !running && !complete && (
            <div className="space-y-4">
              <label className="block text-sm font-medium opacity-70" style={{ color: 'var(--analysis-text)' }}>
                Select a category to search for
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => {
                  const active = selectedCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setSelectedCategory(active ? null : cat.key)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        active ? 'border-transparent' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
                      }`}
                      style={
                        active
                          ? { backgroundColor: 'var(--analysis-primary)', color: '#fff' }
                          : { color: 'var(--analysis-text)' }
                      }
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs opacity-40" style={{ color: 'var(--analysis-text)' }}>
                AI will run multiple targeted searches to find {selectedCategory ? CATEGORIES.find(c => c.key === selectedCategory)?.label?.toLowerCase() || selectedCategory : 'content'} about {profileName}.
              </p>
            </div>
          )}

          {/* Progress area (shown during/after run) */}
          {(running || complete || progress.length > 0) && (
            <div className="space-y-3">
              {/* Count summary */}
              <div className="flex gap-4 text-xs font-medium" style={{ color: 'var(--analysis-text)' }}>
                <span className="opacity-60">
                  Found <span className="opacity-100 font-bold">{found}</span>
                </span>
                <span className="opacity-60">
                  Processed <span className="opacity-100 font-bold">{processed}</span>
                </span>
                <span style={{ color: 'var(--analysis-primary)' }}>
                  Ingested <span className="font-bold">{created}</span>
                </span>
              </div>

              {/* Log */}
              <div
                ref={logRef}
                className="h-48 overflow-y-auto rounded-lg bg-black/30 border border-white/5 p-3 space-y-1 font-mono text-xs"
                style={{ color: 'var(--analysis-text)' }}
              >
                {progress.map((entry, i) => (
                  <div key={i} className="flex gap-2 opacity-70">
                    <span className="opacity-40 shrink-0">
                      {entry.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span>{entry.message}</span>
                  </div>
                ))}
                {running && (
                  <div className="flex items-center gap-2 opacity-60">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          {!running && !complete && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                style={{ color: 'var(--analysis-text)' }}
              >
                Cancel
              </button>
              <button
                onClick={startResearch}
                className="px-5 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                style={{ backgroundColor: 'var(--analysis-primary)', color: '#fff' }}
              >
                {activeTab === 'urls' && <><Link2 className="w-4 h-4" /> Start Scraping</>}
                {activeTab === 'domain' && <><Globe className="w-4 h-4" /> Start Crawling</>}
                {activeTab === 'category' && <><Search className="w-4 h-4" /> Search</>}
              </button>
            </>
          )}
          {running && (
            <button
              disabled
              className="px-5 py-2 rounded-lg text-sm font-medium opacity-60 cursor-not-allowed inline-flex items-center gap-2"
              style={{ backgroundColor: 'var(--analysis-primary)', color: '#fff' }}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </button>
          )}
          {complete && !running && (
            <button
              onClick={handleDone}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
              style={{ backgroundColor: 'var(--analysis-primary)', color: '#fff' }}
            >
              <Check className="w-4 h-4" />
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
