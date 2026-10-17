import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LineChart from '../components/LineChart';
import { Card, Header, Screen } from '../components/ui';
import { fetchRange } from '../data/deviceFeed';
import {
  CHART_CONFIG,
  generateSeries,
  RANGES,
  rangeStart,
  rollingXLabels,
  SERIES_METRICS,
  toSeries,
  xLabelsFor,
} from '../data/history';
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
  const { settings } = useSettings();
  const live = settings.source !== 'demo';
  const [range, setRange] = useState('24h');
  const [history, setHistory] = useState({ state: 'loading', series: null, error: null });

  const load = useCallback(async () => {
    if (!live) return;
    setHistory({ state: 'loading', series: null, error: null });
    try {
      const now = Date.now();
      const samples = await fetchRange(rangeStart(range, now), now);
      setHistory({ state: 'ready', series: toSeries(samples, range, now), error: null, count: samples.length });
    } catch (error) {
      setHistory({ state: 'error', series: null, error });
    }
  }, [live, range]);

  useEffect(() => {
    load();
  }, [load]);

  // Demo mode keeps the simulated curves, which start at midnight rather than
  // on a rolling window, so the two modes label the x axis differently.
  const demoSeries = useMemo(
    () =>
      live ? null : Object.fromEntries(SERIES_METRICS.map((m) => [m, generateSeries(m, range)])),
    [live, range]
  );
  const xLabels = useMemo(
    () => (live ? rollingXLabels(range) : xLabelsFor(range)),
    [live, range]
  );

  const series = live ? history.series : demoSeries;

  return (
    <Screen>
      <Header />
      {/* main dropped the screen title (the Header carries it now); this line
          stays because it reports whether the chart is live or demo data. */}
      <Text style={styles.subtitle}>
        {live
          ? `Readings your node published, ending now${
              history.state === 'ready' ? ` · ${history.count} samples` : ''
            }`
          : 'Simulated history, for trying the app out'}
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

      {live && history.state === 'error' ? (
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
            {live && history.state === 'loading' ? (
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
