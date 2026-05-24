import { Tabs, usePathname } from "expo-router";
import { Text, View, Animated } from "react-native";
import { useRef, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../lib/theme";

const TAB_ORDER = ["sessions", "dashboard", "cost", "connect"];

function TabLabel({ focused, label }: { focused: boolean; label: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.sansMedium,
        fontSize: 10,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: focused ? colors.text : colors.textSecondary,
        marginTop: 3,
        opacity: focused ? 1 : 0.75,
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
        backgroundColor: focused ? colors.accent : "transparent",
        borderWidth: 1,
        borderColor: focused ? colors.accent : colors.textSecondary,
        marginBottom: 1,
      }}
    />
  );
}

// ── Animated swipe dots ──────────────────────────────────────────────────
function SwipeDots({ activeIndex }: { activeIndex: number }) {
  const anims = useRef(TAB_ORDER.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Pulse the active dot
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(anims[activeIndex], { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(anims[activeIndex], { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    );
    // Reset non-active
    TAB_ORDER.forEach((_, i) => {
      if (i !== activeIndex) {
        Animated.timing(anims[i], { toValue: 0, duration: 150, useNativeDriver: false }).start();
      }
    });
    pulse.start();
    return () => pulse.stop();
  }, [activeIndex]);

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingBottom: 3,
      paddingTop: 2,
    }}>
      {TAB_ORDER.map((_, i) => {
        const isActive = i === activeIndex;
        const width = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [isActive ? 14 : 4, isActive ? 20 : 4],
        });
        const opacity = isActive
          ? anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] })
          : 0.3;
        return (
          <Animated.View
            key={i}
            style={{
              height: 3,
              width: isActive ? width : 4,
              borderRadius: 2,
              backgroundColor: isActive ? colors.accent : colors.textSecondary,
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Derive active index from pathname
  const activeIndex = (() => {
    const seg = pathname.replace("/", "").split("/")[0];
    const idx = TAB_ORDER.indexOf(seg);
    return idx >= 0 ? idx : 0;
  })();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarShowLabel: true,
      }}
      tabBar={(props) => {
        // Custom tab bar with swipe dots
        const { state, descriptors, navigation } = props;
        return (
          <View style={{
            backgroundColor: colors.bg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom,
          }}>
            {/* Swipe indicator dots */}
            <SwipeDots activeIndex={activeIndex} />

            {/* Tabs row */}
            <View style={{
              flexDirection: "row",
              height: 52,
              paddingBottom: 6,
              paddingTop: 6,
            }}>
              {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const isFocused = state.index === index;

                const onPress = () => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                };

                const label = (route.name.charAt(0).toUpperCase() + route.name.slice(1));

                return (
                  <View
                    key={route.key}
                    style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                  >
                    <View
                      onTouchEnd={onPress}
                      style={{ alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 4 }}
                    >
                      <TabIcon focused={isFocused} />
                      <TabLabel focused={isFocused} label={label} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      }}
    >
      <Tabs.Screen
        name="sessions"
        options={{ title: "Sessions" }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Dashboard" }}
      />
      <Tabs.Screen
        name="cost"
        options={{ title: "Cost" }}
      />
      <Tabs.Screen
        name="connect"
        options={{ title: "Connect" }}
      />
    </Tabs>
  );
}
