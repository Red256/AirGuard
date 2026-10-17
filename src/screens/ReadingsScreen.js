import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { CloudIcon, DropIcon, ParticlesIcon, SunIcon, ThermometerIcon, WarningBadge } from '../components/Icons';
import { Card, Header, Pill, Screen } from '../components/ui';
import {
  LEVEL_LABEL,
  levelFor,
  STATUS_CONTENT,
  suggestionFor,
} from '../data/levels';
import { useRelativeTime, useSensors } from '../state/SensorContext';
import { useSettings } from '../state/SettingsContext';
import { colors, palettes } from '../theme';

// Order alerts are shown in when more than one is active.
const ALERT_ORDER = ['closed', 'indoor', 'ventilate'];

function AlertBanner({ kind, onLearnMore }) {
  const content = STATUS_CONTENT[kind];
  const palette = palettes[content.palette];
  return (
    <View style={[styles.alertTitleRow, { backgroundColor: palette.bg, borderColor: palette.title }]}>
      <View style={styles.alertTitleLine}>
        <WarningBadge size={40} color={palettes.bad.accent} />
        <Text style={[styles.alertTitle, { color: palette.title }]}>{content.shortTitle}</Text>
      </View>
      <TouchableOpacity
        style={styles.learnMore}
        onPress={onLearnMore}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Learn more about: ${content.shortTitle}`}
      >
        <Text style={styles.learnMoreText}>Learn more</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.primary} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    </View>
  );
}

const GOOD_COPY = {
  co2: { good: 'Good air level', moderate: 'Getting stuffy', bad: 'Ventilation recommended' },
  pmIndoor: { good: 'Low level', moderate: 'Slightly raised', bad: 'High level' },
  pmOutdoor: { good: 'Good air quality', moderate: 'Moderate air quality', bad: 'Poor air quality' },
};

function Row({ icon, name, sub, value, unit, unitBeside, pill, onPress }) {
  // On narrow phones there isn't room for name, value and pill side by side,
  // so the pill moves under the name instead of squeezing it.
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const body = (
    <Card style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowSub}>{onPress ? 'Tap for suggestion' : sub}</Text>
        {compact && pill ? <View style={styles.rowPillCompact}>{pill}</View> : null}
      </View>
      <View style={[styles.rowValueWrap, unitBeside && styles.rowValueWrapBeside, unitBeside && (compact ? styles.rowValueBesideNarrow : styles.rowValueBesideWide)]}>
        <Text style={[styles.rowValue, unitBeside && styles.rowValueBeside]}>{value}</Text>
        <Text style={[styles.rowUnit, unitBeside && styles.rowUnitBeside]}>{unit}</Text>
      </View>
      {compact || unitBeside ? null : <View style={styles.rowPill}>{pill}</View>}
    </Card>
  );
  if (!onPress) return body;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${value} ${unit}. Tap for a suggestion.`}
    >
      {body}
    </TouchableOpacity>
  );
}

export default function ReadingsScreen({ navigation }) {
  const { settings } = useSettings();
  const { readings, updatedAt } = useSensors();
  const updated = useRelativeTime(updatedAt);

  const lv = {
    co2: levelFor('co2', readings.co2, settings.thresholds),
    pmIndoor: levelFor('pmIndoor', readings.pmIndoor, settings.thresholds),
    pmOutdoor: levelFor('pmOutdoor', readings.pmOutdoor, settings.thresholds),
  };

  // A reading above its limit opens the suggestion page for that reading.
  const tapProps = (metric) => {
    const kind = suggestionFor(metric, readings, settings.thresholds);
    if (!kind) return {};
    return {
      onPress: () => navigation.navigate('Suggestion', { kind }),
    };
  };
  const anyTappable = ['co2', 'pmIndoor', 'pmOutdoor'].some((m) => suggestionFor(m, readings, settings.thresholds));

  // With an active alert, the page title becomes the alert itself, with a link to what to do.
  const alertKinds = ALERT_ORDER.filter((kind) =>
    ['pmOutdoor', 'pmIndoor', 'co2'].some((m) => suggestionFor(m, readings, settings.thresholds) === kind),
  );

  return (
    <Screen>
      <Header />
      {alertKinds.length > 0 ? (
        alertKinds.map((kind) => (
          <AlertBanner key={kind} kind={kind} onLearnMore={() => navigation.navigate('Suggestion', { kind })} />
        ))
      ) : (
        <Text style={styles.title}>Sensor Readings</Text>
      )}
      {anyTappable ? null : <Text style={styles.subtitle}>Live data from sensors</Text>}

      <Row
        icon={<CloudIcon size={38} />}
        name="Indoor CO₂"
        sub={GOOD_COPY.co2[lv.co2]}
        value={readings.co2.toLocaleString('en-US')}
        unit="ppm"
        pill={<Pill label={LEVEL_LABEL[lv.co2]} palette={lv.co2} />}
        {...tapProps('co2')}
      />
      <Row
        icon={<ParticlesIcon size={36} />}
        name="Indoor PM2.5"
        sub={GOOD_COPY.pmIndoor[lv.pmIndoor]}
        value={readings.pmIndoor}
        unit="µg/m³"
        pill={<Pill label={LEVEL_LABEL[lv.pmIndoor]} palette={lv.pmIndoor} />}
        {...tapProps('pmIndoor')}
      />
      <Row
        icon={<SunIcon size={38} color="#F7B500" />}
        name="Outdoor PM2.5"
        sub={GOOD_COPY.pmOutdoor[lv.pmOutdoor]}
        value={readings.pmOutdoor}
        unit="µg/m³"
        pill={<Pill label={LEVEL_LABEL[lv.pmOutdoor]} palette={lv.pmOutdoor} />}
        {...tapProps('pmOutdoor')}
      />

      {/* Shown for information only: temperature and humidity are not rated. */}
      <View style={styles.rowGroupGap} />
      <Row
        icon={<ThermometerIcon size={36} />}
        name="Temperature"
        sub="Indoor temperature"
        value={readings.temp}
        unit="°F"
        unitBeside
      />
      <Row icon={<DropIcon size={34} />} name="Humidity" sub="Indoor humidity" value={readings.rh} unit="%" unitBeside />

      <Text style={styles.updated}>Updated: {updated}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.navy, marginTop: 4 },
  // "Learn more" always sits on its own left-aligned line under the alert title.
  // Outline (in the alert's own color) around the active alert and its Learn more link.
  alertTitleRow: {
    marginTop: 4,
    marginBottom: 12,
    padding: 14,
    borderWidth: 2,
    borderRadius: 16,
  },
  alertTitleLine: { flexDirection: 'row', alignItems: 'center' },
  alertTitle: { flex: 1, fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.navy, marginLeft: 10 },
  learnMore: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 6 },
  learnMoreText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  subtitle: { fontSize: 16, color: colors.muted, marginBottom: 14, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, marginBottom: 10 },
  rowIcon: { width: 40, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.navy },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowValueWrap: { alignItems: 'center', minWidth: 52, marginHorizontal: 6 },
  rowValue: { fontSize: 24, fontWeight: '800', color: colors.navy },
  rowUnit: { fontSize: 12, color: colors.muted },
  // Unrated rows: the value sits centered in the whole right-hand area (value column + rating slot).
  rowValueWrapBeside: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginHorizontal: 0, flexShrink: 0 },
  // Same left edge as before, but narrower with a right margin, so the value sits further left.
  rowValueBesideWide: { width: 112, marginRight: 44 },
  rowValueBesideNarrow: { width: 84, marginRight: 16 },
  rowValueBeside: { fontSize: 20, fontWeight: '400', color: '#000000' },
  rowUnitBeside: { fontSize: 20, fontWeight: '400', color: '#000000', marginLeft: 3 },
  rowPill: { minWidth: 92, alignItems: 'center', flexShrink: 0 },
  rowGroupGap: { height: 34 },
  rowPillCompact: { marginTop: 6, flexDirection: 'row' },
  updated: { textAlign: 'center', color: colors.muted, fontSize: 14, marginTop: 14 },
});
