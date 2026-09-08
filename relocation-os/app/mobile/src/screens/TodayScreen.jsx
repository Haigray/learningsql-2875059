import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { usePlan } from '../PlanContext';
import { Screen, Header, Section, Card, TaskCard, Empty, Pill, Button } from '../components/ui';
import { useTheme, space, type, radius } from '../theme';

export default function TodayScreen({ navigation }) {
  const c = useTheme();
  const { plan, pack, built, view, completed, dispatch, pendingUpdate } = usePlan();

  if (!plan || !built) {
    return (
      <Screen>
        <Header title="Today" />
        <Empty title="No plan yet"
               body="Pick a country and answer a few questions, and this becomes a dated plan." />
        <View style={{ paddingHorizontal: space.lg }}>
          <Button title="Start a plan" onPress={() => navigation.navigate('Setup')} />
        </View>
      </Screen>
    );
  }

  const toggle = key => dispatch({
    type: completed[key] ? 'TASK_UNCOMPLETED' : 'TASK_COMPLETED', planId: plan.id, taskKey: key });

  return (
    <Screen>
      <Header title="Today"
        subtitle={`${built.pathway.name} · ${pack.meta.country} · moving ${plan.targetMoveDate}`} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl * 2 }}>

        {pendingUpdate ? (
          <View style={{ margin: space.lg, padding: space.lg, borderRadius: radius.md,
                         backgroundColor: c.accentSoft, borderWidth: StyleSheet.hairlineWidth, borderColor: c.lineStrong }}>
            <Text style={[type.h3, { color: c.accent }]}>
              {pendingUpdate.country} guide updated to v{pendingUpdate.to}
            </Text>
            <Text style={[type.small, { color: c.muted, marginVertical: space.sm }]}>
              Your plan is pinned to v{pendingUpdate.from}. Rules change, so review what moved before
              your schedule does — nothing is applied until you accept it.
            </Text>
            <Button title="Review and apply" onPress={() => navigation.navigate('Guide', { showChangelog: true })} />
          </View>
        ) : null}

        {!built.feasibility.ok ? (
          <Card accent={c.danger} style={{ margin: space.lg, marginBottom: 0 }}>
            <Text style={[type.h3, { color: c.danger }]}>This move date does not work</Text>
            {built.feasibility.problems.map(p => (
              <Text key={p.key} style={[type.small, { color: c.muted, marginTop: space.xs }]}>
                {p.title} — {p.reason}
              </Text>
            ))}
            {built.feasibility.earliestFeasibleMoveDate ? (
              <Text style={[type.body, { color: c.ink, marginTop: space.sm }]}>
                Earliest date that works: {built.feasibility.earliestFeasibleMoveDate}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {view.overdue.length ? (
          <Section title="Overdue">
            {view.overdue.map(t => (
              <TaskCard key={t.key} task={t} done={!!completed[t.key]} onToggle={() => toggle(t.key)} />
            ))}
          </Section>
        ) : null}

        <Section title="Do now"
          note={view.doNow.length ? null : 'Nothing is actionable today. That is a real answer — you are early.'}>
          {view.doNow.map(t => (
            <TaskCard key={t.key} task={t} done={!!completed[t.key]} onToggle={() => toggle(t.key)} />
          ))}
        </Section>

        {/* The screen nobody else has: what to deliberately NOT do yet. */}
        {view.doNotYet.length ? (
          <Section title="Do not order yet"
            note="These expire before they would be needed. Ordering early wastes them as surely as forgetting.">
            {view.doNotYet.map(t => (
              <TaskCard key={t.key} task={t} done={!!completed[t.key]} onToggle={() => toggle(t.key)} />
            ))}
          </Section>
        ) : null}

        {view.alerts.length ? (
          <Section title="Alerts">
            {view.alerts.map((a, i) => (
              <Card key={a.key ?? i} accent={c.warn}>
                <Text style={[type.body, { color: c.ink }]}>{a.message}</Text>
                {a.date ? <View style={{ marginTop: space.sm, flexDirection: 'row' }}>
                  <Pill text={a.date} tone="warn" /></View> : null}
              </Card>
            ))}
          </Section>
        ) : null}

        <Section title="Progress">
          <Card>
            <Text style={[type.body, { color: c.muted }]}>
              {Object.keys(completed).length} of {built.summary.total} done ·{' '}
              {built.summary.ready} ready · {built.summary.waiting} not yet ·{' '}
              {built.summary.locked} blocked
            </Text>
            <Text style={[type.small, { color: c.faint, marginTop: space.xs }]}>
              Pack v{plan.packVersion}, verified {pack.meta.verifiedAsOf}
            </Text>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
