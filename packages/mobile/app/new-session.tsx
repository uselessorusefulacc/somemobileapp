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
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { colors, spacing, radius } from "../lib/theme";
import { apiClient } from "../lib/api";

const AGENT_TYPES = [
  { id: "claude", label: "Claude Code", color: colors.agentClaude },
  { id: "opencode", label: "OpenCode", color: colors.agentOpencode },
  { id: "codex", label: "Codex CLI", color: colors.agentCodex },
  { id: "custom", label: "Custom", color: colors.textSecondary },
];

const MODELS_BY_AGENT: Record<string, string[]> = {
  claude: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"],
  opencode: ["claude-sonnet-4-5", "gpt-4o", "gemini-2-5-pro"],
  codex: ["o3-mini", "gpt-4o", "gpt-4o-mini"],
  custom: ["gpt-4o", "gpt-4o-mini", "claude-haiku-3-5", "gemini-2-5-flash"],
};

export default function NewSessionModal() {
  const router = useRouter();
  const [agentType, setAgentType] = useState("claude");
  const [model, setModel] = useState("claude-sonnet-4-5");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleAgentChange = (id: string) => {
    setAgentType(id);
    setModel(MODELS_BY_AGENT[id][0]);
  };

  const handleCreate = async () => {
    const sessionName = name.trim() || `${AGENT_TYPES.find((a) => a.id === agentType)?.label} Session`;
    setCreating(true);
    try {
      const data = await apiClient.createSession({ name: sessionName, agentType, model });
      router.dismiss();
      setTimeout(() => router.push(`/session/${data.id}`), 100);
    } catch (e) {
      Alert.alert("Error", String(e));
    } finally {
      setCreating(false);
    }
  };

  const selectedAgent = AGENT_TYPES.find((a) => a.id === agentType)!;

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "New Session",
          presentation: "modal",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: "SpaceMono", fontSize: 14 },
          headerRight: () => (
            <TouchableOpacity onPress={handleCreate} disabled={creating} style={{ marginRight: 4 }}>
              {creating ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={styles.headerBtn}>Create</Text>}
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>AGENT TYPE</Text>
        <View style={styles.agentList}>
          {AGENT_TYPES.map((a) => (
            <TouchableOpacity
              key={a.id}
              style={[styles.agentChip, agentType === a.id && { backgroundColor: `${a.color}12`, borderColor: a.color }]}
              onPress={() => handleAgentChange(a.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.agentDot, { backgroundColor: a.color }]} />
              <Text style={[styles.agentChipText, agentType === a.id && { color: a.color }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>MODEL</Text>
        <View style={styles.modelRow}>
          {MODELS_BY_AGENT[agentType].map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modelChip, model === m && styles.modelChipActive]}
              onPress={() => setModel(m)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modelChipText, model === m && styles.modelChipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>NAME (optional)</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={`${selectedAgent.label} Session`}
            placeholderTextColor={colors.textMuted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
        </View>

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: selectedAgent.color }, creating && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={creating}
        >
          {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create Session</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: 60 },
  headerBtn: { color: colors.accent, fontFamily: "SpaceMono", fontSize: 14, fontWeight: "700" },
  label: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", letterSpacing: 2, marginBottom: spacing.sm, marginTop: spacing.md },

  agentList: { gap: spacing.sm },
  agentChip: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  agentDot: { width: 8, height: 8, borderRadius: 4 },
  agentChipText: { color: colors.text, fontFamily: "SpaceMono", fontSize: 13, fontWeight: "700" },

  modelRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  modelChip: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  modelChipActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  modelChipText: { color: colors.textMuted, fontSize: 11, fontFamily: "SpaceMono" },
  modelChipTextActive: { color: colors.accent },

  inputWrap: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  input: { color: colors.text, fontFamily: "SpaceMono", fontSize: 14, padding: spacing.md, minHeight: 52 },

  createBtn: { marginTop: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
  createBtnText: { color: "#fff", fontFamily: "SpaceMono", fontSize: 15, fontWeight: "700" },
});
