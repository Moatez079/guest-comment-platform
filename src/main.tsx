import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupOnlineSync } from "./lib/offlineQueue";

// Setup auto-sync for offline feedback when coming back online
setupOnlineSync();

createRoot(document.getElementById("root")!).render(<App />);
