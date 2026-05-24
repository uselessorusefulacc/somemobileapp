/**
 * DotGrid — subtle dot-matrix background (like the reference image).
 * Uses react-native-svg for crisp rendering at any density.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Pattern, Rect, Circle } from "react-native-svg";

interface Props {
  opacity?: number;
}

export function DotGrid({ opacity = 0.35 }: Props) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Svg width="100%" height="100%" style={{ opacity }}>
        <Defs>
          <Pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <Circle cx="1.5" cy="1.5" r="1.2" fill="#444444" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dots)" />
      </Svg>
    </View>
  );
}
