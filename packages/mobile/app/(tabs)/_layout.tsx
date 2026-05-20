import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

const BG = "#141414";
const ACTIVE = "#e0e0e0";
const INACTIVE = "#333";

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    <View style={s.wrap}>
      <Text style={[s.icon, focused && s.iconActive]}>{icon}</Text>
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
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="⊞" label="Sessions" />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="◫" label="Overview" />,
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
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: "#1e1e1e",
    height: 58,
    paddingTop: 0,
    paddingBottom: 0,
  },
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingTop: 6,
  },
  icon: {
    fontSize: 18,
    color: INACTIVE,
  },
  iconActive: {
    color: ACTIVE,
  },
  label: {
    fontSize: 10,
    color: INACTIVE,
  },
  labelActive: {
    color: ACTIVE,
  },
});
