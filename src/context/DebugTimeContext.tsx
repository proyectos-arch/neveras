'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback, useEffect } from 'react';

interface DebugTimeContextType {
  timeOffset: number;
  setTimeOffset: React.Dispatch<React.SetStateAction<number>>;
  currentTime: Date;
  addHours: (hours: number) => void;
  resetTime: () => void;
}

const DebugTimeContext = createContext<DebugTimeContextType | undefined>(undefined);

export const DebugTimeProvider = ({ children }: { children: ReactNode }) => {
  const [timeOffset, setTimeOffset] = useState(0);
  // Initialize with a placeholder or null, to be set on client-side mount.
  const [clientTime, setClientTime] = useState<Date | null>(null);

  useEffect(() => {
    // This effect runs only on the client, after initial render.
    const updateCurrentTime = () => {
        setClientTime(new Date(Date.now() + timeOffset));
    };
    
    updateCurrentTime(); // Set initial time
    const intervalId = setInterval(updateCurrentTime, 1000); // Update every second

    return () => clearInterval(intervalId);
  }, [timeOffset]);


  const addHours = useCallback((hours: number) => {
    setTimeOffset(prevOffset => prevOffset + hours * 60 * 60 * 1000);
  }, []);

  const resetTime = useCallback(() => {
    setTimeOffset(0);
  }, []);

  // Provide a valid Date object, even on the server (though it won't be used for rendering client components)
  // or before client-side hydration is complete.
  const currentTime = clientTime || new Date(Date.now() + timeOffset);

  const value = {
    timeOffset,
    setTimeOffset,
    currentTime,
    addHours,
    resetTime,
  };

  return (
    <DebugTimeContext.Provider value={value}>
      {children}
    </DebugTimeContext.Provider>
  );
};

export const useCurrentTime = () => {
  const context = useContext(DebugTimeContext);
  if (context === undefined) {
    // In production or if provider is not used, fallback to real time.
    // This makes the hook safe to use everywhere without checking NODE_ENV.
    return { 
        currentTime: new Date(),
        addHours: () => console.warn("addHours is a debug function and has no effect in this context."),
        resetTime: () => console.warn("resetTime is a debug function and has no effect in this context."),
        timeOffset: 0,
        setTimeOffset: () => console.warn("setTimeOffset is a debug function and has no effect in this context."),
    };
  }
  return context;
};
