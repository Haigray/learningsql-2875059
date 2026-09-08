import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { usePlan } from '../PlanContext';
import { Screen, Header, Section, Card, Pill, Empty } from '../components/ui';
import { useTheme, space, type, radius } from '../theme';
import { compareCountries } from '../../../engine/compare.mjs';
import PROFILES from '../data/profiles';

/** Answers the question that comes before a plan: which country at all? */
export default function CompareScreen() {
  const c = useTheme();
  const { packs } = usePlan();
  const [i, setI] = useState(0);

  const result = useMemo(() => compareCountries(packs, PROFILES[i]), [packs, i]);
  const v = result.verdict;

  return (
    <Screen>
      <Header title="Compare" subtitle="Which country has a door open for you" />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxl * 2 }}>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs,
                       paddingHorizontal: space.lg, paddingTop: space.lg }}>
          {PROFILES.map((p, idx) => (
            <Pressable key={p.label} onPress={() => setI(idx)} hitSlop={6}
              style={{ borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill,
                       borderColor: idx === i ? c.accent : c.lineStrong,
                       backgroundColor: idx === i ? c.accentSoft : 'transparent',
                       paddingVertical: 6, paddingHorizontal: 12 }}>
              <Text style={[type.small, { color: idx === i ? c.accent : c.muted, fontWeight: '600' }]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Section title="Best fit">
          <Card accent={v.recommended ? c.ok : c.warn}>
            {v.recommended ? (
              <>
                <Text style={[type.h2, { color: c.ink }]}>{v.recommended}</Text>
                <Text style={[type.body, { color: c.muted, marginTop: 2 }]}>{v.pathway}</Text>
              </>
            ) : (
              <Text style={[type.h2, { color: c.ink }]}>Nothing open, yet</Text>
            )}
            <Text style={[type.small, { color: c.muted, marginTop: space.sm }]}>{v.reason}</Text>
            {v.warnings.map((w, k) => (
              <View key={k} style={{ backgroundColor: c.warnSoft, borderRadius: radius.sm,
                                     padding: space.md, marginTop: space.sm }}>
                <Text style={[type.small, { color: c.warn }]}>{w}</Text>
              </View>
            ))}
          </Card>
        </Section>

        <Section title="By country">
          {result.countries.map(country => (
            <Card key={country.code} accent={country.open.length ? c.ok : c.lineStrong}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <Text style={[type.h3, { color: c.ink, flex: 1 }]}>{country.country}</Text>
                <Text style={[type.small, { color: c.faint }]}>
                  {country.open.length} open · {country.closed.length} closed
                </Text>
              </View>
              {country.open.map(p => (
                <Text key={p.pathwayId} style={[type.small, { color: c.ok, marginTop: space.xs }]}>
                  ✓ {p.name}{p.matchedGroup ? ` · ${p.matchedGroup}` : ''}
                </Text>
              ))}
              {country.check.map(p => (
                <Text key={p.pathwayId} style={[type.small, { color: c.warn, marginTop: space.xs }]}>
                  ? {p.name} — needs {p.unknown.map(u => u.cond.field).join(', ')}
                </Text>
              ))}
              {!country.open.length && !country.check.length ? (
                <Text style={[type.small, { color: c.faint, marginTop: space.xs }]}>
                  Nothing open on these facts.
                </Text>
              ) : null}
            </Card>
          ))}
        </Section>

        {result.unlocks.length ? (
          <Section title="What would open more doors"
            note="Ordered by how reachable the change is from where you stand.">
            {result.unlocks.slice(0, 5).map((u, k) => (
              <Card key={k}>
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
                  <Pill text={u.reachability.replace('-', ' ')}
                        tone={u.reachability === 'close' ? 'ok' : u.reachability === 'stretch' ? 'warn' : 'muted'} />
                </View>
                <Text style={[type.body, { color: c.ink, marginTop: space.sm }]}>{u.summary}</Text>
                <Text style={[type.small, { color: c.muted, marginTop: 2 }]}>
                  Opens: {u.opens.map(o => `${o.country} — ${o.pathway}`).join(' · ')}
                </Text>
              </Card>
            ))}
          </Section>
        ) : null}

        <Section title="How they differ">
          <Card>
            {result.facts.filter(f => f.differs).map(f => (
              <View key={f.label} style={{ paddingVertical: space.sm,
                                           borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }}>
                <Text style={[type.small, { color: c.faint }]}>{f.label}</Text>
                {result.countries.map(country => (
                  <Text key={country.code} style={[type.small, { color: c.ink, marginTop: 2 }]}>
                    {country.country}: {f.values[country.code]}
                  </Text>
                ))}
              </View>
            ))}
          </Card>
        </Section>
      </ScrollView>
    </Screen>
  );
}
