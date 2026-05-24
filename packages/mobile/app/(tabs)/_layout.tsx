import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../lib/theme";
import * as Haptics from "expo-haptics";

// Import screens directly — paged ScrollView needs them all mounted
import SessionsScreen  from "./sessions";
import DashboardScreen from "./dashboard";
import CostScreen      from "./cost";
import ConnectScreen   from "./connect";

const { width: W } = Dimensions.get("window");

const TABS = [
  { name: "sessions",  label: "Sessions"  },
  { name: "dashboard", label: "Dashboard" },
  { name: "cost",      label: "Cost"      },
  { name: "connect",   label: "Connect"   },
];

const SCREENS = [SessionsScreen, DashboardScreen, CostScreen, ConnectScreen];

function getInitialIndex(pathname: string) {
  const seg = pathname.replace("/", "").split("/")[0];
  const i   = TABS.findIndex((t) => t.name === seg);
  return i >= 0 ? i : 1; // default: dashboard
}

// ── Animated tab pill ─────────────────────────────────────────────────────
function TabItem({ label, focused, onPress }: { label: string; focused: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow  = useRef(new Animated.Value(focused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(glow, { toValue: focused ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [focused]);

  const press = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 60, bounciness: 4 }).start();

  const bgColor     = glow.interpolate({ inputRange: [0, 1], outputRange: ["rgba(255,136,0,0)", "rgba(255,136,0,0.12)"] });
  const borderColor = glow.interpolate({ inputRange: [0, 1], outputRange: ["rgba(255,136,0,0)", "rgba(255,136,0,0.4)"] });

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity onPress={onPress} onPressIn={() => press(0.92)} onPressOut={() => press(1)} activeOpacity={1}>
        <Animated.View style={[st.pill, { backgroundColor: bgColor, borderColor }]}>
          {focused && (
            <View style={st.activeDash} />
          )}
          <Text style={[st.pillLabel, focused && st.pillLabelActive]}>
            {label.toUpperCase()}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Sliding position indicator ────────────────────────────────────────────
function ScrubBar({ scrollX }: { scrollX: Animated.Value }) {
  const thumbW = W / TABS.length - 24;
  const translateX = scrollX.interpolate({
    inputRange: [0, W * (TABS.length - 1)],
    outputRange: [12, W - thumbW - 12],
    extrapolate: "clamp",
  });
  return (
    <View style={st.scrubWrap}>
      <View style={st.scrubTrack} />
      <Animated.View style={[st.scrubThumb, { width: thumbW, transform: [{ translateX }] }]} />
    </View>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────
export default function TabLayout() {
  const insets    = useSafeAreaInsets();
  const pathname  = usePathname();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX   = useRef(new Animated.Value(0)).current;
  const [activeIdx, setActiveIdx] = useState(() => getInitialIndex(pathname));
  const isScrolling = useRef(false);

  const goTo = useCallback((idx: number) => {
    if (idx === activeIdx) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveIdx(idx);
    scrollRef.current?.scrollTo({ x: idx * W, animated: true });
  }, [activeIdx]);

  const onMomentumEnd = useCallback((e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    if (idx !== activeIdx) {
      setActiveIdx(idx);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    isScrolling.current = false;
  }, [activeIdx]);

  const onScrollBegin = useCallback(() => {
    isScrolling.current = true;
  }, []);

  return (
    <View style={st.root}>
      {/* ── Paged scroll area ── */}
      <Animated.ScrollView
        ref={scrollRef as any}
        horizontal
        pagingEnabled
        scrollEventThrottle={8}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onScrollBeginDrag={onScrollBegin}
        onMomentumScrollEnd={onMomentumEnd}
        bounces={false}
        decelerationRate="fast"
        style={{ flex: 1 }}
        contentContainerStyle={{ width: W * TABS.length }}
      >
        {SCREENS.map((Screen, i) => (
          <View key={TABS[i].name} style={{ width: W, flex: 1 }}>
            <Screen />
          </View>
        ))}
      </Animated.ScrollView>

      {/* ── Bottom nav ── */}
      <View style={[st.navbar, { paddingBottom: insets.bottom }]}>
        <ScrubBar scrollX={scrollX} />
        <View style={st.tabRow}>
          {TABS.map((tab, i) => (
            <TabItem
              key={tab.name}
              label={tab.label}
              focused={activeIdx === i}
              onPress={() => goTo(i)}
            />
          ))}
        </View>
      </View>
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

  // Scrub bar
  scrubWrap: {
    height: 12,
    justifyContent: "center",
    marginHorizontal: 0,
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

  // Tab pills
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
