import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../../lib/theme";

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    <View style={[styles.icon, focused && styles.iconFocused]}>
      <Text style={[styles.iconText, focused && styles.iconTextFocused]}>{icon}</Text>
      {focused && <Text style={styles.iconLabel}>{label}</Text>}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="⚡" label="DASHBOARD" />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="▣" label="AGENTS" />,
        }}
      />
      <Tabs.Screen
        name="cost"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="◎" label="COSTS" />,
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="⟡" label="CONNECT" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#0c0c0e",
    borderTopColor: "#1a1a1e",
    borderTopWidth: 1,
    height: 68,
    paddingTop: 8,
    paddingBottom: 10,
  },
  icon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  iconFocused: {
    backgroundColor: `${colors.accent}12`,
  },
  iconText: {
    fontSize: 18,
    color: "#333",
  },
  iconTextFocused: {
    color: colors.accent,
  },
  iconLabel: {
    fontSize: 9,
    fontFamily: "monospace",
    fontWeight: "700",
    color: colors.accent,
    letterSpacing: 1,
  },
});
