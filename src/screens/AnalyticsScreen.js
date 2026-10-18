import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LineChart from '../components/LineChart';
import { Card, Header, Screen } from '../components/ui';
import { fetchRange } from '../data/deviceFeed';
import { CHART_CONFIG, RANGES, rangeStart, rollingXLabels, SERIES_METRICS, toSeries } from '../data/history';
import { METRIC_INFO } from '../data/levels';
import { useSettings } from '../state/SettingsContext';
import { colors } from '../theme';

const hasData = (values) => values.some((v) => typeof v === 'number' && isFinite(v));

function EmptyChart({ text }) {
  return (
    <View style={styles.emptyChart}>
      <Text style={styles.emptyChartText}>{text}</Text>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { devices } = useSettings();
  // Re-fetch when the set of nodes or their placements change, not on every
  // settings write.
  const devicesKey = devices.map((d) => `${d.id}:${d.placement}`).join(',');
  const [range, setRange] = useState('24h');
  const [history, setHistory] = useState({ state: 'loading', series: null, error: null });

  const load = useCallback(async () => {
    if (devices.length === 0) return;
    setHistory({ state: 'loading', series: null, error: null });
    try {
      const now = Date.now();
      const from = rangeStart(range, now);
      // One read per node. Each node's samples only carry the metrics its
      // placement supplies, and toSeries() averages per metric ignoring nulls,
      // so concatenating the lists merges indoor and outdoor into one chart set.
      const perDevice = await Promise.all(devices.map((d) => fetchRange(d, from, now)));
      const samples = perDevice.flat().sort((a, b) => a.at - b.at);
      setHistory({ state: 'ready', series: toSeries(samples, range, now), error: null, count: samples.length });
    } catch (error) {
      setHistory({ state: 'error', series: null, error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devicesKey, range]);

  useEffect(() => {
    load();
  }, [load]);

  const xLabels = useMemo(() => rollingXLabels(range), [range]);
  const series = history.series;

  return (
    <Screen>
      <Header />
      {/* main dropped the screen title (the Header carries it now); this line
          stays because it reports how much real data the chart is drawn from. */}
      <Text style={styles.subtitle}>
        {`Readings your node published, ending now${
          history.state === 'ready' ? ` · ${history.count} samples` : ''
        }`}
      </Text>

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

      {history.state === 'error' ? (
        <Card style={styles.errorCard}>
          <Ionicons name="cloud-offline-outline" size={28} color="#C62828" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.errorTitle}>Could not load history</Text>
            <Text style={styles.errorText}>{history.error?.message || 'The database did not respond.'}</Text>
          </View>
          <TouchableOpacity onPress={load} style={styles.retry} accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {SERIES_METRICS.map((m) => {
        const cfg = CHART_CONFIG[m];
        const values = series ? series[m] : null;
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
            {history.state === 'loading' ? (
              <View style={styles.emptyChart}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : !values ? (
              <EmptyChart text="No data" />
            ) : !hasData(values) ? (
              <EmptyChart
                text={
                  m === 'pmOutdoor'
                    ? 'No outdoor sensor connected'
                    : `Nothing recorded in the last ${RANGES[range].label.toLowerCase()}`
                }
              />
            ) : (
              <LineChart
                id={`grad-${m}`}
                values={values}
                color={cfg.color}
                yMin={cfg.min}
                yMax={cfg.max}
                yStep={cfg.step}
                xLabels={xLabels}
              />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 2, marginBottom: 12 },
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
  emptyChart: { height: 150, alignItems: 'center', justifyContent: 'center' },
  emptyChartText: { fontSize: 14, color: colors.muted },
  errorCard: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 14 },
  errorTitle: { fontSize: 15, fontWeight: '700', color: colors.navy },
  errorText: { fontSize: 13, color: colors.muted, marginTop: 2 },
  retry: { paddingHorizontal: 12, paddingVertical: 8 },
  retryText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
