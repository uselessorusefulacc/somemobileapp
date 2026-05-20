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

// Official agentic CLI tools — no model picker, just agent selection
const AGENTS = [
  {
    id: "claude",
    name: "Claude Code",
    tagline: "Anthropic's agentic coding CLI",
    model: "claude-sonnet-4-5",
    accentColor: "#D4B896",
    bgColor: "#1a1510",
    borderColor: "#3d2e1e",
    // Claude logo as text art
    logoText: "✦",
    logoColor: "#D4B896",
    badge: "PREMIUM",
    badgeColor: "#D4B896",
  },
  {
    id: "opencode",
    name: "OpenCode",
    tagline: "Open-source terminal AI agent",
    model: "claude-sonnet-4-5",
    accentColor: "#7C83FD",
    bgColor: "#0f0f1a",
    borderColor: "#2a2a4a",
    logoText: "</>",
    logoColor: "#7C83FD",
    badge: "OPEN SOURCE",
    badgeColor: "#7C83FD",
  },
  {
    id: "codex",
    name: "Codex CLI",
    tagline: "OpenAI's command-line coding agent",
    model: "o3-mini",
    accentColor: "#10A37F",
    bgColor: "#0a1510",
    borderColor: "#1a3a2a",
    logoText: "⬡",
    logoColor: "#10A37F",
    badge: "OpenAI",
    badgeColor: "#10A37F",
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    tagline: "Google's agentic CLI agent",
    model: "gemini-2-5-pro",
    accentColor: "#4285F4",
    bgColor: "#0a0f1a",
    borderColor: "#1a2a3a",
    logoText: "◈",
    logoColor: "#4285F4",
    badge: "Google",
    badgeColor: "#4285F4",
  },
  {
    id: "aider",
    name: "Aider",
    tagline: "AI pair programmer in your terminal",
    model: "claude-sonnet-4-5",
    accentColor: "#22c55e",
    bgColor: "#0a150a",
    borderColor: "#1a3a1a",
    logoText: "⌥",
    logoColor: "#22c55e",
    badge: "COMMUNITY",
    badgeColor: "#22c55e",
  },
];

export default function NewSessionModal() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("claude");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = AGENTS.find((a) => a.id === selectedId)!;

  const handleCreate = async () => {
    const sessionName = name.trim() || `${selected.name} Session`;
    setCreating(true);
    try {
      const data = await apiClient.createSession({
        name: sessionName,
        agentType: selectedId,
        model: selected.model,
      });
      router.dismiss();
      setTimeout(() => router.push(`/session/${data.id}`), 100);
    } catch (e) {
      Alert.alert("Error", String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          title: "New Agent Session",
          presentation: "modal",
          headerStyle: { backgroundColor: "#0c0c0e" },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: "monospace", fontSize: 13, letterSpacing: 1 },
          headerRight: () => (
            <TouchableOpacity onPress={handleCreate} disabled={creating} style={{ marginRight: 4 }}>
              {creating ? (
                <ActivityIndicator color={selected.accentColor} size="small" />
              ) : (
                <Text style={[styles.headerBtn, { color: selected.accentColor }]}>LAUNCH</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Section label */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionLabel}>SELECT AGENT</Text>
          <View style={styles.sectionLine} />
        </View>

        {/* Agent cards */}
        <View style={styles.agentList}>
          {AGENTS.map((agent) => {
            const isSelected = selectedId === agent.id;
            return (
              <TouchableOpacity
                key={agent.id}
                style={[
                  styles.agentCard,
                  {
                    backgroundColor: isSelected ? agent.bgColor : "#111114",
                    borderColor: isSelected ? agent.accentColor : "#1e1e22",
                  },
                ]}
                onPress={() => setSelectedId(agent.id)}
                activeOpacity={0.8}
              >
                {/* Left: logo */}
                <View style={[styles.logoBox, { backgroundColor: `${agent.accentColor}15` }]}>
                  <Text style={[styles.logoText, { color: agent.accentColor }]}>{agent.logoText}</Text>
                </View>

                {/* Center: info */}
                <View style={styles.agentInfo}>
                  <View style={styles.agentNameRow}>
                    <Text style={[styles.agentName, isSelected && { color: agent.accentColor }]}>
                      {agent.name}
                    </Text>
                    <View style={[styles.agentBadge, { backgroundColor: `${agent.badgeColor}15` }]}>
                      <Text style={[styles.agentBadgeText, { color: agent.badgeColor }]}>
                        {agent.badge}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.agentTagline}>{agent.tagline}</Text>
                  <Text style={styles.agentModel}>Default: {agent.model}</Text>
                </View>

                {/* Right: selector */}
                <View style={[styles.selector, { borderColor: isSelected ? agent.accentColor : "#333" }]}>
                  {isSelected && (
                    <View style={[styles.selectorDot, { backgroundColor: agent.accentColor }]} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Session name */}
        <View style={[styles.sectionRow, { marginTop: spacing.lg }]}>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionLabel}>SESSION NAME</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={[styles.inputWrap, { borderColor: selected.borderColor }]}>
          <Text style={[styles.inputPrefix, { color: selected.accentColor }]}>$</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={`${selected.name} Session`}
            placeholderTextColor="#333"
            autoFocus={false}
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
        </View>

        {/* Launch button */}
        <TouchableOpacity
          style={[
            styles.launchBtn,
            { backgroundColor: selected.accentColor },
            creating && { opacity: 0.6 },
          ]}
          onPress={handleCreate}
          disabled={creating}
          activeOpacity={0.85}
        >
          {creating ? (
            <ActivityIndicator color="#000" />
          ) : (
            <View style={styles.launchInner}>
              <Text style={styles.launchText}>LAUNCH {selected.name.toUpperCase()}</Text>
              <Text style={styles.launchArrow}>→</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0c0c0e" },
  content: { padding: spacing.md, paddingBottom: 60 },

  headerBtn: {
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: "#1e1e22" },
  sectionLabel: {
    color: "#444",
    fontSize: 9,
    fontFamily: "monospace",
    letterSpacing: 2.5,
  },

  agentList: { gap: spacing.sm },

  agentCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },

  logoBox: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: 22, fontFamily: "monospace", fontWeight: "700" },

  agentInfo: { flex: 1 },
  agentNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 3,
  },
  agentName: {
    color: "#e0e0e0",
    fontSize: 14,
    fontFamily: "monospace",
    fontWeight: "700",
  },
  agentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  agentBadgeText: { fontSize: 8, fontFamily: "monospace", fontWeight: "700", letterSpacing: 1 },
  agentTagline: { color: "#555", fontSize: 11, fontFamily: "monospace", marginBottom: 3 },
  agentModel: { color: "#333", fontSize: 10, fontFamily: "monospace" },

  selector: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  selectorDot: { width: 10, height: 10, borderRadius: 5 },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111114",
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  inputPrefix: { fontSize: 16, fontFamily: "monospace", fontWeight: "700" },
  input: {
    flex: 1,
    color: "#e0e0e0",
    fontFamily: "monospace",
    fontSize: 14,
    paddingVertical: spacing.md,
    minHeight: 52,
  },

  launchBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  launchInner: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  launchText: { color: "#000", fontFamily: "monospace", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  launchArrow: { color: "#000", fontSize: 18, fontWeight: "900" },
});
