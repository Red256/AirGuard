import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CloudIcon, LeafBadge, ParticlesIcon, SunIcon, WarningBadge } from '../components/Icons';
import { Card, Header, InfoBox, Pill, Screen } from '../components/ui';
import {
  evaluate,
  INDOOR_ACTIONS,
  INDOOR_SOURCES_TEXT,
  LEVEL_LABEL,
  levelFor,
  METRICS,
  STATUS_CONTENT,
} from '../data/levels';
import { dayLabel, formatDuration, formatTime } from '../data/alerts';
import { useSensors, useRelativeTime } from '../state/SensorContext';
import { useSettings } from '../state/SettingsContext';
import { cardShadow, colors, palettes } from '../theme';


function MetricTile({ label, value, unit, level, icon }) {
  return (
    <Card style={styles.tile}>
      <View style={styles.tileIcon}>{icon}</View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value.toLocaleString('en-US')}</Text>
      <Text style={styles.tileUnit}>{unit}</Text>
      <Pill label={LEVEL_LABEL[level]} palette={level} style={{ marginTop: 8 }} />
    </Card>
  );
}

export default function SuggestionScreen({ navigation, route }) {
  const { settings } = useSettings();
  const { readings, updatedAt } = useSensors();
  const updated = useRelativeTime(updatedAt);
  const [learnOpen, setLearnOpen] = useState(false);

  const params = route.params || {};
  // A past alert passes the readings saved at its peak; otherwise we show the live readings.
  const past = params.event && params.snapshot ? params : null;
  const data = past ? past.snapshot : readings;
  const kind = params.kind || evaluate(readings, settings.thresholds);
  const content = STATUS_CONTENT[kind];
  const palette = palettes[content.palette];
  const levels = {
    co2: levelFor('co2', data.co2, settings.thresholds),
    pmIndoor: levelFor('pmIndoor', data.pmIndoor, settings.thresholds),
    pmOutdoor: levelFor('pmOutdoor', data.pmOutdoor, settings.thresholds),
  };

  return (
    <Screen>
      <Header />

      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel={params.backLabel || 'Back to readings'}>
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
        <Text style={styles.backText}>{params.backLabel || 'Back to readings'}</Text>
      </TouchableOpacity>

      {past ? (
        <View style={styles.pastBanner}>
          <Text style={styles.pastBannerTitle}>🕒 Past alert</Text>
          <Text style={styles.pastBannerText}>
            {dayLabel(past.event.startedAt)} · {formatTime(past.event.startedAt)} – {formatTime(past.event.endedAt)} ({formatDuration(past.event.endedAt - past.event.startedAt)})
          </Text>
          <Text style={styles.pastBannerSub}>Readings at the peak of this alert, {formatTime(past.event.peakAt)}</Text>
        </View>
      ) : null}

      <View style={[styles.statusCard, { backgroundColor: palette.bg }]}>
        {content.icon === 'leaf' ? <LeafBadge color={palette.accent} /> : <WarningBadge color={palette.accent} />}
        <Text style={[styles.statusTitle, { color: palette.title }]}>{content.title}</Text>
        <Text style={styles.statusMessage}>{content.message}</Text>
      </View>

      <View style={styles.tiles}>
        <MetricTile
          label={METRICS.co2.label}
          value={data.co2}
          unit={METRICS.co2.unit}
          level={levels.co2}
          icon={<CloudIcon size={44} />}
        />
        <MetricTile
          label={METRICS.pmIndoor.label}
          value={data.pmIndoor}
          unit={METRICS.pmIndoor.unit}
          level={levels.pmIndoor}
          icon={<ParticlesIcon size={34} />}
        />
        <MetricTile
          label={METRICS.pmOutdoor.label}
          value={data.pmOutdoor}
          unit={METRICS.pmOutdoor.unit}
          level={levels.pmOutdoor}
          icon={<SunIcon size={36} color="#F7B500" />}
        />
      </View>

      {content.info ? (
        <InfoBox onLearnMore={content.learn ? () => setLearnOpen(true) : undefined}>{content.info}</InfoBox>
      ) : (
        <>
          <Card style={styles.actionsCard}>
            <View style={styles.actionsHeader}>
              <View style={styles.bulb}>
                <Ionicons name="bulb-outline" size={20} color="#1E88E5" />
              </View>
              <Text style={styles.actionsTitle}>Recommended Actions</Text>
            </View>
            {INDOOR_ACTIONS.map((a) => (
              <View key={a} style={styles.actionRow}>
                <Ionicons name="checkmark-circle" size={24} color="#1E88E5" />
                <Text style={styles.actionText}>{a}</Text>
              </View>
            ))}
          </Card>
          <View style={styles.sourcesCard}>
            <Ionicons name="information-circle" size={26} color="#6B7B93" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.sourcesTitle}>Possible Indoor Sources</Text>
              <Text style={styles.sourcesText}>{INDOOR_SOURCES_TEXT}</Text>
            </View>
          </View>
        </>
      )}

      {past ? null : <Text style={styles.updated}>Last updated: {updated}</Text>}

      <Modal visible={learnOpen} transparent animationType="fade" onRequestClose={() => setLearnOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{content.learn ? content.learn.title : ''}</Text>
            <Text style={styles.sheetBody}>{content.learn ? content.learn.body : ''}</Text>
            <TouchableOpacity style={styles.sheetButton} onPress={() => setLearnOpen(false)}>
              <Text style={styles.sheetButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pastBanner: { backgroundColor: '#EAF1F8', borderRadius: 16, padding: 14, marginBottom: 12 },
  pastBannerTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  pastBannerText: { fontSize: 15, color: colors.text, marginTop: 4 },
  pastBannerSub: { fontSize: 13, color: colors.muted, marginTop: 3 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, alignSelf: 'flex-start' },
  backText: { fontSize: 16, color: colors.primary, fontWeight: '600', marginLeft: 2 },
  statusCard: { borderRadius: 24, paddingVertical: 24, paddingHorizontal: 18, alignItems: 'center' },
  statusTitle: { fontSize: 34, fontWeight: '800', textAlign: 'center', marginTop: 10, lineHeight: 40 },
  statusMessage: { fontSize: 17, lineHeight: 25, color: '#1B2A41', textAlign: 'center', marginTop: 8 },
  tiles: { flexDirection: 'row', marginTop: 14, marginHorizontal: -5 },
  tile: { flex: 1, marginHorizontal: 5, paddingVertical: 14, paddingHorizontal: 4, alignItems: 'center' },
  tileIcon: { height: 40, justifyContent: 'center', marginBottom: 6 },
  tileLabel: { fontSize: 13, color: colors.text, textAlign: 'center' },
  tileValue: { fontSize: 30, fontWeight: '800', color: colors.navy, marginTop: 4 },
  tileUnit: { fontSize: 13, color: colors.muted },
  actionsCard: { marginTop: 14, padding: 16 },
  actionsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bulb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsTitle: { fontSize: 18, fontWeight: '700', color: colors.navy, marginLeft: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  actionText: { fontSize: 16, color: colors.text, marginLeft: 12 },
  sourcesCard: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F7',
    borderRadius: 18,
    padding: 16,
    marginTop: 12,
  },
  sourcesTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  sourcesText: { fontSize: 14, lineHeight: 20, color: colors.infoText, marginTop: 2 },
  updated: { textAlign: 'center', color: colors.muted, fontSize: 14, marginTop: 18 },
  backdrop: { flex: 1, backgroundColor: 'rgba(11,36,71,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 22, padding: 22, ...cardShadow },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: colors.navy },
  sheetBody: { fontSize: 15, lineHeight: 22, color: colors.infoText, marginTop: 10 },
  sheetButton: {
    marginTop: 18,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sheetButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
