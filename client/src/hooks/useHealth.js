// client/src/hooks/useHealth.js
import { useState, useEffect, useCallback } from 'react';
import { checkServerHealth, checkAiHealth } from '../services/api';

export const useHealth = () => {
  const [serverHealth, setServerHealth] = useState(null);
  const [aiHealth, setAiHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const serverRes = await checkServerHealth();
      setServerHealth(serverRes?.data || serverRes);
    } catch (err) {
      setServerHealth({
        service: 'campusx-server',
        status: 'unreachable',
        error: err.message || 'Server connection failed',
      });
      setError(err.message);
    }

    try {
      const aiRes = await checkAiHealth();
      setAiHealth(aiRes?.data || aiRes);
    } catch (err) {
      setAiHealth({
        service: 'campusx-ai-service',
        status: 'unreachable',
        error: err.message || 'AI service connection failed',
      });
    }

    setLastChecked(new Date().toLocaleTimeString());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return {
    serverHealth,
    aiHealth,
    loading,
    error,
    lastChecked,
    refetch: fetchHealth,
  };
};
