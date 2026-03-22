# COVALED ANALYSIS — Implementation Prompt

## For use with Claude Code / Cursor to build `covaled.com/analysis`

---

## 0. CONTEXT FOR THE DEVELOPER (Claude Code)

You are building **Covaled Analysis**, a new branch of the Covaled platform (covaled.com). This is a **person-profiling and communication tool** that helps staffers, lobbyists, consultants, and advocates deeply understand a public figure (politician, jurist, regulator, executive) so they can communicate with them more effectively.

This tool is NOT for creating deepfakes, impersonation, or deception. It is a **research and communication aid** — the same kind of opposition research, constituent analysis, and speechwriting preparation that political staffers, advocacy groups, and legal teams already do manually. This tool automates and systematizes that research.

### Existing Covaled Stack (match this exactly):
- **Framework**: Next.js 15, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL + Storage + Auth)
- **Deployment**: Vercel (frontend/API) + Mac Mini (background workers)
- **Auth**: Supabase Auth with RLS policies
- **Multi-tenant**: Single deployment, org-scoped via RLS (like Covaled Events)
- **GitHub**: HillDaze org

### Where this lives:
- URL: `covaled.com/analysis` — path-based routing within the **same Vercel project** as the main Covaled app
- Shares the same Supabase project with RLS isolation (same pattern as Covaled Events)
- The existing `covaled.com/intel` branch (Covaled Intelligence for trade groups) is a sibling product — similar architecture, different use case

### Who uses this:
- Political consultants and staffers researching a principal or target
- Advocacy groups preparing to engage with legislators or regulators
- Legal teams profiling jurists for amicus brief strategy
- The primary operator (you, the consultant) + a few collaborators per profile

---

## 1. CORE CONCEPT

A user creates a **Person Profile** (e.g., "Senator Jane Doe"). The system then:

1. **Automatically researches** that person across multiple high-fidelity public sources
2. **Ingests user-uploaded documents** (PDFs, Word docs) organized by folder/subfolder
3. **Continuously monitors** for new information about the person
4. **Builds a living "Soul Document"** that captures the person's communication style, priorities, positions, and patterns
5. **Provides a chat interface** where users can request outputs (speeches, tweets, letters, briefs) that are grounded in the researched data
6. **Supports focused work** through dedicated input/output folders for specific projects

### The Anti-Hallucination Principle

This is the single most important design constraint: **Every claim the system makes must be traceable to a specific source document, search result, or uploaded file.** The system should NEVER synthesize information it cannot cite. When generating content (speeches, letters, etc.), it should draw on found patterns and direct quotes/positions from source material. If it doesn't have enough data to make a claim, it should say so.

---

## 2. INPUT GOALS — Data Acquisition

### 2A. Automated Web Research

When a new Person Profile is created, the system kicks off an automated research pipeline. The user provides:
- Full name
- Title/position (e.g., "U.S. Senator, Virginia")
- Optional: party affiliation, state, district, court, organization
- Optional: known aliases, maiden names, prior titles

The system searches for and ingests (with source URLs logged):

#### a) Public Speeches
- Search for transcripts of public speeches, commencement addresses, keynotes
- Sources: C-SPAN transcript search, official government websites, university archives, YouTube transcript extraction where available
- Store: full text + date + venue + source URL

#### b) Congressional Record / C-SPAN
- If a member of Congress: search the Congressional Record via congress.gov API
- Search C-SPAN's video/transcript archive for floor speeches, committee hearings, press conferences
- Store: full text + date + context (floor speech vs. committee vs. press conference) + source URL

#### c) Legal Filings & Amicus Briefs
- If a jurist or attorney: search for amicus briefs, legal opinions, court filings
- Sources: CourtListener (free API), Google Scholar (legal), Supreme Court website, PACER (note: PACER has fees — flag to user before incurring)
- Store: full text or summary + case name + date + source URL

#### d) Causes & Advocacy Positions
- Search for public statements on policy positions
- Sources: official website, campaign website archive (Wayback Machine), VoteSmart.org, OnTheIssues.org
- Store: position + source + date + direct quote where available

#### e) Donation History (OpenSecrets)
- Query OpenSecrets.org for donation records (both given and received)
- Sources: OpenSecrets API (free with key), FEC.gov
- Store: donor/recipient + amount + date + source URL
- Flag: distinguish between personal donations and PAC/campaign committee activity

#### f) Bills Co-Sponsored (Congress Members)
- Query congress.gov API for bills sponsored and co-sponsored
- Store: bill number + title + status + date + source URL
- Categorize by topic area (the API provides subject tags)

#### g) Voting History (Congress Members)
- Query congress.gov API or VoteView for roll-call votes
- Store: vote + bill + date + source URL
- Generate: summary of voting patterns by topic area (e.g., "votes with party 92% on defense, 78% on environment")
- Also store full vote-by-vote record for deep-dive queries

#### h) Social Media Historical Record
- Search for archived social media posts
- Sources: Internet Archive / Wayback Machine snapshots of Twitter/X profiles, public Facebook posts, official YouTube channel
- Note: Direct Twitter/X API access is expensive/restricted — use archival sources like Wayback Machine, or integrate with tools like Xpoz if the user provides API credentials
- Store: post text + date + platform + engagement metrics if available + source URL

#### i) Podcast & Media Appearances
- Search for podcast appearances and media interviews
- Sources: Google search (`"[person name]" podcast interview transcript`), Listen Notes API (podcast search), YouTube transcript extraction
- Store: show name + episode + date + transcript (if available) or summary + source URL

### 2A-Settings: High-Fidelity Source Configuration

In the Settings panel, provide a **Source Priority Manager** where the user can:

1. **View all sources** the system has pulled from, organized by category
2. **Mark sources as "Trusted" / "Default" / "Ignore"**
   - Trusted: Always include, weight highly in analysis
   - Default: Include unless flagged
   - Ignore: Exclude from analysis (but keep in archive in case user changes mind)
3. **Add custom high-fidelity sources** (e.g., a specific government database URL, a specific news outlet's archive)
4. **Pre-configured trusted sources** (editable):
   - congress.gov, c-span.org, supremecourt.gov, courtlistener.com, opensecrets.org, votesmart.org, federalregister.gov, regulations.gov
   - Official .gov and .mil domains
   - Major wire services (AP, Reuters)
   - Major newspapers of record (configurable per user preference)
5. **Source log**: Every piece of information ingested shows which source it came from, with a timestamp and a button to mark as "Ignore" retroactively

### 2B. User-Uploaded Document Ingestion

Users can upload folders and subfolders of PDFs and Word documents. The system:

1. **Preserves folder structure** as metadata tags (e.g., `Speeches/2024/DogParkAddress.pdf`)
2. **Analyzes per-document**: extracts text, generates structured summary (title, date, author, doc type, key topics, executive summary, key quotes, tone analysis)
3. **Analyzes per-folder**: generates a folder-level synthesis ("This folder contains 12 speeches from 2024, primarily focused on infrastructure and education, with a consistent formal-but-folksy tone")
4. **Analyzes per-subfolder**: same as above but scoped to subfolder
5. **Cross-correlates**: identifies themes, contradictions, evolution of positions across folders
6. **Two-tier storage** (matching Covaled Intelligence pattern):
   - **Deep-dive folder**: Full text stored, re-readable on demand for detailed analysis
   - **Reference folder**: Summary-only for day-to-day use, full text available on demand but not default context

### 2C. Persistent Search / Monitoring

After initial research, the system runs background jobs to monitor for new information:

- **Frequency**: Configurable (daily, every 6 hours, weekly)
- **What it monitors**: New speeches, votes, bills, media appearances, social media activity, news mentions, legal filings
- **How it works**: Background cron job (Mac Mini) runs search queries, compares against existing data, ingests only new items
- **Notification**: New items appear in a "Recent Updates" feed on the profile dashboard, with a badge count
- **Integration with chat**: The chat interface can also trigger ad-hoc searches ("search for any new speeches by Person A in the last week")

### 2D. Ingestion Anomaly Detection

Every piece of data being ingested passes through an **identity verification check**:

1. **Baseline profile**: After initial research, the system builds a profile (name, title, location, age range, party, profession, known associations)
2. **Anomaly scoring**: Each new item is scored against the baseline:
   - Name match but wrong state/location → flag
   - Name match but wrong profession → flag
   - Name match but wrong age/era → flag
   - Name match but contradicts known positions dramatically → soft flag ("verify — this may be accurate but represents a significant shift")
3. **Soft gate**: Flagged items are **soft-flagged** — they are ingested but marked as `unverified` and excluded from analysis/soul document until the user reviews them
4. **Settings-based review panel**: In **Settings → Anomaly Review**, the user sees all flagged items in a list with:
   - The item content (title, summary, source URL)
   - Why it was flagged (location mismatch, profession mismatch, etc.)
   - Two action buttons: **"Relevant"** (confirms this IS about our person) / **"Ignore"** (marks as wrong person)
   - When marked "Relevant": `verification_status` updates to `verified`, item is included in analysis and soul document context going forward
   - When marked "Ignore": `verification_status` updates to `rejected`, item is permanently excluded from all analysis, soul document generation, and chat context — but remains in the database (never deleted) in case the user changes their mind later
   - An "Undo" option for recently reviewed items (last 30 days)
   - Filter/sort options: by date flagged, by anomaly type, by source
5. **Example**: Profile is "Senator John Smith (R-TX)." An article about "John Smith arrested for DUI in Fairbanks, AK" would be flagged as "likely different person — location mismatch, profession mismatch"
6. **Dashboard badge**: The main dashboard shows a badge count of unreviewed anomalies so the user knows to check Settings

### 2E. Staffer / Contact Profiling (Lite Mode)

Users can add **secondary profiles** for staffers, chiefs of staff, legislative directors, or other contacts:

1. **Lighter research**: Same pipeline but with reduced scope (no voting history, no bill sponsorship — focus on public statements, LinkedIn-type info, media appearances, areas of expertise)
2. **Purpose**: Identify communication touchstones — what does the staffer care about? What's their background? Where did they go to school? What did they work on before?
3. **Linked to parent profile**: A staffer profile is linked to the Person A profile, so the system can identify commonalities ("Both Person A and Staffer B have backgrounds in agricultural policy")
4. **Output**: A shorter "Staffer Brief" document that summarizes how to connect with this person and what they care about

---

## 3. DATA LAKE ARCHITECTURE

All ingested data lives in a **discretized, tagged, source-attributed data lake** in Supabase:

### Core Tables

```sql
-- Person profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  full_name TEXT NOT NULL,
  title TEXT,
  position_type TEXT, -- 'congress_member', 'jurist', 'executive', 'regulator', 'other'
  party TEXT,
  state TEXT,
  district TEXT,
  court TEXT,
  organization TEXT,
  aliases TEXT[], -- alternate names, maiden names
  baseline_attributes JSONB, -- for anomaly detection
  profile_type TEXT DEFAULT 'primary', -- 'primary' or 'staffer'
  parent_profile_id UUID REFERENCES profiles(id), -- for staffer profiles
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- All ingested data items
CREATE TABLE data_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  org_id UUID REFERENCES organizations(id),
  
  -- Classification
  category TEXT NOT NULL, -- 'speech', 'vote', 'bill', 'legal_filing', 'donation', 'social_media', 'podcast', 'news', 'position', 'uploaded_doc'
  subcategory TEXT, -- 'floor_speech', 'committee_hearing', 'amicus_brief', etc.
  
  -- Content
  title TEXT,
  full_text TEXT, -- full content (for deep-dive items)
  summary TEXT, -- AI-generated summary
  key_quotes TEXT[], -- notable direct quotes
  key_topics TEXT[], -- extracted topic tags
  
  -- Source attribution (CRITICAL for anti-hallucination)
  source_url TEXT,
  source_name TEXT, -- 'congress.gov', 'C-SPAN', 'OpenSecrets', 'user_upload', etc.
  source_trust_level TEXT DEFAULT 'default', -- 'trusted', 'default', 'ignored'
  
  -- Metadata
  item_date DATE, -- when the speech/vote/filing occurred
  venue TEXT, -- where (Senate floor, Harvard commencement, etc.)
  context TEXT, -- additional context
  tone_analysis JSONB, -- AI-generated tone markers
  
  -- Upload metadata (for user-uploaded docs)
  folder_path TEXT, -- preserves original folder structure
  storage_path TEXT, -- Supabase Storage path
  storage_tier TEXT, -- 'deep_dive' or 'reference'
  
  -- Anomaly detection
  verification_status TEXT DEFAULT 'verified', -- 'verified', 'unverified', 'rejected'
  anomaly_flags JSONB, -- reasons for flagging
  
  -- Timestamps
  ingested_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Soul document (living profile synthesis)
CREATE TABLE soul_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  org_id UUID REFERENCES organizations(id),
  content JSONB NOT NULL, -- structured soul document (see section 4)
  version INTEGER DEFAULT 1,
  last_regenerated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Soul document change proposals (human-in-the-loop)
CREATE TABLE soul_document_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soul_document_id UUID REFERENCES soul_documents(id),
  proposed_changes JSONB, -- what the agent wants to change
  reasoning TEXT, -- why
  source_data_item_ids UUID[], -- which data items support this change
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Source registry (settings)
CREATE TABLE source_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id),
  source_name TEXT NOT NULL,
  source_url TEXT,
  category TEXT, -- 'government', 'news', 'legal', 'social', 'custom'
  trust_level TEXT DEFAULT 'default', -- 'trusted', 'default', 'ignored'
  is_default BOOLEAN DEFAULT false, -- shipped with the platform
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Focused work folders
CREATE TABLE focused_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  org_id UUID REFERENCES organizations(id),
  folder_type TEXT NOT NULL, -- 'input' or 'output'
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Items assigned to focused folders
CREATE TABLE focused_folder_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES focused_folders(id),
  data_item_id UUID REFERENCES data_items(id), -- can reference existing data items
  storage_path TEXT, -- or a newly uploaded file
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chat conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  org_id UUID REFERENCES organizations(id),
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  role TEXT NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL,
  citations JSONB, -- array of {data_item_id, quote, source_url} for traceability
  focused_input_folder_id UUID REFERENCES focused_folders(id), -- if this message used focused context
  focused_output_folder_id UUID REFERENCES focused_folders(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Monitoring job configuration
CREATE TABLE monitoring_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  org_id UUID REFERENCES organizations(id),
  frequency TEXT DEFAULT 'daily', -- 'every_6_hours', 'daily', 'weekly'
  search_queries JSONB, -- auto-generated + user-customizable search terms
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Folder-level analysis cache
CREATE TABLE folder_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id),
  org_id UUID REFERENCES organizations(id),
  folder_path TEXT NOT NULL,
  analysis JSONB NOT NULL, -- themes, tone, patterns, evolution
  item_count INTEGER,
  last_regenerated_at TIMESTAMPTZ DEFAULT now()
);
```

### RLS Policies
All tables get `org_id`-scoped RLS policies matching the Covaled Events pattern. No cross-tenant data access.

---

## 4. OUTPUT GOALS

### 4A. The Person A Soul Document

A structured, living document that dynamically evolves as new data is ingested. Structure:

```json
{
  "meta": {
    "person_name": "Senator Jane Doe",
    "title": "U.S. Senator, Virginia",
    "party": "D",
    "last_updated": "2026-03-19T...",
    "data_item_count": 847,
    "confidence_level": "high" // based on data volume and source quality
  },
  
  "communication_style": {
    "overall_tone": "Formal but accessible, uses folksy analogies to explain complex policy",
    "vocabulary_level": "Graduate-level vocabulary but deliberately simplifies for public audiences",
    "rhetorical_devices": ["Anaphora (repeating 'We must...')", "Personal anecdotes from childhood in rural Virginia"],
    "sentence_patterns": "Favors compound sentences. Opens paragraphs with short declarative statements.",
    "humor_style": "Self-deprecating, dad-joke adjacent, avoids sarcasm",
    "signature_phrases": ["'At the end of the day, it comes down to...'", "'My grandmother used to say...'"],
    "differences_by_medium": {
      "floor_speech": "More formal, cites data heavily, structured argumentation",
      "tweet": "Punchy, uses em-dashes, frequently tags colleagues",
      "press_conference": "Relaxed, conversational, often goes off-script with stories",
      "written_letter": "Extremely formal, letterhead-conscious, always includes a handwritten-style closing"
    },
    "source_citations": ["data_item_id_1", "data_item_id_2"]
  },
  
  "priorities": {
    "top_issues": [
      {
        "topic": "Rural broadband infrastructure",
        "position": "Strong advocate for federal broadband expansion",
        "intensity": "HIGH — mentions in 73% of speeches",
        "evolution": "Shifted from 'market solutions' in 2018 to 'federal investment required' by 2022",
        "key_quotes": ["'Broadband is the electricity of the 21st century'"],
        "source_citations": ["data_item_id_3", "data_item_id_4"]
      }
    ],
    "secondary_issues": [...],
    "known_opposition": [
      {
        "topic": "Cryptocurrency deregulation",
        "position": "Strongly opposed, has called for SEC enforcement",
        "source_citations": [...]
      }
    ]
  },
  
  "voting_pattern_summary": {
    "party_alignment": "87% overall",
    "breakaway_areas": ["Votes against party on agricultural subsidies 40% of the time"],
    "bipartisan_collaborations": ["Frequently co-sponsors with Sen. X on veterans affairs"],
    "source_citations": [...]
  },
  
  "personal_touchstones": {
    "background": "Grew up on a farm in Shenandoah Valley, first in family to attend college",
    "education": "UVA undergrad, Georgetown Law",
    "family_references": "Frequently mentions grandmother, rarely mentions parents",
    "hobbies_interests": "Known fly fisher, references Blue Ridge Mountains frequently",
    "source_citations": [...]
  },
  
  "donation_network_summary": {
    "top_donors_by_sector": [...],
    "top_recipients_of_personal_donations": [...],
    "pac_affiliations": [...],
    "source_citations": [...]
  },
  
  "media_presence": {
    "preferred_outlets": ["Appears frequently on NPR, avoids cable news"],
    "podcast_appearances": [...],
    "social_media_habits": {
      "platform": "Twitter/X",
      "frequency": "2-3 posts/day",
      "tone": "More casual than official statements",
      "common_topics": ["Local Virginia events", "Committee work updates"]
    },
    "source_citations": [...]
  },
  
  "how_to_communicate_with_them": {
    "dos": [
      "Lead with data — they respond to statistics and research citations",
      "Reference Virginia-specific impacts",
      "Use agricultural metaphors — they land well"
    ],
    "donts": [
      "Don't lead with partisan framing — they pride themselves on bipartisanship",
      "Avoid tech jargon without explanation",
      "Don't reference their opponent by name — they find it distasteful"
    ],
    "best_approach_by_context": {
      "requesting_a_meeting": "Go through the LD (Legislative Director), reference a specific bill",
      "requesting_co_sponsorship": "Show constituent impact data for Virginia, ideally with a personal story",
      "writing_to_persuade": "Open with shared values, present the ask as an extension of their existing positions"
    },
    "source_citations": [...]
  }
}
```

**Dynamic evolution**: Every time new data is ingested, the system proposes updates to the soul document. These go into the `soul_document_proposals` queue for human approval. The user can also manually edit any section.

### 4B. Chat Interface

A Claude.ai-style chat interface (clean message bubbles, markdown rendering, scroll-to-bottom, input bar at bottom) where users can:

1. **Ask questions about the person**: "What is Person A's position on renewable energy?" → Answer with citations to specific data items
2. **Request content generation**:
   - "Write a tweet about infrastructure in the tone of Person A"
   - "Write a 5-minute speech about education for Person A to deliver at a Virginia town hall"
   - "Write a letter to Person A explaining why they should support bill S.1234"
   - "Draft an amicus brief in the style of Person A's previous filings"
3. **Trigger ad-hoc research**: "Search for any new podcast appearances by Person A in the last month"
4. **Compare profiles**: "What do Person A and Staffer B have in common?"

**Every response must include inline citations** linking back to specific data items. The UI should show these as clickable footnotes that expand to show the source URL, date, and relevant quote.

**Model routing**:
| Task | Model |
|------|-------|
| Chat Q&A, simple queries | Sonnet |
| Content generation (speeches, letters, briefs) | Opus |
| Research/search synthesis | Sonnet |
| Soul document proposals | Sonnet |
| Focused folder deep analysis | Opus |

### 4C. Focused Input / Output Folders

A dedicated workspace for specific projects that need higher-attention analysis:

**Focused Input Folder**: User uploads or selects existing data items that should receive special attention for this task. Example: "Person A's 5 speeches specifically about dog parks."

**Focused Output Folder**: User uploads reference/example documents that define the desired output format. Example: "5 sample amicus briefs that represent the style I want."

**How it works in chat**: When the user activates focused folders for a conversation, the system prompt is augmented:
- "With the full Person A research as background context, focus specifically on the materials in the Focused Input Folder. Use the documents in the Focused Output Folder as style/format references for your output."
- The chat message stores which focused folders were active, for reproducibility

**Example workflow**: 
1. User creates Focused Input Folder: "Dog Park Speeches" → adds 5 relevant speeches
2. User creates Focused Output Folder: "Amicus Brief Examples" → uploads 5 sample briefs
3. User opens chat with both folders active
4. User types: "Using Person A's dog park speeches as the substantive basis, draft an amicus brief in the style of the examples in my output folder"
5. System reads all 5 speeches in full (deep-dive mode), analyzes the 5 brief examples for structure/tone/format, and produces a draft

---

## 5. UI STRUCTURE

Each person profile is identified by its UUID in the URL. The soul document lives at `/voice`.

```
covaled.com/analysis/
├── [org-slug]/
│   ├── dashboard           — Overview: all profiles, recent updates, pending reviews
│   ├── profiles/
│   │   ├── new             — Create new person profile
│   │   └── [profile-uuid]/ — e.g. /analysis/my-org/profiles/a1b2c3d4-.../ 
│   │       ├── voice       — Soul document viewer/editor ("Person A's Voice")
│   │       ├── data        — Browse all ingested data by category, with search/filter
│   │       ├── documents   — Upload folders (deep-dive / reference)
│   │       ├── chat        — Chat interface (Claude.ai style)
│   │       ├── focused/    — Focused input/output folder manager
│   │       ├── monitoring  — Persistent search config + recent updates feed
│   │       └── staffers    — Linked staffer profiles
│   └── settings/
│       ├── sources         — Source priority manager
│       ├── anomalies       — Anomaly review panel (ignore/relevant buttons, updates in/out filter)
│       ├── branding        — Color scheme editor (background + text color)
│       └── team            — User/collaborator management
```

**Note on routing**: Profile pages use the profile's UUID as the route param (`[profile-uuid]`), not a slug. This avoids name collision issues and keeps URLs stable even if the person's display name is edited. The dashboard and profile list pages display the person's name — the UUID is only in the URL bar.

### Chat Interface Spec
- **Style**: Match Claude.ai — clean, modern, message bubbles, markdown rendering
- **Features**:
  - Conversation list sidebar (collapsible)
  - New conversation button
  - Focused folder selector (dropdown at top of chat: "Focused Input: [none / folder name]" + "Focused Output: [none / folder name]")
  - Citation footnotes (clickable, expand to show source)
  - "Search for updates" button in the input bar (triggers ad-hoc monitoring)
  - Conversation history persisted in Supabase
  - Streaming responses (SSE from API route)

### Color Scheme Editor
- Simple: background color picker + text color picker
- Applied via CSS variables globally
- Preview before save
- Per-org setting (stored in organizations table)

---

## 6. AGENT SYSTEM PROMPT ARCHITECTURE

Each API call to Claude assembles a system prompt from layers:

```
Layer 1: Base Instructions
  "You are a research analyst for [org name]. Your role is to help users 
  understand [Person A] and communicate with/for them effectively.
  
  CRITICAL RULES:
  - Every factual claim must cite a specific data item by ID
  - Never invent quotes, positions, or facts not in your context
  - If you don't have enough data, say so explicitly
  - When generating content 'in the style of' someone, base it on documented 
    patterns, not assumptions
  - Distinguish between 'Person A has said X' (direct quote) and 
    'Person A's pattern suggests X' (inference from data)"

Layer 2: Soul Document
  [Full JSON soul document injected here]

Layer 3: Relevant Data Items (context-window managed)
  [Summaries of most relevant data items for this query, selected by 
  semantic search or category filter]

Layer 4: Focused Folder Content (if active)
  "FOCUSED INPUT: The user has highlighted these specific documents for 
  special attention: [full text of focused input items]"
  "FOCUSED OUTPUT REFERENCE: The user wants output styled after these 
  examples: [full text or summaries of focused output items]"

Layer 5: Conversation History
  [Current chat thread]
```

### Context Window Management
- Soul document: always included (should be <5K tokens)
- Data items: semantic search to find most relevant items for the query, inject top 20-30 summaries (~10K tokens)
- Focused folders: when active, replace generic data items with focused content (prioritized)
- Conversation history: rolling window, last 10-15 messages
- Total target: stay under 150K tokens to leave room for generation

---

## 7. BACKGROUND WORKERS (Mac Mini)

### Initial Research Pipeline
When a new profile is created:
1. **Search orchestrator**: Runs all category searches in parallel
2. **Per-result processing**: For each found item → extract text → generate summary → run anomaly check → store in data_items
3. **Soul document generation**: After initial research completes, generate the first soul document draft
4. **Notify user**: Mark profile as "research complete" on dashboard

### Monitoring Cron Jobs
| Job | Frequency | Action |
|-----|-----------|--------|
| `monitor-news` | Configurable (default: daily) | Search for new mentions, speeches, articles |
| `monitor-congress` | Daily | Check for new votes, bills, floor speeches |
| `monitor-legal` | Weekly | Check for new filings, opinions |
| `monitor-social` | Every 6 hours | Check for new social media activity |
| `propose-soul-updates` | Weekly | Review new data, propose soul document amendments |
| `folder-reanalysis` | On new upload | Re-run folder-level analysis when new docs are added |

### Worker Architecture
- Node.js scripts running on Mac Mini
- Connected to same Supabase instance via service role key
- Cloudflare Tunnel for secure access if needed
- PM2 for process management
- Logging to Supabase `worker_logs` table

---

## 8. DATA ISOLATION & CONFIDENTIALITY

- **RLS on every table**: All queries scoped by `org_id`
- **No cross-tenant queries**: Agent context never includes data from other orgs
- **Claude API is stateless**: No data persists between API calls
- **Storage buckets**: Org-scoped paths in Supabase Storage
- **Service role key**: Only used by Mac Mini workers, never exposed to frontend
- **Staffer profiles**: Scoped to parent profile's org, never shared across orgs

---

## 9. PHASED DEVELOPMENT PLAN

### Phase 1: Foundation (Week 1-2)
- Next.js 15 project setup (TypeScript, Tailwind)
- Supabase schema: profiles, data_items, soul_documents, organizations, conversations, messages
- Auth flow (Supabase Auth)
- Multi-tenant routing: `/analysis/[org-slug]/profiles/[profile-uuid]/...`
- Basic profile CRUD (create, view, edit a person profile)
- Color scheme editor (settings)
- Deploy to Vercel

### Phase 2: Document Upload + Analysis (Week 2-3)
- File upload UI (drag-and-drop, folder structure preservation)
- Two-tier storage (deep-dive vs. reference)
- PDF text extraction (pdf-parse)
- Word doc text extraction (mammoth or similar)
- Auto-summarization on upload (Claude Sonnet)
- Folder-level analysis generation
- Document browser with search/filter

### Phase 3: Automated Research Pipeline (Week 3-5)
- Search orchestrator (triggered on profile creation)
- Congress.gov API integration (bills, votes, speeches)
- OpenSecrets API integration (donations)
- CourtListener API integration (legal filings)
- Web search integration (Claude web search tool) for speeches, podcasts, positions
- Source registry + trust level settings
- Anomaly detection scoring
- Anomaly review panel in Settings (ignore/relevant buttons, updates in/out filter)

### Phase 4: Voice Document + Chat (Week 5-7)
- Voice document generation from ingested data (the "soul document" at `/voice` route)
- Voice document viewer/editor
- Voice document proposal queue (human-in-the-loop)
- Chat interface (Claude.ai style)
- Chat with citations (inline footnotes)
- Model routing (Sonnet for Q&A, Opus for content generation)
- Streaming responses (SSE)
- Conversation persistence

### Phase 5: Focused Folders + Advanced Features (Week 7-9)
- Focused input/output folder management
- Focused context injection in chat
- Staffer lite profiles
- Staffer-parent commonality analysis
- Ad-hoc search from chat ("search for new podcast appearances")

### Phase 6: Monitoring + Polish (Week 9-11)
- Background monitoring workers (Mac Mini)
- Monitoring configuration UI
- Recent updates feed
- Soul document auto-proposal from new data
- Dashboard overview (all profiles, activity, pending reviews)
- Mobile responsiveness
- Error handling, edge cases, loading states

---

## 10. API ROUTE STRUCTURE

```
/api/analysis/
├── profiles/
│   ├── POST   /                    — Create profile
│   ├── GET    /[id]                — Get profile (id = UUID)
│   ├── PATCH  /[id]                — Update profile
│   └── POST   /[id]/research       — Trigger initial research
├── data-items/
│   ├── GET    /                    — List/search data items (filtered by profile, category, etc.)
│   ├── POST   /upload              — Upload documents
│   └── GET    /[id]                — Get full data item
├── voice/
│   ├── GET    /[profile-id]        — Get current voice document (soul document)
│   ├── PATCH  /[profile-id]        — Manual edit
│   └── POST   /[profile-id]/proposals/[id]/approve  — Approve/reject proposal
├── chat/
│   ├── POST   /                    — Send message (streaming SSE response)
│   ├── GET    /conversations       — List conversations
│   └── GET    /conversations/[id]  — Get conversation history
├── focused-folders/
│   ├── POST   /                    — Create folder
│   ├── POST   /[id]/items          — Add items to folder
│   └── GET    /[id]                — Get folder with items
├── monitoring/
│   ├── GET    /[profile-id]/config — Get monitoring config
│   ├── PATCH  /[profile-id]/config — Update config
│   ├── GET    /[profile-id]/updates — Get recent updates
│   └── POST   /[profile-id]/search — Trigger ad-hoc search
├── sources/
│   ├── GET    /                    — List source registry
│   ├── PATCH  /[id]                — Update trust level
│   └── POST   /                    — Add custom source
└── settings/
    ├── GET    /branding            — Get color scheme
    ├── PATCH  /branding            — Update color scheme
    ├── GET    /anomalies           — List all flagged/unverified data items
    └── PATCH  /anomalies/[id]      — Mark as 'relevant' or 'ignore' (updates verification_status)
```

---

## 11. COST ESTIMATES

| Component | Monthly Cost | Notes |
|-----------|-------------|-------|
| Supabase | $0–25 | Free tier handles early use; Pro ($25/mo) for more storage |
| Vercel | $0–20 | Free tier for low traffic; Pro if needed |
| Claude API (Sonnet) | $10–30/profile | Depends on chat volume and monitoring frequency |
| Claude API (Opus) | $5–20/profile | Only for content generation tasks |
| Congress.gov API | Free | Rate-limited but sufficient |
| OpenSecrets API | Free | With API key registration |
| CourtListener API | Free | With rate limits |
| Mac Mini | One-time $599-799 | Already owned per prior discussions |
| **Total per profile** | **~$15-75/month** | Scales with usage |

---

## 12. RISK REGISTER

| Risk | Impact | Mitigation |
|------|--------|------------|
| API rate limits (congress.gov, etc.) | Slow research | Cache aggressively, stagger requests, respect rate limits |
| Social media API restrictions | Incomplete social data | Fall back to archival sources (Wayback Machine) |
| PACER fees for legal filings | Unexpected costs | Alert user before PACER queries, prefer CourtListener (free) |
| Soul document drift from reality | Bad advice | Human-in-the-loop for all soul doc changes, citation requirement |
| Anomaly detection false positives | User fatigue | Tune scoring over time, allow bulk-approve for low-risk items |
| Context window overflow | Degraded responses | Strict token budgeting, semantic search for relevance filtering |
| Hallucination in content generation | Credibility loss | Mandatory citation requirement, post-generation fact-check prompt |

---

## 13. DELIVERABLES FROM THIS PROMPT

When you execute this plan, produce:

1. **Full Supabase SQL migration** — all tables, RLS policies, indexes
2. **Next.js project scaffold** — file/folder structure matching the UI spec
3. **Agent system prompt templates** — the layered prompt architecture as reusable functions
4. **API route implementations** — all routes listed in section 10
5. **Background worker scripts** — for Mac Mini deployment
6. **Source registry seed data** — pre-configured trusted sources
7. **Cost projection worksheet** — based on estimated usage patterns

Execute phase by phase. Each phase should produce working, demoable code before moving to the next.

