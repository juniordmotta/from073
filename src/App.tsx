import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MinhasArbitragens from "./pages/MinhasArbitragens";
import CustosOperacionais from "./pages/CustosOperacionais";
import CasasDeApostas from "./pages/CasasDeApostas";
import Parcerias from "./pages/Parcerias";
import Anotacoes from "./pages/Anotacoes";
import Usuarios from "./pages/Usuarios";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/minhas-arbitragens"
              element={
                <ProtectedRoute>
                  <MinhasArbitragens />
                </ProtectedRoute>
              }
            />
            <Route
              path="/custos-operacionais"
              element={
                <ProtectedRoute>
                  <CustosOperacionais />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parcerias"
              element={
                <ProtectedRoute>
                  <Parcerias />
                </ProtectedRoute>
              }
            />
            <Route
              path="/casas-de-apostas"
              element={
                <ProtectedRoute>
                  <CasasDeApostas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/anotacoes"
              element={
                <ProtectedRoute>
                  <Anotacoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <ProtectedRoute allowedRoles={['admin', 'admin_master']}>
                  <Usuarios />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
