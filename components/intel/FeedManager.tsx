'use client';

import { useState, useEffect, useCallback } from 'react';

interface Feed {
  id: string;
  feed_url: string;
  feed_name: string;
  category: string;
  active: boolean;
  last_fetched_at: string | null;
}

interface CompSource {
  id: string;
  name: string;
  url: string;
  relationship: string;
  description: string | null;
  active: boolean;
  last_fetched_at: string | null;
}

const CATEGORIES = ['federal_policy', 'industry_news', 'state_legislation', 'technology', 'general'];

export default function FeedManager({ orgId }: { orgId: string }) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [competitive, setCompetitive] = useState<CompSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [showAddComp, setShowAddComp] = useState(false);
  const [feedForm, setFeedForm] = useState({ feed_url: '', feed_name: '', category: 'general' });
  const [compForm, setCompForm] = useState({ name: '', url: '', relationship: 'neutral', description: '' });
  const [testResult, setTestResult] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState('');

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/intel/feeds?orgId=${orgId}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setFeeds(data.feeds);
      setCompetitive(data.competitive);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function addFeed(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/intel/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, ...feedForm }),
    });
    if (res.ok) {
      setShowAddFeed(false);
      setFeedForm({ feed_url: '', feed_name: '', category: 'general' });
      fetchData();
    }
  }

  async function addCompSource(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/intel/feeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId, type: 'competitive', ...compForm }),
    });
    if (res.ok) {
      setShowAddComp(false);
      setCompForm({ name: '', url: '', relationship: 'neutral', description: '' });
      fetchData();
    }
  }

  async function deleteFeed(id: string, type: string) {
    await fetch('/api/intel/feeds', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feed_id: id, type, org_id: orgId }),
    });
    fetchData();
  }

  async function testFeed() {
    setTestResult(null);
    const res = await fetch('/api/intel/feeds/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: feedForm.feed_url }),
    });
    const data = await res.json();
    setTestResult('error' in data ? `Error: ${data.error}` : `Found: "${data.title}" (${data.date || 'no date'})`);
  }

  async function fetchAllFeeds() {
    setFetching(true);
    setMessage('');
    const res = await fetch('/api/intel/ingest/rss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: orgId }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessage(`Fetched ${data.items_added} new items`);
      fetchData();
    }
    setFetching(false);
  }

  if (loading) return <div className="text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>Loading...</div>;

  return (
    <div className="space-y-8">
      {message && (
        <div className="p-3 rounded-lg bg-white/[0.06] border border-white/10 text-sm" style={{ color: 'var(--intel-primary)' }}>{message}</div>
      )}

      {/* RSS Feeds */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--intel-text)' }}>RSS Feeds</h2>
          <div className="flex gap-2">
            <button onClick={fetchAllFeeds} disabled={fetching} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05] disabled:opacity-40" style={{ color: 'var(--intel-text)' }}>
              {fetching ? 'Fetching...' : 'Fetch All'}
            </button>
            <button onClick={() => setShowAddFeed(!showAddFeed)} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>
              Add Feed
            </button>
          </div>
        </div>

        {showAddFeed && (
          <form onSubmit={addFeed} className="mb-4 p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="url" required placeholder="Feed URL" value={feedForm.feed_url} onChange={e => setFeedForm({ ...feedForm, feed_url: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" required placeholder="Display name" value={feedForm.feed_name} onChange={e => setFeedForm({ ...feedForm, feed_name: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={feedForm.category} onChange={e => setFeedForm({ ...feedForm, category: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white">
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-gray-900">{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={testFeed} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/[0.05]" style={{ color: 'var(--intel-text)' }}>Test</button>
              <button type="submit" className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>Add</button>
            </div>
            {testResult && <p className="text-xs" style={{ color: 'var(--intel-primary)' }}>{testResult}</p>}
          </form>
        )}

        <div className="rounded-xl border border-white/10 overflow-hidden">
          {feeds.length === 0 ? (
            <div className="p-6 text-center text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>No feeds configured</div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left px-4 py-2 text-xs font-medium uppercase opacity-50" style={{ color: 'var(--intel-text)' }}>Name</th>
                <th className="text-left px-4 py-2 text-xs font-medium uppercase opacity-50 hidden md:table-cell" style={{ color: 'var(--intel-text)' }}>Category</th>
                <th className="text-left px-4 py-2 text-xs font-medium uppercase opacity-50 hidden md:table-cell" style={{ color: 'var(--intel-text)' }}>Last Fetched</th>
                <th className="px-4 py-2" />
              </tr></thead>
              <tbody>
                {feeds.map(f => (
                  <tr key={f.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5"><div className="text-sm" style={{ color: 'var(--intel-text)' }}>{f.feed_name}</div><div className="text-[10px] opacity-30 truncate max-w-[200px]" style={{ color: 'var(--intel-text)' }}>{f.feed_url}</div></td>
                    <td className="px-4 py-2.5 hidden md:table-cell"><span className="text-xs px-2 py-0.5 rounded bg-white/[0.06]" style={{ color: 'var(--intel-text)' }}>{f.category}</span></td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-xs opacity-40" style={{ color: 'var(--intel-text)' }}>{f.last_fetched_at ? new Date(f.last_fetched_at).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-2.5 text-right"><button onClick={() => deleteFeed(f.id, 'rss')} className="text-xs text-red-400/60 hover:text-red-400">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Competitive Sources */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--intel-text)' }}>Competitive & Allied Sources</h2>
          <button onClick={() => setShowAddComp(!showAddComp)} className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>Add Source</button>
        </div>

        {showAddComp && (
          <form onSubmit={addCompSource} className="mb-4 p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input type="text" required placeholder="Name" value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="url" required placeholder="RSS URL" value={compForm.url} onChange={e => setCompForm({ ...compForm, url: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={compForm.relationship} onChange={e => setCompForm({ ...compForm, relationship: e.target.value })} className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-lg text-sm text-white">
                <option value="competitor" className="bg-gray-900">Competitor</option>
                <option value="ally" className="bg-gray-900">Ally</option>
                <option value="neutral" className="bg-gray-900">Neutral</option>
              </select>
            </div>
            <button type="submit" className="px-3 py-1.5 text-xs font-medium text-white rounded-lg" style={{ backgroundColor: 'var(--intel-primary)' }}>Add</button>
          </form>
        )}

        <div className="rounded-xl border border-white/10 overflow-hidden">
          {competitive.length === 0 ? (
            <div className="p-6 text-center text-sm opacity-40" style={{ color: 'var(--intel-text)' }}>No competitive sources configured</div>
          ) : (
            <table className="w-full">
              <thead><tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left px-4 py-2 text-xs font-medium uppercase opacity-50" style={{ color: 'var(--intel-text)' }}>Name</th>
                <th className="text-left px-4 py-2 text-xs font-medium uppercase opacity-50 hidden md:table-cell" style={{ color: 'var(--intel-text)' }}>Relationship</th>
                <th className="px-4 py-2" />
              </tr></thead>
              <tbody>
                {competitive.map(s => (
                  <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-2.5"><div className="text-sm" style={{ color: 'var(--intel-text)' }}>{s.name}</div></td>
                    <td className="px-4 py-2.5 hidden md:table-cell"><span className="text-xs px-2 py-0.5 rounded bg-white/[0.06] capitalize" style={{ color: 'var(--intel-text)' }}>{s.relationship}</span></td>
                    <td className="px-4 py-2.5 text-right"><button onClick={() => deleteFeed(s.id, 'competitive')} className="text-xs text-red-400/60 hover:text-red-400">Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
