'use client';

import { useState, useEffect } from 'react';
import { useUserConfig } from '@/contexts/UserConfigContext';
import { UserConfig, maskValue } from '@/lib/user-config';

export default function SettingsPage() {
  const { config, updateConfig, clearConfig, validateConfig, hasConfig } = useUserConfig();
  const [formData, setFormData] = useState<UserConfig>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const [testingConfig, setTestingConfig] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setFormData(config);
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    setErrors([]);
    setTestResult(null);

    const validation = validateConfig(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await updateConfig(formData);
      setSuccess(true);
      setShowValues(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setErrors(['Failed to save configuration. Please try again.']);
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all saved credentials? This action cannot be undone.')) {
      clearConfig();
      setFormData({});
      setErrors([]);
      setSuccess(false);
      setTestResult(null);
    }
  };

  const handleTestConfig = async () => {
    setTestingConfig(true);
    setTestResult(null);
    setErrors([]);

    const validation = validateConfig(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      setTestingConfig(false);
      return;
    }

    try {
      const response = await fetch('/api/test-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTestResult({ success: true, message: 'All credentials are valid!' });
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Credential validation failed. Please check your keys.'
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to test credentials. Please check your network connection.'
      });
    } finally {
      setTestingConfig(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">API Configuration</h1>
          <p className="text-gray-600">
            Configure your own API keys to use this voice agent. Your credentials are stored securely in your browser and never leave your machine.
          </p>
        </div>

        {/* Security Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Your credentials stay on your device</h3>
              <p className="text-sm text-blue-800">
                API keys are stored in your browser's local storage and are only sent to your own server when making calls.
                They are never transmitted to any third-party services or logged anywhere.
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* OpenAI Configuration */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">OpenAI Configuration</h2>

              <div>
                <label htmlFor="openaiApiKey" className="block text-sm font-medium text-gray-700 mb-2">
                  OpenAI API Key *
                </label>
                <input
                  type={showValues ? 'text' : 'password'}
                  id="openaiApiKey"
                  value={formData.openaiApiKey || ''}
                  onChange={(e) => setFormData({ ...formData, openaiApiKey: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="sk-proj-..."
                />
                <p className="mt-2 text-sm text-gray-500">
                  Get your API key from{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 underline"
                  >
                    OpenAI Platform → API Keys
                  </a>
                  . Ensure you have access to the Realtime API (currently in beta).
                </p>
              </div>
            </div>

            {/* Twilio Configuration */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Twilio Configuration</h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="twilioAccountSid" className="block text-sm font-medium text-gray-700 mb-2">
                    Twilio Account SID *
                  </label>
                  <input
                    type={showValues ? 'text' : 'password'}
                    id="twilioAccountSid"
                    value={formData.twilioAccountSid || ''}
                    onChange={(e) => setFormData({ ...formData, twilioAccountSid: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="AC..."
                  />
                </div>

                <div>
                  <label htmlFor="twilioAuthToken" className="block text-sm font-medium text-gray-700 mb-2">
                    Twilio Auth Token *
                  </label>
                  <input
                    type={showValues ? 'text' : 'password'}
                    id="twilioAuthToken"
                    value={formData.twilioAuthToken || ''}
                    onChange={(e) => setFormData({ ...formData, twilioAuthToken: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your auth token"
                  />
                </div>

                <div>
                  <label htmlFor="twilioPhoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    Twilio Phone Number *
                  </label>
                  <input
                    type={showValues ? 'text' : 'password'}
                    id="twilioPhoneNumber"
                    value={formData.twilioPhoneNumber || ''}
                    onChange={(e) => setFormData({ ...formData, twilioPhoneNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+14155551234"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Must be in E.164 format (e.g., +14155551234)
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                  <p className="text-sm text-gray-700 mb-2">
                    <strong>How to get your Twilio credentials:</strong>
                  </p>
                  <ol className="text-sm text-gray-600 space-y-1 ml-4 list-decimal">
                    <li>
                      Create a free account at{' '}
                      <a
                        href="https://www.twilio.com/try-twilio"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 underline"
                      >
                        Twilio Sign Up
                      </a>
                    </li>
                    <li>
                      Go to{' '}
                      <a
                        href="https://console.twilio.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 underline"
                      >
                        Twilio Console
                      </a>
                      {' '}to find your Account SID and Auth Token
                    </li>
                    <li>
                      Purchase a phone number at{' '}
                      <a
                        href="https://console.twilio.com/us1/develop/phone-numbers/manage/search"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 underline"
                      >
                        Buy a Number
                      </a>
                      {' '}(trial accounts get free credit)
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Show/Hide Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showValues"
                checked={showValues}
                onChange={(e) => setShowValues(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="showValues" className="ml-2 text-sm text-gray-700">
                Show API keys and tokens
              </label>
            </div>

            {/* Error Messages */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-900 mb-2">Please fix the following errors:</h3>
                <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800 font-medium">
                  ✓ Configuration saved successfully!
                </p>
              </div>
            )}

            {/* Test Result */}
            {testResult && (
              <div className={`border rounded-lg p-4 ${
                testResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className={`text-sm font-medium ${
                  testResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {testResult.success ? '✓' : '✗'} {testResult.message}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors font-medium"
              >
                Save Configuration
              </button>

              <button
                type="button"
                onClick={handleTestConfig}
                disabled={testingConfig}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 focus:ring-4 focus:ring-green-300 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {testingConfig ? 'Testing...' : 'Test Credentials'}
              </button>

              {hasConfig && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 focus:ring-4 focus:ring-red-300 transition-colors font-medium"
                >
                  Clear All
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Current Configuration Summary */}
        {hasConfig && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Configuration</h2>
            <dl className="grid grid-cols-1 gap-4 text-sm">
              <div>
                <dt className="font-medium text-gray-700">OpenAI API Key:</dt>
                <dd className="text-gray-600 font-mono">{maskValue(config.openaiApiKey)}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Twilio Account SID:</dt>
                <dd className="text-gray-600 font-mono">{maskValue(config.twilioAccountSid)}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Twilio Auth Token:</dt>
                <dd className="text-gray-600 font-mono">{maskValue(config.twilioAuthToken)}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-700">Twilio Phone Number:</dt>
                <dd className="text-gray-600 font-mono">{maskValue(config.twilioPhoneNumber, 6)}</dd>
              </div>
            </dl>
          </div>
        )}

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <a
            href="/"
            className="text-blue-600 hover:text-blue-700 underline text-sm"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
