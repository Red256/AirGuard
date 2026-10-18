import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isValidDeviceId, lookupDevice, normalizeDeviceId } from '../data/deviceFeed';
import { useSettings } from '../state/SettingsContext';
import { cardShadow, colors } from '../theme';

// Registration has four outcomes, and they need different words. A malformed
// id is a typo; a well-formed id with no data is either the wrong node or one
// that has not reported yet; an unreachable database is the user's connection.
const HELP = 'Find this in the Particle console, or on the label on your AirGuard node.';

// Demo convenience: the field starts on the node used for demonstrations so it
// does not have to be typed on a phone. Registration is unchanged — the id is
// still checked against the database when Connect is tapped, and it can be
// edited or cleared. Set this to '' before handing the app to anyone else.
const DEMO_DEVICE_ID = 'e00fce6893f468b723fe10b0';

// `onDone` is for the "change device" route, where the app is already past the
// registration gate and has to navigate back itself. On first launch it is
// omitted: saving the id flips the gate and the tabs mount on their own.
export default function RegisterDeviceScreen({ onCancel, onDone }) {
  const insets = useSafeAreaInsets();
  const { registerDevice } = useSettings();
  const [input, setInput] = useState(DEMO_DEVICE_ID);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState(null);

  const id = normalizeDeviceId(input);
  const wellFormed = isValidDeviceId(id);

  const submit = async () => {
    setProblem(null);
    if (!wellFormed) {
      setProblem({
        kind: 'format',
        text: `A device id is 24 letters and numbers. This one has ${id.length}.`,
      });
      return;
    }
    setChecking(true);
    try {
      const { found } = await lookupDevice(id);
      if (!found) {
        setProblem({
          kind: 'missing',
          text: 'No readings found for this id. Check the id, and that the node has been powered on and online at least once.',
        });
        return;
      }
      // Registering is the last step, so the first screen after this already
      // has a device to subscribe to.
      registerDevice(id);
      if (onDone) onDone();
    } catch (e) {
      setProblem({
        kind: 'offline',
        text: 'Could not reach the database. Check your internet connection and try again.',
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.badge}>
          <Ionicons name="hardware-chip" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>Register your node</Text>
        <Text style={styles.body}>
          AirGuard shows readings from your own sensor node. Enter its device id to connect it.
        </Text>

        <Text style={styles.label}>Device ID</Text>
        <TextInput
          style={[styles.input, problem && styles.inputError]}
          value={input}
          onChangeText={(t) => {
            setInput(t);
            setProblem(null);
          }}
          placeholder="e00fce68…"
          placeholderTextColor="#9AA8BC"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          editable={!checking}
          returnKeyType="go"
          onSubmitEditing={submit}
          accessibilityLabel="Device ID"
        />
        <Text style={styles.hint}>
          {id.length > 0 && !wellFormed ? `${id.length} of 24 characters` : HELP}
        </Text>

        {problem ? (
          <View style={styles.problem}>
            <Ionicons
              name={problem.kind === 'offline' ? 'cloud-offline' : 'alert-circle'}
              size={18}
              color="#C62828"
            />
            <Text style={styles.problemText}>{problem.text}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, (!wellFormed || checking) && styles.buttonDisabled]}
          onPress={submit}
          disabled={!wellFormed || checking}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Connect node"
        >
          {checking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.buttonText}>Connect</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>

        {onCancel ? (
          <TouchableOpacity onPress={onCancel} style={styles.cancel} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 24, flexGrow: 1, justifyContent: 'center' },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E6EEF6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.navy },
  body: { fontSize: 16, lineHeight: 23, color: colors.muted, marginTop: 8, marginBottom: 26 },
  label: { fontSize: 14, fontWeight: '700', color: colors.navy, marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4DEE9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.navy,
    ...cardShadow,
  },
  inputError: { borderColor: '#C62828' },
  hint: { fontSize: 13, color: colors.muted, marginTop: 8 },
  problem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  problemText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#8E2B23', marginLeft: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 26,
    minHeight: 56,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  cancel: { alignSelf: 'center', paddingVertical: 14, marginTop: 4 },
  cancelText: { fontSize: 16, fontWeight: '600', color: colors.muted },
});
