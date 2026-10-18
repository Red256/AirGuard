import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CloudIcon, ParticlesIcon, SunIcon } from '../components/Icons';
import { Card, Header, Pill, Screen } from '../components/ui';
import {
  ALERT_META,
  dayKey,
  dayLabel,
  formatAgo,
  formatDuration,
  formatTime,
} from '../data/alerts';
import { formatValue, LEVEL_LABEL, levelFor, suggestionFor } from '../data/levels';
import { useAlerts } from '../state/AlertsContext';
import { useSensors } from '../state/SensorContext';
import { useSettings } from '../state/SettingsContext';
import { cardShadow, colors, palettes } from '../theme';


function MetricIcon({ metric, level, size = 34 }) {
  if (metric === 'co2') return <CloudIcon size={size} />;
  if (metric === 'pmIndoor') return <ParticlesIcon size={size - 4} />;
  return <SunIcon size={size} color="#F7B500" />;
}

function SectionTitle({ title, count }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count > 0 ? (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

function CurrentAlert({ event, onOpen }) {
  const { settings } = useSettings();
  const { readings, status } = useSensors();
  const meta = ALERT_META[event.metric];
  const now = readings[event.metric];
  const level = levelFor(event.metric, now, settings.thresholds);
  // While the reading is back to Good, or the channel dropped out, the card
  // keeps the colour of the alert's peak rather than going green mid-alert.
  const palette = palettes[level === 'good' || level === 'none' ? event.peakLevel : level];
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onOpen(event)}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}. ${meta.action}. Tap for details.`}
    >
      <Card style={[styles.alertCard, { borderLeftColor: palette.accent }]}>
        <View style={styles.alertTop}>
          <View style={styles.alertIcon}>
            <MetricIcon metric={event.metric} level={level === 'good' || level === 'none' ? event.peakLevel : level} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>{meta.title}</Text>
            <Text style={styles.alertDetail}>
              {level === 'none'
                ? `${meta.label}: no current reading · peak ${formatValue(event.metric, event.peak)} ${meta.unit}`
                : `${meta.label}: ${formatValue(event.metric, now)} ${meta.unit} (Unhealthy above ${settings.thresholds[event.metric].moderate})`}
            </Text>
            <Text style={styles.alertSince}>Started {formatAgo(event.startedAt)}</Text>
          </View>
          <Pill label={LEVEL_LABEL[event.peakLevel]} palette={event.peakLevel} />
        </View>
        <View style={[styles.actionRow, { backgroundColor: palette.bg }]}>
          <Text style={[styles.actionText, { color: palette.title }]}>{meta.action}</Text>
          <Ionicons name="chevron-forward" size={18} color={palette.title} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function PastAlert({ event, onOpen }) {
  const meta = ALERT_META[event.metric];
  const sameDay = dayKey(event.startedAt) === dayKey(event.endedAt);
  const range = `${formatTime(event.startedAt)} – ${formatTime(event.endedAt)}${sameDay ? '' : ' (next day)'}`;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onOpen(event)}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}, peak ${event.peak} ${meta.unit}. Tap to see the readings from that alert.`}
    >
      <Card style={styles.pastCard}>
        <View style={styles.pastIcon}>
          <MetricIcon metric={event.metric} level={event.peakLevel} size={30} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pastTitle}>{meta.title}</Text>
          <Text style={styles.pastDetail}>
            Peak {formatValue(event.metric, event.peak)} {meta.unit}
          </Text>
          <Text style={styles.pastTime}>
            {range} · {formatDuration(event.endedAt - event.startedAt)}
          </Text>
          <Text style={styles.pastHint}>Tap to see the readings</Text>
        </View>
        <Pill label={LEVEL_LABEL[event.peakLevel]} palette={event.peakLevel} />
      </Card>
    </TouchableOpacity>
  );
}

export default function AlertsScreen({ navigation }) {
  const { current, past } = useAlerts();
  const { settings } = useSettings();
  const { readings, status } = useSensors();

  const groups = useMemo(() => {
    const out = [];
    past.forEach((e) => {
      const label = dayLabel(e.startedAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(e);
      else out.push({ label, items: [e] });
    });
    return out;
  }, [past]);

  // Resolve the advice against the live readings, so a CO₂ alert with no
  // outdoor reading opens the hedged page rather than claiming the air is clean.
  const openCurrent = (event) =>
    navigation.navigate('AlertDetail', {
      kind: suggestionFor(event.metric, readings, settings.thresholds) || ALERT_META[event.metric].kind,
    });
  const openPast = (event) =>
    navigation.navigate('AlertDetail', {
      kind: ALERT_META[event.metric].kind,
      event: { startedAt: event.startedAt, endedAt: event.endedAt, peakAt: event.peakAt || event.startedAt },
      snapshot: event.snapshot,
    });

  return (
    <Screen>
      <Header />

      <SectionTitle title="Current alerts" count={current.length} />
      {current.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons
            name={status === 'ok' ? 'checkmark-circle' : 'cloud-offline-outline'}
            size={34}
            color={status === 'ok' ? '#2E9E4B' : '#7A8AA0'}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.emptyTitle}>
              {status === 'ok' ? 'No active alerts' : 'No readings yet'}
            </Text>
            <Text style={styles.emptyText}>
              {status === 'ok'
                ? 'No readings are unhealthy right now.'
                : 'Waiting for your node to publish. Nothing is being graded yet.'}
            </Text>
          </View>
        </Card>
      ) : (
        current.map((e) => <CurrentAlert key={e.id} event={e} onOpen={openCurrent} />)
      )}

      <SectionTitle title="Past alerts" count={past.length} />
      {groups.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="time-outline" size={30} color="#6B7B93" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.emptyTitle}>No past alerts</Text>
            <Text style={styles.emptyText}>Alerts that have ended will show up here.</Text>
          </View>
        </Card>
      ) : (
        groups.map((g) => (
          <View key={g.label}>
            <Text style={styles.dayLabel}>{g.label}</Text>
            {g.items.map((e) => (
              <PastAlert key={e.id} event={e} onOpen={openPast} />
            ))}
          </View>
        ))
      )}

      <Text style={styles.footnote}>
        Alerts are logged on this device from the readings your nodes publish.
        Manage your nodes in Settings.
      </Text>

    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.navy },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    marginLeft: 8,
  },
  countText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  alertCard: { borderLeftWidth: 5, padding: 14, marginBottom: 12 },
  alertTop: { flexDirection: 'row', alignItems: 'flex-start' },
  alertIcon: { width: 44, alignItems: 'center', marginRight: 8, paddingTop: 2 },
  alertTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  alertDetail: { fontSize: 13, color: colors.text, marginTop: 3 },
  alertSince: { fontSize: 12, color: colors.muted, marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  actionText: { fontSize: 15, fontWeight: '700' },
  emptyCard: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  emptyText: { fontSize: 14, color: colors.muted, marginTop: 2 },
  dayLabel: { fontSize: 13, fontWeight: '700', color: colors.muted, marginBottom: 8, marginTop: 4, letterSpacing: 0.4 },
  pastCard: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10 },
  pastIcon: { width: 40, alignItems: 'center', marginRight: 8 },
  pastTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  pastDetail: { fontSize: 13, color: colors.text, marginTop: 2 },
  pastTime: { fontSize: 12, color: colors.muted, marginTop: 2 },
  pastHint: { fontSize: 12, color: colors.primary, fontWeight: '600', marginTop: 4 },
  footnote: { textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 10 },
});
