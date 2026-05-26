// Tailwind CSS + DaisyUI styles
import './app.css';
// Tasklet shim MUST be imported first — sets up window.tasklet before any other code uses it
import './tasklet-shim';
import { setAuthToken, clearAuthToken, getAuthToken } from './tasklet-shim';

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Page, PortalMode, Property, Client, SaleDeal, RentalDeal, Invoice, MessageTemplate, BillingSchedule, Owner, SystemUser } from './types';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { PropertyList } from './components/PropertyList';
import { PropertyForm } from './components/PropertyForm';
import { SalesPipeline } from './components/SalesPipeline';
import { RentalPipeline } from './components/RentalPipeline';
import { ClientList } from './components/ClientList';
import { ClientForm } from './components/ClientForm';
import { DealForm } from './components/DealForm';
import { BillingPage } from './components/BillingPage';
import { InvoiceForm } from './components/InvoiceForm';
import { SettingsPage } from './components/SettingsPage';
import { TemplateForm } from './components/TemplateForm';
import { ScheduleForm } from './components/ScheduleForm';
import { OwnerForm } from './components/OwnerForm';
import { AccessManager } from './components/AccessManager';
import { MaintenanceTickets } from './components/MaintenanceTickets';
import { TenantPortal } from './components/TenantPortal';
import { WorkerPortal } from './components/WorkerPortal';
import { StakeholderPortal } from './components/StakeholderPortal';
import { LoginScreen } from './components/LoginScreen';
import { LogOut, Bell, BellOff, BellRing, Sun, Moon } from 'lucide-react';
import { isPushSupported, getNotificationPermission, requestNotificationPermission } from './utils/push';
