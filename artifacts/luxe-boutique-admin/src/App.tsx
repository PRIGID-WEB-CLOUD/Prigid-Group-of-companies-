import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { AuthProvider } from "@/contexts/AuthContext";
import AdminGuard from "@/components/AdminGuard";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminCatalogPage from "@/pages/admin/AdminCatalogPage";
import AdminOrdersPage from "@/pages/admin/AdminOrdersPage";
import AdminProductEditorPage from "@/pages/admin/AdminProductEditorPage";
import AdminAnalyticsPage from "@/pages/admin/AdminAnalyticsPage";
import AdminCustomersPage from "@/pages/admin/AdminCustomersPage";
import AdminCategoriesPage from "@/pages/admin/AdminCategoriesPage";
import AdminChannelHubPage from "@/pages/admin/AdminChannelHubPage";
import AdminFacebookPage from "@/pages/admin/AdminFacebookPage";
import AdminInstagramPage from "@/pages/admin/AdminInstagramPage";
import AdminMetaCommercePage from "@/pages/admin/AdminMetaCommercePage";
import AdminMetaAdsPage from "@/pages/admin/AdminMetaAdsPage";
import AdminMetaBusinessPage from "@/pages/admin/AdminMetaBusinessPage";
import AdminTwitterPage from "@/pages/admin/AdminTwitterPage";
import AdminWhatsAppPage from "@/pages/admin/AdminWhatsAppPage";
import AdminSocialAnalyticsPage from "@/pages/admin/AdminSocialAnalyticsPage";
import AdminBlogPage from "@/pages/admin/AdminBlogPage";
import AdminBlogEditorPage from "@/pages/admin/AdminBlogEditorPage";
import AdminMediaPage from "@/pages/admin/AdminMediaPage";
import AdminNewsletterPage from "@/pages/admin/AdminNewsletterPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import AdminTeamPage from "@/pages/admin/AdminTeamPage";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminAcceptInvitePage from "@/pages/admin/AdminAcceptInvitePage";
import AdminCouponsPage from "@/pages/admin/AdminCouponsPage";
import AdminProvidersPage from "@/pages/admin/AdminProvidersPage";
import AdminGoogleWorkspacePage from "@/pages/admin/AdminGoogleWorkspacePage";
import AdminAppStorePage from "@/pages/admin/AdminAppStorePage";
import AdminTikTokPage from "@/pages/admin/AdminTikTokPage";
import AdminPinterestPage from "@/pages/admin/AdminPinterestPage";
import AdminChatPage from "@/pages/admin/AdminChatPage";
import AdminShowroomsPage from "@/pages/admin/AdminShowroomsPage";
import AdminNotificationsPage from "@/pages/admin/AdminNotificationsPage";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={() => <AdminLoginPage />} />
      <Route path="/accept-invite" component={() => <AdminAcceptInvitePage />} />
      <Route path="/" component={() => <AdminGuard><AdminDashboardPage /></AdminGuard>} />
      <Route path="/dashboard" component={() => <AdminGuard><AdminDashboardPage /></AdminGuard>} />
      <Route path="/catalog" component={() => <AdminGuard><AdminCatalogPage /></AdminGuard>} />
      <Route path="/categories" component={() => <AdminGuard><AdminCategoriesPage /></AdminGuard>} />
      <Route path="/orders" component={() => <AdminGuard><AdminOrdersPage /></AdminGuard>} />
      <Route path="/products/new" component={() => <AdminGuard><AdminProductEditorPage /></AdminGuard>} />
      <Route path="/products/edit" component={() => <AdminGuard><AdminProductEditorPage /></AdminGuard>} />
      <Route path="/products/edit/:id" component={() => <AdminGuard><AdminProductEditorPage /></AdminGuard>} />
      <Route path="/products/:id/edit" component={() => <AdminGuard><AdminProductEditorPage /></AdminGuard>} />
      <Route path="/admin/products/new" component={() => <AdminGuard><AdminProductEditorPage /></AdminGuard>} />
      <Route path="/admin/products/edit" component={() => <AdminGuard><AdminProductEditorPage /></AdminGuard>} />
      <Route path="/admin/products/edit/:id" component={() => <AdminGuard><AdminProductEditorPage /></AdminGuard>} />
      <Route path="/admin/products/:id/edit" component={() => <AdminGuard><AdminProductEditorPage /></AdminGuard>} />
      <Route path="/admin/catalog" component={() => <AdminGuard><AdminCatalogPage /></AdminGuard>} />
      <Route path="/admin/dashboard" component={() => <AdminGuard><AdminDashboardPage /></AdminGuard>} />
      <Route path="/customers" component={() => <AdminGuard><AdminCustomersPage /></AdminGuard>} />
      <Route path="/chat" component={() => <AdminGuard><AdminChatPage /></AdminGuard>} />
      <Route path="/admin/chat" component={() => <AdminGuard><AdminChatPage /></AdminGuard>} />
      <Route path="/analytics" component={() => <AdminGuard><AdminAnalyticsPage /></AdminGuard>} />
      <Route path="/channels" component={() => <AdminGuard><AdminChannelHubPage /></AdminGuard>} />
      <Route path="/admin/channels" component={() => <AdminGuard><AdminChannelHubPage /></AdminGuard>} />
      <Route path="/channels/tiktok" component={() => <AdminGuard><AdminTikTokPage /></AdminGuard>} />
      <Route path="/admin/channels/tiktok" component={() => <AdminGuard><AdminTikTokPage /></AdminGuard>} />
      <Route path="/channels/pinterest" component={() => <AdminGuard><AdminPinterestPage /></AdminGuard>} />
      <Route path="/admin/channels/pinterest" component={() => <AdminGuard><AdminPinterestPage /></AdminGuard>} />
      <Route path="/calendar" component={() => <AdminGuard><AdminGoogleWorkspacePage /></AdminGuard>} />
      <Route path="/admin/calendar" component={() => <AdminGuard><AdminGoogleWorkspacePage /></AdminGuard>} />
      <Route path="/channels/google-workspace" component={() => <AdminGuard><AdminGoogleWorkspacePage /></AdminGuard>} />
      <Route path="/google-workspace" component={() => <AdminGuard><AdminGoogleWorkspacePage /></AdminGuard>} />
      <Route path="/admin/google-workspace" component={() => <AdminGuard><AdminGoogleWorkspacePage /></AdminGuard>} />
      <Route path="/admin/channels/google-workspace" component={() => <AdminGuard><AdminGoogleWorkspacePage /></AdminGuard>} />
      <Route path="/channels/facebook" component={() => <AdminGuard><AdminFacebookPage /></AdminGuard>} />
      <Route path="/admin/channels/facebook" component={() => <AdminGuard><AdminFacebookPage /></AdminGuard>} />
      <Route path="/channels/instagram" component={() => <AdminGuard><AdminInstagramPage /></AdminGuard>} />
      <Route path="/admin/channels/instagram" component={() => <AdminGuard><AdminInstagramPage /></AdminGuard>} />
      <Route path="/channels/meta-commerce" component={() => <AdminGuard><AdminMetaCommercePage /></AdminGuard>} />
      <Route path="/admin/channels/meta-commerce" component={() => <AdminGuard><AdminMetaCommercePage /></AdminGuard>} />
      <Route path="/channels/meta-business" component={() => <AdminGuard><AdminMetaBusinessPage /></AdminGuard>} />
      <Route path="/admin/channels/meta-business" component={() => <AdminGuard><AdminMetaBusinessPage /></AdminGuard>} />
      <Route path="/channels/meta-ads" component={() => <AdminGuard><AdminMetaAdsPage /></AdminGuard>} />
      <Route path="/admin/channels/meta-ads" component={() => <AdminGuard><AdminMetaAdsPage /></AdminGuard>} />
      <Route path="/channels/whatsapp" component={() => <AdminGuard><AdminWhatsAppPage /></AdminGuard>} />
      <Route path="/admin/channels/whatsapp" component={() => <AdminGuard><AdminWhatsAppPage /></AdminGuard>} />
      <Route path="/channels/twitter" component={() => <AdminGuard><AdminTwitterPage /></AdminGuard>} />
      <Route path="/admin/channels/twitter" component={() => <AdminGuard><AdminTwitterPage /></AdminGuard>} />
      <Route path="/channels/analytics" component={() => <AdminGuard><AdminSocialAnalyticsPage /></AdminGuard>} />
      <Route path="/admin/channels/analytics" component={() => <AdminGuard><AdminSocialAnalyticsPage /></AdminGuard>} />
      <Route path="/blog" component={() => <AdminGuard><AdminBlogPage /></AdminGuard>} />
      <Route path="/blog/new" component={() => <AdminGuard><AdminBlogEditorPage /></AdminGuard>} />
      <Route path="/blog/edit" component={() => <AdminGuard><AdminBlogEditorPage /></AdminGuard>} />
      <Route path="/blog/edit/:id" component={() => <AdminGuard><AdminBlogEditorPage /></AdminGuard>} />
      <Route path="/blog/:id/edit" component={() => <AdminGuard><AdminBlogEditorPage /></AdminGuard>} />
      <Route path="/admin/blog/new" component={() => <AdminGuard><AdminBlogEditorPage /></AdminGuard>} />
      <Route path="/admin/blog/edit" component={() => <AdminGuard><AdminBlogEditorPage /></AdminGuard>} />
      <Route path="/admin/blog/edit/:id" component={() => <AdminGuard><AdminBlogEditorPage /></AdminGuard>} />
      <Route path="/media" component={() => <AdminGuard><AdminMediaPage /></AdminGuard>} />
      <Route path="/newsletter" component={() => <AdminGuard><AdminNewsletterPage /></AdminGuard>} />
      <Route path="/settings" component={() => <AdminGuard><AdminSettingsPage /></AdminGuard>} />
      <Route path="/team" component={() => <AdminGuard><AdminTeamPage /></AdminGuard>} />
      <Route path="/coupons" component={() => <AdminGuard><AdminCouponsPage /></AdminGuard>} />
      <Route path="/showrooms" component={() => <AdminGuard><AdminShowroomsPage /></AdminGuard>} />
      <Route path="/admin/showrooms" component={() => <AdminGuard><AdminShowroomsPage /></AdminGuard>} />
      <Route path="/providers" component={() => <AdminGuard><AdminProvidersPage /></AdminGuard>} />
      <Route path="/admin/providers" component={() => <AdminGuard><AdminProvidersPage /></AdminGuard>} />
      <Route path="/appstore" component={() => <AdminGuard><AdminAppStorePage /></AdminGuard>} />
      <Route path="/admin/appstore" component={() => <AdminGuard><AdminAppStorePage /></AdminGuard>} />
      <Route path="/notifications" component={() => <AdminGuard><AdminNotificationsPage /></AdminGuard>} />
      <Route path="/admin/notifications" component={() => <AdminGuard><AdminNotificationsPage /></AdminGuard>} />
      <Route component={() => <AdminGuard><AdminDashboardPage /></AdminGuard>} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CurrencyProvider>
            <WouterRouter base="/admin">
              <div className="min-h-screen flex flex-col bg-white font-sans antialiased text-slate-900 selection:bg-slate-900 selection:text-white">
                <Router />
              </div>
            </WouterRouter>
            <Toaster />
          </CurrencyProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
