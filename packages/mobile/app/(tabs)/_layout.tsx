import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../../lib/theme";

interface TabIconProps {
  focused: boolean;
  emoji: string;
  label: string;
}

function TabIcon({ focused, emoji, label }: TabIconProps) {
  return (
    <View style={[styles.iconContainer, focused && styles.iconActive]}>
      <Text style={styles.emoji}>{emoji}</Text>
      {focused && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="⚡" label="Dashboard" />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="🤖" label="Agents" />
          ),
        }}
      />
      <Tabs.Screen
        name="cost"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="💰" label="Costs" />
          ),
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="☁️" label="Connect" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 8,
    paddingTop: 8,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    minWidth: 56,
    flexDirection: "row",
    gap: 6,
  },
  iconActive: {
    backgroundColor: colors.accentDim,
  },
  emoji: {
    fontSize: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.accent,
  },
});
