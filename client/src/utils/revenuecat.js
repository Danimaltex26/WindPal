import { Purchases } from '@revenuecat/purchases-js';

const RC_API_KEY = import.meta.env.VITE_REVENUECAT_API_KEY || '';

let purchasesInstance = null;

export function initRevenueCat(userId) {
  if (!RC_API_KEY || !userId) return null;
  purchasesInstance = Purchases.configure(RC_API_KEY, userId);
  return purchasesInstance;
}

export function getPurchases() {
  return purchasesInstance;
}

export async function getOfferings() {
  if (!purchasesInstance) return null;
  try {
    return await purchasesInstance.getOfferings();
  } catch (err) {
    console.error('[RevenueCat] getOfferings error:', err);
    return null;
  }
}

export async function purchase(pkg) {
  if (!purchasesInstance) throw new Error('RevenueCat not initialized');
  return await purchasesInstance.purchase({ rcPackage: pkg });
}

export async function getCustomerInfo() {
  if (!purchasesInstance) return null;
  try {
    return await purchasesInstance.getCustomerInfo();
  } catch (err) {
    console.error('[RevenueCat] getCustomerInfo error:', err);
    return null;
  }
}

export async function getManagementURL() {
  const info = await getCustomerInfo();
  return info?.managementURL || null;
}
