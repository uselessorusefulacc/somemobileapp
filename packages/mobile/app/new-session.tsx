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

const AGENTS = [
  { id: "claude",   name: "Claude Code", model: "claude-sonnet-4-5", color: "#D4B896" },
  { id: "opencode", name: "OpenCode",    model: "claude-sonnet-4-5", color: "#7C83FD" },
  { id: "codex",    name: "Codex CLI",   model: "o3-mini",           color: "#10A37F" },
  { id: "gemini",   name: "Gemini CLI",  model: "gemini-2-5-pro",    color: "#4285F4" },
  { id: "aider",    name: "Aider",       model: "claude-sonnet-4-5", color: "#22c55e" },
];

const SKILLS_COUNT = 14;

export default function NewSessionModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState("claude");
  const [message, setMessage] = useState("");
  const [autoMode, setAutoMode] = useState(true);
  const [creating, setCreating] = useState(false);

  const selected = AGENTS.find((a) => a.id === selectedId)!;

  const handleCreate = async () => {
    if (creating) return;
    const sessionName = message.trim() || `${selected.name} Session`;
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
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerStyle: { backgroundColor: "#141414" },
          headerTintColor: "#aaa",
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.dismiss()} style={styles.backBtn}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* Chat area — scrollable messages area (empty for new session) */}
      <ScrollView
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Agent selector pills */}
        <View style={styles.agentPills}>
          {AGENTS.map((agent) => (
            <TouchableOpacity
              key={agent.id}
              style={[
                styles.agentPill,
                selectedId === agent.id && { borderColor: agent.color, backgroundColor: `${agent.color}12` },
              ]}
              onPress={() => setSelectedId(agent.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.agentDot, { backgroundColor: agent.color }]} />
              <Text
                style={[
                  styles.agentPillText,
                  selectedId === agent.id && { color: agent.color },
                ]}
              >
                {agent.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Welcome message */}
        <View style={styles.welcomeArea}>
          <Text style={styles.welcomeTitle}>New Session</Text>
          <Text style={styles.welcomeSub}>
            What would you like {selected.name} to do?
          </Text>
        </View>
      </ScrollView>

      {/* Bottom composer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        <View style={styles.composer}>
          {/* Toolbar row */}
          <View style={styles.composerToolbar}>
            {/* Model pill */}
            <TouchableOpacity style={styles.modelPill} activeOpacity={0.7}>
              <View style={[styles.modelDot, { backgroundColor: selected.color }]} />
              <Text style={styles.modelPillText}>{selected.name}</Text>
              <Text style={styles.modelPillChevron}>|||</Text>
            </TouchableOpacity>

            {/* MCP button */}
            <TouchableOpacity style={styles.toolBtn} activeOpacity={0.7}>
              <Text style={styles.toolBtnText}>+ MCP</Text>
            </TouchableOpacity>

            {/* Skills button */}
            <TouchableOpacity style={styles.toolBtn} activeOpacity={0.7}>
              <Text style={styles.toolBtnText}>Skills ({SKILLS_COUNT})</Text>
            </TouchableOpacity>

            <View style={styles.flex} />

            {/* Auto toggle */}
            <TouchableOpacity
              style={[styles.autoToggle, autoMode && styles.autoToggleOn]}
              onPress={() => setAutoMode((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.autoToggleText, autoMode && styles.autoToggleTextOn]}>
                Auto
              </Text>
            </TouchableOpacity>
          </View>

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder="Type your message..."
              placeholderTextColor="#444"
              multiline
              maxLength={2000}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (message.trim() || creating) && styles.sendBtnActive,
              ]}
              onPress={handleCreate}
              disabled={creating}
              activeOpacity={0.8}
            >
              {creating ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.sendBtnText}>↑</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#141414" },

  backBtn: { paddingHorizontal: 4 },
  backArrow: { color: "#aaa", fontSize: 18 },

  // Chat area
  chatArea: { flex: 1 },
  chatContent: {
    padding: 20,
    paddingTop: 24,
    flexGrow: 1,
  },

  // Agent pills
  agentPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 32,
  },
  agentPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    gap: 6,
  },
  agentDot: { width: 6, height: 6, borderRadius: 3 },
  agentPillText: { color: "#666", fontSize: 13, fontWeight: "400" },

  // Welcome
  welcomeArea: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 40 },
  welcomeTitle: { color: "#e0e0e0", fontSize: 22, fontWeight: "600", marginBottom: 8 },
  welcomeSub: { color: "#555", fontSize: 14, textAlign: "center", lineHeight: 20 },

  // Composer
  composer: {
    backgroundColor: "#1a1a1a",
    borderTopWidth: 1,
    borderTopColor: "#252525",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },

  // Toolbar
  composerToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  modelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#252525",
  },
  modelDot: { width: 7, height: 7, borderRadius: 4 },
  modelPillText: { color: "#c0c0c0", fontSize: 12, fontWeight: "500" },
  modelPillChevron: { color: "#555", fontSize: 10, letterSpacing: -1 },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#252525",
  },
  toolBtnText: { color: "#888", fontSize: 12 },
  flex: { flex: 1 },
  autoToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#252525",
  },
  autoToggleOn: { backgroundColor: "#e0e0e0" },
  autoToggleText: { color: "#888", fontSize: 12, fontWeight: "500" },
  autoToggleTextOn: { color: "#000" },

  // Input
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    backgroundColor: "#252525",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: "#e0e0e0",
    fontSize: 15,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#3a3a3a",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: { backgroundColor: "#ffffff" },
  sendBtnText: { color: "#000", fontSize: 18, fontWeight: "700", lineHeight: 22 },
});
