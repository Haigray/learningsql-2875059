import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { usePlan } from '../PlanContext';
import { Screen, Header, Section, Card, Button, Pill } from '../components/ui';
import { useTheme, space, type, radius } from '../theme';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Walks the pack's own decision tree — the same tree the printed guide uses. */
export default function SetupScreen({ navigation }) {
  const c = useTheme();
  const { packs, dispatch } = usePlan();
  const [pack, setPack] = useState(null);
  const [path, setPath] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [moveDate, setMoveDate] = useState('');

  const nodes = pack ? new Map(pack.tree.nodes.map(n => [n.id, n])) : null;
  const node = pack ? nodes.get(path[path.length - 1] ?? pack.tree.entry) : null;

  const choose = answer => { setAnswers(a => [...a, answer.label]); setPath(p => [...p, answer.next]); };
  const back = () => { setAnswers(a => a.slice(0, -1)); setPath(p => p.slice(0, -1)); };

  const start = pathwayId => {
    if (!ISO.test(moveDate)) return;
    dispatch({ type: 'PLAN_CREATED', plan: {
      id: `${pack.meta.countryCode}-${Date.now()}`,
      countryCode: pack.meta.countryCode,
      packVersion: pack.meta.version,      // pinned, so later updates are reviewed
      pathwayId, treeAnswers: answers,
      targetMoveDate: moveDate, entryDate: moveDate } });
    navigation.navigate('Today');
  };

  if (!pack) {
    return (
      <Screen>
        <Header title="Start a plan" subtitle="Pick a country" />
        <ScrollView>
          <Section title="Countries">
            {packs.map(p => (
              <Card key={p.meta.countryCode} onPress={() => setPack(p)}>
                <Text style={[type.h3, { color: c.ink }]}>{p.meta.country}</Text>
                <Text style={[type.small, { color: c.muted, marginTop: space.xs }]}>{p.meta.tagline}</Text>
                <View style={{ flexDirection: 'row', gap: space.xs, marginTop: space.sm }}>
                  <Pill text={`${p.pathways.length} pathways`} />
                  <Pill text={`verified ${p.meta.verifiedAsOf}`} />
                </View>
              </Card>
            ))}
          </Section>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={pack.meta.country}
        subtitle={answers.length ? answers[answers.length - 1] : 'Answer honestly, not optimistically'}
        right={path.length ? (
          <Pressable onPress={back} hitSlop={8}><Pill text="Back" tone="accent" /></Pressable>
        ) : null} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl * 2 }}>

        {node?.type === 'question' ? (
          <Section title="Question">
            <Text style={[type.h2, { color: c.ink, marginBottom: space.sm }]}>{node.question}</Text>
            {node.help ? (
              <Text style={[type.small, { color: c.muted, marginBottom: space.lg }]}>{node.help}</Text>
            ) : null}
            {node.answers.map(a => (
              <Card key={a.label} onPress={() => choose(a)}>
                <Text style={[type.body, { color: c.ink, fontWeight: '600' }]}>{a.label}</Text>
                {a.note ? (
                  <Text style={[type.small, { color: c.muted, marginTop: space.xs }]}>{a.note}</Text>
                ) : null}
              </Card>
            ))}
          </Section>
        ) : null}

        {node?.type === 'outcome' ? (() => {
          const pw = pack.pathways.find(p => p.id === node.pathwayId);
          return (
            <Section title="Your pathway">
              <Card accent={c.ok}>
                <Text style={[type.h2, { color: c.ink }]}>{pw.name}</Text>
                <Text style={[type.small, { color: c.muted, marginTop: space.sm }]}>{pw.summary}</Text>
              </Card>
              <Text style={[type.label, { color: c.faint, marginTop: space.lg, marginBottom: space.sm }]}>
                When do you plan to move?
              </Text>
              <TextInput value={moveDate} onChangeText={setMoveDate} placeholder="YYYY-MM-DD"
                placeholderTextColor={c.faint} autoCapitalize="none"
                style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: c.lineStrong,
                         borderRadius: radius.sm, padding: space.md, color: c.ink,
                         backgroundColor: c.surface, marginBottom: space.md }} />
              <Button title="Build my plan" onPress={() => start(pw.id)} />
            </Section>
          );
        })() : null}

        {node?.type === 'deadend' ? (
          <Section title="No pathway fits — the honest answer">
            <Card accent={c.danger}>
              <Text style={[type.body, { color: c.ink }]}>{node.verdict}</Text>
            </Card>
            {node.alternatives?.length ? (
              <>
                <Text style={[type.label, { color: c.faint, marginTop: space.lg, marginBottom: space.sm }]}>
                  What to actually consider
                </Text>
                {node.alternatives.map((a, i) => (
                  <Card key={i}><Text style={[type.small, { color: c.muted }]}>{a}</Text></Card>
                ))}
              </>
            ) : null}
            <View style={{ marginTop: space.lg }}>
              <Button title="Compare all three countries" tone="muted"
                onPress={() => navigation.navigate('Compare')} />
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
