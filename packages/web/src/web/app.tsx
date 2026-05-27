import { Route, Switch } from "wouter";
import { Component, type ReactNode } from "react";
import Index from "./pages/index";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean; error: Error | null}> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div>
          Something went wrong.{" "}
          <button onClick={() => this.setState({ hasError: false, error: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <Provider>
        <Switch>
          <Route path="/" component={Index} />
        </Switch>
        {import.meta.env.DEV && <AgentFeedback />}
        <RunableBadge />
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
