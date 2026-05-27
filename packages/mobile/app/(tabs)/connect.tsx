import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import Constants from "expo-constants";
import { CameraView, Camera } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRelay } from "../../lib/relay-context";
import { colors, fonts, space, type as t, radius } from "../../lib/theme";
import { DotGrid } from "../../components/DotGrid";
import { PulseDot } from "../../components/PulseDot";
import { getRelayUrl, loadSettings } from "../../lib/settings";
const { width: SW, height: SH } = Dimensions.get("window");
const FRAME = Math.min(SW * 0.62, 260);

/** Corner brackets for scanner viewfinder */
function ScanFrame() {
  const CORNER = 22;
  const THICK  = 2.5;
  const corner = { width: CORNER, height: CORNER, borderColor: colors.accent };
  return (
    <View style={{ width: FRAME, height: FRAME }}>
      {/* TL */}
      <View style={[s.corner, { top: 0, left: 0,
        borderTopWidth: THICK, borderLeftWidth: THICK, ...corner }]} />
      {/* TR */}
      <View style={[s.corner, { top: 0, right: 0,
        borderTopWidth: THICK, borderRightWidth: THICK, ...corner }]} />
      {/* BL */}
      <View style={[s.corner, { bottom: 0, left: 0,
        borderBottomWidth: THICK, borderLeftWidth: THICK, ...corner }]} />
      {/* BR */}
      <View style={[s.corner, { bottom: 0, right: 0,
        borderBottomWidth: THICK, borderRightWidth: THICK, ...corner }]} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scanner overlay (full-screen)
// ─────────────────────────────────────────────────────────────────────────────

function ScannerView({
  onScanned,
  onCancel,
}: {
  onScanned: (data: string) => void;
  onCancel: () => void;
}) {
  const scannedRef = useRef(false);
  const scanLineY  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLineY, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handleScan = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    onScanned(data);
  }, [onScanned]);

  const lineTranslate = scanLineY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME - 2],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleScan}
      />

      {/* Dark mask — top */}
      <View style={[s.mask, { top: 0, height: (SH - FRAME) / 2 }]} />
      {/* Dark mask — bottom */}
      <View style={[s.mask, { bottom: 0, height: (SH - FRAME) / 2 }]} />
      {/* Dark mask — left */}
      <View style={[s.mask, {
        top: (SH - FRAME) / 2, height: FRAME,
        left: 0, width: (SW - FRAME) / 2,
      }]} />
      {/* Dark mask — right */}
      <View style={[s.mask, {
        top: (SH - FRAME) / 2, height: FRAME,
        right: 0, width: (SW - FRAME) / 2,
      }]} />

      {/* Viewfinder frame */}
      <View style={s.frameWrapper} pointerEvents="none">
        <ScanFrame />
        {/* Scan line */}
        <Animated.View style={[
          s.scanLine,
          { transform: [{ translateY: lineTranslate }] },
        ]} />
      </View>

      {/* Label */}
      <View style={s.scanLabelWrapper} pointerEvents="none">
        <Text style={s.scanLabelText}>Align QR code from terminal</Text>
      </View>

      {/* Cancel */}
      <View style={s.cancelWrapper}>
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={s.cancelText}>CANCEL</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

type Phase = "idle" | "scanning" | "connecting" | "connected";

export default function ConnectScreen() {
  const insets = useSafeAreaInsets();
  const relay  = useRelay();

  const [phase,     setPhase]     = useState<Phase>("idle");
  const [error,     setError]     = useState("");

  // Keep phase in sync with relay
  useEffect(() => {
    setPhase(prev => {
      if (relay.isConnected && prev !== "connected") return "connected";
      if (!relay.isConnected && prev === "connected") return "idle";
      return prev;
    });
  }, [relay.isConnected]);

  // ── fade-in ───────────────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // ── handlers ──────────────────────────────────────────────────────────────
  const startScan = useCallback(async () => {
    setError("");
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== "granted") { setError("Camera access required"); return; }
    setPhase("scanning");
  }, []);

  const onScanned = useCallback(async (data: string) => {
    setPhase("connecting");
    try {
      const url = new URL(data);
      const id  = url.searchParams.get("session");
      if (!id) throw new Error("No session ID in QR");
      const baseRelay = `${url.protocol}//${url.host}${url.pathname}`;
      const settings = await loadSettings();
      relay.connect(id, baseRelay || getRelayUrl(settings));
    } catch (e: unknown) {
      setError(`Invalid QR — ${e instanceof Error ? e.message : String(e)}`);
      setPhase("idle");
    }
  }, [relay]);

  const disconnect = useCallback(() => {
    relay.disconnect();
    setPhase("idle");
    setError("");
  }, [relay]);

  const cancelConnect = useCallback(() => {
    relay.disconnect();
    setPhase("idle");
    setError("");
  }, [relay]);

  // ── scanner fullscreen ─────────────────────────────────────────────────────
  if (phase === "scanning") {
    return (
      <ScannerView
        onScanned={onScanned}
        onCancel={() => setPhase("idle")}
      />
    );
  }

  // ── main UI ───────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <DotGrid />

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>CONNECT</Text>
        <View style={[s.statusPill, phase === "connected" && s.statusPillLive]}>
          {phase === "connected"
            ? <PulseDot color={colors.success} />
            : <View style={[s.statusDot,
                phase === "connecting"
                  ? { backgroundColor: colors.warning }
                  : { backgroundColor: colors.textTertiary }
              ]} />
          }
          <Text style={[s.statusLabel, {
            color: phase === "connected" ? colors.success
                 : phase === "connecting" ? colors.warning
                 : colors.textTertiary,
          }]}>
            {phase === "connected" ? "LIVE"
           : phase === "connecting" ? "PAIRING"
           : "OFFLINE"}
          </Text>
        </View>
      </View>
      <View style={s.accentRule} />

      {/* ── Body ── */}
      <Animated.View style={[s.body, { opacity: fadeAnim }]}>

        {/* ── IDLE ── */}
        {phase === "idle" && (
          <View style={s.stateBlock}>
            {/* Icon area */}
            <View style={s.iconRing}>
              <View style={s.iconRingInner}>
                <Text style={s.iconGlyph}>⌗</Text>
              </View>
            </View>

            <Text style={s.stateHeading}>Pair your laptop</Text>
            <Text style={s.stateSub}>
              Run this command on your machine, then scan the QR it prints.
            </Text>

            {/* Terminal snippet */}
            <View style={s.terminalBox}>
              <Text style={s.terminalPrompt}>$</Text>
              <Text style={s.terminalCmd}>npx agentpilot-daemon pair</Text>
            </View>

            {!!error && (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={s.primaryBtn} onPress={startScan} activeOpacity={0.75}>
              <Text style={s.primaryBtnText}>Scan QR Code</Text>
            </TouchableOpacity>

            {/* Steps */}
            <View style={s.steps}>
              {[
                { n: "1", label: "Run pair command on laptop" },
                { n: "2", label: "Scan the QR with this button" },
                { n: "3", label: "Agent goes live instantly" },
              ].map((step, i) => (
                <View key={step.n} style={s.stepRow}>
                  <View style={s.stepBadge}>
                    <Text style={s.stepNum}>{step.n}</Text>
                  </View>
                  <Text style={s.stepLabel}>{step.label}</Text>
                  {i < 2 && <View style={s.stepLine} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── CONNECTING ── */}
        {phase === "connecting" && (
          <View style={s.stateBlock}>
            <View style={[s.iconRing, s.iconRingWarning]}>
              <View style={[s.iconRingInner, { borderColor: colors.warningBorder }]}>
                <ActivityIndicator color={colors.warning} size="small" />
              </View>
            </View>

            <Text style={s.stateHeading}>Connecting…</Text>
            <Text style={s.stateSub}>
              QR scanned. Waiting for your laptop to handshake.
            </Text>
            <Text style={s.stateMicro}>
              Make sure agentpilot-daemon pair is still running.
            </Text>

            <TouchableOpacity style={s.ghostBtn} onPress={cancelConnect} activeOpacity={0.7}>
              <Text style={s.ghostBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── CONNECTED ── */}
        {phase === "connected" && (
          <View style={s.stateBlock}>
            <View style={[s.iconRing, s.iconRingSuccess]}>
              <View style={[s.iconRingInner, { borderColor: colors.successBorder }]}>
                <Text style={[s.iconGlyph, { color: colors.success }]}>✓</Text>
              </View>
            </View>

            <Text style={[s.stateHeading, { color: colors.success }]}>Daemon connected</Text>
            <Text style={s.stateSub}>
              Your laptop agent is live. Head to Dashboard to monitor activity.
            </Text>

            <View style={s.liveRow}>
              <PulseDot color={colors.success} />
              <Text style={s.liveLabel}>LIVE SESSION</Text>
            </View>

            <TouchableOpacity style={s.dangerBtn} onPress={disconnect} activeOpacity={0.7}>
              <Text style={s.dangerBtnText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        )}

      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // ── Header ──
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: space.lg, paddingVertical: 13,
  },
  headerTitle: {
    fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 3,
    color: colors.accent, textTransform: "uppercase",
  },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.xs,
  },
  statusPillLive: {
    borderColor: colors.successBorder, backgroundColor: colors.successMuted,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: {
    fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  accentRule: { height: 1, backgroundColor: colors.accent + "28" },

  // ── Body ──
  body: { flex: 1, alignItems: "center", justifyContent: "center" },

  // ── State block — centred card ──
  stateBlock: {
    width: "100%", paddingHorizontal: space.xl,
    alignItems: "center",
  },

  // ── Icon ring ──
  iconRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.accentMuted,
    alignItems: "center", justifyContent: "center",
    marginBottom: space.lg,
  },
  iconRingWarning: { backgroundColor: colors.warningMuted },
  iconRingSuccess: { backgroundColor: colors.successMuted },
  iconRingInner: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 1, borderColor: colors.accentBorder,
    alignItems: "center", justifyContent: "center",
  },
  iconGlyph: {
    fontFamily: fonts.mono, fontSize: 26,
    color: colors.accent,
  },

  // ── Copy ──
  stateHeading: {
    fontFamily: fonts.sans, fontSize: 24, fontWeight: "300",
    letterSpacing: -0.8, color: colors.text,
    textAlign: "center", marginBottom: 10,
  },
  stateSub: {
    fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary,
    lineHeight: 22, textAlign: "center", marginBottom: 8,
  },
  stateMicro: {
    fontFamily: fonts.mono, fontSize: 11, color: colors.textTertiary,
    textAlign: "center", marginBottom: space.xl,
  },

  // ── Terminal snippet ──
  terminalBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xs,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: space.lg, alignSelf: "stretch",
  },
  terminalPrompt: {
    fontFamily: fonts.mono, fontSize: 13, color: colors.accent,
  },
  terminalCmd: {
    fontFamily: fonts.mono, fontSize: 13, color: colors.text,
  },

  // ── Error ──
  errorBox: {
    alignSelf: "stretch", marginBottom: space.md,
    backgroundColor: colors.dangerMuted,
    borderWidth: 1, borderColor: colors.dangerBorder,
    borderRadius: radius.xs,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: {
    fontFamily: fonts.mono, fontSize: 11, color: colors.danger,
    textAlign: "center",
  },

  // ── Buttons ──
  primaryBtn: {
    alignSelf: "stretch", alignItems: "center",
    backgroundColor: colors.accent,
    paddingVertical: 14, borderRadius: radius.xs,
    marginBottom: space.xl,
  },
  primaryBtnText: {
    fontFamily: fonts.sansMedium, fontSize: 13, letterSpacing: 0.5,
    color: colors.black, textTransform: "uppercase",
  },
  ghostBtn: {
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: space.xl, paddingVertical: 10, borderRadius: radius.xs,
    marginTop: space.md,
  },
  ghostBtnText: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.4,
    color: colors.textSecondary, textTransform: "uppercase",
  },
  dangerBtn: {
    borderWidth: 1, borderColor: colors.dangerBorder,
    paddingHorizontal: space.xl, paddingVertical: 10, borderRadius: radius.xs,
    marginTop: space.lg,
  },
  dangerBtnText: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.4,
    color: colors.danger, textTransform: "uppercase",
  },

  // ── Live row ──
  liveRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: space.sm, marginBottom: 4,
  },
  liveLabel: {
    fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 2,
    color: colors.success, textTransform: "uppercase",
  },

  // ── Steps ──
  steps: { alignSelf: "stretch" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", position: "relative" },
  stepBadge: {
    width: 24, height: 24, borderRadius: radius.xs,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
    marginRight: 12, flexShrink: 0,
  },
  stepNum: {
    fontFamily: fonts.mono, fontSize: 10, color: colors.accent,
  },
  stepLabel: {
    fontFamily: fonts.sans, fontSize: 13, color: colors.textSecondary,
    lineHeight: 24, flex: 1,
  },
  stepLine: {
    position: "absolute", left: 11.5, top: 24, bottom: -12,
    width: 1, backgroundColor: colors.border,
  },

  // ── Scanner ──
  mask: {
    position: "absolute", left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  frameWrapper: {
    position: "absolute",
    top: (SH - FRAME) / 2,
    left: (SW - FRAME) / 2,
    width: FRAME, height: FRAME,
  },
  corner: { position: "absolute" },
  scanLine: {
    position: "absolute", left: 6, right: 6, height: 1.5,
    backgroundColor: colors.accent,
    opacity: 0.7,
  },
  scanLabelWrapper: {
    position: "absolute",
    top: (SH - FRAME) / 2 + FRAME + 20,
    left: 0, right: 0, alignItems: "center",
  },
  scanLabelText: {
    fontFamily: fonts.sans, fontSize: 13,
    color: "rgba(255,255,255,0.7)", textAlign: "center",
    letterSpacing: 0.2,
  },
  cancelWrapper: {
    position: "absolute",
    bottom: 60, left: 0, right: 0, alignItems: "center",
  },
  cancelBtn: {
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 32, paddingVertical: 11, borderRadius: radius.xs,
  },
  cancelText: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 2,
    color: "rgba(255,255,255,0.8)", textTransform: "uppercase",
  },
});
