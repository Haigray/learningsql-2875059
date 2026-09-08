// Plan state as a pure reducer.
//
// Kept free of React and of storage so it can be tested in Node and reasoned
// about. The screens dispatch; persistence serialises this object verbatim.
//
// The rule that shapes the whole design: a plan pins the pack version it was
// built against. Content updates never silently mutate somebody's schedule
// mid-move — they surface as a change the user accepts.

export const INITIAL = {
  version: 1,
  plans: {},            // id -> plan
  activePlanId: null,
  completed: {},        // planId -> { [taskKey]: completedOnISO }
  documents: {},        // planId -> { [taskKey]: { issuedOn, note } }
  dismissed: {},        // planId -> { [alertId]: true }
  settings: { notificationsEnabled: true },
};

const today = () => new Date().toISOString().slice(0, 10);
const omit = (obj, key) => { const { [key]: _, ...rest } = obj; return rest; };

export function createPlan({ id, countryCode, packVersion, pathwayId, treeAnswers = [], targetMoveDate, entryDate }) {
  if (!id || !countryCode || !pathwayId || !targetMoveDate) {
    throw new Error('a plan needs id, countryCode, pathwayId and targetMoveDate');
  }
  if (!packVersion) throw new Error('a plan must pin the pack version it was built against');
  return {
    id, countryCode, packVersion, pathwayId, treeAnswers,
    targetMoveDate,
    entryDate: entryDate ?? targetMoveDate,
    status: 'planning',
    createdAt: today(),
  };
}

export function reducer(state = INITIAL, action) {
  switch (action.type) {
    case 'HYDRATE': {
      // Persisted state from an older build may be missing keys entirely, so
      // merge over the defaults rather than trusting what came off disk.
      const saved = action.state ?? {};
      const plans = saved.plans ?? {};
      return { ...INITIAL, ...saved,
        plans,
        settings: { ...INITIAL.settings, ...(saved.settings ?? {}) },
        completed: saved.completed ?? {},
        documents: saved.documents ?? {},
        dismissed: saved.dismissed ?? {},
        activePlanId: plans[saved.activePlanId] ? saved.activePlanId : (Object.keys(plans)[0] ?? null) };
    }

    case 'PLAN_CREATED': {
      const plan = createPlan(action.plan);
      return { ...state,
        plans: { ...state.plans, [plan.id]: plan },
        activePlanId: plan.id,
        completed: { ...state.completed, [plan.id]: {} },
        documents: { ...state.documents, [plan.id]: {} },
        dismissed: { ...state.dismissed, [plan.id]: {} } };
    }

    case 'PLAN_ACTIVATED':
      return state.plans[action.planId] ? { ...state, activePlanId: action.planId } : state;

    case 'PLAN_DELETED': {
      if (!state.plans[action.planId]) return state;
      const plans = omit(state.plans, action.planId);
      const remaining = Object.keys(plans);
      return { ...state, plans,
        completed: omit(state.completed, action.planId),
        documents: omit(state.documents, action.planId),
        dismissed: omit(state.dismissed, action.planId),
        activePlanId: state.activePlanId === action.planId ? (remaining[0] ?? null) : state.activePlanId };
    }

    case 'PLAN_DATES_CHANGED': {
      const plan = state.plans[action.planId];
      if (!plan) return state;
      // Changing the move date re-times everything downstream. The screens are
      // expected to show the diff rather than silently reshuffling the plan.
      return { ...state, plans: { ...state.plans, [action.planId]: {
        ...plan,
        targetMoveDate: action.targetMoveDate ?? plan.targetMoveDate,
        entryDate: action.entryDate ?? plan.entryDate,
      } } };
    }

    case 'PLAN_STATUS_CHANGED': {
      const plan = state.plans[action.planId];
      if (!plan) return state;
      return { ...state, plans: { ...state.plans, [action.planId]: { ...plan, status: action.status } } };
    }

    case 'TASK_COMPLETED': {
      if (!state.plans[action.planId]) return state;
      const forPlan = state.completed[action.planId] ?? {};
      if (forPlan[action.taskKey]) return state;
      return { ...state, completed: { ...state.completed,
        [action.planId]: { ...forPlan, [action.taskKey]: action.on ?? today() } } };
    }

    case 'TASK_UNCOMPLETED': {
      const forPlan = state.completed[action.planId];
      if (!forPlan?.[action.taskKey]) return state;
      return { ...state, completed: { ...state.completed,
        [action.planId]: omit(forPlan, action.taskKey) } };
    }

    case 'DOCUMENT_RECORDED': {
      if (!state.plans[action.planId]) return state;
      if (!action.issuedOn) throw new Error('a recorded document needs an issue date — that is what the expiry check runs on');
      return { ...state, documents: { ...state.documents,
        [action.planId]: { ...(state.documents[action.planId] ?? {}),
          [action.taskKey]: { issuedOn: action.issuedOn, note: action.note ?? '' } } } };
    }

    case 'DOCUMENT_REMOVED': {
      const forPlan = state.documents[action.planId];
      if (!forPlan?.[action.taskKey]) return state;
      return { ...state, documents: { ...state.documents, [action.planId]: omit(forPlan, action.taskKey) } };
    }

    case 'ALERT_DISMISSED':
      return { ...state, dismissed: { ...state.dismissed,
        [action.planId]: { ...(state.dismissed[action.planId] ?? {}), [action.alertId]: true } } };

    case 'PACK_UPDATE_ACCEPTED': {
      const plan = state.plans[action.planId];
      if (!plan || !action.packVersion) return state;
      return { ...state, plans: { ...state.plans,
        [action.planId]: { ...plan, packVersion: action.packVersion, packUpdatedOn: today() } } };
    }

    case 'SETTINGS_CHANGED':
      return { ...state, settings: { ...state.settings, ...action.settings } };

    default:
      return state;   // same reference, so React does not re-render
  }
}

/* ------------------------------------------------------------- selectors */

export const selectActivePlan = state => state.plans[state.activePlanId] ?? null;

/** The arguments buildPlan() needs, assembled from stored state. */
export function selectPlanInputs(state, planId) {
  const plan = state.plans[planId];
  if (!plan) return null;
  return {
    pathwayId: plan.pathwayId,
    targetMoveDate: plan.targetMoveDate,
    entryDate: plan.entryDate,
    heldDocuments: state.documents[planId] ?? {},
  };
}

export const isComplete = (state, planId, taskKey) => Boolean(state.completed[planId]?.[taskKey]);

export const completedCount = (state, planId) => Object.keys(state.completed[planId] ?? {}).length;

/**
 * Whether a newer pack has shipped than the one this plan is pinned to.
 * Returned rather than applied: an update mid-move is a reviewed event.
 */
export function pendingPackUpdate(state, planId, manifest) {
  const plan = state.plans[planId];
  if (!plan) return null;
  const entry = manifest.find(m => m.code === plan.countryCode);
  if (!entry) return null;
  const cmp = v => v.split('.').map(Number);
  const [a, b] = [cmp(entry.version), cmp(plan.packVersion)];
  const newer = a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] > b[2];
  return newer ? { from: plan.packVersion, to: entry.version, country: entry.country } : null;
}
