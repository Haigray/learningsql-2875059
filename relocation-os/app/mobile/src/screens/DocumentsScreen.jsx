import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { usePlan } from '../PlanContext';
import { Screen, Header, Section, Card, Empty, Pill, Button } from '../components/ui';
import { useTheme, space, type, radius } from '../theme';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Documents matter here only because of what expires. Everything else is a file. */
export default function DocumentsScreen() {
  const c = useTheme();
  const { plan, built, documents, dispatch } = usePlan();
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');

  const tracked = useMemo(
    () => (built?.tasks ?? []).filter(t => t.shelfLife || t.state === 'reorder'),
    [built]);

  if (!built) return <Screen><Header title="Documents" /><Empty title="No plan yet" /></Screen>;

  const save = key => {
    if (!ISO.test(draft)) return;                    // a bad date is worse than none
    dispatch({ type: 'DOCUMENT_RECORDED', planId: plan.id, taskKey: key, issuedOn: draft });
    setEditing(null); setDraft('');
  };

  return (
    <Screen>
      <Header title="Documents" subtitle="What expires, and whether it lasts long enough" />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl * 2 }}>
        <Section title="Dated documents"
          note="Record the issue date and the plan checks it against the day the document is actually consumed.">
          {tracked.length === 0 ? (
            <Empty title="Nothing on this pathway expires" body="Not every route depends on a dated document." />
          ) : null}

          {tracked.map(t => {
            const held = documents[t.key];
            const bad = t.state === 'reorder';
            return (
              <Card key={t.key} accent={bad ? c.danger : held ? c.ok : c.lineStrong}>
                <Text style={[type.h3, { color: c.ink }]}>{t.title}</Text>

                <View style={{ flexDirection: 'row', gap: space.xs, marginTop: space.sm, flexWrap: 'wrap' }}>
                  {t.shelfLife ? <Pill text={`Valid ${t.shelfLife.days} days`} /> : null}
                  {t.shelfLife ? <Pill text={`Needed ${t.shelfLife.consumedOn}`} tone="warn" /> : null}
                  {held ? <Pill text={`Issued ${held.issuedOn}`} tone={bad ? 'danger' : 'ok'} /> : null}
                </View>

                {bad ? (
                  <Text style={[type.small, { color: c.danger, marginTop: space.sm }]}>
                    {t.warnings[0]}
                  </Text>
                ) : held ? (
                  <Text style={[type.small, { color: c.ok, marginTop: space.sm }]}>
                    Still valid when it is needed.
                  </Text>
                ) : t.shelfLife ? (
                  <Text style={[type.small, { color: c.muted, marginTop: space.sm }]}>
                    Order between {t.shelfLife.orderWindow.from} and {t.shelfLife.orderWindow.to}.
                  </Text>
                ) : null}

                {editing === t.key ? (
                  <View style={{ marginTop: space.md }}>
                    <TextInput
                      value={draft} onChangeText={setDraft} placeholder="YYYY-MM-DD"
                      placeholderTextColor={c.faint} autoCapitalize="none" keyboardType="numbers-and-punctuation"
                      style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: c.lineStrong,
                               borderRadius: radius.sm, padding: space.md, color: c.ink,
                               backgroundColor: c.bg, marginBottom: space.sm }} />
                    <Button title="Save issue date" onPress={() => save(t.key)} />
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.md }}>
                    <Pressable onPress={() => { setEditing(t.key); setDraft(held?.issuedOn ?? ''); }} hitSlop={8}>
                      <Text style={[type.small, { color: c.accent, fontWeight: '700' }]}>
                        {held ? 'Change issue date' : 'I already have this'}
                      </Text>
                    </Pressable>
                    {held ? (
                      <Pressable hitSlop={8}
                        onPress={() => dispatch({ type: 'DOCUMENT_REMOVED', planId: plan.id, taskKey: t.key })}>
                        <Text style={[type.small, { color: c.faint }]}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </Card>
            );
          })}
        </Section>

        <Section title="Storing the files themselves">
          <Card>
            <Text style={[type.small, { color: c.muted }]}>
              This build tracks dates only. Scans of a passport or a criminal record check are
              sensitive enough that they should be encrypted at rest and easy to delete, so file
              storage is deliberately a later step rather than a quick one.
            </Text>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
