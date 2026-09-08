import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { usePlan } from '../PlanContext';
import { Screen, Header, Section, Card, Pill, Empty, Button } from '../components/ui';
import { useTheme, space, type, radius } from '../theme';

/** The reference layer: the pack's own words, offline, with its citations. */
export default function GuideScreen({ route }) {
  const c = useTheme();
  const { plan, pack, dispatch, pendingUpdate } = usePlan();
  const [tab, setTab] = useState(route?.params?.showChangelog ? 'changes' : 'traps');

  if (!pack) return <Screen><Header title="Guide" /><Empty title="No plan yet" /></Screen>;

  const pathway = pack.pathways.find(p => p.id === plan.pathwayId);
  const TABS = [['traps', 'Traps'], ['verify', 'Verify'], ['contested', 'Disputed'],
                ['watch', 'Watching'], ['changes', 'Changes']];

  return (
    <Screen>
      <Header title={pack.meta.country}
        subtitle={`Pack v${plan.packVersion} · verified ${pack.meta.verifiedAsOf}`} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, padding: space.lg,
                     paddingBottom: 0 }}>
        {TABS.map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} hitSlop={6}
            style={{ borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill,
                     borderColor: tab === id ? c.accent : c.lineStrong,
                     backgroundColor: tab === id ? c.accentSoft : 'transparent',
                     paddingVertical: 6, paddingHorizontal: 12 }}>
            <Text style={[type.small, { color: tab === id ? c.accent : c.muted, fontWeight: '600' }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl * 2 }}>
        {pendingUpdate ? (
          <Section title="Update available">
            <Card accent={c.accent}>
              <Text style={[type.body, { color: c.ink }]}>
                v{pendingUpdate.from} → v{pendingUpdate.to}
              </Text>
              <Text style={[type.small, { color: c.muted, marginVertical: space.sm }]}>
                Applying this re-times your plan against the newer content. Read the changes below first.
              </Text>
              <Button title={`Apply v${pendingUpdate.to}`}
                onPress={() => dispatch({ type: 'PACK_UPDATE_ACCEPTED', planId: plan.id,
                                          packVersion: pendingUpdate.to })} />
            </Card>
          </Section>
        ) : null}

        {tab === 'traps' ? (
          <Section title="Traps" note="The cross-cutting failures, in severity order.">
            {(pack.gotchas ?? []).map(g => (
              <Card key={g.title} accent={g.severity === 'trip-ending' ? c.danger
                                          : g.severity === 'expensive' ? c.warn : c.lineStrong}>
                <Text style={[type.h3, { color: c.ink }]}>{g.title}</Text>
                <Text style={[type.small, { color: c.muted, marginTop: space.sm }]}>{g.trap}</Text>
                <Text style={[type.small, { color: c.ink, marginTop: space.sm }]}>
                  <Text style={{ fontWeight: '700' }}>Do this. </Text>{g.doThis}
                </Text>
              </Card>
            ))}
          </Section>
        ) : null}

        {tab === 'verify' ? (
          <Section title={`Verify ${pathway?.name ?? 'your pathway'} yourself`}
            note="Under an hour. This is the check that matters — not our word, and not an agency's.">
            {(pathway?.verification ?? []).map((v, i) => (
              <Card key={i} accent={c.accent}>
                <Text style={[type.h3, { color: c.ink }]}>{v.check}</Text>
                <Text style={[type.small, { color: c.muted, marginTop: space.sm }]}>
                  <Text style={{ fontWeight: '700' }}>Ask: </Text>{v.authority}
                </Text>
                <Text style={[type.small, { color: c.ink, marginTop: space.sm }]}>{v.how}</Text>
                {v.url ? <Text style={[type.small, { color: c.accent, marginTop: space.xs }]}>{v.url}</Text> : null}
                {v.expectAnswer ? (
                  <Text style={[type.small, { color: c.muted, marginTop: space.sm, fontStyle: 'italic' }]}>
                    A real answer sounds like: {v.expectAnswer}
                  </Text>
                ) : null}
              </Card>
            ))}
          </Section>
        ) : null}

        {tab === 'contested' ? (
          <Section title="Where sources disagree"
            note="Published rather than adjudicated. A guide that hides a real conflict is more dangerous than one that names it.">
            {(pack.contested ?? []).map(q => (
              <Card key={q.question}>
                <Text style={[type.h3, { color: c.ink }]}>{q.question}</Text>
                {q.positions.map((p, i) => (
                  <View key={i} style={{ marginTop: space.md, paddingLeft: space.md,
                                         borderLeftWidth: 2, borderLeftColor: c.lineStrong }}>
                    <Text style={[type.small, { color: c.ink }]}>{p.position}</Text>
                    <Text style={[type.small, { color: c.faint, marginTop: 2 }]}>Held by: {p.heldBy}</Text>
                  </View>
                ))}
                {q.practicalEffect ? (
                  <View style={{ backgroundColor: c.warnSoft, borderRadius: radius.sm,
                                 padding: space.md, marginTop: space.md }}>
                    <Text style={[type.small, { color: c.warn }]}>{q.practicalEffect}</Text>
                  </View>
                ) : null}
                <Text style={[type.small, { color: c.ink, marginTop: space.sm }]}>
                  <Text style={{ fontWeight: '700' }}>To settle it: </Text>{q.howToResolve}
                </Text>
              </Card>
            ))}
          </Section>
        ) : null}

        {tab === 'watch' ? (
          <Section title="Rules in motion"
            note="Each carries the date we next check it. When one lands, you get the updated pack.">
            {(pack.watchlist ?? []).map(w => (
              <Card key={w.title} accent={w.impact === 'pathway-changing' ? c.danger : c.warn}>
                <Text style={[type.h3, { color: c.ink }]}>{w.title}</Text>
                <View style={{ flexDirection: 'row', gap: space.xs, marginTop: space.sm, flexWrap: 'wrap' }}>
                  <Pill text={w.status.replace(/-/g, ' ')} tone="warn" />
                  <Pill text={`impact: ${w.impact.replace('-', ' ')}`} />
                  {w.checkBy ? <Pill text={`re-check ${w.checkBy}`} /> : null}
                </View>
                <Text style={[type.small, { color: c.muted, marginTop: space.sm }]}>{w.whatChanges}</Text>
              </Card>
            ))}
          </Section>
        ) : null}

        {tab === 'changes' ? (
          <Section title="Edition history">
            {(pack.changelog ?? []).map(e => (
              <Card key={e.version}>
                <Text style={[type.h3, { color: c.ink }]}>v{e.version} · {e.date}</Text>
                {e.summary ? <Text style={[type.small, { color: c.muted, marginTop: space.xs }]}>{e.summary}</Text> : null}
                {e.changes.map((ch, i) => (
                  <View key={i} style={{ marginTop: space.sm }}>
                    <Text style={[type.small, { color: c.ink }]}>· {ch.what}</Text>
                    {ch.actionRequired ? (
                      <Text style={[type.small, { color: c.accent, marginTop: 2 }]}>
                        What to do: {ch.actionRequired}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </Card>
            ))}
          </Section>
        ) : null}

        <Section title="Not advice">
          <Card>
            <Text style={[type.small, { color: c.muted }]}>
              Researched reference material, not legal or tax advice. No practitioner has reviewed it —
              which is why every pathway carries steps for verifying it yourself. Rules change without
              notice; this pack was verified {pack.meta.verifiedAsOf}.
            </Text>
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
