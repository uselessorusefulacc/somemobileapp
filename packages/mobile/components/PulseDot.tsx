import React, { useEffect, useRef } from "react";
import { View, Animated } from "react-native";

interface Props {
  color: string;
  size?: number;
  scaleTo?: number;
  duration?: number;
  pause?: number;
}

export function PulseDot({ color, size = 10, scaleTo = 1.9, duration = 850, pause = 400 }: Props) {
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const s    = useRef(new Animated.Value(1)).current;
  const o    = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    anim.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(s, { toValue: scaleTo, duration, useNativeDriver: true }),
          Animated.timing(o, { toValue: 0,       duration, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(s, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(o, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(pause),
      ])
    );
    anim.current.start();
    return () => anim.current?.stop();
  }, []);

  const inner = size * 0.6;
  const half  = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute", width: size, height: size, borderRadius: half,
        backgroundColor: color, opacity: o, transform: [{ scale: s }],
      }} />
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: color }} />
    </View>
  );
}
