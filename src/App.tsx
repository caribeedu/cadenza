import { AppProvider } from "./app/AppProvider";
import { AppShell } from "./app/AppShell";
import "./styles/design-tokens.css";
import "./styles/typography.css";
import "./styles/components.css";
import "./App.css";
import "./components/Piano.css";
import "./components/Waterfall.css";

function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

export default App;
