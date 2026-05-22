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
import {
  colors,
  spacing,
  radius,
  typography,
  getAgentColor,
} from "../lib/theme";

const AGENTS = [
  { id: "claude",   name: "Claude Code",     model: "claude-sonnet-4-5", color: "#D4A574" },
  { id: "opencode", name: "OpenCode",         model: "claude-sonnet-4-5", color: "#818CF8" },
  { id: "codex",    name: "Codex CLI",        model: "o3",                color: "#10A37F" },
  { id: "gemini",   name: "Gemini CLI",       model: "gemini-2-5-pro",    color: "#4285F4" },
  { id: "aider",    name: "Aider",            model: "claude-sonnet-4-5", color: "#4CAF50" },
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
          title: "New session",
          headerStyle: { backgroundColor: colors.bgElevated },
          headerTitleStyle: { color: colors.text, fontSize: 17, fontWeight: "700" },
          headerTintColor: colors.textSecondary,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.dismiss()} style={m.backBtn}>
              <Text style={m.backArrow}>✕</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={m.label}>Select agent</Text>
        {AGENTS.map((a) => {
          const sel = selectedId === a.id;
          return (
            <TouchableOpacity
              key={a.id}
              style={[m.agentCard, sel && { borderColor: a.color + "50", backgroundColor: a.color + "08" }]}
              onPress={() => setSelectedId(a.id)}
              activeOpacity={0.7}
            >
              <View style={[m.agentDot, { backgroundColor: sel ? a.color : colors.textDisabled }]} />
              <Text style={[m.agentName, sel && { color: a.color }]}>{a.name}</Text>
              {sel && <View style={[m.check, { borderColor: a.color }]}><View style={[m.checkInner, { backgroundColor: a.color }]} /></View>}
            </TouchableOpacity>
          );
        })}

        <Text style={[m.label, { marginTop: spacing.xl }]}>Session name</Text>
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

        <View style={m.modelRow}>
          <Text style={m.modelLabel}>Model</Text>
          <Text style={[m.modelValue, { color: selected.color }]}>{selected.model}</Text>
        </View>
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={88}
      >
        <View style={m.footer}>
          <TouchableOpacity
            style={[m.createBtn, { backgroundColor: selected.color }]}
            onPress={handleCreate}
            disabled={creating}
            activeOpacity={0.8}
          >
            {creating
              ? <ActivityIndicator color="#000" />
              : <Text style={[m.createBtnText, { color: "#000" }]}>Create Session</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const m = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  backBtn: { paddingHorizontal: 4 },
  backArrow: { color: colors.textSecondary, fontSize: 16 },

  label: {
    ...typography.label,
    color: colors.textTertiary,
    marginBottom: spacing.base,
  },

  agentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  agentDot: { width: 8, height: 8, borderRadius: 4 },
  agentName: { ...typography.body, color: colors.text },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  checkInner: { width: 10, height: 10, borderRadius: 5 },

  inputWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  input: {
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },

  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  modelLabel: { ...typography.bodySmall, color: colors.textTertiary },
  modelValue: { ...typography.body, fontWeight: "600" },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  createBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.base,
    alignItems: "center",
  },
  createBtnText: { fontSize: 15, fontWeight: "600" },
});
