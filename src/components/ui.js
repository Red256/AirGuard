import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cardShadow, colors, palettes } from '../theme';

export function Screen({ children }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 28 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" accessibilityLabel="AirGuard logo" />
        <Text style={styles.brandText}>AirGuard</Text>
      </View>
    </View>
  );
}

export function Pill({ label, palette = 'good', style }) {
  const p = palettes[palette];
  return (
    <View style={[styles.pill, { backgroundColor: p.pillBg }, style]}>
      <Text
        style={[styles.pillText, { color: p.pillText }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function InfoBox({ children, onLearnMore, icon = 'information-circle', iconColor = '#1E88E5' }) {
  return (
    <View style={styles.infoBox}>
      <Ionicons name={icon} size={26} color={iconColor} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.infoText}>{children}</Text>
        {onLearnMore ? (
          <TouchableOpacity onPress={onLearnMore} style={styles.learn} hitSlop={8}>
            <Text style={styles.learnText}>Learn more</Text>
            <Ionicons name="arrow-forward" size={16} color="#1565C0" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 48, height: 48 },
  brandText: { fontSize: 26, fontWeight: '700', color: colors.navy, marginLeft: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, alignSelf: 'center', flexShrink: 0 },
  pillText: { fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.card, borderRadius: 20, ...cardShadow },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.infoBg,
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
  },
  infoText: { fontSize: 15, lineHeight: 22, color: colors.infoText },
  learn: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  learnText: { fontSize: 16, fontWeight: '500', color: '#1565C0' },
});
