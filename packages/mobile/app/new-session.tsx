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

// ── Design tokens ────────────────────────────────────────────────
const BG      = "#141414";
const SURFACE = "#1e1e1e";
const BORDER  = "#282828";
const LINE    = "#1e1e1e";
const TEXT    = "#f0f0f0";
const TEXT_2  = "#888";
const TEXT_3  = "#444";

const AGENTS = [
  { id: "claude",   name: "Claude Code",     model: "claude-sonnet-4-5", color: "#D4A574", logo: "A"  },
  { id: "opencode", name: "OpenCode",         model: "claude-sonnet-4-5", color: "#818CF8", logo: "O"  },
  { id: "codex",    name: "Codex CLI",        model: "o3",                color: "#10A37F", logo: "C"  },
  { id: "gemini",   name: "Gemini CLI",       model: "gemini-2-5-pro",    color: "#4285F4", logo: "G"  },
  { id: "aider",    name: "Aider",            model: "claude-sonnet-4-5", color: "#22c55e", logo: "Ai" },
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
    setCreating(true);
    try {
      const data = await apiClient.createSession({
        name: message.trim() || `${selected.name} Session`,
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
    <View style={[s.root, { paddingBottom: insets.bottom }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "New session",
          headerStyle: { backgroundColor: BG },
          headerTitleStyle: { color: TEXT, fontSize: 16, fontWeight: "600" },
          headerTintColor: TEXT_2,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.dismiss()} style={s.backBtn}>
              <Text style={s.backArrow}>←</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* ── Agent context header ───────────────────────── */}
      <View style={s.contextBar}>
        <View style={[s.contextDot, { backgroundColor: selected.color + "22", borderColor: selected.color + "44" }]}>
          <Text style={[s.contextLogo, { color: selected.color }]}>{selected.logo}</Text>
        </View>
        <Text style={s.contextName}>{selected.name}</Text>
        <View style={[s.contextIndicator, { backgroundColor: TEXT_3 }]} />
        <Text style={s.contextNow}>now</Text>
      </View>

      {/* ── Chat area ──────────────────────────────────── */}
      <ScrollView
        style={s.chatArea}
        contentContainerStyle={s.chatContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Agent pills */}
        <View style={s.agentPills}>
          {AGENTS.map((a) => {
            const sel = selectedId === a.id;
            return (
              <TouchableOpacity
                key={a.id}
                style={[s.agentPill, sel && {
                  borderColor: a.color + "55",
                  backgroundColor: a.color + "12",
                }]}
                onPress={() => setSelectedId(a.id)}
                activeOpacity={0.7}
              >
                <View style={[s.agentPillDot, { backgroundColor: sel ? a.color : TEXT_3 }]} />
                <Text style={[s.agentPillText, sel && { color: a.color }]}>{a.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Empty state prompt */}
        <View style={s.welcomeArea}>
          <Text style={s.welcomeText}>Start a new conversation</Text>
        </View>
      </ScrollView>

      {/* ── Bottom composer ───────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={88}
      >
        <View style={s.composer}>
          {/* Input area */}
          <View style={s.inputBox}>
            {/* Task prefix row */}
            <View style={s.taskRow}>
              <View style={[s.taskDot, { borderColor: selected.color }]} />
              <Text style={s.taskPlaceholder} numberOfLines={1}>
                {message.trim() || "Check current branch…"}
              </Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={s.taskChevron}>∧</Text>
              </TouchableOpacity>
            </View>

            {/* Message input */}
            <TextInput
              style={s.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Type your message…"
              placeholderTextColor={TEXT_3}
              multiline
              maxLength={4000}
            />

            {/* Toolbar */}
            <View style={s.toolbar}>
              {/* Plus */}
              <TouchableOpacity style={s.toolBtn} activeOpacity={0.7}>
                <Text style={s.toolBtnText}>+</Text>
              </TouchableOpacity>

              {/* Model pill */}
              <TouchableOpacity style={s.modelPill} activeOpacity={0.7}>
                <Text style={[s.modelPillLogo, { color: selected.color }]}>{selected.logo}</Text>
                <Text style={s.modelPillName}>{selected.name.split(" ")[0]}</Text>
                <Text style={s.modelPillSignal}>|||</Text>
              </TouchableOpacity>

              {/* Auto toggle */}
              <TouchableOpacity
                style={[s.togglePill, autoMode && s.togglePillOn]}
                onPress={() => setAutoMode((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={[s.toggleText, autoMode && s.toggleTextOn]}>Auto</Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              {/* Send */}
              <TouchableOpacity
                style={[s.sendBtn, (message.trim() || creating) && s.sendBtnActive]}
                onPress={handleCreate}
                disabled={creating}
                activeOpacity={0.8}
              >
                {creating
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={s.sendBtnText}>↑</Text>
                }
              </TouchableOpacity>
            </View>

            {/* MCP + Skills row */}
            <View style={s.chipRow}>
              <View style={[s.chip, { borderColor: selected.color + "44" }]}>
                <View style={[s.chipDot, { backgroundColor: selected.color }]} />
                <Text style={[s.chipText, { color: selected.color }]}>MCP (1)</Text>
              </View>
              <TouchableOpacity style={s.chip} activeOpacity={0.7}>
                <Text style={s.chipText}>Skills ({SKILLS_COUNT})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  backBtn: { paddingHorizontal: 4 },
  backArrow: { color: TEXT_2, fontSize: 20 },

  // Context bar (project + "now")
  contextBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 18, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: LINE,
  },
  contextDot: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
  },
  contextLogo: { fontSize: 10, fontWeight: "700" },
  contextName: { color: TEXT_2, fontSize: 13 },
  contextIndicator: { width: 5, height: 5, borderRadius: 3 },
  contextNow: { color: TEXT_3, fontSize: 12 },

  // Chat area
  chatArea: { flex: 1 },
  chatContent: { padding: 20, paddingTop: 20, flexGrow: 1 },

  // Agent pills
  agentPills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 40 },
  agentPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: BORDER,
  },
  agentPillDot: { width: 6, height: 6, borderRadius: 3 },
  agentPillText: { color: TEXT_3, fontSize: 13 },

  // Welcome
  welcomeArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 20 },
  welcomeText: { color: TEXT_3, fontSize: 15 },

  // Composer
  composer: {
    backgroundColor: BG,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  inputBox: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },

  // Task row
  taskRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: LINE,
    gap: 10,
  },
  taskDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  taskPlaceholder: { flex: 1, color: TEXT_2, fontSize: 13 },
  taskChevron: { color: TEXT_3, fontSize: 14 },

  // Message input
  messageInput: {
    color: TEXT, fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12,
    maxHeight: 100, lineHeight: 21,
  },

  // Toolbar
  toolbar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: LINE, gap: 8,
  },
  toolBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: "#252525",
    alignItems: "center", justifyContent: "center",
  },
  toolBtnText: { color: TEXT_2, fontSize: 16 },

  // Model pill
  modelPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14, backgroundColor: "#252525",
  },
  modelPillLogo: { fontSize: 11, fontWeight: "700" },
  modelPillName: { color: TEXT_2, fontSize: 12 },
  modelPillSignal: { color: TEXT_3, fontSize: 9, letterSpacing: -1 },

  // Auto toggle
  togglePill: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 14, backgroundColor: "#252525",
  },
  togglePillOn: { backgroundColor: TEXT },
  toggleText: { color: TEXT_2, fontSize: 12, fontWeight: "500" },
  toggleTextOn: { color: "#000" },

  // Send button
  sendBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#2a2a2a",
    alignItems: "center", justifyContent: "center",
  },
  sendBtnActive: { backgroundColor: TEXT },
  sendBtnText: { color: "#000", fontSize: 17, fontWeight: "700", lineHeight: 22 },

  // Chip row (MCP + Skills)
  chipRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: LINE,
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { color: TEXT_2, fontSize: 12 },
});
