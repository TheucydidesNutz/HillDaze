// ── Intel Entity Types ──────────────────────────────────────────────

export type IntelMemberRole = 'super_admin' | 'admin' | 'user' | 'viewer';

export interface BrandingConfig {
  logo_url: string | null;
  background_color: string;
  text_color: string;
  primary_color: string;
  tagline: string | null;
}

export interface OrgSettings {
  notification_prefs: Record<string, unknown>;
  default_model: string;
  max_daily_api_calls: number;
  auto_monthly_report: boolean;
}

export interface IntelOrg {
  id: string;
  name: string;
  slug: string;
  branding: BrandingConfig;
  settings: OrgSettings;
  created_at: string;
}

export interface IntelOrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: IntelMemberRole;
  display_name: string;
  title: string | null;
  company: string | null;
  phone: string | null;
  invited_by: string | null;
  created_at: string;
}

// ── Phase 2+ Placeholder Types ─────────────────────────────────────

export interface IntelSoulDocument {
  id: string;
  org_id: string;
  content: string;
  version: number;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentSummaryMetadata {
  title?: string;
  doc_type?: string;
  date?: string | null;
  author?: string | null;
  key_topics?: string[];
  executive_summary?: string;
  detailed_summary?: string;
  key_quotes?: { quote: string; context: string }[];
  relevance_to_org?: string;
  actionable_items?: string[];
  page_count?: number;
  file_type?: string;
  parse_error?: boolean;
  possible_duplicates?: { id: string; filename: string; similarity: number }[];
}

export interface IntelDocument {
  id: string;
  org_id: string;
  folder: 'deep_dive' | 'reference';
  filename: string;
  storage_path: string;
  summary: string | null;
  summary_metadata: DocumentSummaryMetadata | null;
  full_text: string | null;
  uploaded_by: string;
  uploaded_at: string;
  uploader_name?: string;
  file_hash?: string;
  folder_id?: string;
}

export interface IntelConversation {
  id: string;
  org_id: string;
  user_id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface IntelConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Record<string, unknown>[];
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  context_refs?: string[];
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
  message_preview: string;
}

export interface IntelFeed {
  id: string;
  org_id: string;
  name: string;
  source_type: 'rss' | 'api' | 'scrape';
  source_url: string;
  active: boolean;
  last_fetched_at: string | null;
  created_at: string;
}

export interface IntelRecommendation {
  id: string;
  org_id: string;
  feed_id: string | null;
  title: string;
  summary: string;
  url: string | null;
  relevance_score: number;
  status: 'new' | 'reviewed' | 'actioned' | 'dismissed';
  created_at: string;
}

export interface IntelProposal {
  id: string;
  org_id: string;
  title: string;
  content: string;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  created_by: string;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}
