import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reducer, INITIAL, selectPlanInputs, pendingPackUpdate } from './state/store';
import { buildPlan, todayView } from '../../engine/plan.mjs';
import { deriveNotifications } from './notifications/schedule';
import { PACKS, MANIFEST, byCode } from './data/packs.generated';

const KEY = 'relocation-os/state/v1';
const Ctx = createContext(null);
export const usePlan = () => useContext(Ctx);

export function PlanProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [hydrated, setHydrated] = useState(false);

  // Load once, then persist on every change. The whole state object is small
  // and JSON-serialisable by design, so this stays boring.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) dispatch({ type: 'HYDRATE', state: JSON.parse(raw) });
      } catch (e) {
        // A corrupt store must not brick the app; start clean rather than crash.
        console.warn('could not restore saved plans', e);
      } finally { setHydrated(true); }
    })();
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, hydrated]);

  const value = useMemo(() => {
    const plan = state.plans[state.activePlanId] ?? null;
    const pack = plan ? byCode(plan.countryCode) : null;

    let built = null, view = null, notifications = [], update = null;
    if (plan && pack) {
      try {
        built = buildPlan(pack, selectPlanInputs(state, plan.id));
        view = todayView(built);
        notifications = deriveNotifications(built, { completed: state.completed[plan.id] ?? {} });
      } catch (e) {
        // A pathway that cannot be planned is a content bug, not a crash.
        console.warn('could not build plan', e);
      }
      update = pendingPackUpdate(state, plan.id, MANIFEST);
    }

    return { state, dispatch, hydrated, plan, pack, built, view, notifications,
             pendingUpdate: update, packs: PACKS, manifest: MANIFEST,
             completed: state.completed[state.activePlanId] ?? {},
             documents: state.documents[state.activePlanId] ?? {} };
  }, [state, hydrated]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
