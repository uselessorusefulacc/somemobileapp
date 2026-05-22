import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../../lib/theme";

function TabIcon({ focused, label }: { focused: boolean; label: string }) {
  return (
    <View style={s.wrap}>
      <Text style={[s.label, focused && s.labelActive]}>{label}</Text>
      {focused && <View style={s.dot} />}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: s.bar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="sessions"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="SESSIONS" />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="OVERVIEW" />,
        }}
      />
      <Tabs.Screen
        name="cost"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="COSTS" />,
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="CONNECT" />,
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 56,
    paddingBottom: 0,
  },
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 0.7,
    color: colors.textTertiary,
  },
  labelActive: {
    color: colors.text,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.text,
  },
});
