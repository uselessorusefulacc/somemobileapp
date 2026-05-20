import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

function TabIcon({ focused, icon, label }: { focused: boolean; icon: string; label: string }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.iconText, focused && styles.iconTextFocused]}>{icon}</Text>
      <Text style={[styles.iconLabel, focused && styles.iconLabelFocused]}>{label}</Text>
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

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#141414",
    borderTopColor: "#252525",
    borderTopWidth: 1,
    height: 60,
    paddingTop: 0,
    paddingBottom: 0,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingTop: 6,
  },
  iconText: {
    fontSize: 18,
    color: "#3a3a3a",
  },
  iconTextFocused: {
    color: "#ffffff",
  },
  iconLabel: {
    fontSize: 10,
    color: "#3a3a3a",
    fontWeight: "400",
  },
  iconLabelFocused: {
    color: "#ffffff",
  },
});
