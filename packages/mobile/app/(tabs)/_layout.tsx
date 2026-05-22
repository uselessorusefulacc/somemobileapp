import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, type } from "../../lib/theme";

function TabLabel({ focused, label }: { focused: boolean; label: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.sansMedium,
        fontSize: 10,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: focused ? colors.text : colors.textTertiary,
        marginTop: 3,
      }}
    >
      {label}
    </Text>
  );
}

function TabIcon({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: focused ? colors.text : "transparent",
        borderWidth: 1,
        borderColor: focused ? colors.text : colors.textTertiary,
        marginBottom: 1,
      }}
    />
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="sessions"
        options={{
          title: "Sessions",
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Sessions" />,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Dashboard" />,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cost"
        options={{
          title: "Cost",
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Cost" />,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          title: "Connect",
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} label="Connect" />,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} />,
        }}
      />
    </Tabs>
  );
}
