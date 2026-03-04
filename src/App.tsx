import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import GuestLanguageSelect from "./pages/GuestLanguageSelect";
import GuestRoomNumber from "./pages/GuestRoomNumber";
import GuestFeedbackForm from "./pages/GuestFeedbackForm";
import GuestThankYou from "./pages/GuestThankYou";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          
          {/* Guest Flow */}
          <Route path="/ship/:shipId/feedback/lang" element={<GuestLanguageSelect />} />
          <Route path="/ship/:shipId/room" element={<GuestRoomNumber />} />
          <Route path="/ship/:shipId/feedback" element={<GuestFeedbackForm />} />
          <Route path="/ship/:shipId/thankyou" element={<GuestThankYou />} />
          
          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
