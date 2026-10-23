import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { extractDeviceId } from '../data/deviceFeed';
import { colors } from '../theme';

// Full-screen camera for reading the device id off the QR label on a node.
// `onScanned` receives a normalized 24-hex id; the caller decides what to do
// with it, so this stays a reader and never touches registration state.
//
// Scanning is the convenience path, not the only one: a camera that is denied,
// unavailable, or pointed at the wrong sticker has to leave the user typing the
// id instead, so every failure here ends in a message and a way back out.
export default function QrScanner({ visible, onScanned, onClose }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [problem, setProblem] = useState(null);
  // The camera keeps firing for every frame the code stays in view. The ref
  // closes the scanner on the first readable one; state alone would let a
  // second frame through before the re-render landed.
  const handled = useRef(false);

  useEffect(() => {
    if (visible) {
      handled.current = false;
      setProblem(null);
    }
  }, [visible]);

  const onBarcodeScanned = ({ data }) => {
    if (handled.current) return;
    const id = extractDeviceId(data);
    if (!id) {
      setProblem('That code is not a device id. Scan the QR label on the node.');
      return;
    }
    handled.current = true;
    onScanned(id);
  };

  const granted = permission && permission.granted;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onBarcodeScanned}
          />
        ) : null}

        <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <TouchableOpacity
            style={styles.close}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          {granted ? (
            <>
              <View style={styles.frame} />
              <Text style={styles.caption}>
                {problem || 'Point the camera at the QR code on your AirGuard node.'}
              </Text>
            </>
          ) : (
            <View style={styles.ask}>
              <Ionicons name="camera" size={34} color="#FFFFFF" />
              <Text style={styles.askTitle}>Camera access needed</Text>
              <Text style={styles.askBody}>
                AirGuard uses the camera only to read the QR code on your node. You can also type
                the device id instead.
              </Text>
              <TouchableOpacity
                style={styles.askButton}
                onPress={permission && !permission.canAskAgain ? Linking.openSettings : requestPermission}
                accessibilityRole="button"
              >
                <Text style={styles.askButtonText}>
                  {permission && !permission.canAskAgain ? 'Open Settings' : 'Allow camera'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  close: { position: 'absolute', top: 0, right: 0, margin: 16, padding: 8 },
  frame: {
    width: 236,
    height: 236,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  caption: {
    fontSize: 15,
    lineHeight: 21,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 22,
  },
  ask: { alignItems: 'center' },
  askTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginTop: 14 },
  askBody: {
    fontSize: 15,
    lineHeight: 21,
    color: '#D7E0EC',
    textAlign: 'center',
    marginTop: 8,
  },
  askButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 20,
  },
  askButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
