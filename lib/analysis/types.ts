// ── Analysis Entity Types ──────────────────────────────────────────

export type AnalysisMemberRole = 'super_admin' | 'admin' | 'user' | 'viewer';

export type PositionType = 'congress_member' | 'jurist' | 'executive' | 'regulator' | 'other';
export type ResearchStatus = 'pending' | 'in_progress' | 'complete' | 'error';
export type DataItemCategory = 'speech' | 'vote' | 'bill' | 'legal_filing' | 'donation' | 'social_media' | 'podcast' | 'news' | 'position' | 'uploaded_doc';
export type TrustLevel = 'trusted' | 'default' | 'ignored';
export type VerificationStatus = 'verified' | 'unverified' | 'rejected';
export type StorageTier = 'deep_dive' | 'reference';
export type FolderType = 'input' | 'output';
export type MonitoringFrequency = 'every_6_hours' | 'daily' | 'weekly';
export type ProposalStatus = 'pending' | 'approved' | 'rejected';
export type ProfileType = 'primary' | 'staffer';

// Reuse BrandingConfig from intel
export { type BrandingConfig, type IntelOrg, type IntelOrgMember, type IntelMemberRole } from '@/lib/intel/types';

export interface AnalysisProfile {
  id: string;
  org_id: string;
  full_name: string;
  title: string | null;
  position_type: PositionType;
  party: string | null;
  state: string | null;
  district: string | null;
  court: string | null;
  organization: string | null;
  aliases: string[];
  baseline_attributes: Record<string, unknown>;
  profile_type: ProfileType;
  parent_profile_id: string | null;
  research_status: ResearchStatus;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisDataItem {
  id: string;
  profile_id: string;
  org_id: string;
  category: DataItemCategory;
  subcategory: string | null;
  title: string | null;
  full_text: string | null;
  summary: string | null;
  key_quotes: string[];
  key_topics: string[];
  source_url: string | null;
  source_name: string | null;
  source_trust_level: TrustLevel;
  item_date: string | null;
  venue: string | null;
  context: string | null;
  tone_analysis: Record<string, unknown>;
  folder_path: string | null;
  storage_path: string | null;
  storage_tier: StorageTier | null;
  original_filename: string | null;
  file_size_bytes: number | null;
  verification_status: VerificationStatus;
  anomaly_flags: Record<string, unknown>;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisSoulDocument {
  id: string;
  profile_id: string;
  org_id: string;
  content: Record<string, unknown>;
  version: number;
  last_regenerated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisSoulDocumentProposal {
  id: string;
  soul_document_id: string;
  org_id: string;
  proposed_changes: Record<string, unknown>;
  reasoning: string | null;
  source_data_item_ids: string[];
  status: ProposalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AnalysisSourceRegistry {
  id: string;
  org_id: string;
  source_name: string;
  source_url: string | null;
  category: string | null;
  trust_level: TrustLevel;
  is_default: boolean;
  created_at: string;
}

export interface AnalysisFocusedFolder {
  id: string;
  profile_id: string;
  org_id: string;
  folder_type: FolderType;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisFocusedFolderItem {
  id: string;
  folder_id: string;
  data_item_id: string | null;
  storage_path: string | null;
  created_at: string;
}

export interface AnalysisConversation {
  id: string;
  profile_id: string;
  org_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AnalysisMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Array<{ data_item_id: string; quote: string; source_url: string }>;
  focused_input_folder_id: string | null;
  focused_output_folder_id: string | null;
  model_used: string | null;
  token_count: number | null;
  created_at: string;
}

export interface AnalysisMonitoringConfig {
  id: string;
  profile_id: string;
  org_id: string;
  frequency: MonitoringFrequency;
  search_queries: Array<{ query: string; enabled: boolean }>;
  last_run_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AnalysisFolderAnalysis {
  id: string;
  profile_id: string;
  org_id: string;
  folder_path: string;
  analysis: Record<string, unknown>;
  item_count: number;
  last_regenerated_at: string | null;
}

export interface AnalysisWorkerLog {
  id: string;
  worker_name: string;
  profile_id: string | null;
  status: 'started' | 'running' | 'completed' | 'error';
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Profile with computed counts for dashboard display
export interface AnalysisProfileWithCounts extends AnalysisProfile {
  data_item_count: number;
  unverified_count: number;
}
