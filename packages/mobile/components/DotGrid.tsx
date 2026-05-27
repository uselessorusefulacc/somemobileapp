/**
 * DotGrid — dot-matrix background matching the reference.
 * Deep charcoal bg (#111214), dots at #252830 — tight 18px grid, 1.8px radius.
 * Matches: Linear / Vercel / factory.ai dark dot-grid aesthetic.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Pattern, Rect, Circle } from "react-native-svg";

interface Props {
  opacity?: number;
  dotColor?: string;
  spacing?: number;
  dotRadius?: number;
}

export function DotGrid({
  opacity = 1,
  dotColor = "#252830",
  spacing = 18,
  dotRadius = 1.5,
}: Props) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width="100%" height="100%" style={{ opacity }}>
        <Defs>
          <Pattern
            id="dots"
            x="0"
            y="0"
            width={spacing}
            height={spacing}
            patternUnits="userSpaceOnUse"
          >
            <Circle
              cx={spacing / 2}
              cy={spacing / 2}
              r={dotRadius}
              fill={dotColor}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dots)" />
      </Svg>
    </View>
  );
}
