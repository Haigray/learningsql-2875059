import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme, space, radius, type, stateColor, stateLabel } from '../theme';

export function Screen({ children, style }) {
  const c = useTheme();
  return <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
}

export function Header({ title, subtitle, right }) {
  const c = useTheme();
  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md,
                   borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line,
                   backgroundColor: c.surface, flexDirection: 'row', alignItems: 'flex-end' }}>
      <View style={{ flex: 1 }}>
        <Text style={[type.h1, { color: c.ink }]}>{title}</Text>
        {subtitle ? <Text style={[type.small, { color: c.faint, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Section({ title, note, children }) {
  const c = useTheme();
  return (
    <View style={{ marginTop: space.xl, paddingHorizontal: space.lg }}>
      <Text style={[type.label, { color: c.faint, marginBottom: space.sm }]}>{title}</Text>
      {note ? <Text style={[type.small, { color: c.muted, marginBottom: space.md }]}>{note}</Text> : null}
      {children}
    </View>
  );
}

export function Pill({ text, tone = 'muted' }) {
  const c = useTheme();
  const bg = { ok: c.okSoft, warn: c.warnSoft, danger: c.dangerSoft, accent: c.accentSoft, muted: c.bg }[tone];
  const fg = { ok: c.ok, warn: c.warn, danger: c.danger, accent: c.accent, muted: c.faint }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 3,
                   borderWidth: tone === 'muted' ? StyleSheet.hairlineWidth : 0, borderColor: c.lineStrong }}>
      <Text style={[type.label, { color: fg, fontSize: 10 }]}>{text}</Text>
    </View>
  );
}

export function Card({ children, onPress, accent, style }) {
  const c = useTheme();
  const body = (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius.md, padding: space.lg,
                    borderWidth: StyleSheet.hairlineWidth, borderColor: c.line,
                    borderLeftWidth: accent ? 3 : StyleSheet.hairlineWidth,
                    borderLeftColor: accent ?? c.line, marginBottom: space.sm }, style]}>
      {children}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button">{body}</Pressable> : body;
}

export function Empty({ title, body }) {
  const c = useTheme();
  return (
    <View style={{ padding: space.xl, alignItems: 'center' }}>
      <Text style={[type.h3, { color: c.muted, marginBottom: space.xs, textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.small, { color: c.faint, textAlign: 'center' }]}>{body}</Text> : null}
    </View>
  );
}

export function Button({ title, onPress, tone = 'accent' }) {
  const c = useTheme();
  const fg = tone === 'accent' ? c.accent : c.muted;
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: fg, borderRadius: radius.sm,
               paddingVertical: space.md, paddingHorizontal: space.lg, alignItems: 'center' }}>
      <Text style={[type.h3, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** One task, rendered the same way on Today and on the Timeline. */
export function TaskCard({ task, done, onToggle, onPress }) {
  const c = useTheme();
  const colour = done ? c.faint : stateColor(c, task.state);
  const when = task.dueDate ?? task.latestStart;

  return (
    <Card accent={colour} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Pressable onPress={onToggle} hitSlop={10} accessibilityRole="checkbox"
          accessibilityState={{ checked: !!done }}
          style={{ width: 22, height: 22, borderRadius: radius.sm, marginRight: space.md, marginTop: 1,
                   borderWidth: 1.5, borderColor: done ? c.ok : c.lineStrong,
                   backgroundColor: done ? c.ok : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {done ? <Text style={{ color: c.surface, fontSize: 13, fontWeight: '800' }}>✓</Text> : null}
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={[type.h3, { color: done ? c.faint : c.ink,
                                   textDecorationLine: done ? 'line-through' : 'none' }]}>
            {task.title}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm }}>
            <Pill text={stateLabel(done ? 'done' : task.state)}
                  tone={done ? 'muted' : task.state === 'overdue' || task.state === 'reorder' ? 'danger'
                        : task.state === 'ready' ? 'ok' : task.state === 'waiting' ? 'warn' : 'muted'} />
            {task.critical ? <Pill text="Critical" tone="danger" /> : null}
            {when ? <Pill text={when} /> : null}
          </View>

          {/* The shelf-life window is the reason this app exists, so it is never collapsed. */}
          {task.shelfLife && !done ? (
            <View style={{ marginTop: space.md, backgroundColor: c.warnSoft, borderRadius: radius.sm, padding: space.md }}>
              <Text style={[type.small, { color: c.warn, fontWeight: '700' }]}>
                Order between {task.shelfLife.orderWindow.from} and {task.shelfLife.orderWindow.to}
              </Text>
              <Text style={[type.small, { color: c.muted, marginTop: 2 }]}>
                Valid {task.shelfLife.days} days · needed {task.shelfLife.consumedOn} for{' '}
                {task.shelfLife.consumedByTitle.toLowerCase()}
              </Text>
            </View>
          ) : null}

          {task.detail && !done ? (
            <Text style={[type.small, { color: c.muted, marginTop: space.sm }]} numberOfLines={4}>
              {task.detail}
            </Text>
          ) : null}

          {task.blockedBy?.length ? (
            <Text style={[type.small, { color: c.faint, marginTop: space.sm }]}>
              Waiting on {task.blockedBy.length} earlier step{task.blockedBy.length > 1 ? 's' : ''}
            </Text>
          ) : null}
        </View>
      </View>
    </Card>
  );
}
