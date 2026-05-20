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
const BG      = "#080808";
const SURFACE = "#111111";
const CARD    = "#141414";
const BORDER  = "#1f1f1f";
const LINE    = "#161616";
const TEXT    = "#ffffff";
const TEXT_2  = "#888";
const TEXT_3  = "#3a3a3a";
const VIOLET  = "#7c3aed";
const PURPLE  = "#a78bfa";

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
          headerStyle: { backgroundColor: "#0d0d0d" },
          headerTitleStyle: { color: TEXT, fontSize: 17, fontWeight: "700" },
          headerTintColor: TEXT_2,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.dismiss()} style={s.backBtn}>
              <Text style={s.backArrow}>✕</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* ── Agent context bar ─────────────────────────────────── */}
      <View style={s.contextBar}>
        <View style={[s.contextIcon, {
          backgroundColor: selected.color + "18",
          borderColor: selected.color + "40",
          shadowColor: selected.color,
          shadowOpacity: 0.5,
          shadowRadius: 8,
        }]}>
          <Text style={[s.contextLogo, { color: selected.color }]}>{selected.logo}</Text>
        </View>
        <Text style={s.contextName}>{selected.name}</Text>
        <Text style={s.contextDivider}>·</Text>
        <Text style={s.contextNow}>now</Text>
      </View>

      {/* ── Chat area ─────────────────────────────────────────── */}
      <ScrollView
        style={s.chatArea}
        contentContainerStyle={s.chatContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Agent selector pills */}
        <Text style={s.pickLabel}>Select agent</Text>
        <View style={s.agentGrid}>
          {AGENTS.map((a) => {
            const sel = selectedId === a.id;
            return (
              <TouchableOpacity
                key={a.id}
                style={[s.agentChip, sel && {
                  backgroundColor: a.color + "15",
                  borderColor: a.color + "55",
                  shadowColor: a.color,
                  shadowOpacity: 0.4,
                  shadowRadius: 8,
                  elevation: 4,
                }]}
                onPress={() => setSelectedId(a.id)}
                activeOpacity={0.7}
              >
                <View style={[s.agentChipDot, { backgroundColor: sel ? a.color : TEXT_3 }]} />
                <Text style={[s.agentChipText, sel && { color: a.color, fontWeight: "600" }]}>
                  {a.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Welcome message */}
        <View style={s.welcomeArea}>
          <View style={s.welcomeGlow} />
          <Text style={s.welcomeIcon}>✦</Text>
          <Text style={s.welcomeTitle}>Start a new session</Text>
          <Text style={s.welcomeSub}>Describe what you want to accomplish</Text>
        </View>
      </ScrollView>

      {/* ── Composer ──────────────────────────────────────────── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={88}
      >
        <View style={s.composerWrap}>
          <View style={[s.composerBox, {
            borderColor: message.trim() ? selected.color + "40" : BORDER,
            shadowColor: message.trim() ? selected.color : "transparent",
            shadowOpacity: 0.2,
            shadowRadius: 16,
          }]}>

            {/* Task context row */}
            <View style={s.taskRow}>
              <View style={[s.taskDot, {
                borderColor: selected.color,
                shadowColor: selected.color,
                shadowOpacity: 0.7,
                shadowRadius: 5,
              }]} />
              <Text style={[s.taskText, { color: selected.color }]} numberOfLines={1}>
                {message.trim() || "What do you want to build?"}
              </Text>
            </View>

            {/* Text input */}
            <TextInput
              style={s.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe the task…"
              placeholderTextColor={TEXT_3}
              multiline
              maxLength={4000}
            />

            {/* Toolbar */}
            <View style={s.toolbar}>
              {/* Attach */}
              <TouchableOpacity style={s.toolBtn} activeOpacity={0.7}>
                <Text style={s.toolBtnText}>+</Text>
              </TouchableOpacity>

              {/* Agent pill */}
              <TouchableOpacity style={[s.agentPill, {
                borderColor: selected.color + "40",
                backgroundColor: selected.color + "10",
              }]} activeOpacity={0.7}>
                <Text style={[s.agentPillLogo, { color: selected.color }]}>{selected.logo}</Text>
                <Text style={[s.agentPillName, { color: selected.color }]}>
                  {selected.name.split(" ")[0]}
                </Text>
              </TouchableOpacity>

              {/* Auto mode toggle */}
              <TouchableOpacity
                style={[s.autoToggle, autoMode && {
                  backgroundColor: VIOLET + "20",
                  borderColor: VIOLET + "50",
                }]}
                onPress={() => setAutoMode((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={[s.autoText, autoMode && { color: PURPLE }]}>Auto</Text>
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              {/* Send */}
              <TouchableOpacity
                style={[s.sendBtn, {
                  backgroundColor: message.trim() ? selected.color : SURFACE,
                  borderColor: message.trim() ? selected.color : BORDER,
                  shadowColor: message.trim() ? selected.color : "transparent",
                  shadowOpacity: 0.6,
                  shadowRadius: 10,
                }]}
                onPress={handleCreate}
                disabled={creating}
                activeOpacity={0.8}
              >
                {creating
                  ? <ActivityIndicator color={message.trim() ? "#000" : TEXT_2} size="small" />
                  : <Text style={[s.sendBtnText, { color: message.trim() ? "#000" : TEXT_3 }]}>↑</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Chips row */}
            <View style={s.chipRow}>
              <View style={[s.chip, {
                borderColor: selected.color + "40",
                backgroundColor: selected.color + "08",
              }]}>
                <View style={[s.chipDot, { backgroundColor: selected.color }]} />
                <Text style={[s.chipText, { color: selected.color }]}>MCP (1)</Text>
              </View>
              <TouchableOpacity style={s.chip} activeOpacity={0.7}>
                <Text style={s.chipText}>Skills ({SKILLS_COUNT})</Text>
              </TouchableOpacity>
              <View style={[s.chip, {
                borderColor: VIOLET + "30",
                backgroundColor: VIOLET + "08",
              }]}>
                <Text style={[s.chipText, { color: PURPLE }]}>{selected.model}</Text>
              </View>
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
  backArrow: { color: TEXT_2, fontSize: 16, fontWeight: "400" },

  // Context bar
  contextBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    backgroundColor: "#0c0c0c",
  },
  contextIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  contextLogo: { fontSize: 11, fontWeight: "800" },
  contextName: { color: TEXT_2, fontSize: 13, fontWeight: "500" },
  contextDivider: { color: TEXT_3, fontSize: 14 },
  contextNow: { color: TEXT_3, fontSize: 12 },

  // Chat area
  chatArea: { flex: 1 },
  chatContent: { padding: 20, flexGrow: 1 },

  pickLabel: {
    color: TEXT_3,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  // Agent chips
  agentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 36 },
  agentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  agentChipDot: { width: 6, height: 6, borderRadius: 3 },
  agentChipText: { color: TEXT_3, fontSize: 13, fontWeight: "400" },

  // Welcome
  welcomeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
    position: "relative",
  },
  welcomeGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: VIOLET + "07",
  },
  welcomeIcon: { fontSize: 32, marginBottom: 12, color: PURPLE },
  welcomeTitle: { color: TEXT_2, fontSize: 18, fontWeight: "600", marginBottom: 6 },
  welcomeSub: { color: TEXT_3, fontSize: 13 },

  // Composer
  composerWrap: {
    backgroundColor: "#0c0c0c",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  composerBox: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },

  // Task row
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    gap: 10,
  },
  taskDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  taskText: { flex: 1, fontSize: 13, fontWeight: "500" },

  // Input
  messageInput: {
    color: TEXT,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
    lineHeight: 22,
  },

  // Toolbar
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: LINE,
    gap: 8,
  },
  toolBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnText: { color: TEXT_2, fontSize: 18, lineHeight: 22 },

  // Agent pill in toolbar
  agentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  agentPillLogo: { fontSize: 11, fontWeight: "800" },
  agentPillName: { fontSize: 12, fontWeight: "600" },

  // Auto toggle
  autoToggle: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  autoText: { color: TEXT_3, fontSize: 12, fontWeight: "500" },

  // Send button
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnText: { fontSize: 17, fontWeight: "700", lineHeight: 22 },

  // Chip row
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  chipDot: { width: 5, height: 5, borderRadius: 3 },
  chipText: { color: TEXT_2, fontSize: 11, fontWeight: "500" },
});
