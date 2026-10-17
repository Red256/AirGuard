import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { CloudIcon, DropIcon, ParticlesIcon, SunIcon, ThermometerIcon } from '../components/Icons';
import { Card, Header, InfoBox, Pill, Screen } from '../components/ui';
import {
  evaluate,
  formatValue,
  humidityLabel,
  LEVEL_LABEL,
  levelFor,
  STATUS_CONTENT,
  suggestionFor,
  temperatureLabel,
  toDisplayTemp,
} from '../data/levels';
import { useRelativeTime, useSensors } from '../state/SensorContext';
import { useSettings } from '../state/SettingsContext';
import { colors, palettes } from '../theme';

const GOOD_COPY = {
  co2: {
    good: 'Good air level',
    moderate: 'Getting stuffy',
    bad: 'Ventilation recommended',
    none: 'Sensor has not reported this',
  },
  pmIndoor: {
    good: 'Low level',
    moderate: 'Slightly raised',
    bad: 'High level',
    none: 'Sensor has not reported this',
  },
  pmOutdoor: {
    good: 'Good air quality',
    moderate: 'Moderate air quality',
    bad: 'Poor air quality',
    none: 'No outdoor sensor connected',
  },
};

// One line under the title about the feed itself, so a blank card is never
// ambiguous between "the air is fine" and "we are not hearing from the device".
const FEED_NOTE = {
  connecting: 'Connecting to your AirGuard node…',
  empty: 'Connected, but this device has not published any readings yet',
  error: 'Cannot reach the database — check your connection',
  demo: 'Simulated demo data, not a real sensor',
};

function Row({ icon, name, sub, value, unit, pill, onPress, accent }) {
  // On narrow phones there isn't room for name, value and pill side by side,
  // so the pill moves under the name instead of squeezing it.
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const body = (
    <Card style={[styles.row, onPress && { borderWidth: 1.5, borderColor: accent }]}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName}>{name}</Text>
        <Text style={styles.rowSub}>{onPress ? 'Tap for suggestion' : sub}</Text>
        {compact ? <View style={styles.rowPillCompact}>{pill}</View> : null}
      </View>
      <View style={styles.rowValueWrap}>
        <Text style={styles.rowValue}>{value}</Text>
        <Text style={styles.rowUnit}>{unit}</Text>
      </View>
      {compact ? null : <View style={styles.rowPill}>{pill}</View>}
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
  const { readings, updatedAt, status } = useSensors();
  const updated = useRelativeTime(updatedAt);
  const feedNote = FEED_NOTE[status] || null;

  const lv = {
    co2: levelFor('co2', readings.co2, settings.thresholds),
    pmIndoor: levelFor('pmIndoor', readings.pmIndoor, settings.thresholds),
    pmOutdoor: levelFor('pmOutdoor', readings.pmOutdoor, settings.thresholds),
  };
  const temp = temperatureLabel(readings.temp);
  const hum = humidityLabel(readings.rh);

  // A reading above its limit opens the suggestion page for that reading.
  const tapProps = (metric) => {
    const kind = suggestionFor(metric, readings, settings.thresholds);
    if (!kind) return {};
    return {
      onPress: () => navigation.navigate('Suggestion', { kind }),
      accent: palettes[lv[metric]].accent,
    };
  };
  const anyTappable = ['co2', 'pmIndoor', 'pmOutdoor'].some((m) => suggestionFor(m, readings, settings.thresholds));

  // With an active alert, the page title becomes the alert itself, with a link to what to do.
  const alertKind = evaluate(readings, settings.thresholds);
  const activeAlert = alertKind !== 'good' ? STATUS_CONTENT[alertKind] : null;

  return (
    <Screen>
      <Header />
      {activeAlert ? (
        <View style={styles.alertTitleRow}>
          <Text style={styles.alertTitle}>⚠️ {activeAlert.shortTitle}</Text>
          <TouchableOpacity
            style={styles.learnMore}
            onPress={() => navigation.navigate('Suggestion', { kind: alertKind })}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Learn more about: ${activeAlert.shortTitle}`}
          >
            <Text style={styles.learnMoreText}>Learn more</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.title}>Sensor Readings</Text>
      )}
      <Text style={styles.subtitle}>
        {anyTappable ? 'Tap a highlighted reading to see what to do' : 'Live data from your AirGuard node'}
      </Text>
      {feedNote ? (
        <Text style={[styles.feedNote, status === 'error' && styles.feedNoteError]}>{feedNote}</Text>
      ) : null}

      <Row
        icon={<CloudIcon size={38} />}
        name="Indoor CO₂"
        sub={GOOD_COPY.co2[lv.co2]}
        value={formatValue('co2', readings.co2)}
        unit="ppm"
        pill={<Pill label={LEVEL_LABEL[lv.co2]} palette={lv.co2} />}
        {...tapProps('co2')}
      />
      <Row
        icon={<ParticlesIcon size={36} />}
        name="Indoor PM2.5"
        sub={GOOD_COPY.pmIndoor[lv.pmIndoor]}
        value={formatValue('pmIndoor', readings.pmIndoor)}
        unit="µg/m³"
        pill={<Pill label={LEVEL_LABEL[lv.pmIndoor]} palette={lv.pmIndoor} />}
        {...tapProps('pmIndoor')}
      />
      <Row
        icon={<SunIcon size={38} color="#F7B500" />}
        name="Outdoor PM2.5"
        sub={GOOD_COPY.pmOutdoor[lv.pmOutdoor]}
        value={formatValue('pmOutdoor', readings.pmOutdoor)}
        unit="µg/m³"
        pill={<Pill label={LEVEL_LABEL[lv.pmOutdoor]} palette={lv.pmOutdoor} />}
        {...tapProps('pmOutdoor')}
      />
      <Row
        icon={<ThermometerIcon size={36} />}
        name="Temperature"
        sub={temp.note ? `Indoor temperature · ${temp.note}` : 'Indoor temperature'}
        value={formatValue('temp', toDisplayTemp(readings.temp, settings.tempUnit))}
        unit={settings.tempUnit === 'C' ? '°C' : '°F'}
        pill={<Pill label={temp.label} palette={temp.palette} />}
      />
      <Row
        icon={<DropIcon size={34} />}
        name="Relative Humidity"
        sub={hum.note ? `Indoor humidity · ${hum.note}` : 'Indoor humidity'}
        value={formatValue('rh', readings.rh)}
        unit="%"
        pill={<Pill label={hum.label} palette={hum.palette} />}
      />

      <InfoBox>
        {status === 'demo'
          ? 'Simulated readings, for trying the app out.\nSwitch back to the live node on the Alerts tab.'
          : 'Readings come from your SEN66 node, which publishes every 5 minutes.\nOutdoor PM2.5 needs a second, outdoor sensor.'}
      </InfoBox>
      <Text style={styles.updated}>Updated: {updated}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.navy, marginTop: 4 },
  // "Learn more" always sits on its own left-aligned line under the alert title.
  alertTitleRow: { marginTop: 4 },
  alertTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', color: colors.navy },
  learnMore: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 4, marginBottom: 14 },
  learnMoreText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  subtitle: { fontSize: 16, color: colors.muted, marginBottom: 14, marginTop: 2 },
  feedNote: { fontSize: 13, color: colors.muted, marginTop: -8, marginBottom: 12 },
  feedNoteError: { color: '#C62828', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, marginBottom: 10 },
  rowIcon: { width: 40, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.navy },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowValueWrap: { alignItems: 'center', minWidth: 52, marginHorizontal: 6 },
  rowValue: { fontSize: 24, fontWeight: '800', color: colors.navy },
  rowUnit: { fontSize: 12, color: colors.muted },
  rowPill: { minWidth: 92, alignItems: 'center', flexShrink: 0 },
  rowPillCompact: { marginTop: 6, flexDirection: 'row' },
  updated: { textAlign: 'center', color: colors.muted, fontSize: 14, marginTop: 14 },
});
