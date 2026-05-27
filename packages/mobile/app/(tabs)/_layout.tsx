import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  PanResponder,
} from "react-native";
import { Tabs, useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../lib/theme";
import * as Haptics from "expo-haptics";

const { width: W } = Dimensions.get("window");

const TABS = [
  { name: "sessions",  label: "Sessions"  },
  { name: "dashboard", label: "Dashboard" },
  { name: "cost",      label: "Cost"      },
  { name: "connect",   label: "Connect"   },
];

function getTabIndex(pathname: string) {
  const seg = pathname.split("/").pop() ?? "";
  const i   = TABS.findIndex((t) => t.name === seg);
  return i >= 0 ? i : 1;
}

// ── Tab pill ──────────────────────────────────────────────────────────────
function TabItem({
  label,
  focused,
  onPress,
}: {
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(focused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(glow, {
      toValue: focused ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const press = (v: number) =>
    Animated.spring(scale, {
      toValue: v,
      useNativeDriver: true,
      speed: 60,
      bounciness: 4,
    }).start();

  const bgColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,136,0,0)", "rgba(255,136,0,0.12)"],
  });
  const borderColor = glow.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,136,0,0)", "rgba(255,136,0,0.4)"],
  });

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => press(0.92)}
        onPressOut={() => press(1)}
        activeOpacity={1}
        accessibilityLabel={`${label} tab`}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
      >
        <Animated.View
          style={[st.pill, { backgroundColor: bgColor, borderColor }]}
        >
          {focused && <View style={st.activeDash} />}
          <Text style={[st.pillLabel, focused && st.pillLabelActive]}>
            {label.toUpperCase()}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Scrub bar ─────────────────────────────────────────────────────────────
function ScrubBar({ activeIdx }: { activeIdx: number }) {
  const pos = useRef(new Animated.Value(activeIdx)).current;

  React.useEffect(() => {
    Animated.spring(pos, {
      toValue: activeIdx,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [activeIdx]);

  const thumbW    = W / TABS.length - 24;
  const maxOffset = W - thumbW - 24;
  const translateX = pos.interpolate({
    inputRange: [0, TABS.length - 1],
    outputRange: [12, maxOffset],
    extrapolate: "clamp",
  });

  return (
    <View style={st.scrubWrap}>
      <View style={st.scrubTrack} />
      <Animated.View
        style={[st.scrubThumb, { width: thumbW, transform: [{ translateX }] }]}
      />
    </View>
  );
}

// ── Custom tab bar ─────────────────────────────────────────────────────────
function CustomTabBar({ activeIdx, onTab }: { activeIdx: number; onTab: (i: number) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.navbar, { paddingBottom: insets.bottom }]}>
      <ScrubBar activeIdx={activeIdx} />
      <View style={st.tabRow}>
        {TABS.map((tab, i) => (
          <TabItem
            key={tab.name}
            label={tab.label}
            focused={activeIdx === i}
            onPress={() => onTab(i)}
          />
        ))}
      </View>
    </View>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────
export default function TabLayout() {
  const router   = useRouter();
  const pathname = usePathname();
  const activeIdx = getTabIndex(pathname);

  const navigateTo = useCallback(
    (i: number) => {
      if (i === activeIdx) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.replace(`/(tabs)/${TABS[i].name}` as const);
    },
    [activeIdx, router]
  );

  // Swipe pan responder
  const activeIdxRef = useRef(activeIdx);
  activeIdxRef.current = activeIdx;
  const swipeRef = useRef({ startX: 0 });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: (_, g) => {
        swipeRef.current.startX = g.x0;
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 40) {
          const idx = activeIdxRef.current;
          const dir = g.dx < 0 ? 1 : -1;
          const next = Math.max(0, Math.min(TABS.length - 1, idx + dir));
          if (next !== idx) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace(`/(tabs)/${TABS[next].name}` as const);
          }
        }
      },
    })
  ).current;

  return (
    <View style={st.root} {...panResponder.panHandlers}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={() => (
          <CustomTabBar activeIdx={activeIdx} onTab={navigateTo} />
        )}
      >
        <Tabs.Screen name="sessions"  options={{ title: "Sessions"  }} />
        <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
        <Tabs.Screen name="cost"      options={{ title: "Cost"      }} />
        <Tabs.Screen name="connect"   options={{ title: "Connect"   }} />
      </Tabs>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  navbar: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  scrubWrap: {
    height: 12,
    justifyContent: "center",
    marginTop: 8,
  },
  scrubTrack: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: colors.border,
    borderRadius: 1,
  },
  scrubThumb: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowRadius: 8,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },

  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 4,
    gap: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 5,
  },
  activeDash: {
    width: 3,
    height: 11,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowRadius: 5,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
  },
  pillLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textSecondary,
  },
  pillLabelActive: {
    color: colors.accent,
  },
});
