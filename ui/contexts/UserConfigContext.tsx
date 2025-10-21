'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  UserConfig,
  loadUserConfig,
  saveUserConfig,
  clearUserConfig,
  hasUserConfig,
  validateUserConfig,
} from '@/lib/user-config';

interface UserConfigContextType {
  config: UserConfig;
  hasConfig: boolean;
  updateConfig: (config: UserConfig) => Promise<void>;
  clearConfig: () => void;
  validateConfig: (config: UserConfig) => { valid: boolean; errors: string[] };
  isLoading: boolean;
}

const UserConfigContext = createContext<UserConfigContextType | undefined>(undefined);

export function UserConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<UserConfig>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasConfig, setHasConfig] = useState(false);

  // Load config on mount
  useEffect(() => {
    const loadedConfig = loadUserConfig();
    setConfig(loadedConfig);
    setHasConfig(hasUserConfig());
    setIsLoading(false);
  }, []);

  const updateConfig = useCallback(async (newConfig: UserConfig) => {
    saveUserConfig(newConfig);
    setConfig(newConfig);
    setHasConfig(hasUserConfig());
  }, []);

  const clearConfig = useCallback(() => {
    clearUserConfig();
    setConfig({});
    setHasConfig(false);
  }, []);

  const validateConfig = useCallback((configToValidate: UserConfig) => {
    return validateUserConfig(configToValidate);
  }, []);

  const value: UserConfigContextType = {
    config,
    hasConfig,
    updateConfig,
    clearConfig,
    validateConfig,
    isLoading,
  };

  return <UserConfigContext.Provider value={value}>{children}</UserConfigContext.Provider>;
}

export function useUserConfig() {
  const context = useContext(UserConfigContext);
  if (context === undefined) {
    throw new Error('useUserConfig must be used within a UserConfigProvider');
  }
  return context;
}
