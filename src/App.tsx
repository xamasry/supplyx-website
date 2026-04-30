/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import BuyerHome from './pages/buyer/BuyerHome';
import SupplierHome from './pages/supplier/SupplierHome';
import NewRequest from './pages/buyer/NewRequest';
import RequestDetail from './pages/buyer/RequestDetail';
import BuyerLayout from './components/layout/BuyerLayout';
import SupplierLayout from './components/layout/SupplierLayout';
import BuyerOrders from './pages/buyer/BuyerOrders';
import BuyerOffers from './pages/buyer/BuyerOffers';
import BuyerProfile from './pages/buyer/BuyerProfile';
import BuyerWishlist from './pages/buyer/BuyerWishlist';
import SupplierRequestDetail from './pages/supplier/SupplierRequestDetail';
import SupplierOrders from './pages/supplier/SupplierOrders';
import SupplierOffers from './pages/supplier/SupplierOffers';
import NewSupplierOffer from './pages/supplier/NewSupplierOffer';
import SupplierAnalytics from './pages/supplier/SupplierAnalytics';
import SupplierProfile from './pages/supplier/SupplierProfile';
import Notifications from './pages/Notifications';
import OrderTracking from './pages/OrderTracking';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLogin from './pages/admin/AdminLogin';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import ReloadPrompt from './components/pwa/ReloadPrompt';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <ReloadPrompt />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
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
          <Route path="/buyer/request/new" element={<NewRequest />} />
          <Route path="/buyer/request/:id" element={<RequestDetail />} />
          <Route path="/buyer/orders" element={<BuyerOrders />} />
          <Route path="/buyer/orders/:id" element={<OrderTracking />} />
          <Route path="/buyer/offers" element={<BuyerOffers />} />
          <Route path="/buyer/profile" element={<BuyerProfile />} />
          <Route path="/buyer/wishlist" element={<BuyerWishlist />} />
          <Route path="/buyer/notifications" element={<Notifications />} />
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
          <Route path="/supplier/offers" element={<SupplierOffers />} />
          <Route path="/supplier/offers/new" element={<NewSupplierOffer />} />
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
    </BrowserRouter>
  );
}
