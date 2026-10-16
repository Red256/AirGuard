import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LineChart from '../components/LineChart';
import { Card, Header, Screen } from '../components/ui';
import { CHART_CONFIG, generateSeries, RANGES, xLabelsFor } from '../data/history';
import { METRIC_INFO } from '../data/levels';
import { colors } from '../theme';

const METRIC_ORDER = ['co2', 'pmIndoor', 'pmOutdoor'];

export default function AnalyticsScreen({ navigation }) {
  const [range, setRange] = useState('24h');
  const xLabels = useMemo(() => xLabelsFor(range), [range]);
  const series = useMemo(
    () => Object.fromEntries(METRIC_ORDER.map((m) => [m, generateSeries(m, range)])),
    [range]
  );

  return (
    <Screen>
      <Header />
      <Text style={styles.title}>Air Quality Analytics</Text>

      <View style={styles.rangeRow}>
        {Object.entries(RANGES).map(([key, r]) => {
          const active = key === range;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setRange(key)}
              style={[styles.rangeBtn, active && styles.rangeBtnActive]}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.rangeText, active && styles.rangeTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {METRIC_ORDER.map((m) => {
        const cfg = CHART_CONFIG[m];
        return (
          <Card key={m} style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>{cfg.title}</Text>
              <TouchableOpacity
                hitSlop={10}
                onPress={() => Alert.alert(METRIC_INFO[m].title, METRIC_INFO[m].body)}
                accessibilityLabel={`About ${METRIC_INFO[m].title}`}
              >
                <Ionicons name="information-circle-outline" size={24} color="#6B7B93" />
              </TouchableOpacity>
            </View>
            <LineChart
              id={`grad-${m}`}
              values={series[m]}
              color={cfg.color}
              yMin={cfg.min}
              yMax={cfg.max}
              yStep={cfg.step}
              xLabels={xLabels}
            />
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.navy, marginTop: 4, marginBottom: 12 },
  rangeRow: {
    flexDirection: 'row',
    backgroundColor: '#E6EEF6',
    borderRadius: 14,
    padding: 3,
    marginBottom: 14,
  },
  rangeBtn: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  rangeBtnActive: { backgroundColor: colors.primary },
  rangeText: { fontSize: 15, color: '#4A5A70', fontWeight: '500' },
  rangeTextActive: { color: '#fff', fontWeight: '600' },
  chartCard: { padding: 14, marginBottom: 14 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  chartTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
});
