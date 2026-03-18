export interface RssFeedConfig {
  id: string;
  org_id: string;
  feed_url: string;
  feed_name: string;
  category: string;
  active: boolean;
  last_fetched_at: string | null;
  created_at: string;
}

export interface ApiSourceConfig {
  id: string;
  org_id: string;
  source_type: 'federal_register' | 'congress_gov' | 'regulations_gov';
  api_key: string | null;
  search_terms: string[];
  filters: Record<string, unknown>;
  active: boolean;
  last_fetched_at: string | null;
  created_at: string;
}

export interface CompetitiveSource {
  id: string;
  org_id: string;
  name: string;
  url: string;
  relationship: 'competitor' | 'ally' | 'neutral';
  description: string | null;
  active: boolean;
  last_fetched_at: string | null;
  created_at: string;
}

export interface NewsItem {
  id: string;
  org_id: string;
  source_type: string;
  source_url: string;
  title: string;
  raw_content: string | null;
  summary: string | null;
  relevance_score: number | null;
  created_at: string;
}

export interface ExtractedCalendarEvent {
  title: string;
  event_type: string;
  date: string;
  end_date: string | null;
  description: string;
  action_needed: string | null;
  relevance_score?: number;
}

export interface ExtractedStakeholder {
  name: string;
  title: string | null;
  organization: string | null;
  role_type: string;
  context: string;
}

export interface ScoredItem {
  id: string;
  relevance_score: number;
  summary: string;
  calendar_events: ExtractedCalendarEvent[];
  stakeholders: ExtractedStakeholder[];
}
