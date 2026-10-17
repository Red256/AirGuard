import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cardShadow, colors } from '../theme';

const FEATURES = [
  { icon: 'pulse', text: 'Live indoor and outdoor air readings' },
  { icon: 'notifications', text: 'Alerts when air turns unhealthy' },
  { icon: 'bar-chart', text: 'Trends over the last day, week, or month' },
  { icon: 'help-circle', text: 'Resources to help you understand your air quality' },
];

export default function StartScreen({ onStart }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="AirGuard logo" />
        <Text style={styles.title}>AirGuard</Text>
        <Text style={styles.tagline}>Know your air. Breathe smart.</Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.icon} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={22} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.button} onPress={onStart} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Get started">
        <Text style={styles.buttonText}>Get Started</Text>
        <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  logo: { width: 150, height: 150 },
  title: { fontSize: 40, fontWeight: '800', color: colors.navy, marginTop: 12 },
  tagline: { fontSize: 18, color: colors.muted, marginTop: 6, textAlign: 'center' },
  features: { alignSelf: 'stretch', marginTop: 36 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    ...cardShadow,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: { flex: 1, fontSize: 16, color: colors.text, lineHeight: 22 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 16,
    ...cardShadow,
  },
  buttonText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
});
