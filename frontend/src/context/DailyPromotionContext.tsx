import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { api } from '../api/client';
import { createDailyPromotionStore, type DailyPromotion, type DailyPromotionState } from './dailyPromotionStore';

type DailyPromotionContextValue = DailyPromotionState & {
  refresh: () => Promise<DailyPromotion | null>;
  getSnapshot: () => DailyPromotionState;
};

const DailyPromotionContext = createContext<DailyPromotionContextValue | null>(null);

export function DailyPromotionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createDailyPromotionStore(api.getDailyPizza));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    const resume = () => { void store.resume(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') resume();
    };
    store.start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    return () => {
      store.stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', resume);
    };
  }, [store]);

  return (
    <DailyPromotionContext.Provider value={{ ...state, refresh: store.refresh, getSnapshot: store.getSnapshot }}>
      {children}
    </DailyPromotionContext.Provider>
  );
}

export function useDailyPromotion(): DailyPromotionContextValue {
  const context = useContext(DailyPromotionContext);
  if (!context) throw new Error('useDailyPromotion must be used inside DailyPromotionProvider');
  return context;
}
