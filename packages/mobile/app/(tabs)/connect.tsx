import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing, radius } from "../../lib/theme";
import { apiClient, API_BASE } from "../../lib/api";

const AGENT_TYPES = [
  {
    id: "claude",
    label: "Claude Code",
    desc: "Anthropic's Claude with computer use",
    color: colors.agentClaude,
  },
  {
    id: "opencode",
    label: "OpenCode",
    desc: "Open-source coding agent (Runable-native)",
    color: colors.agentOpencode,
  },
  {
    id: "codex",
    label: "Codex CLI",
    desc: "OpenAI's terminal-native coding agent",
    color: colors.agentCodex,
  },
  {
    id: "custom",
    label: "Custom Agent",
    desc: "Any LLM agent with token event webhook",
    color: colors.textSecondary,
  },
];

const MODELS_BY_AGENT: Record<string, string[]> = {
  claude: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"],
  opencode: ["claude-sonnet-4-5", "gpt-4o", "gemini-2-5-pro"],
  codex: ["o3-mini", "gpt-4o", "gpt-4o-mini"],
  custom: ["gpt-4o", "gpt-4o-mini", "claude-haiku-3-5", "gemini-2-5-flash"],
};

function AgentTypeCard({
  agent,
  selected,
  onPress,
}: {
  agent: (typeof AGENT_TYPES)[0];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.agentCard,
        selected && { borderColor: agent.color, backgroundColor: agent.color + "15" },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.agentDot, { backgroundColor: agent.color }]} />
      <View style={styles.agentCardText}>
        <Text style={[styles.agentCardLabel, selected && { color: agent.color }]}>
          {agent.label}
        </Text>
        <Text style={styles.agentCardDesc}>{agent.desc}</Text>
      </View>
      {selected && (
        <View style={[styles.checkMark, { borderColor: agent.color }]}>
          <Text style={[styles.checkMarkText, { color: agent.color }]}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ModelChip({
  model,
  selected,
  onPress,
}: {
  model: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.modelChip, selected && styles.modelChipSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.modelChipText, selected && styles.modelChipTextSelected]}>
        {model}
      </Text>
    </TouchableOpacity>
  );
}

export default function ConnectScreen() {
  const router = useRouter();
  const [agentType, setAgentType] = useState("claude");
  const [model, setModel] = useState("claude-sonnet-4-5");
  const [sessionName, setSessionName] = useState("");
  const [sandboxUrl, setSandboxUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const selectedAgent = AGENT_TYPES.find((a) => a.id === agentType)!;
  const models = MODELS_BY_AGENT[agentType] || [];

  // When agent type changes, reset model to first available
  const handleAgentChange = (id: string) => {
    setAgentType(id);
    setModel(MODELS_BY_AGENT[id][0]);
  };

  const handleCreate = async () => {
    const name = sessionName.trim() || `${selectedAgent.label} Session`;
    setCreating(true);
    try {
      const data = await apiClient.createSession({
        name,
        agentType,
        model,
        cloudUrl: sandboxUrl.trim() || undefined,
      });
      Alert.alert(
        "Session Created",
        `"${name}" is ready. Use the webhook URL below to stream token events.\n\nEndpoint: ${API_BASE}/api/sessions/${data.id}/tokens`,
        [
          { text: "View Session", onPress: () => router.push(`/session/${data.id}`) },
          { text: "OK" },
        ]
      );
      setSessionName("");
      setSandboxUrl("");
    } catch (e) {
      Alert.alert("Error", String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Connect</Text>
        <Text style={styles.headerSub}>Link an AI agent to start monitoring</Text>
      </View>

      {/* Runable banner */}
      <TouchableOpacity
        style={styles.runableBanner}
        onPress={() => Linking.openURL("https://runable.com")}
        activeOpacity={0.8}
      >
        <View style={styles.runableLeft}>
          <View style={styles.runableBadge}>
            <Text style={styles.runableBadgeText}>⚡ RUNABLE</Text>
          </View>
          <Text style={styles.runableText}>
            Run agents in a Runable sandbox — zero setup, full isolation
          </Text>
        </View>
        <Text style={styles.runableChevron}>›</Text>
      </TouchableOpacity>

      {/* Agent type */}
      <Text style={styles.sectionTitle}>AGENT TYPE</Text>
      <View style={styles.agentList}>
        {AGENT_TYPES.map((agent) => (
          <AgentTypeCard
            key={agent.id}
            agent={agent}
            selected={agentType === agent.id}
            onPress={() => handleAgentChange(agent.id)}
          />
        ))}
      </View>

      {/* Model */}
      <Text style={styles.sectionTitle}>MODEL</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modelRow}>
        {models.map((m) => (
          <ModelChip
            key={m}
            model={m}
            selected={model === m}
            onPress={() => setModel(m)}
          />
        ))}
      </ScrollView>

      {/* Session name */}
      <Text style={styles.sectionTitle}>SESSION NAME</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={sessionName}
          onChangeText={setSessionName}
          placeholder="e.g. Fix auth bug in API"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
        />
      </View>

      {/* Sandbox URL */}
      <Text style={styles.sectionTitle}>RUNABLE SANDBOX URL (optional)</Text>
      <Text style={styles.fieldHint}>
        Paste the URL of your Runable sandbox where the agent is running
      </Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={sandboxUrl}
          onChangeText={setSandboxUrl}
          placeholder="https://your-sandbox.runable.com"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
      </View>

      {/* Webhook info */}
      <View style={styles.webhookCard}>
        <Text style={styles.webhookTitle}>WEBHOOK INTEGRATION</Text>
        <Text style={styles.webhookText}>
          After creating a session, point your agent to the AgentPilot webhook to stream
          token events in real time.
        </Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>POST /api/sessions/:id/tokens</Text>
          <Text style={styles.codeText}>{'{'}</Text>
          <Text style={styles.codeText}>  "model": "claude-sonnet-4-5",</Text>
          <Text style={styles.codeText}>  "inputTokens": 1024,</Text>
          <Text style={styles.codeText}>  "outputTokens": 512,</Text>
          <Text style={styles.codeText}>  "cacheReadTokens": 256,</Text>
          <Text style={styles.codeText}>  "cacheWriteTokens": 0</Text>
          <Text style={styles.codeText}>{'}'}</Text>
        </View>
      </View>

      {/* Create button */}
      <TouchableOpacity
        style={[styles.createBtn, { backgroundColor: selectedAgent.color }, creating && styles.createBtnDisabled]}
        onPress={handleCreate}
        disabled={creating}
        activeOpacity={0.8}
      >
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createBtnText}>Create Session</Text>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 40 },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontFamily: "SpaceMono",
    fontWeight: "700",
  },
  headerSub: { color: colors.textMuted, fontSize: 11, fontFamily: "SpaceMono", marginTop: 2 },
  runableBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: colors.accentDim,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent + "55",
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  runableLeft: { flex: 1 },
  runableBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginBottom: 6,
  },
  runableBadgeText: { color: "#fff", fontSize: 9, fontFamily: "SpaceMono", fontWeight: "700", letterSpacing: 1 },
  runableText: { color: colors.textSecondary, fontSize: 12, fontFamily: "SpaceMono", lineHeight: 18 },
  runableChevron: { color: colors.accent, fontSize: 22 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "SpaceMono",
    letterSpacing: 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  agentList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  agentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  agentDot: { width: 10, height: 10, borderRadius: 5 },
  agentCardText: { flex: 1 },
  agentCardLabel: { color: colors.text, fontSize: 13, fontFamily: "SpaceMono", fontWeight: "700" },
  agentCardDesc: { color: colors.textMuted, fontSize: 10, fontFamily: "SpaceMono", marginTop: 2 },
  checkMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMarkText: { fontSize: 12, fontWeight: "700" },
  modelRow: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  modelChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  modelChipSelected: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  modelChipText: { color: colors.textMuted, fontSize: 11, fontFamily: "SpaceMono" },
  modelChipTextSelected: { color: colors.accent },
  inputContainer: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  input: {
    color: colors.text,
    fontFamily: "SpaceMono",
    fontSize: 13,
    padding: spacing.md,
    minHeight: 48,
  },
  fieldHint: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: "SpaceMono",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  webhookCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  webhookTitle: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: "SpaceMono",
    letterSpacing: 2,
    marginBottom: 6,
  },
  webhookText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: "SpaceMono",
    lineHeight: 17,
    marginBottom: spacing.md,
  },
  codeBlock: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeText: { color: colors.accent, fontSize: 11, fontFamily: "SpaceMono", lineHeight: 18 },
  createBtn: {
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: "#fff", fontSize: 15, fontFamily: "SpaceMono", fontWeight: "700" },
});
