import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { colors, fonts, radius } from "../lib/theme";

interface StatCardProps {
  label: string;
  value: string;
  valueColor?: string;
  accent?: string;
  delay?: number;
  onPress?: () => void;
}

export function StatCard({ label, value, valueColor, accent, delay, onPress }: StatCardProps) {
  const hasAnimation = delay !== undefined;
  const hasPress = !!onPress;

  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(hasAnimation ? 0 : 1)).current;
  const slideY = useRef(new Animated.Value(hasAnimation ? 20 : 0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!hasAnimation) return;
    entranceAnim.current = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(slideY, { toValue: 0, delay, useNativeDriver: true, damping: 16, stiffness: 180 }),
    ]);
    entranceAnim.current.start();
    return () => entranceAnim.current?.stop();
  }, []);

  const onPressIn = () => {
    if (!hasPress) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.04, useNativeDriver: true, speed: 50, bounciness: 6 }),
      Animated.timing(glowOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const onPressOut = () => {
    if (!hasPress) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }),
      Animated.timing(glowOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const inner = (
    <>
      {accent && <View style={[st.cardGlow, { backgroundColor: accent + "10" }]} />}
      <Animated.View style={[st.cardGlow, { backgroundColor: (accent || colors.accent) + "18", opacity: glowOpacity }]} />
      <Text style={st.cardLabel}>{label}</Text>
      <Text style={[st.cardValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </>
  );

  return (
    <Animated.View style={[st.card, accent ? { borderColor: accent + "55", borderWidth: 1 } : {}, { opacity, transform: [{ translateY: slideY }, { scale }] }]}>
      {hasPress ? (
        <TouchableOpacity activeOpacity={1} onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} style={{ flex: 1 }}>
          {inner}
        </TouchableOpacity>
      ) : inner}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    padding: 14, overflow: "hidden", minHeight: 74, justifyContent: "space-between",
  },
  cardGlow: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: radius.sm,
  },
  cardLabel: {
    fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.6,
    color: colors.textSecondary, textTransform: "uppercase", marginBottom: 6,
  },
  cardValue: {
    fontFamily: fonts.sans, fontSize: 21, fontWeight: "300",
    letterSpacing: -0.8, color: colors.text,
  },
});
