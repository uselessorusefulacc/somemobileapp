import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../../lib/theme";

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    <View style={s.wrap}>
      <View style={[s.iconBg, focused && s.iconBgActive]}>
        <Text style={[s.icon, focused && s.iconActive]}>{icon}</Text>
      </View>
      <Text style={[s.label, focused && s.labelActive]}>{label}</Text>
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
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="◫" label="Sessions" />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="◈" label="Overview" />,
        }}
      />
      <Tabs.Screen
        name="cost"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="◎" label="Costs" />,
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="⟡" label="Connect" />,
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: 64,
    paddingTop: 4,
    paddingBottom: 4,
  },
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingTop: 2,
  },
  iconBg: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBgActive: {
    backgroundColor: colors.accentDim,
  },
  icon: {
    fontSize: 16,
    color: colors.textDisabled,
    lineHeight: 20,
  },
  iconActive: {
    color: colors.accent,
  },
  label: {
    fontSize: 10,
    color: colors.textDisabled,
    fontWeight: "500",
  },
  labelActive: {
    color: colors.accent,
  },
});
