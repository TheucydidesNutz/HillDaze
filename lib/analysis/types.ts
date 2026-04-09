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

// ── Workspace Types ────────────────────────────────────────────────

export type WorkspaceDocSourceType = 'upload' | 'web' | 'research_agent' | 'generated';
export type WorkspaceConversationSource = 'web' | 'butterrobot' | 'api';
export type WorkspaceSoulDocProposalSource = 'conversation' | 'research_agent' | 'manual';
export type WorkspaceResearchVerification = 'unreviewed' | 'relevant' | 'ignored';
export type WorkspaceReportFormat = 'docx' | 'md' | 'pdf';

export interface Workspace {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  description: string | null;
  soul_doc: Record<string, unknown>;
  soul_doc_md: string | null;
  soul_doc_version: number;
  settings: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceDocument {
  id: string;
  workspace_id: string;
  title: string;
  source_type: WorkspaceDocSourceType;
  source_url: string | null;
  content: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  folder: string;
  storage_path: string | null;
  original_filename: string | null;
  file_size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceChunk {
  id: string;
  document_id: string;
  workspace_id: string;
  chunk_text: string;
  chunk_index: number;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WorkspaceConversation {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  source: WorkspaceConversationSource;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    model_used?: string | null;
    token_count?: number | null;
    created_at?: string;
  }>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSoulDocProposal {
  id: string;
  workspace_id: string;
  proposed_changes: Record<string, unknown>;
  description: string | null;
  source: WorkspaceSoulDocProposalSource;
  status: ProposalStatus;
  proposed_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface WorkspaceSoulDocHistory {
  id: string;
  workspace_id: string;
  version: number;
  soul_doc: Record<string, unknown>;
  soul_doc_md: string | null;
  changed_by: 'user' | 'system' | 'butterrobot';
  description: string | null;
  created_at: string;
}

export interface WorkspaceReportTemplate {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  example_reports: Array<{ title: string; content: string; date?: string }>;
  output_format: WorkspaceReportFormat;
  generation_prompt: string | null;
  schedule: string | null;
  last_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceGeneratedReport {
  id: string;
  template_id: string;
  workspace_id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  generated_by: string | null;
  created_at: string;
}

export interface WorkspaceResearchConfig {
  id: string;
  workspace_id: string;
  source_type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  check_interval: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceResearchItem {
  id: string;
  workspace_id: string;
  research_config_id: string | null;
  title: string;
  content: string | null;
  source_url: string | null;
  source_type: string | null;
  relevance_score: number | null;
  verification_status: WorkspaceResearchVerification;
  metadata: Record<string, unknown>;
  created_at: string;
}
