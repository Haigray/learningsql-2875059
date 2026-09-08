import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { usePlan } from '../PlanContext';
import { Screen, Header, Card, TaskCard, Empty, Pill } from '../components/ui';
import { useTheme, space, type } from '../theme';

const PHASES = ['decide', 'documents', 'exit-origin', 'money', 'arrival', 'first-90-days', 'ongoing', 'contingency'];
const TITLES = {
  decide: 'Decide', documents: 'Documents', 'exit-origin': 'Leave the US', money: 'Money',
  arrival: 'Arrival', 'first-90-days': 'First 90 days', ongoing: 'Ongoing', contingency: 'Contingency',
};

export default function TimelineScreen() {
  const c = useTheme();
  const { plan, built, completed, dispatch } = usePlan();
  const [hideDone, setHideDone] = useState(false);

  const byPhase = useMemo(() => {
    if (!built) return [];
    return PHASES.map(phase => ({
      phase,
      tasks: built.tasks.filter(t => t.phase === phase && !(hideDone && completed[t.key])),
    })).filter(g => g.tasks.length);
  }, [built, completed, hideDone]);

  if (!built) return <Screen><Header title="Plan" /><Empty title="No plan yet" /></Screen>;

  const toggle = key => dispatch({
    type: completed[key] ? 'TASK_UNCOMPLETED' : 'TASK_COMPLETED', planId: plan.id, taskKey: key });

  return (
    <Screen>
      <Header title="Plan" subtitle={`${built.tasks.length} tasks · ${built.pathway.name}`}
        right={
          <Pressable onPress={() => setHideDone(v => !v)} hitSlop={8}>
            <Pill text={hideDone ? 'Show done' : 'Hide done'} tone="accent" />
          </Pressable>
        } />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl * 2 }}>
        {byPhase.map(({ phase, tasks }) => (
          <View key={phase} style={{ marginTop: space.xl, paddingHorizontal: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
              <Text style={[type.label, { color: c.faint, flex: 1 }]}>{TITLES[phase]}</Text>
              <Text style={[type.small, { color: c.faint }]}>
                {tasks.filter(t => completed[t.key]).length}/{tasks.length}
              </Text>
            </View>
            {tasks[0]?.windowText ? (
              <Text style={[type.small, { color: c.accent, marginBottom: space.sm }]}>{tasks[0].windowText}</Text>
            ) : null}
            {tasks.map(t => (
              <TaskCard key={t.key} task={t} done={!!completed[t.key]} onToggle={() => toggle(t.key)} />
            ))}
          </View>
        ))}
        <Card style={{ margin: space.lg }}>
          <Text style={[type.small, { color: c.faint }]}>
            Dates are computed from your move date and each document's shelf life. Change the move
            date in Settings and everything below it re-times.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
