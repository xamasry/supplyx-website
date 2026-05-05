/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import ReloadPrompt from './components/pwa/ReloadPrompt';
import PushNotificationManager from './components/pwa/PushNotificationManager';
import InstallPrompt from './components/pwa/InstallPrompt';
import { Loader2 } from 'lucide-react';

const BuyerHome = lazy(() => import('./pages/buyer/BuyerHome'));
const SupplierHome = lazy(() => import('./pages/supplier/SupplierHome'));
const NewRequest = lazy(() => import('./pages/buyer/NewRequest'));
const RequestDetail = lazy(() => import('./pages/buyer/RequestDetail'));
const BuyerLayout = lazy(() => import('./components/layout/BuyerLayout'));
const SupplierLayout = lazy(() => import('./components/layout/SupplierLayout'));
const BuyerOrders = lazy(() => import('./pages/buyer/BuyerOrders'));
const BuyerOffers = lazy(() => import('./pages/buyer/BuyerOffers'));
const BuyerProfile = lazy(() => import('./pages/buyer/BuyerProfile'));
const BuyerWishlist = lazy(() => import('./pages/buyer/BuyerWishlist'));
const SupplierRequestDetail = lazy(() => import('./pages/supplier/SupplierRequestDetail'));
const SupplierOrders = lazy(() => import('./pages/supplier/SupplierOrders'));
const SupplierOffers = lazy(() => import('./pages/supplier/SupplierOffers'));
const NewSupplierOffer = lazy(() => import('./pages/supplier/NewSupplierOffer'));
const SupplierAnalytics = lazy(() => import('./pages/supplier/SupplierAnalytics'));
const SupplierProfile = lazy(() => import('./pages/supplier/SupplierProfile'));
const ManageCatalog = lazy(() => import('./pages/supplier/ManageCatalog'));
const SupplierStore = lazy(() => import('./pages/buyer/SupplierStore'));
const Notifications = lazy(() => import('./pages/Notifications'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const CategoryProducts = lazy(() => import('./pages/buyer/CategoryProducts'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="flex flex-col items-center gap-4 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin" />
      <span className="text-sm font-bold animate-pulse">جاري التحميل...</span>
    </div>
  </div>
);

import { AnalyticsProvider } from './lib/analytics';
import GuestMarketplace from './pages/GuestMarketplace';

export default function App() {
  return (
    <BrowserRouter>
      <AnalyticsProvider>
        <Toaster position="top-center" />
        <ReloadPrompt />
        <PushNotificationManager />
        <InstallPrompt />
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/marketplace" element={<GuestMarketplace />} />
          
          {/* Auth */}
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignupPage />} />
          
          {/* Buyer Routes - Wrapped in Layout */}
          <Route element={
            <ProtectedRoute allowedRole="buyer">
              <BuyerLayout />
            </ProtectedRoute>
          }>
            <Route path="/buyer/home" element={<BuyerHome />} />
            <Route path="/buyer/products" element={<CategoryProducts />} />
            <Route path="/buyer/request/new" element={<NewRequest />} />
            <Route path="/buyer/request/:id" element={<RequestDetail />} />
            <Route path="/buyer/orders" element={<BuyerOrders />} />
            <Route path="/buyer/orders/:id" element={<OrderTracking />} />
            <Route path="/buyer/offers" element={<BuyerOffers />} />
            <Route path="/buyer/profile" element={<BuyerProfile />} />
            <Route path="/buyer/wishlist" element={<BuyerWishlist />} />
            <Route path="/buyer/notifications" element={<Notifications />} />
            <Route path="/buyer/supplier/:id" element={<SupplierStore />} />
          </Route>
          
          {/* Supplier Routes - Wrapped in Layout */}
          <Route element={
            <ProtectedRoute allowedRole="supplier">
              <SupplierLayout />
            </ProtectedRoute>
          }>
            <Route path="/supplier/home" element={<SupplierHome />} />
            <Route path="/supplier/request/:id" element={<SupplierRequestDetail />} />
            <Route path="/supplier/orders" element={<SupplierOrders />} />
            <Route path="/supplier/orders/:id" element={<OrderTracking />} />
            <Route path="/supplier/products" element={<ManageCatalog />} />
            <Route path="/supplier/offers" element={<SupplierOffers />} />
            <Route path="/supplier/offers/new" element={<NewSupplierOffer />} />
            <Route path="/supplier/offers/edit/:id" element={<NewSupplierOffer />} />
            <Route path="/supplier/analytics" element={<SupplierAnalytics />} />
            <Route path="/supplier/profile" element={<SupplierProfile />} />
            <Route path="/supplier/notifications" element={<Notifications />} />
          </Route>
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          
          <Route path="/admin/dashboard" element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </AnalyticsProvider>
    </BrowserRouter>
  );
}
