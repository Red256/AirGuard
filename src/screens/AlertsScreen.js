import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { LEVEL_LABEL, levelFor } from '../data/levels';
import { useAlerts } from '../state/AlertsContext';
import { SCENARIOS, useSensors } from '../state/SensorContext';
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
  const { readings } = useSensors();
  const meta = ALERT_META[event.metric];
  const now = readings[event.metric];
  const level = levelFor(event.metric, now, settings.thresholds);
  const palette = palettes[level === 'good' ? event.peakLevel : level];
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onOpen(meta.kind)}
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}. ${meta.action}. Tap for details.`}
    >
      <Card style={[styles.alertCard, { borderLeftColor: palette.accent }]}>
        <View style={styles.alertTop}>
          <View style={styles.alertIcon}>
            <MetricIcon metric={event.metric} level={level === 'good' ? event.peakLevel : level} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>{meta.title}</Text>
            <Text style={styles.alertDetail}>
              {meta.label}: {now.toLocaleString('en-US')} {meta.unit} (Unhealthy above {settings.thresholds[event.metric].moderate})
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
            Peak {event.peak.toLocaleString('en-US')} {meta.unit}
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

function ScenarioModal({ selected, onSelect, onClose }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Simulate a situation</Text>
          <Text style={styles.sheetHint}>Choose what the simulated sensors report.</Text>
          {Object.entries(SCENARIOS).map(([key, s]) => (
            <TouchableOpacity key={key} style={styles.option} onPress={() => onSelect(key)}>
              <Text style={[styles.optionText, key === selected && styles.optionSelected]}>{s.name}</Text>
              {key === selected ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : null}
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function AlertsScreen({ navigation }) {
  const { current, past } = useAlerts();
  const { settings, update } = useSettings();
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const openCurrent = (kind) => navigation.navigate('AlertDetail', { kind, backLabel: 'Back to alerts' });
  const openPast = (event) =>
    navigation.navigate('AlertDetail', {
      kind: ALERT_META[event.metric].kind,
      event: { startedAt: event.startedAt, endedAt: event.endedAt, peakAt: event.peakAt || event.startedAt },
      snapshot: event.snapshot,
      backLabel: 'Back to alerts',
    });

  return (
    <Screen>
      <Header />
      <Text style={styles.title}>Alerts</Text>
      <Text style={styles.subtitle}>Current and past air quality alerts</Text>

      <SectionTitle title="Current alerts" count={current.length} />
      {current.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Ionicons name="checkmark-circle" size={34} color="#2E9E4B" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.emptyTitle}>No active alerts</Text>
            <Text style={styles.emptyText}>No readings are unhealthy right now.</Text>
          </View>
        </Card>
      ) : (
        current.map((e) => <CurrentAlert key={e.id} event={e} onOpen={openCurrent} />)
      )}

      <SectionTitle title="Past alerts" count={0} />
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

      <TouchableOpacity style={styles.demoRow} onPress={() => setPickerOpen(true)} accessibilityRole="button">
        <Ionicons name="flask" size={18} color="#3F6EA8" />
        <Text style={styles.demoLabel}>Demo: simulate a situation</Text>
        <Text style={styles.demoValue}>{(SCENARIOS[settings.scenario] || SCENARIOS.ventilate).name}</Text>
        <Ionicons name="chevron-forward" size={16} color="#7A8AA0" />
      </TouchableOpacity>
      <Text style={styles.footnote}>Sensor readings and past alerts on this device are simulated.</Text>

      {pickerOpen ? (
        <ScenarioModal
          selected={settings.scenario}
          onClose={() => setPickerOpen(false)}
          onSelect={(k) => {
            update({ scenario: k });
            setPickerOpen(false);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.navy, marginTop: 4 },
  subtitle: { fontSize: 16, color: colors.muted, marginBottom: 12, marginTop: 2 },
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
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF1F8',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  demoLabel: { flex: 1, fontSize: 14, color: colors.text, marginLeft: 8 },
  demoValue: { fontSize: 13, color: '#2A5DA8', marginRight: 6 },
  footnote: { textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,36,71,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 22, padding: 22, ...cardShadow },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.navy },
  sheetHint: { fontSize: 14, color: colors.muted, marginTop: 6, marginBottom: 10 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: { fontSize: 17, color: colors.text },
  optionSelected: { color: colors.primary, fontWeight: '700' },
  closeBtn: { alignSelf: 'flex-end', paddingVertical: 10, paddingHorizontal: 16, marginTop: 8 },
  closeText: { fontSize: 16, color: colors.muted, fontWeight: '600' },
});
