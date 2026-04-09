# ButterRobot iOS — Native Swift Voice Client

> **Save this for later.** Build this after the Mac ButterRobot v2 and 
> Covaled Workspaces are stable and tested. This is a native iOS app 
> that connects to the same Covaled backend as the Mac client.
>
> Run in Claude Code from a new Xcode project directory.

---

## What This Is

A native Swift/SwiftUI iPhone app that provides the same two-mode 
voice interface as the Mac ButterRobot — conversation with Claude 
and high-fidelity dictation — but saves everything to Covaled 
workspaces instead of the local filesystem. The Mac is not required 
to be running. The iPhone is a fully independent client.

## Target Device

- iPhone 17 Pro Max (or any recent iPhone with Neural Engine)
- iOS 18+
- AirPods Pro for hands-free voice I/O
- Internet required for conversation mode (Claude API)
- Dictation mode works offline (WhisperKit runs on-device)

## Core Principle

Same as Mac ButterRobot: **Claude is the brain, the device is the 
voice.** All thinking goes to Claude API. All audio stays on-device. 
Voice data never leaves the phone.

---

## Dependencies

### Swift Packages

```swift
// Package.swift or Xcode SPM dependencies
dependencies: [
    // On-device speech-to-text
    .package(url: "https://github.com/argmaxinc/WhisperKit.git", from: "0.9.0"),
    
    // On-device text-to-speech (if available for iOS)
    // Fallback: AVSpeechSynthesizer (built into iOS)
    
    // Anthropic SDK (or direct URLSession calls)
    // Supabase Swift SDK
    .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.0.0"),
]
```

### Models to Bundle / Download on First Launch

- WhisperKit small or medium model (~500MB-1.5GB, downloaded on 
  first launch, cached on device)
- TTS model if using mlx-audio-swift, otherwise use iOS built-in 
  AVSpeechSynthesizer voices

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│            iPhone App (SwiftUI)                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ WhisperKit│  │Correction│  │ TTS Engine   │  │
│  │ STT      │  │Dictionary│  │ (AVSpeech or │  │
│  │ (on-device)│ │(synced)  │  │  mlx-audio)  │  │
│  └─────┬────┘  └────┬─────┘  └──────▲───────┘  │
│        │             │               │           │
│        ▼             ▼               │           │
│  ┌─────────────────────────────┐     │           │
│  │  Mode: Conversation | Dict  │     │           │
│  │                             │     │           │
│  │  Conversation:              │     │           │
│  │    text → Claude API ───────┼─────┘           │
│  │           ↕                 │                 │
│  │    Covaled Workspace API    │                 │
│  │                             │                 │
│  │  Dictation:                 │                 │
│  │    text → Covaled storage   │                 │
│  └─────────────────────────────┘                 │
│                                                  │
│  UI Views:                                       │
│  - Conversation (chat bubbles, voice-first)      │
│  - Dictation (clean text editor)                 │
│  - Workspace selector                            │
│  - Settings                                      │
└──────────────────────────────────────────────────┘
         │                          ▲
         │ sync                     │ pull context
         ▼                          │
┌──────────────────────────────────────────────────┐
│        COVALED (Cloud, Supabase)                  │
│                                                   │
│  - Workspace soul docs                            │
│  - Document RAG search                            │
│  - Conversation history                           │
│  - Correction dictionary (user_corrections table) │
│  - Generated documents                            │
│  - Voice command config                           │
└───────────────────────────────────────────────────┘
```

---

## Data Models

### Supabase Tables (add to existing schema)

```sql
-- User-level correction dictionary (shared across all devices)
CREATE TABLE user_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  heard TEXT NOT NULL,
  corrected TEXT NOT NULL,
  source TEXT DEFAULT 'manual', -- 'manual', 'auto'
  times_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, heard)
);

ALTER TABLE user_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own corrections"
  ON user_corrections FOR ALL
  USING (user_id = auth.uid());

-- User-level voice command config (shared across devices)
CREATE TABLE user_voice_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  trigger_phrase TEXT NOT NULL,
  action TEXT NOT NULL, -- 'replace', 'send', 'command'
  replacement TEXT, -- for 'replace' action
  command TEXT, -- for 'command' action (e.g., 'switch_mode')
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, trigger_phrase)
);

ALTER TABLE user_voice_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own commands"
  ON user_voice_commands FOR ALL
  USING (user_id = auth.uid());

-- Dictation files (saved to workspace)
CREATE TABLE workspace_dictations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES auth.users(id),
  title TEXT,
  content TEXT NOT NULL,
  source_device TEXT DEFAULT 'iphone', -- 'iphone', 'mac'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Swift Models

```swift
struct Correction: Codable, Identifiable {
    let id: UUID
    let heard: String
    let corrected: String
    var timesUsed: Int
}

struct VoiceCommand: Codable, Identifiable {
    let id: UUID
    let triggerPhrase: String
    let action: String // "replace", "send", "command"
    let replacement: String?
    let command: String?
}

struct Workspace: Codable, Identifiable {
    let id: UUID
    let slug: String
    let name: String
    let description: String?
}

struct ConversationMessage: Codable {
    let role: String // "user", "assistant"
    let content: String
    let timestamp: Date
    let source: String // "voice", "text"
    let model: String? // "claude-sonnet-4-6", etc.
}

struct Conversation: Codable, Identifiable {
    let id: UUID
    let workspaceId: UUID
    let title: String?
    var messages: [ConversationMessage]
    let source: String // "butterrobot-ios"
    let createdAt: Date
}
```

---

## App Structure

### Entry Point & Navigation

```swift
@main
struct ButterRobotApp: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        WindowGroup {
            if appState.isAuthenticated {
                MainView()
                    .environmentObject(appState)
            } else {
                LoginView()
                    .environmentObject(appState)
            }
        }
    }
}

struct MainView: View {
    @EnvironmentObject var appState: AppState
    @State private var selectedMode: AppMode = .conversation
    
    var body: some View {
        VStack(spacing: 0) {
            // Top bar: mode toggle + workspace selector
            TopBar(selectedMode: $selectedMode, 
                   workspace: appState.activeWorkspace)
            
            // Main content
            switch selectedMode {
            case .conversation:
                ConversationView()
            case .dictation:
                DictationView()
            }
            
            // Bottom bar: mic, speaker, send
            VoiceControlBar()
        }
    }
}

enum AppMode {
    case conversation
    case dictation
}
```

### AppState (Central State Manager)

```swift
class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var activeWorkspace: Workspace?
    @Published var workspaces: [Workspace] = []
    @Published var corrections: [Correction] = []
    @Published var voiceCommands: [VoiceCommand] = []
    @Published var isRecording = false
    @Published var isSpeaking = false // TTS active
    @Published var isOnline = true
    @Published var currentMode: AppMode = .conversation
    
    // Services
    let supabase: SupabaseClient
    let whisperKit: WhisperKit
    let ttsEngine: TTSEngine
    let claudeAPI: ClaudeAPIClient
    
    // Correction dictionary syncs on launch and on changes
    func syncCorrections() async { ... }
    
    // Voice commands sync on launch
    func syncVoiceCommands() async { ... }
}
```

---

## Voice Pipeline (iOS)

### Speech-to-Text (WhisperKit)

```swift
class SpeechRecognizer: ObservableObject {
    private var whisperKit: WhisperKit?
    @Published var transcribedText = ""
    @Published var isListening = false
    @Published var speechDetected = false
    
    func setup() async {
        // Use small model for iPhone, medium if enough RAM
        let config = WhisperKitConfig(model: "small")
        whisperKit = try? await WhisperKit(config)
    }
    
    func startListening() {
        // Begin audio capture from microphone
        // Use AVAudioEngine for real-time audio
        // Feed audio chunks to WhisperKit for streaming transcription
        // Apply VAD — only process when speech is detected
        // Update transcribedText as words are recognized
    }
    
    func stopListening() {
        // Stop audio capture
    }
}
```

### Voice Activity Detection

Implement VAD to prevent Whisper hallucinations on silence:
- Monitor audio input energy level from AVAudioEngine
- Only send audio to WhisperKit when energy exceeds threshold
- Visual indicator: dim mic when idle, bright when speech detected
- Configurable threshold in settings

### Post-Processing (Corrections + Commands)

```swift
class TranscriptionProcessor {
    var corrections: [Correction]
    var voiceCommands: [VoiceCommand]
    
    func process(_ rawText: String) -> ProcessingResult {
        var text = rawText
        
        // Apply voice commands first
        for command in voiceCommands {
            if text.lowercased().contains(command.triggerPhrase.lowercased()) {
                switch command.action {
                case "replace":
                    text = text.replacingOccurrences(
                        of: command.triggerPhrase,
                        with: command.replacement ?? "",
                        options: .caseInsensitive
                    )
                case "send":
                    // Strip trigger and signal send
                    text = text.replacingOccurrences(
                        of: command.triggerPhrase,
                        with: "",
                        options: .caseInsensitive
                    ).trimmingCharacters(in: .whitespaces)
                    return ProcessingResult(text: text, shouldSend: true)
                case "command":
                    return ProcessingResult(
                        text: text, 
                        systemCommand: command.command
                    )
                default:
                    break
                }
            }
        }
        
        // Apply corrections
        for correction in corrections {
            text = text.replacingOccurrences(
                of: correction.heard,
                with: correction.corrected,
                options: .caseInsensitive
            )
        }
        
        return ProcessingResult(text: text, shouldSend: false)
    }
}

struct ProcessingResult {
    let text: String
    var shouldSend: Bool = false
    var systemCommand: String? = nil
}
```

### Send Triggers

Same as Mac ButterRobot:
1. **5-second silence** after speech detected (configurable)
2. **"Over over"** spoken — strips and sends immediately
3. **Manual send** button tap
4. Mic stays active after sending — continuous conversation loop

### Text-to-Speech

```swift
class TTSEngine: ObservableObject {
    @Published var isSpeaking = false
    private let synthesizer = AVSpeechSynthesizer()
    
    // Primary: AVSpeechSynthesizer with premium voice
    func speak(_ text: String, voice: String = "com.apple.speech.synthesis.voice.Samantha.premium") {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(identifier: voice)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        isSpeaking = true
        synthesizer.speak(utterance)
    }
    
    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        isSpeaking = false
    }
    
    // List available premium voices
    func availableVoices() -> [AVSpeechSynthesisVoice] {
        AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.quality == .premium || $0.quality == .enhanced }
            .filter { $0.language.starts(with: "en") }
    }
}
```

If mlx-audio-swift supports iOS TTS by the time this is built, 
use that instead for higher quality Kokoro voices. Keep 
AVSpeechSynthesizer as fallback.

### Background Audio Session

Critical for AirPods hands-free use:

```swift
func configureAudioSession() {
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(
        .playAndRecord,
        mode: .voiceChat,
        options: [
            .defaultToSpeaker,
            .allowBluetooth,
            .allowBluetoothA2DP
        ]
    )
    try? session.setActive(true)
}
```

This allows:
- Simultaneous mic input and speaker output
- Automatic routing to AirPods when connected
- Background audio (app keeps working with screen locked)

Add background mode capability in Xcode:
`Signing & Capabilities → Background Modes → Audio, AirPlay, and Picture in Picture`

---

## Covaled API Client

```swift
class CovaledAPIClient {
    let baseURL: URL
    let supabase: SupabaseClient
    
    // Workspaces
    func listWorkspaces() async throws -> [Workspace]
    func getWorkspace(slug: String) async throws -> Workspace
    
    // Soul Doc (for system prompt context)
    func getSoulDoc(workspaceSlug: String) async throws -> SoulDoc
    
    // RAG Search (for conversation context)
    func searchDocuments(
        workspaceSlug: String, 
        query: String, 
        folder: String? = nil,
        k: Int = 10
    ) async throws -> [DocumentChunk]
    
    // Conversations
    func saveConversation(_ conversation: Conversation) async throws
    func listConversations(workspaceSlug: String) async throws -> [Conversation]
    func getConversation(id: UUID) async throws -> Conversation
    
    // Corrections (sync)
    func getCorrections() async throws -> [Correction]
    func addCorrection(heard: String, corrected: String) async throws
    
    // Voice Commands (sync)
    func getVoiceCommands() async throws -> [VoiceCommand]
    
    // Dictation
    func saveDictation(
        workspaceSlug: String, 
        title: String, 
        content: String
    ) async throws
    
    // Documents (save generated content)
    func saveDocument(
        workspaceSlug: String,
        title: String,
        content: String,
        folder: String = "Generated Output"
    ) async throws
}
```

---

## Claude API Client

```swift
class ClaudeAPIClient {
    private let apiKey: String
    private let baseURL = URL(string: "https://api.anthropic.com/v1/messages")!
    
    struct Message: Codable {
        let role: String
        let content: String
    }
    
    func chat(
        messages: [Message],
        systemPrompt: String,
        model: String = "claude-sonnet-4-6",
        maxTokens: Int = 4096
    ) async throws -> String {
        var request = URLRequest(url: baseURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        
        let body: [String: Any] = [
            "model": model,
            "max_tokens": maxTokens,
            "system": systemPrompt,
            "messages": messages.map { ["role": $0.role, "content": $0.content] }
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(ClaudeResponse.self, from: data)
        return response.content.first?.text ?? ""
    }
    
    // Streaming version for real-time response display
    func chatStream(
        messages: [Message],
        systemPrompt: String,
        model: String = "claude-sonnet-4-6"
    ) -> AsyncThrowingStream<String, Error> {
        // SSE streaming implementation
        // Yield text chunks as they arrive
        // UI updates in real-time
    }
}

// System prompt assembly — same layers as Mac ButterRobot
func assembleSystemPrompt(
    soulDoc: SoulDoc,
    documentChunks: [DocumentChunk],
    workspaceName: String
) -> String {
    """
    You are ButterRobot, a voice-first AI assistant. You are currently 
    connected to the \(workspaceName) workspace. Respond conversationally — 
    your responses will be spoken aloud, so keep them natural and concise 
    unless asked for detail.
    
    If you don't know something, say so. Never fabricate information.
    When referencing documents, cite the source.
    
    === USER PROFILE ===
    \(soulDoc.markdown)
    
    === RELEVANT DOCUMENTS ===
    \(documentChunks.map { "[\($0.sourceTitle)]: \($0.text)" }.joined(separator: "\n\n"))
    """
}
```

---

## UI Views

### ConversationView

```swift
struct ConversationView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = ConversationViewModel()
    
    var body: some View {
        VStack {
            // Chat messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.messages) { message in
                            MessageBubble(message: message)
                                .onTapGesture {
                                    // Tap to correct words (for user messages)
                                }
                        }
                    }
                }
            }
            
            // Live transcription preview
            if appState.isRecording {
                TranscriptionPreview(text: viewModel.liveTranscription)
            }
        }
    }
}

struct MessageBubble: View {
    let message: ConversationMessage
    
    var body: some View {
        HStack {
            if message.role == "user" { Spacer() }
            
            VStack(alignment: message.role == "user" ? .trailing : .leading) {
                Text(message.content)
                    .padding(12)
                    .background(
                        message.role == "user" 
                            ? Color.blue 
                            : Color(.systemGray5)
                    )
                    .cornerRadius(16)
                
                // Metadata: model, voice/text indicator
                HStack(spacing: 4) {
                    if message.source == "voice" {
                        Image(systemName: "mic.fill")
                            .font(.caption2)
                    }
                    if let model = message.model {
                        Text(model)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            if message.role == "assistant" { Spacer() }
        }
        .padding(.horizontal)
    }
}
```

### DictationView

```swift
struct DictationView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var viewModel = DictationViewModel()
    
    var body: some View {
        VStack {
            // Clean text editor
            TextEditor(text: $viewModel.dictationText)
                .font(.body)
                .padding()
            
            // File controls
            HStack {
                Button("Save to Workspace") {
                    viewModel.saveToWorkspace()
                }
                
                Button("New File") {
                    viewModel.newFile()
                }
                
                Spacer()
                
                Text("\(viewModel.wordCount) words")
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal)
        }
    }
}
```

### VoiceControlBar (Bottom Bar — Shared)

```swift
struct VoiceControlBar: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        HStack(spacing: 20) {
            // Mic button
            Button(action: { appState.toggleRecording() }) {
                Image(systemName: appState.isRecording 
                    ? "mic.fill" : "mic")
                    .font(.title2)
                    .foregroundColor(appState.isRecording ? .red : .primary)
            }
            
            // Speaker toggle
            Button(action: { appState.toggleTTS() }) {
                Image(systemName: appState.ttsEnabled 
                    ? "speaker.wave.2.fill" : "speaker.slash")
                    .font(.title2)
            }
            
            // Voice selector (compact)
            Menu {
                ForEach(appState.ttsEngine.availableVoices(), id: \.identifier) { voice in
                    Button(voice.name) {
                        appState.selectedVoice = voice.identifier
                    }
                }
            } label: {
                Image(systemName: "person.wave.2")
                    .font(.title2)
            }
            
            Spacer()
            
            // Workspace indicator
            Menu {
                ForEach(appState.workspaces) { workspace in
                    Button(workspace.name) {
                        appState.switchWorkspace(to: workspace)
                    }
                }
            } label: {
                HStack {
                    Image(systemName: "folder")
                    Text(appState.activeWorkspace?.name ?? "No workspace")
                        .font(.caption)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
    }
}
```

### Word Correction Interface

```swift
struct CorrectionPopup: View {
    let originalWord: String
    @State private var correctedWord: String = ""
    @State private var alwaysCorrect: Bool = true
    let onSave: (String, Bool) -> Void
    let onDismiss: () -> Void
    
    var body: some View {
        VStack(spacing: 12) {
            Text("Heard: \"\(originalWord)\"")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            TextField("Correct to:", text: $correctedWord)
                .textFieldStyle(.roundedBorder)
            
            Toggle("Always correct this", isOn: $alwaysCorrect)
            
            HStack {
                Button("Cancel") { onDismiss() }
                Button("Save") { 
                    onSave(correctedWord, alwaysCorrect)
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(radius: 10)
    }
}
```

### Settings View

```swift
struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        Form {
            Section("Workspace") {
                // Covaled URL
                // Auth status
                // Active workspace
            }
            
            Section("Voice Input") {
                // Silence timeout slider (3-10 seconds)
                // Send trigger phrase
                // Whisper model selector (small / medium)
            }
            
            Section("Voice Output") {
                // TTS enabled toggle
                // Voice selector
                // Speech rate slider
            }
            
            Section("Corrections") {
                // List of learned corrections
                // Swipe to delete
                // Add manual correction
                // Sync status
            }
            
            Section("Model") {
                // Default: Sonnet
                // Option: Opus for brainstorming
            }
        }
    }
}
```

---

## Offline Behavior

When no internet is available:

- **Conversation mode:** Disabled. Show message: "Conversation requires 
  internet (Claude API). Switch to dictation mode for offline use."
- **Dictation mode:** Fully functional. WhisperKit runs on-device. 
  Corrections applied from cached local copy. Transcriptions saved 
  locally and synced to Covaled when connectivity resumes.
- **Correction dictionary:** Cached locally on device. Syncs on next 
  connectivity.
- **Conversations:** Cached locally if saved during offline, synced when 
  online.

Use NWPathMonitor for connectivity detection:
```swift
let monitor = NWPathMonitor()
monitor.pathUpdateHandler = { path in
    DispatchQueue.main.async {
        appState.isOnline = (path.status == .satisfied)
    }
}
monitor.start(queue: DispatchQueue(label: "NetworkMonitor"))
```

---

## Build Order

1. Xcode project setup (SwiftUI, add SPM dependencies)
2. Auth flow (Supabase login, persist session)
3. Workspace selector (fetch from Covaled API)
4. WhisperKit integration (on-device STT with VAD)
5. Correction dictionary (sync from Supabase, local cache, 
   correction popup UI)
6. Voice command processing (send triggers, mode switching)
7. Claude API integration (chat with workspace context)
8. Conversation view (chat bubbles, streaming responses)
9. TTS integration (AVSpeechSynthesizer with voice selector)
10. Dictation view (clean editor, save to workspace)
11. Background audio session (AirPods, screen-off support)
12. Offline handling (local cache, sync on reconnect)
13. Settings view
14. TestFlight beta

**Test each phase before proceeding.**

---

## Security

- Claude API key stored in iOS Keychain, never in UserDefaults
- Supabase auth token stored in Keychain
- No audio data ever transmitted — only transcribed text
- Workspace isolation enforced by Covaled RLS (same as web)
- App Transport Security enabled (HTTPS only)
- No analytics or tracking SDKs

---

## App Store Considerations (Future)

If you want to distribute this beyond personal use:
- Requires Apple Developer Program membership ($99/year)
- App Review will want to understand the AI integration
- Need privacy policy explaining on-device audio processing
- Claude API costs would need to be covered (user brings their 
  own API key, or you proxy through Covaled with billing)
- WhisperKit model download on first launch needs clear UX 
  (progress indicator, Wi-Fi recommendation for large model)
