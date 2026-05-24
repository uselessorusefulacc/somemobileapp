import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient } from "../lib/api";
import { colors, fonts, radius, space } from "../lib/theme";

const AGENTS = [
  { id: "claude",   name: "Claude Code",  model: "claude-sonnet-4-5" },
  { id: "opencode", name: "OpenCode",     model: "claude-sonnet-4-5" },
  { id: "codex",    name: "Codex CLI",    model: "o3"                },
  { id: "gemini",   name: "Gemini CLI",   model: "gemini-2-5-pro"    },
  { id: "aider",    name: "Aider",        model: "claude-sonnet-4-5" },
];

export default function NewSessionModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState("claude");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  // Row press animations
  const rowScales = useRef(
    Object.fromEntries(AGENTS.map((a) => [a.id, new Animated.Value(1)]))
  ).current;

  const selected = AGENTS.find((a) => a.id === selectedId)!;

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const data = await apiClient.createSession({
        name: name.trim() || `${selected.name} Session`,
        agentType: selectedId,
        model: selected.model,
      });
      router.dismiss();
      setTimeout(() => router.push(`/session/${data.id}`), 120);
    } catch (e) {
      Alert.alert("Error", String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleSelectAgent = (id: string) => {
    setSelectedId(id);
    const sv = rowScales[id];
    if (sv) {
      Animated.sequence([
        Animated.timing(sv, { toValue: 0.97, duration: 80, useNativeDriver: true }),
        Animated.timing(sv, { toValue: 1,    duration: 120, useNativeDriver: true }),
      ]).start();
    }
  };

  return (
    <View style={[m.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.textSecondary,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.dismiss()} style={m.closeBtn}>
              <Text style={m.closeX}>✕</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <Text style={m.headerTitle}>NEW SESSION</Text>
          ),
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={m.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Agent picker ── */}
        <View style={m.sectionHeaderRow}>
          <Text style={m.sectionLabel}>AGENT</Text>
          <View style={m.sectionLine} />
        </View>

        {AGENTS.map((a) => {
          const sel = selectedId === a.id;
          return (
            <Animated.View
              key={a.id}
              style={[{ transform: [{ scale: rowScales[a.id] ?? 1 }] }]}
            >
              <TouchableOpacity
                style={[m.agentRow, sel && m.agentRowSel]}
                onPress={() => handleSelectAgent(a.id)}
                activeOpacity={0.75}
              >
                {/* Left glow bar */}
                <View
                  style={[
                    m.accent,
                    {
                      backgroundColor: sel ? colors.success : "transparent",
                      shadowColor: sel ? colors.success : "transparent",
                      shadowRadius: sel ? 8 : 0,
                      shadowOpacity: sel ? 0.9 : 0,
                      shadowOffset: { width: 0, height: 0 },
                    },
                  ]}
                />
                <View style={m.agentMeta}>
                  <Text style={[m.agentName, sel && m.agentNameSel]}>{a.name}</Text>
                  <Text style={[m.agentModel, sel && m.agentModelSel]}>{a.model}</Text>
                </View>
                {sel && (
                  <View style={m.checkDotWrap}>
                    <View style={m.checkDot} />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        <View style={m.divider} />

        {/* ── Session name ── */}
        <View style={[m.sectionHeaderRow, { marginTop: space.xl }]}>
          <Text style={m.sectionLabel}>SESSION NAME</Text>
          <View style={m.sectionLine} />
        </View>

        <View style={[m.inputWrap, inputFocused && m.inputWrapFocused]}>
          <TextInput
            style={m.input}
            value={name}
            onChangeText={setName}
            placeholder={`${selected.name} Session`}
            placeholderTextColor={colors.textTertiary}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
        </View>

        <View style={m.divider} />

        <View style={m.modelRow}>
          <Text style={m.modelKey}>MODEL</Text>
          <Text style={m.modelVal}>{selected.model}</Text>
        </View>
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={88}
      >
        <View style={m.footer}>
          <TouchableOpacity
            style={[m.createBtn, creating && { opacity: 0.5 }]}
            onPress={handleCreate}
            disabled={creating}
            activeOpacity={0.8}
          >
            {creating ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={m.createBtnText}>CREATE SESSION</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const m = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: 40 },
  divider: { height: 1, backgroundColor: colors.border },

  closeBtn: { paddingHorizontal: 4 },
  closeX: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 3,
    color: colors.accent,
    textTransform: "uppercase",
    marginRight: 4,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.sm,
  },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 12,
  },

  // Agent rows
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  agentRowSel: {
    backgroundColor: colors.successMuted,
    borderBottomColor: colors.successBorder + "60",
  },
  accent: {
    width: 3,
    alignSelf: "stretch",
    marginLeft: space.lg - 2,
    marginRight: space.sm + 4,
    borderRadius: 2,
  },
  agentMeta: { flex: 1, paddingVertical: 14 },
  agentName: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400",
    color: colors.textSecondary,
    marginBottom: 3,
  },
  agentNameSel: {
    fontFamily: fonts.sansMedium,
    color: colors.success,
    textShadowColor: colors.success + "50",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  agentModel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.2,
  },
  agentModelSel: {
    color: colors.success + "AA",
  },
  checkDotWrap: {
    width: 20,
    alignItems: "center",
    marginRight: space.lg,
  },
  checkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    shadowColor: colors.success,
    shadowRadius: 6,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
  },

  // Input
  inputWrap: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 2,
    marginHorizontal: space.lg,
    marginVertical: space.sm,
    backgroundColor: colors.surface,
  },
  inputWrapFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + "08",
    shadowColor: colors.accent,
    shadowRadius: 10,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 0 },
  },
  input: {
    fontFamily: fonts.sans,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    letterSpacing: -0.1,
  },

  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  modelKey: {
    fontFamily: fonts.sansMedium,
    fontSize: 8,
    letterSpacing: 1.6,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
  modelVal: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
  },

  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.accent + "30",
    backgroundColor: colors.bg,
  },
  createBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 2,
    shadowColor: colors.accent,
    shadowRadius: 16,
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 0 },
  },
  createBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2.0,
    color: colors.bg,
    textTransform: "uppercase",
  },
});
