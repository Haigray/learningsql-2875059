// Turns a built plan into dated notification requests.
//
// Pure: it produces the requests, and the app layer hands them to Expo's
// scheduler. That separation is what makes the wording testable, and the wording
// is the product — "your check expires before it is needed" has to be a sentence
// someone acts on at a glance.

const DAY = 86400000;
const iso = d => d.toISOString().slice(0, 10);
const addDays = (date, n) => iso(new Date(new Date(`${date}T00:00:00Z`).getTime() + n * DAY));
const diffDays = (from, to) =>
  Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / DAY);
const pretty = d => new Date(`${d}T00:00:00Z`)
  .toLocaleDateString('en-US', { day: 'numeric', month: 'long', timeZone: 'UTC' });

const LEAD_DAYS = [30, 7];          // ordinary reminders before a critical deadline
const CLOSING_SOON = 10;            // days before a shelf-life order window shuts
const RECURRING_LEAD = 14;

/**
 * @param plan     output of buildPlan()
 * @param options  { now, includePast, completed } — completed is a { taskKey: date } map
 * @returns notification requests, earliest first, de-duplicated by id
 */
export function deriveNotifications(plan, options = {}) {
  const now = options.now ?? iso(new Date());
  const completed = options.completed ?? {};
  const out = [];
  const push = n => out.push(n);
  const country = plan.country;

  for (const task of plan.tasks) {
    if (completed[task.key]) continue;

    /* A document you already hold that will expire too early. Nothing else in
       the app is more urgent, because it silently invalidates work already done. */
    if (task.state === 'reorder' && task.held) {
      push({
        id: `${task.key}:reorder`, at: now, priority: 'high', category: 'document-expiry',
        taskKey: task.key,
        title: `Re-order: ${task.title}`,
        body: `The one you hold expires ${pretty(task.held.expiresOn)}, before it is needed on ` +
              `${pretty(task.shelfLife.consumedOn)}. You will have to obtain it again.`,
      });
      continue;
    }

    /* Shelf-life windows — the reason someone keeps this app installed. */
    if (task.shelfLife && task.earliestStart && task.latestStart) {
      const { from, to } = task.shelfLife.orderWindow;
      if (from >= now) {
        push({
          id: `${task.key}:window-open`, at: from, priority: 'high', category: 'shelf-life',
          taskKey: task.key,
          title: `Now order: ${task.title}`,
          body: `Not before today — it is valid for ${task.shelfLife.days} days and is needed on ` +
                `${pretty(task.shelfLife.consumedOn)}. Order it between now and ${pretty(to)}.`,
        });
      }
      const closing = addDays(to, -CLOSING_SOON);
      if (closing >= now && closing > from) {
        push({
          id: `${task.key}:window-closing`, at: closing, priority: 'high', category: 'shelf-life',
          taskKey: task.key,
          title: `Order now: ${task.title}`,
          body: `The window to order this closes ${pretty(to)}. After that it cannot arrive in time for ` +
                `${task.shelfLife.consumedByTitle.toLowerCase()}.`,
        });
      }
      continue;
    }

    /* Recurring obligations. */
    if (task.kind === 'recurring' && task.dueDate) {
      const at = addDays(task.dueDate, -RECURRING_LEAD);
      if (at >= now) {
        push({
          id: `${task.key}:due`, at, priority: 'normal', category: 'recurring',
          taskKey: task.parentKey ?? task.key,
          title: task.title,
          body: `Due ${pretty(task.dueDate)} in ${country}. This one repeats — the next falls due after it.`,
        });
      }
      continue;
    }

    /* Day-count thresholds that change your legal position. */
    if (task.dayCounter) {
      const { warnOn, crossOn, label } = task.dayCounter;
      if (warnOn >= now) {
        push({
          id: `${task.key}:threshold`, at: warnOn, priority: 'high', category: 'threshold',
          taskKey: task.key,
          title: `30 days to a change in your tax position`,
          body: label ?? `You reach the residency threshold in ${country} on ${pretty(crossOn)}.`,
        });
      }
      continue;
    }

    /* Ordinary deadlines. Only critical ones get a notification — everything
       else lives on the Today screen, because a phone that buzzes for all 59
       tasks is a phone with notifications turned off. */
    if (task.critical && task.latestStart) {
      for (const lead of LEAD_DAYS) {
        const at = addDays(task.latestStart, -lead);
        if (at < now) continue;
        push({
          id: `${task.key}:lead${lead}`, at, priority: lead <= 7 ? 'high' : 'normal',
          category: 'deadline', taskKey: task.key,
          title: task.title,
          body: `Due ${pretty(task.latestStart)} — ${lead} days from this reminder.` +
                (task.blockedBy?.length ? ' Something it depends on is still outstanding.' : ''),
        });
      }
      const overdue = addDays(task.latestStart, 1);
      if (overdue >= now) {
        push({
          id: `${task.key}:overdue`, at: overdue, priority: 'high', category: 'overdue',
          taskKey: task.key,
          title: `Overdue: ${task.title}`,
          body: `This was due ${pretty(task.latestStart)}. Later steps in your plan depend on it.`,
        });
      }
    }
  }

  /* Arrival day: the address-registration rules with hour-scale deadlines. */
  const arrivalRule = plan.tasks.find(t =>
    t.phase === 'arrival' && /within 12 hours|within 24 hours|TM30|temporary residence/i.test(
      `${t.title} ${t.detail ?? ''}`));
  if (arrivalRule && plan.entryDate >= now) {
    push({
      id: 'arrival:address-registration', at: plan.entryDate, priority: 'high', category: 'arrival',
      taskKey: arrivalRule.key,
      title: 'Address registration — hours, not days',
      body: `${arrivalRule.title}. Confirm today that whoever hosts you has actually filed it.`,
    });
  }

  const seen = new Set();
  return out
    .filter(n => (options.includePast || n.at >= now) && !seen.has(n.id) && seen.add(n.id))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

/** Groups the next notifications for an "upcoming" screen. */
export function upcoming(notifications, now, withinDays = 90) {
  const until = addDays(now, withinDays);
  return notifications.filter(n => n.at >= now && n.at <= until);
}
