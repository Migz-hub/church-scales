import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { MinistryProvider } from "@/contexts/MinistryContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import SignUp from "./pages/auth/SignUp";
import ForgotPassword from "./pages/auth/ForgotPassword";
import MinistryEntry from "./pages/MinistryEntry";
import MinistryCreate from "./pages/MinistryCreate";
import MinistryJoin from "./pages/MinistryJoin";
import Dashboard from "./pages/Dashboard";
import Schedules from "./pages/Schedules";
import ScheduleDetail from "./pages/ScheduleDetail";
import ScheduleNew from "./pages/ScheduleNew";
import Members from "./pages/Members";
import Chat from "./pages/Chat";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import SettingsNotifications from "./pages/SettingsNotifications";
import SettingsAppearance from "./pages/SettingsAppearance";
import Ministry from "./pages/Ministry";
import Unavailability from "./pages/Unavailability";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
   <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <MinistryProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<SignUp />} />
              <Route path="/recuperar-senha" element={<ForgotPassword />} />

              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/escalas" element={<Schedules />} />
                <Route path="/escalas/nova" element={<ScheduleNew />} />
                <Route path="/escalas/:id/editar" element={<ScheduleNew />} />
                <Route path="/escalas/:id" element={<ScheduleDetail />} />
                <Route path="/membros" element={<Members />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/notificacoes" element={<Notifications />} />
                <Route path="/configuracoes" element={<Settings />} />
                <Route path="/configuracoes/notificacoes" element={<SettingsNotifications />} />
                <Route path="/configuracoes/aparencia" element={<SettingsAppearance />} />
                <Route path="/ministerio" element={<Ministry />} />
                <Route path="/indisponibilidade" element={<Unavailability />} />
                <Route path="/perfil" element={<Profile />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute requireMinistry={false}>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/ministerios/entrada" element={<MinistryEntry />} />
                <Route path="/ministerios/criar" element={<MinistryCreate />} />
                <Route path="/ministerios/ingressar" element={<MinistryJoin />} />
              </Route>

              <Route path="/index" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MinistryProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
   </ThemeProvider>
  </QueryClientProvider>
);

export default App;
