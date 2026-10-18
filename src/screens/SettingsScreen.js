import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card, Screen } from '../components/ui';
import { PLACEMENT_LABEL, PLACEMENTS, useSettings } from '../state/SettingsContext';
import { useRelativeTime, useSensors } from '../state/SensorContext';
import { colors } from '../theme';

// What each placement contributes, said plainly, because the choice changes
// which cards on the Home tab have data in them.
const PLACEMENT_HELP = {
  indoor: 'Supplies CO₂ and indoor PM2.5',
  outdoor: 'Supplies outdoor PM2.5',
};

function PlacementToggle({ value, onChange }) {
  return (
    <View style={styles.segmented}>
      {PLACEMENTS.map((p) => {
        const active = p === value;
        return (
          <TouchableOpacity
            key={p}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(p)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Set this node to ${PLACEMENT_LABEL[p]}`}
          >
            <Ionicons
              name={p === 'indoor' ? 'home' : 'partly-sunny'}
              size={15}
              color={active ? '#FFFFFF' : colors.muted}
            />
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
              {PLACEMENT_LABEL[p]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DeviceCard({ device, lastAt, onPlacement, onRemove }) {
  const seen = useRelativeTime(lastAt);
  return (
    <Card style={styles.deviceCard}>
      <View style={styles.deviceTop}>
        <Ionicons name="hardware-chip" size={20} color="#3F6EA8" />
        <Text style={styles.deviceId} numberOfLines={1} ellipsizeMode="middle">
          {device.id}
        </Text>
        <TouchableOpacity
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Unregister node ${device.id}`}
        >
          <Ionicons name="trash-outline" size={20} color="#C62828" />
        </TouchableOpacity>
      </View>
      <PlacementToggle value={device.placement} onChange={onPlacement} />
      <Text style={styles.deviceHelp}>{PLACEMENT_HELP[device.placement]}</Text>
      <Text style={styles.deviceSeen}>Last reading: {seen}</Text>
    </Card>
  );
}

export default function SettingsScreen({ navigation }) {
  const { devices, removeDevice, setPlacement } = useSettings();
  const { sources } = useSensors();

  // When was each node last heard from, taken from whichever slot it filled.
  const lastAtFor = (id) => {
    const times = Object.values(sources || {})
      .filter((s) => s.deviceId === id)
      .map((s) => s.at);
    return times.length ? Math.max(...times) : null;
  };

  const confirmRemove = (device) => {
    const isLast = devices.length === 1;
    Alert.alert(
      'Unregister this node?',
      isLast
        ? 'This is your only node. AirGuard has no readings to show without one, so you will be asked to register a node again.'
        : `AirGuard will stop reading ${PLACEMENT_LABEL[device.placement].toLowerCase()} air from this node.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unregister', style: 'destructive', onPress: () => removeDevice(device.id) },
      ]
    );
  };

  const counts = PLACEMENTS.map((p) => ({ p, n: devices.filter((d) => d.placement === p).length }));
  const missing = counts.filter((c) => c.n === 0).map((c) => PLACEMENT_LABEL[c.p].toLowerCase());

  return (
    <Screen>
      <View style={styles.titleRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Text style={styles.sectionTitle}>Your nodes</Text>
      <Text style={styles.sectionHint}>
        Each node reads one side of your home. Set where it is and AirGuard uses its readings for
        that side.
      </Text>

      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          lastAt={lastAtFor(device.id)}
          onPlacement={(p) => setPlacement(device.id, p)}
          onRemove={() => confirmRemove(device)}
        />
      ))}

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('RegisterDevice')}
        accessibilityRole="button"
        accessibilityLabel="Register another node"
      >
        <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
        <Text style={styles.addText}>Register another node</Text>
      </TouchableOpacity>

      {missing.length ? (
        <Card style={styles.noteCard}>
          <Ionicons name="information-circle" size={20} color="#1565C0" />
          <Text style={styles.noteText}>
            {missing.length === PLACEMENTS.length
              ? 'No nodes registered.'
              : `No ${missing.join(' or ')} node is registered, so ${
                  missing.includes('outdoor')
                    ? 'outdoor PM2.5 shows as No data and ventilation advice stays hedged.'
                    : 'CO₂ and indoor PM2.5 show as No data.'
                }`}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, marginTop: 2 },
  title: { fontSize: 28, fontWeight: '800', color: colors.navy, marginLeft: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.navy },
  sectionHint: { fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 4, marginBottom: 14 },
  deviceCard: { padding: 14, marginBottom: 12 },
  deviceTop: { flexDirection: 'row', alignItems: 'center' },
  deviceId: { flex: 1, fontSize: 14, color: colors.navy, fontWeight: '600', marginLeft: 8, marginRight: 10 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#E6EEF6',
    borderRadius: 10,
    padding: 3,
    marginTop: 12,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.muted, marginLeft: 6 },
  segmentTextActive: { color: '#FFFFFF' },
  deviceHelp: { fontSize: 13, color: colors.muted, marginTop: 8 },
  deviceSeen: { fontSize: 13, color: colors.muted, marginTop: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#C8D7E6',
    borderStyle: 'dashed',
    marginTop: 2,
  },
  addText: { fontSize: 16, fontWeight: '600', color: colors.primary, marginLeft: 8 },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, marginTop: 16 },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.infoText, marginLeft: 10 },
});
