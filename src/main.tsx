import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./pwa-register";

// Initialize theme from localStorage or default to light
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.classList.add(savedTheme);

createRoot(document.getElementById("root")!).render(<App />);
