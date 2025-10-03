# Twilio UI Enhancement Roadmap

## Current State

The Twilio UI (`/twilio` page) currently provides:
- ✅ Call initiation with phone number and custom prompts
- ✅ Real-time transcript display
- ✅ Activity logging
- ✅ Quick presets for common tasks
- ✅ WebSocket-based live updates

## Proposed Enhancements

### Phase 1: Voice & Audio Controls (Immediate - Week 1)

#### 1.1 Voice Selection
**Component**: Dropdown menu
**Location**: Call Configuration panel
**Options**:
- Alloy (neutral)
- Echo (male)
- Fable (storytelling)
- Onyx (deep)
- Nova (female)
- Shimmer (warm)

**Implementation**:
```typescript
// Add to outbound-task-agent.ts
voice: config.voice || 'verse'
```

#### 1.2 Speech Speed Control
**Component**: Range slider (0.25x - 4.0x)
**Default**: 1.0x
**Real-time update**: Apply to ongoing calls

**API Parameter**:
```json
{
  "config": {
    "voice": "alloy",
    "speed": 1.2
  }
}
```

#### 1.3 Temperature Control
**Component**: Range slider (0.0 - 1.0)
**Purpose**: Control response creativity
**Default**: 0.8

#### 1.4 Turn Detection Settings
**Component**: Toggle buttons
- Server VAD (current default)
- Push-to-talk
- No turn detection

### Phase 2: Advanced Configuration (Week 2)

#### 2.1 Live System Instructions Editor
**Component**: Monaco/CodeMirror editor
**Features**:
- Syntax highlighting
- Template variables
- Real-time validation
- Save as preset

**Example UI**:
```
┌─ System Instructions ────────────────────┐
│ You are a {role} calling to {purpose}.  │
│                                          │
│ Key points to cover:                     │
│ - {point_1}                             │
│ - {point_2}                             │
│                                          │
│ Guidelines:                              │
│ - {guideline_1}                         │
│ - {guideline_2}                         │
└──────────────────────────────────────────┘
```

#### 2.2 Context Variables Panel
**Purpose**: Pass dynamic data to agent
**UI**: Key-value pairs with add/remove

```typescript
{
  "context": {
    "customer_name": "John Doe",
    "account_number": "12345",
    "appointment_time": "2:00 PM Tuesday",
    "location": "123 Main St"
  }
}
```

#### 2.3 Function Tools Builder
**Component**: Visual function designer
**Features**:
- Add function name and description
- Define parameters with types
- Test function execution
- View function call history

### Phase 3: Call Management (Week 2-3)

#### 3.1 Call History
**Storage**: Local storage initially, DB later
**Features**:
- List of past calls with metadata
- Search by phone number, date, or content
- Replay transcript
- Re-use configuration

**Data Structure**:
```typescript
interface CallRecord {
  callSid: string;
  phoneNumber: string;
  timestamp: Date;
  duration: number;
  transcript: TranscriptItem[];
  taskConfig: TaskConfig;
  outcome: 'completed' | 'failed' | 'dropped';
}
```

#### 3.2 Preset Library
**Component**: Saved configurations panel
**Features**:
- Save current config as preset
- Load preset to form
- Edit/delete presets
- Share presets (export/import JSON)

#### 3.3 Export Functionality
**Formats**:
- JSON (full data)
- TXT (readable transcript)
- CSV (for analysis)
- PDF (formatted report)

**Example Export**:
```json
{
  "call": {
    "sid": "CA...",
    "to": "+1234567890",
    "timestamp": "2025-10-03T10:52:34Z",
    "duration": "3:45"
  },
  "transcript": [
    {"speaker": "ai", "time": "00:05", "text": "Hello..."},
    {"speaker": "user", "time": "00:08", "text": "Hi..."}
  ],
  "summary": "Call successfully completed task..."
}
```

### Phase 4: Monitoring & Analytics (Week 3)

#### 4.1 Call Duration Timer
**Component**: Live timer display
**Features**:
- MM:SS format
- Color coding (green → yellow → red)
- Alert at time limits

#### 4.2 Audio Quality Metrics
**Metrics to Display**:
- Latency (ms)
- Jitter
- Packet loss
- Audio bitrate
- Connection quality score

**Visualization**: Real-time line chart

#### 4.3 Event Timeline
**Component**: Horizontal timeline
**Events to Show**:
- Call initiated
- AI first response
- User first input
- Tool calls
- Interruptions
- Call ended

**Visual**: Interactive timeline with hover details

#### 4.4 Sentiment Analysis (Advanced)
**Integration**: OpenAI embeddings + classification
**Display**:
- Real-time sentiment indicator
- Positive/Neutral/Negative badges on transcripts
- Overall call sentiment score

### Phase 5: Multi-Call Support (Week 4)

#### 5.1 Active Calls Dashboard
**Layout**: Grid of active call cards
**Per-call Card Shows**:
- Phone number
- Duration
- Current status
- Latest transcript snippet
- Quick actions (end, transfer)

#### 5.2 Call Queue System
**Features**:
- Schedule calls for future times
- Bulk upload (CSV of numbers)
- Retry logic for failed calls
- Rate limiting controls

#### 5.3 Conference/Transfer
**Capability**: Multi-party calls
**UI Controls**:
- Add participant
- Transfer to another agent
- Mute/unmute parties

## Technical Implementation Details

### Voice Control Implementation

**1. Update Agent Creation**:
```typescript
// src/twilio/agents/outbound-task-agent.ts
export function createOutboundTaskAgent(task: OutboundTask, config?: {
  voice?: string;
  speed?: number;
  temperature?: number;
}): RealtimeAgent {
  return new RealtimeAgent({
    name: 'outbound-task-agent',
    voice: config?.voice || 'verse',
    instructions,
    tools: [],
    handoffs: [],
  });
}
```

**2. Update API Endpoint**:
```typescript
// Add to POST /twilio/outbound-call
interface OutboundCallRequest {
  to: string;
  task: OutboundTask;
  config?: {
    voice?: string;
    speed?: number;
    temperature?: number;
    turnDetection?: string;
  };
}
```

**3. Update UI Form**:
```tsx
// src/app/twilio/page.tsx
const [voice, setVoice] = useState('verse');
const [speed, setSpeed] = useState(1.0);
const [temperature, setTemperature] = useState(0.8);

// In call initiation
const response = await fetch('...', {
  body: JSON.stringify({
    to: phoneNumber,
    task: { type, prompt, context },
    config: { voice, speed, temperature }
  })
});
```

### Call History Implementation

**1. Add Storage Layer**:
```typescript
// src/app/twilio/lib/callHistory.ts
interface CallHistory {
  save(record: CallRecord): void;
  getAll(): CallRecord[];
  search(query: string): CallRecord[];
  delete(callSid: string): void;
}

// localStorage implementation
export const callHistory: CallHistory = {
  save: (record) => {
    const history = JSON.parse(localStorage.getItem('call_history') || '[]');
    history.unshift(record);
    localStorage.setItem('call_history', JSON.stringify(history.slice(0, 100)));
  },
  // ... other methods
};
```

**2. Update UI to Save Calls**:
```tsx
useEffect(() => {
  if (isCallActive && transcript.length > 0) {
    callHistory.save({
      callSid: currentCallSid!,
      phoneNumber,
      timestamp: new Date(),
      duration: callDuration,
      transcript,
      taskConfig: { type: taskType, prompt: taskPrompt },
      outcome: 'completed'
    });
  }
}, [isCallActive]);
```

### Event Timeline Implementation

**1. Track Events**:
```typescript
interface TimelineEvent {
  time: number; // seconds from call start
  type: 'call_start' | 'ai_speech' | 'user_speech' | 'tool_call' | 'call_end';
  data: any;
}

const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
```

**2. Visualize**:
```tsx
<div className="relative h-16 bg-gray-700 rounded">
  {timeline.map((event, i) => (
    <div
      key={i}
      className="absolute top-0 h-full w-1 bg-blue-500"
      style={{ left: `${(event.time / totalDuration) * 100}%` }}
      title={event.type}
    />
  ))}
</div>
```

## UI Mock-ups

### Enhanced Configuration Panel
```
┌─ Call Configuration ──────────────────────────────┐
│ Phone Number: [+1234567890        ]               │
│                                                    │
│ Task Type: [Custom ▼]                             │
│                                                    │
│ Voice: [Verse ▼]     Speed: [1.0x ──●──]         │
│                                                    │
│ Temperature: [0.8 ──●──]                          │
│                                                    │
│ Turn Detection: ( ) Server VAD (•) PTT ( ) None   │
│                                                    │
│ Task Prompt:                                       │
│ ┌────────────────────────────────────────────┐   │
│ │ You are a helpful AI assistant...          │   │
│ │                                            │   │
│ └────────────────────────────────────────────┘   │
│                                                    │
│ Context Variables:                                 │
│ ┌────────────────────────────────────────────┐   │
│ │ customer_name: [John Doe          ] [×]    │   │
│ │ account_id:    [12345             ] [×]    │   │
│ │ [+ Add Variable]                            │   │
│ └────────────────────────────────────────────┘   │
│                                                    │
│ [Initiate Call]  [Save as Preset]                 │
└────────────────────────────────────────────────────┘
```

### Call History Panel
```
┌─ Call History ────────────────────────────────────┐
│ Search: [_________________________] [🔍]           │
│                                                    │
│ ┌─ Oct 3, 2025 10:52 AM ─────────────────────┐   │
│ │ +14168327527 • 3:45 • ✓ Completed          │   │
│ │ "Appointment reminder call..."              │   │
│ │ [View] [Replay] [Export]                    │   │
│ └────────────────────────────────────────────┘   │
│                                                    │
│ ┌─ Oct 3, 2025 09:15 AM ─────────────────────┐   │
│ │ +14168327527 • 2:10 • ✓ Completed          │   │
│ │ "Transit booking assistance..."             │   │
│ │ [View] [Replay] [Export]                    │   │
│ └────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────┘
```

## Recommended Starting Point

**Start with Phase 1 - Voice & Audio Controls**:

1. Add voice selection dropdown (1-2 hours)
2. Add speed control slider (1 hour)
3. Update API to accept config parameters (2 hours)
4. Test with different voices and speeds (1 hour)

**Total**: ~1 day of work for immediate, high-value improvements

This provides immediate user control over the calling experience while laying groundwork for more advanced features.
