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
import { colors, spacing, radius, typography } from "../lib/theme";

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
              <Text style={m.closeText}>✕</Text>
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

        {AGENTS.map((a, idx) => {
          const sel = selectedId === a.id;
          const isLast = idx === AGENTS.length - 1;
          return (
            <TouchableOpacity
              key={a.id}
              style={[
                m.agentRow,
                sel && m.agentRowSelected,
                !isLast && m.agentRowBorder,
              ]}
              onPress={() => setSelectedId(a.id)}
              activeOpacity={0.65}
            >
              {/* selection indicator */}
              {sel ? (
                <View style={m.selectedBar} />
              ) : (
                <View style={m.unselectedBar} />
              )}

              <View style={m.agentMeta}>
                <Text style={[m.agentName, sel && m.agentNameSelected]}>
                  {a.name}
                </Text>
                <Text style={m.agentModel}>{a.model}</Text>
              </View>

              {sel && (
                <View style={m.checkDot} />
              )}
            </TouchableOpacity>
          );
        })}

        <View style={m.divider} />

        {/* ── Session name ── */}
        <Text style={[m.sectionLabel, { marginTop: spacing.xl }]}>SESSION NAME</Text>

        <View style={m.inputWrap}>
          <TextInput
            style={m.input}
            value={name}
            onChangeText={setName}
            placeholder={`${selected.name} Session`}
            placeholderTextColor={colors.textDisabled}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
        </View>

        {/* ── Model info ── */}
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
            style={[m.createBtn, creating && m.createBtnDisabled]}
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

  scrollContent: {
    paddingBottom: spacing["4xl"],
  },

  // Header
  closeBtn: { paddingHorizontal: 4 },
  closeText: { color: colors.textSecondary, fontSize: 16 },
  headerTitle: {
    ...typography.label,
    color: colors.textTertiary,
    letterSpacing: 1.5,
    marginRight: 4,
  },

  // Section label
  sectionLabel: {
    ...typography.label,
    color: colors.textTertiary,
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },

  // Agent rows
  agentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
    minHeight: 56,
  },
  agentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  agentRowSelected: {
    backgroundColor: colors.surface,
  },

  // Left accent bar (2px — same pattern as sessions list)
  selectedBar: {
    width: 2,
    alignSelf: "stretch",
    backgroundColor: colors.text,
    marginRight: spacing.base,
    marginLeft: spacing.lg,
  },
  unselectedBar: {
    width: 2,
    alignSelf: "stretch",
    backgroundColor: "transparent",
    marginRight: spacing.base,
    marginLeft: spacing.lg,
  },

  agentMeta: { flex: 1 },
  agentName: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: "400",
  },
  agentNameSelected: {
    color: colors.text,
    fontWeight: "600",
  },
  agentModel: {
    fontFamily: "monospace",
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  },

  checkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },

  // Input
  inputWrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: spacing.xs,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontWeight: "400",
  },

  // Model row
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
  },
  modelKey: {
    ...typography.label,
    color: colors.textTertiary,
    letterSpacing: 0.8,
  },
  modelVal: {
    fontFamily: "monospace",
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  createBtn: {
    borderRadius: radius.xs,
    paddingVertical: spacing.base,
    alignItems: "center",
    backgroundColor: colors.text,
  },
  createBtnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    ...typography.label,
    color: colors.bg,
    letterSpacing: 1.5,
    fontSize: 12,
    fontWeight: "700",
  },
});
