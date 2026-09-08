// The plan engine.
//
// Turns a country pack plus one person's answers into a dated, dependency-ordered
// task list. Pure functions, no dependencies, no I/O — so the same module runs in
// Node, in the React Native app, and in a test.
//
// The thing this does that no competitor does is shelf-life backward scheduling:
// telling someone NOT to order a document yet, because it expires before the day
// it gets consumed. That failure — a criminal record check ordered five months too
// early — is one of the most expensive and most common in the whole category.

const DAY = 86400000;
const SAFETY_DAYS = 7;              // breathing room at each end of an order window
const MAX_RECURRENCES = 8;          // how many future instances of a repeating task to emit

/* ------------------------------------------------------------------ dates */

export const toUTC  = iso => new Date(`${iso}T00:00:00Z`);
export const toISO  = d   => d.toISOString().slice(0, 10);
export const addDays = (iso, n) => toISO(new Date(toUTC(iso).getTime() + n * DAY));
export const diffDays = (from, to) => Math.round((toUTC(to) - toUTC(from)) / DAY);
const min = (a, b) => (a == null ? b : b == null ? a : a < b ? a : b);
const max = (a, b) => (a == null ? b : b == null ? a : a > b ? a : b);

/**
 * Parses a module window like "T-150 to T-60 days" into day offsets relative to
 * the move date. Returns null for the non-dated phases ("Continuous",
 * "Have this before you need it"), which are real and deliberately undated.
 */
export function parseWindow(text) {
  const m = /^T([+-])(\d+)\s+to\s+T([+-])(\d+)\s+days?$/i.exec((text ?? '').trim());
  if (!m) return null;
  // `|| 0` normalises negative zero, which is not deep-equal to 0.
  const from = (m[1] === '-' ? -1 : 1) * Number(m[2]) || 0;
  const to   = (m[3] === '-' ? -1 : 1) * Number(m[4]) || 0;
  return from <= to ? { from, to } : { from: to, to: from };
}

/** Next occurrence of an annual MM-DD window, on or after `after`. */
function nextAnnualWindow(after, { from, to }) {
  const year = Number(after.slice(0, 4));
  for (const y of [year, year + 1]) {
    const start = `${y}-${from}`;
    let end = `${y}-${to}`;
    if (end < start) end = `${y + 1}-${to}`;   // window straddles new year
    if (end >= after) return { start, end };
  }
  return null;
}

/* ------------------------------------------------------- item collection */

const appliesToPathway = (list, pathwayId) =>
  !list?.length || list.includes('*') || list.includes(pathwayId);

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

/** Flattens the pack's modules into schedulable items for one pathway. */
function collectItems(pack, pathwayId) {
  const out = [];
  for (const mod of pack.modules ?? []) {
    if (!appliesToPathway(mod.appliesTo, pathwayId)) continue;
    const win = parseWindow(mod.window);
    mod.items.forEach((item, i) => {
      if (!appliesToPathway(item.appliesTo, pathwayId)) return;
      out.push({
        key: item.key ?? `${mod.id}.${slug(item.task)}`,
        sourceRef: `modules.${mod.id}.items[${i}]`,
        title: item.task,
        detail: item.detail ?? '',
        why: item.why ?? '',
        critical: item.critical === true,
        phase: mod.phase,
        module: mod.id,
        moduleTitle: mod.title,
        window: win,
        windowText: mod.window ?? '',
        schedule: item.schedule ?? {},
        sourceIds: item.sourceIds ?? [],
      });
    });
  }
  return out;
}

/* --------------------------------------------------------- dependencies */

/** Kahn's algorithm. Returns ordered keys, or throws naming the cycle. */
function topoSort(items) {
  const byKey = new Map(items.map(i => [i.key, i]));
  const indegree = new Map(items.map(i => [i.key, 0]));
  const dependents = new Map(items.map(i => [i.key, []]));

  for (const item of items) {
    for (const dep of item.schedule.dependsOn ?? []) {
      if (!byKey.has(dep)) continue;                  // dep filtered out by pathway
      indegree.set(item.key, indegree.get(item.key) + 1);
      dependents.get(dep).push(item.key);
    }
  }

  const queue = items.filter(i => indegree.get(i.key) === 0).map(i => i.key);
  const order = [];
  while (queue.length) {
    const key = queue.shift();
    order.push(key);
    for (const next of dependents.get(key)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  if (order.length !== items.length) {
    const stuck = items.filter(i => !order.includes(i.key)).map(i => i.key);
    throw new Error(`dependency cycle among: ${stuck.join(', ')}`);
  }
  return order;
}

/* ------------------------------------------------------------ the engine */

/**
 * @param pack  a validated country pack
 * @param opts  { pathwayId, targetMoveDate, entryDate?, today?, heldDocuments? }
 *              heldDocuments maps an item key to { issuedOn } for documents the
 *              user already has — used to warn when one will expire too early.
 */
export function buildPlan(pack, opts) {
  const { pathwayId, targetMoveDate } = opts;
  if (!pathwayId) throw new Error('pathwayId is required');
  if (!targetMoveDate) throw new Error('targetMoveDate is required');

  const today = opts.today ?? toISO(new Date());
  const entryDate = opts.entryDate ?? targetMoveDate;
  const held = opts.heldDocuments ?? {};
  const pathway = (pack.pathways ?? []).find(p => p.id === pathwayId);
  if (!pathway) throw new Error(`unknown pathway "${pathwayId}" in ${pack.meta.country}`);

  const items = collectItems(pack, pathwayId);
  const byKey = new Map(items.map(i => [i.key, i]));
  const order = topoSort(items);
  const tasks = new Map();
  const alerts = [];

  // --- pass 1: place every task from its module window and its dependencies ---
  for (const key of order) {
    const item = byKey.get(key);
    const s = item.schedule;
    const duration = s.durationDays ?? 0;

    let earliest = null, latest = null, kind = 'once';

    if (item.window) {
      earliest = addDays(targetMoveDate, item.window.from);
      latest   = addDays(targetMoveDate, item.window.to);
    } else {
      kind = item.phase === 'ongoing' ? 'ongoing' : 'contingency';
    }

    // A task cannot start before everything it depends on has finished.
    for (const dep of s.dependsOn ?? []) {
      const depTask = tasks.get(dep);
      if (!depTask?.finishBy) continue;
      earliest = max(earliest, depTask.finishBy);
      if (latest && latest < earliest) latest = earliest;
    }

    // Annual calendar windows (work permit renewals, quota filings) are absolute,
    // not relative to anyone's move date.
    if (s.absoluteWindow) {
      const win = nextAnnualWindow(today, s.absoluteWindow);
      if (win) { earliest = win.start; latest = win.end; kind = 'annual'; }
    }

    tasks.set(key, {
      key, sourceRef: item.sourceRef, title: item.title, detail: item.detail,
      why: item.why, critical: item.critical, phase: item.phase, module: item.module,
      moduleTitle: item.moduleTitle, windowText: item.windowText, sourceIds: item.sourceIds,
      kind, earliestStart: earliest, latestStart: latest,
      finishBy: latest ? addDays(latest, duration) : null,
      durationDays: duration,
      dependsOn: (s.dependsOn ?? []).filter(d => byKey.has(d)),
      warnings: [], state: 'scheduled',
    });
  }

  // --- pass 2: shelf-life backward scheduling (the differentiator) ---
  for (const item of items) {
    const s = item.schedule;
    if (!s.shelfLifeDays) continue;
    const task = tasks.get(item.key);

    if (!s.consumedBy) {
      task.warnings.push('has a shelf life but names no consuming task, so it cannot be timed');
      continue;
    }
    const consumer = tasks.get(s.consumedBy);
    if (!consumer) {
      task.warnings.push(`is consumed by "${s.consumedBy}", which is not in this pathway`);
      continue;
    }

    // It must still be valid on the day it is used, and must arrive in time.
    const consumedOn = consumer.latestStart ?? consumer.earliestStart;
    if (!consumedOn) continue;

    const orderFrom = addDays(consumedOn, -s.shelfLifeDays + SAFETY_DAYS);
    const orderTo   = addDays(consumedOn, -(task.durationDays + SAFETY_DAYS));

    task.shelfLife = {
      days: s.shelfLifeDays,
      consumedBy: s.consumedBy,
      consumedByTitle: consumer.title,
      consumedOn,
      orderWindow: { from: orderFrom, to: orderTo },
    };

    if (orderFrom > orderTo) {
      task.state = 'infeasible';
      task.warnings.push(
        `cannot be timed: it is valid for ${s.shelfLifeDays} days but takes ${task.durationDays} days to obtain, ` +
        `and is needed on ${consumedOn}`
      );
    } else {
      // The shelf life binds harder than the module window. Use it.
      task.earliestStart = orderFrom;
      task.latestStart = orderTo;
      task.finishBy = addDays(orderTo, task.durationDays);
    }

    // If they already hold the document, will it still be valid when it is used?
    const holding = held[item.key];
    if (holding?.issuedOn) {
      const expiresOn = addDays(holding.issuedOn, s.shelfLifeDays);
      task.held = { issuedOn: holding.issuedOn, expiresOn };
      if (expiresOn < consumedOn) {
        task.state = 'reorder';
        task.warnings.push(
          `the one you hold was issued ${holding.issuedOn} and expires ${expiresOn}, ` +
          `before it is needed on ${consumedOn} — you will have to obtain it again`
        );
        alerts.push({
          severity: 'high', key: item.key, kind: 'document-expiry',
          message: `Your ${item.title.toLowerCase()} expires ${expiresOn}, before it is needed on ${consumedOn}.`,
        });
      } else {
        task.state = 'done';
      }
    }
  }

  // --- pass 3: recurring obligations and day counters ---
  const recurring = [];
  for (const item of items) {
    const s = item.schedule;

    if (s.recurrence?.everyDays) {
      const anchor = s.recurrence.from === 'move' ? targetMoveDate : entryDate;
      for (let n = 1; n <= MAX_RECURRENCES; n++) {
        const due = addDays(anchor, s.recurrence.everyDays * n);
        recurring.push({
          key: `${item.key}#${n}`, parentKey: item.key, title: item.title,
          detail: item.detail, phase: item.phase, module: item.module,
          critical: item.critical, kind: 'recurring', occurrence: n,
          earliestStart: addDays(due, -(s.recurrence.windowDays ?? 14)),
          latestStart: due, dueDate: due, sourceIds: item.sourceIds,
          warnings: [], state: due < today ? 'overdue' : 'scheduled',
        });
      }
    }

    if (s.dayCounter?.threshold) {
      const crossOn = addDays(entryDate, s.dayCounter.threshold);
      const warnOn = addDays(crossOn, -(s.dayCounter.warnBefore ?? 30));
      const task = tasks.get(item.key);
      task.dayCounter = { threshold: s.dayCounter.threshold, crossOn, warnOn, label: s.dayCounter.label };
      task.earliestStart = min(task.earliestStart, warnOn);
      task.latestStart = crossOn;
      task.kind = 'threshold';
      alerts.push({
        severity: today >= warnOn ? 'high' : 'info',
        key: item.key, kind: 'day-counter', date: crossOn,
        message: s.dayCounter.label ??
          `You reach ${s.dayCounter.threshold} days in ${pack.meta.country} on ${crossOn}.`,
      });
    }
  }

  // --- pass 4: states, relative to today ---
  const all = [...tasks.values(), ...recurring];
  for (const t of all) {
    if (t.state === 'done' || t.state === 'infeasible' || t.state === 'reorder') continue;
    if (t.kind === 'ongoing' || t.kind === 'contingency') { t.state = t.kind; continue; }

    const unmet = (t.dependsOn ?? []).filter(d => {
      const dep = tasks.get(d);
      return dep && dep.state !== 'done';
    });
    if (unmet.length) t.blockedBy = unmet;
    // A shelf-life task always reports as waiting rather than locked: "don't
    // order this yet, order between X and Y" is more actionable than "blocked".
    if (unmet.length && !t.shelfLife && t.earliestStart > today) { t.state = 'locked'; continue; }

    if (t.latestStart && t.latestStart < today) t.state = 'overdue';
    else if (t.earliestStart && t.earliestStart > today) t.state = 'waiting';
    else t.state = 'ready';
  }

  // --- feasibility: is this move date actually achievable? ---
  const infeasible = all.filter(t => t.state === 'infeasible');
  const overdue = all.filter(t => t.state === 'overdue' && t.critical);
  let feasibility = { ok: infeasible.length === 0 && overdue.length === 0, problems: [] };

  for (const t of infeasible) {
    feasibility.problems.push({ key: t.key, title: t.title, reason: t.warnings[0] });
  }
  if (overdue.length) {
    // The binding constraint is the critical task whose window closed longest ago.
    const worst = overdue.reduce((a, b) => (a.latestStart < b.latestStart ? a : b));
    const slip = diffDays(worst.latestStart, today);
    feasibility.problems.push({
      key: worst.key, title: worst.title,
      reason: `its window closed ${slip} day(s) ago`,
    });
    feasibility.earliestFeasibleMoveDate = addDays(targetMoveDate, slip);
  }

  const sortKey = t => t.latestStart ?? t.earliestStart ?? '9999-12-31';
  all.sort((a, b) => sortKey(a).localeCompare(sortKey(b)) || a.title.localeCompare(b.title));

  return {
    country: pack.meta.country,
    packVersion: pack.meta.version,
    pathway: { id: pathway.id, name: pathway.name },
    targetMoveDate, entryDate, today,
    tasks: all,
    alerts,
    feasibility,
    summary: {
      total: all.length,
      ready: all.filter(t => t.state === 'ready').length,
      waiting: all.filter(t => t.state === 'waiting').length,
      locked: all.filter(t => t.state === 'locked').length,
      overdue: all.filter(t => t.state === 'overdue').length,
      infeasible: infeasible.length,
      critical: all.filter(t => t.critical).length,
    },
  };
}

/** The Today screen: what is actionable now, what is next, what is wrong. */
export function todayView(plan, limit = 5) {
  const by = state => plan.tasks.filter(t => t.state === state);
  return {
    doNow: by('ready').sort((a, b) => (b.critical - a.critical)).slice(0, limit),
    doNotYet: by('waiting')
      .filter(t => t.shelfLife)
      .sort((a, b) => a.earliestStart.localeCompare(b.earliestStart))
      .slice(0, limit),
    overdue: by('overdue'),
    problems: plan.feasibility.problems,
    alerts: plan.alerts.filter(a => a.severity === 'high'),
  };
}
