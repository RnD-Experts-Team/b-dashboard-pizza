"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface KitErrorBoundaryProps {
  /** What to show instead of the children. `reset` clears the error and re-renders them. */
  fallback: (args: { error: Error; reset: () => void }) => ReactNode;
  children: ReactNode;
}

interface KitErrorBoundaryState {
  error: Error | null;
}

/**
 * A tiny error boundary for the picker panels, so a failure inside the emoji or
 * GIF picker shows an error tile with a retry instead of taking the dialog down.
 */
export class KitErrorBoundary extends Component<
  KitErrorBoundaryProps,
  KitErrorBoundaryState
> {
  state: KitErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): KitErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[announcements] picker failed", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) return this.props.fallback({ error, reset: this.reset });
    return this.props.children;
  }
}
