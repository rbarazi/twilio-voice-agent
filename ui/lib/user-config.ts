/**
 * Client-side user configuration management
 * Stores API credentials securely in browser localStorage
 */

export interface UserConfig {
  openaiApiKey?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
}

const STORAGE_KEY = 'twilio-voice-agent-config';
const ENCRYPTION_KEY = 'twilio-voice-agent-key-v1';

/**
 * Simple XOR-based obfuscation for localStorage
 * Note: This is NOT cryptographic encryption, just obfuscation to prevent
 * casual observation. Real security comes from HTTPS and not sharing credentials.
 */
function obfuscate(text: string): string {
  const key = ENCRYPTION_KEY;
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result); // Base64 encode
}

function deobfuscate(encoded: string): string {
  try {
    const text = atob(encoded); // Base64 decode
    const key = ENCRYPTION_KEY;
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return '';
  }
}

/**
 * Load user configuration from localStorage
 */
export function loadUserConfig(): UserConfig {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};

    const decrypted = deobfuscate(stored);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to load user config:', error);
    return {};
  }
}

/**
 * Save user configuration to localStorage
 */
export function saveUserConfig(config: UserConfig): void {
  if (typeof window === 'undefined') return;

  try {
    const json = JSON.stringify(config);
    const encrypted = obfuscate(json);
    localStorage.setItem(STORAGE_KEY, encrypted);
  } catch (error) {
    console.error('Failed to save user config:', error);
    throw new Error('Failed to save configuration');
  }
}

/**
 * Clear user configuration from localStorage
 */
export function clearUserConfig(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if user has configured their own credentials
 */
export function hasUserConfig(): boolean {
  const config = loadUserConfig();
  return !!(
    config.openaiApiKey &&
    config.twilioAccountSid &&
    config.twilioAuthToken &&
    config.twilioPhoneNumber
  );
}

/**
 * Validate that all required fields are present
 */
export function validateUserConfig(config: UserConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.openaiApiKey?.trim()) {
    errors.push('OpenAI API Key is required');
  } else if (!config.openaiApiKey.startsWith('sk-')) {
    errors.push('OpenAI API Key should start with "sk-"');
  }

  if (!config.twilioAccountSid?.trim()) {
    errors.push('Twilio Account SID is required');
  } else if (!config.twilioAccountSid.startsWith('AC')) {
    errors.push('Twilio Account SID should start with "AC"');
  }

  if (!config.twilioAuthToken?.trim()) {
    errors.push('Twilio Auth Token is required');
  }

  if (!config.twilioPhoneNumber?.trim()) {
    errors.push('Twilio Phone Number is required');
  } else if (!config.twilioPhoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
    errors.push('Twilio Phone Number must be in E.164 format (e.g., +14155551234)');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Mask sensitive values for display
 */
export function maskValue(value: string | undefined, visibleChars: number = 4): string {
  if (!value) return '';
  if (value.length <= visibleChars) return '*'.repeat(value.length);
  return value.substring(0, visibleChars) + '*'.repeat(Math.min(20, value.length - visibleChars));
}
