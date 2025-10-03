# Noise Reduction for Phone Calls

## Overview

Implemented OpenAI's built-in input audio noise reduction to filter background talking and environmental noise from the caller's end. This significantly improves call quality in noisy environments.

## How It Works

OpenAI's Realtime API includes native noise reduction that filters audio **before** it enters the audio buffer and is sent to:
1. Voice Activity Detection (VAD)
2. The AI model

This pre-processing:
- **Improves VAD accuracy** by reducing false positives from background noise
- **Enhances model performance** by improving perception of the input audio
- **Has low latency** since it's applied at the buffer stage

## Noise Reduction Modes

### 1. Far Field (Default - Recommended for Phone Calls)
- **Use case**: Phone calls, conference rooms, far-field microphones
- **Scenario**: User may not hold phone close to mouth, background conversations, environmental noise
- **Default**: This is the default mode for all Twilio calls
- **Best for**:
  - Mobile phone calls
  - Calls from public spaces
  - Calls with background conversations
  - Speakerphone scenarios

### 2. Near Field
- **Use case**: Close-talking microphones like headphones, headsets
- **Scenario**: User has microphone very close to mouth
- **Best for**:
  - Headset/headphone calls
  - Close-range handheld phones
  - Professional call center environments

### 3. Off
- **Use case**: Disable noise reduction entirely
- **Scenario**: Clean audio environment, or when you want raw audio
- **Best for**:
  - Professional studio environments
  - Debugging audio issues
  - Testing raw audio quality

## Configuration

### Via UI

1. Navigate to `/twilio` page
2. In the "Call Configuration" panel, find the "Noise Reduction" dropdown
3. Select your preferred mode:
   - **Far Field (Recommended for phones)** - Default
   - **Near Field (For close microphones)**
   - **Off**

### Via API

```bash
curl -X POST https://your-domain.com/twilio/outbound-call \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "task": {
      "type": "custom",
      "prompt": "You are a helpful assistant.",
      "context": {}
    },
    "agentConfig": {
      "noiseReduction": "far_field"
    }
  }'
```

**Options**: `"far_field"`, `"near_field"`, or `"off"`

## Technical Implementation

### Backend

**File**: `src/twilio/routes/media-stream.ts`

```typescript
// Configure noise reduction
const noiseReductionMode = callMetadata?.agentConfig?.noiseReduction || 'far_field';
if (noiseReductionMode !== 'off') {
  sessionConfig.inputAudioNoiseReduction = {
    type: noiseReductionMode,
  };
  logger.info('Enabling noise reduction', { callSid, mode: noiseReductionMode });
} else {
  logger.info('Noise reduction disabled', { callSid });
}
```

### Type Definition

**File**: `src/twilio/types/index.ts`

```typescript
export interface AgentConfig {
  voice?: string;
  speed?: number;
  temperature?: number;
  noiseReduction?: 'near_field' | 'far_field' | 'off';
  model?: string;
}
```

### UI Component

**File**: `src/app/twilio/page.tsx`

```typescript
const [noiseReduction, setNoiseReduction] = useState<'near_field' | 'far_field' | 'off'>('far_field');

// In the form
<select
  value={noiseReduction}
  onChange={(e) => setNoiseReduction(e.target.value as 'near_field' | 'far_field' | 'off')}
  className="..."
  disabled={isCallActive}
>
  <option value="far_field">Far Field (Recommended for phones)</option>
  <option value="near_field">Near Field (For close microphones)</option>
  <option value="off">Off</option>
</select>
```

## Monitoring

Noise reduction mode is logged with each call:

```
[INFO] Enabling noise reduction { callSid: 'CA...', mode: 'far_field' }
```

or

```
[INFO] Noise reduction disabled { callSid: 'CA...' }
```

## Use Cases

### Scenario 1: Customer Service Call from Busy Coffee Shop
**Problem**: Customer calling from noisy café with background conversations
**Solution**: Far Field mode filters background chatter, improving both VAD accuracy and AI comprehension

### Scenario 2: Sales Call with Professional Headset
**Problem**: Sales rep using quality headset in quiet office
**Solution**: Near Field mode optimized for close-range, clean audio

### Scenario 3: Technical Support in Car
**Problem**: User calling while driving, road noise and traffic sounds
**Solution**: Far Field mode reduces road noise and improves speech clarity

### Scenario 4: Debugging Audio Quality Issues
**Problem**: Need to hear raw audio to diagnose problems
**Solution**: Off mode disables filtering for troubleshooting

## Expected Results

With noise reduction enabled, you should notice:
- ✅ **Fewer false triggers** - AI won't respond to background conversations
- ✅ **Better transcription accuracy** - Whisper transcription will be more accurate
- ✅ **Improved AI responses** - Model better understands user input
- ✅ **Reduced interruptions** - VAD less likely to trigger on background noise
- ✅ **Clearer conversations** - Overall better call quality

## Performance Impact

**Latency**: Minimal - noise reduction is applied at the buffer stage before processing
**Quality**: High - OpenAI's noise reduction is optimized for their models
**Resource usage**: Handled by OpenAI's infrastructure, no client-side impact

## Troubleshooting

### Issue: User voice sounds muffled
**Solution**: Try switching to Near Field mode or turning noise reduction Off

### Issue: Background noise still coming through
**Solution**:
1. Ensure Far Field mode is selected
2. Check if background noise is very loud (noise reduction has limits)
3. Ask user to move to quieter location

### Issue: AI not responding to user
**Solution**:
1. Check logs to see if VAD is triggering
2. Try reducing noise reduction or switching modes
3. May be VAD threshold issue unrelated to noise reduction

## References

- OpenAI Realtime API: `inputAudioNoiseReduction` parameter
- Session interface: `input_audio_noise_reduction?: Session.InputAudioNoiseReduction`
- Supported types: `'near_field' | 'far_field'`

## Future Enhancements

Potential improvements:
- [ ] Add UI indicator showing when noise reduction is actively filtering
- [ ] Add audio quality metrics visualization
- [ ] Allow runtime switching of noise reduction mode during call
- [ ] Add custom noise reduction strength slider (if API supports it)
- [ ] Add A/B testing for optimal mode selection per user

---

**Status**: ✅ Implemented and working
**Default**: Far Field mode for all phone calls
**Configurable**: Yes, via UI and API
