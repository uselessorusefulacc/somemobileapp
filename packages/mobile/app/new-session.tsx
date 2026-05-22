import React, { useState } from "react";
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
        <Text style={m.sectionLabel}>AGENT</Text>
        <View style={m.divider} />

        {AGENTS.map((a, idx) => {
          const sel = selectedId === a.id;
          const isLast = idx === AGENTS.length - 1;
          return (
            <TouchableOpacity
              key={a.id}
              style={[m.agentRow, sel && m.agentRowSel]}
              onPress={() => setSelectedId(a.id)}
              activeOpacity={0.65}
            >
              {/* 2px left accent */}
              <View style={[m.accent, { backgroundColor: sel ? colors.text : "transparent" }]} />

              <View style={m.agentMeta}>
                <Text style={[m.agentName, sel && m.agentNameSel]}>{a.name}</Text>
                <Text style={m.agentModel}>{a.model}</Text>
              </View>

              {sel && <View style={m.checkDot} />}
            </TouchableOpacity>
          );
        })}

        <View style={m.divider} />

        {/* ── Session name ── */}
        <Text style={[m.sectionLabel, { marginTop: space.xl }]}>SESSION NAME</Text>
        <View style={m.divider} />

        <TextInput
          style={m.input}
          value={name}
          onChangeText={setName}
          placeholder={`${selected.name} Session`}
          placeholderTextColor={colors.textTertiary}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />

        <View style={m.divider} />

        {/* ── Model display ── */}
        <View style={m.modelRow}>
          <Text style={m.modelKey}>MODEL</Text>
          <Text style={m.modelVal}>{selected.model}</Text>
        </View>
      </ScrollView>

      {/* ── Footer CTA ── */}
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

  // Header
  closeBtn: { paddingHorizontal: 4 },
  closeX: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginRight: 4,
  },

  // Section label
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: "uppercase",
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.sm,
  },

  // Agent rows
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 60,
  },
  agentRowSel: {
    backgroundColor: colors.surface,
  },
  accent: {
    width: 2,
    alignSelf: "stretch",
    marginLeft: space.lg - 2,
    marginRight: space.sm + 4,
    borderRadius: 1,
  },
  agentMeta: { flex: 1, paddingVertical: 14 },
  agentName: {
    fontFamily: fonts.sans,
    fontSize: 15,
    fontWeight: "400",
    color: colors.textSecondary,
    letterSpacing: 0,
    marginBottom: 3,
  },
  agentNameSel: {
    fontFamily: fonts.sansMedium,
    color: colors.text,
  },
  agentModel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textTertiary,
  },
  checkDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.text,
    marginRight: space.lg,
  },

  // Input
  input: {
    fontFamily: fonts.sans,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    letterSpacing: 0,
  },

  // Model row
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  modelKey: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: "uppercase",
  },
  modelVal: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Footer
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  createBtn: {
    backgroundColor: colors.text,
    paddingVertical: 13,
    alignItems: "center",
    borderRadius: radius.xs,
  },
  createBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.bg,
    textTransform: "uppercase",
  },
});
