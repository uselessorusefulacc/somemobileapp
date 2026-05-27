import React, { Component, type ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/theme";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.container}>
          <View style={styles.icon}><Text style={styles.iconText}>!</Text></View>
          <Text style={styles.title}>CRASHED</Text>
          <Text style={styles.subtitle}>Something went wrong</Text>
          {this.state.error && (
            <Text style={styles.errorText}>{this.state.error.message}</Text>
          )}
          <TouchableOpacity style={styles.retryBtn} onPress={this.handleRetry} activeOpacity={0.7}>
            <Text style={styles.retryText}>↻  RETRY</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: 32, gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerMuted, alignItems: "center", justifyContent: "center" },
  iconText: { fontFamily: fonts.sansMedium, fontSize: 20, color: colors.danger, lineHeight: 24 },
  title: { fontFamily: fonts.sansMedium, fontSize: 10, letterSpacing: 1.8, color: colors.danger, textTransform: "uppercase" },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  errorText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textTertiary, textAlign: "center", maxWidth: "80%" },
  retryBtn: { borderWidth: 1, borderColor: colors.accentBorder, backgroundColor: colors.accentMuted, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 2, marginTop: 4 },
  retryText: { fontFamily: fonts.sansMedium, fontSize: 9, letterSpacing: 1.4, color: colors.accent, textTransform: "uppercase" },
});
