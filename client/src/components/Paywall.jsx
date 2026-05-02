import { useState, useEffect } from 'react';
import { getOfferings, purchase } from '../utils/revenuecat';

export default function Paywall() {
  const [offerings, setOfferings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('Annual');

  useEffect(() => {
    getOfferings().then(setOfferings).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handlePurchase(pkg) {
    setPurchasing(true); setError('');
    try { await purchase(pkg); window.location.reload(); }
    catch (err) { if (!err.message?.includes('cancel')) setError(err.message || 'Purchase failed.'); }
    finally { setPurchasing(false); }
  }

  if (loading) return <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}><p className="text-secondary">Loading plans...</p></div>;

  const packages = offerings?.all?.['WindPal']?.availablePackages || [];
  const monthlyPkg = packages.find(p => p.identifier === '$rc_monthly' || p.identifier === 'Monthly');
  const annualPkg = packages.find(p => p.identifier === '$rc_annual' || p.identifier === 'Annual');

  if (!monthlyPkg && !annualPkg) return (
    <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.5rem' }}>Upgrade to Pro</h3>
      <p className="text-secondary" style={{ fontSize: '0.8125rem', marginBottom: '1rem' }}>Unlimited analyses, troubleshooting, training, and reference lookups.</p>
      <a href="https://tradepals.net/#pricing" target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-block">View Pro Plans</a>
    </div>
  );

  const monthlyCost = monthlyPkg?.rcBillingProduct?.currentPrice?.amountMicros ? (monthlyPkg.rcBillingProduct.currentPrice.amountMicros / 1_000_000).toFixed(2) : '12.95';
  const annualCost = annualPkg?.rcBillingProduct?.currentPrice?.amountMicros ? (annualPkg.rcBillingProduct.currentPrice.amountMicros / 1_000_000).toFixed(2) : '89.95';
  const monthlyEquiv = (parseFloat(annualCost) / 12).toFixed(2);
  const savingsPercent = Math.round((1 - parseFloat(annualCost) / (parseFloat(monthlyCost) * 12)) * 100);
  const selectedPkg = selected === 'Annual' ? annualPkg : monthlyPkg;

  return (
    <div className="card" style={{ padding: '1.5rem' }}>
      <h3 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Upgrade to Pro</h3>
      <p className="text-secondary" style={{ textAlign: 'center', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>Unlimited analyses, troubleshooting, training, and reference lookups.</p>
      {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>{error}</div>}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {annualPkg && <button onClick={() => setSelected('Annual')} style={{ flex: 1, padding: '1rem', borderRadius: 12, border: selected === 'Annual' ? '2px solid #22D3EE' : '2px solid #2A2A2E', background: selected === 'Annual' ? 'rgba(34,211,238, 0.08)' : 'transparent', cursor: 'pointer', textAlign: 'center', position: 'relative' }}>
          {savingsPercent > 0 && <span style={{ position: 'absolute', top: -10, right: 8, fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: '#22D3EE', color: '#0D0D0F' }}>Save {savingsPercent}%</span>}
          <p style={{ fontWeight: 700, fontSize: '1.125rem' }}>Annual</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#22D3EE', margin: '0.25rem 0' }}>${annualCost}<span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#A0A0A8' }}>/yr</span></p>
          <p style={{ fontSize: '0.75rem', color: '#6B6B73' }}>${monthlyEquiv}/mo</p>
        </button>}
        {monthlyPkg && <button onClick={() => setSelected('Monthly')} style={{ flex: 1, padding: '1rem', borderRadius: 12, border: selected === 'Monthly' ? '2px solid #22D3EE' : '2px solid #2A2A2E', background: selected === 'Monthly' ? 'rgba(34,211,238, 0.08)' : 'transparent', cursor: 'pointer', textAlign: 'center' }}>
          <p style={{ fontWeight: 700, fontSize: '1.125rem' }}>Monthly</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F5F5F5', margin: '0.25rem 0' }}>${monthlyCost}<span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#A0A0A8' }}>/mo</span></p>
          <p style={{ fontSize: '0.75rem', color: '#6B6B73' }}>Cancel anytime</p>
        </button>}
      </div>
      <button className="btn btn-primary btn-block" onClick={() => selectedPkg && handlePurchase(selectedPkg)} disabled={purchasing || !selectedPkg} style={{ height: 48, fontSize: '1rem' }}>
        {purchasing ? 'Processing...' : `Subscribe — $${selected === 'Annual' ? annualCost + '/yr' : monthlyCost + '/mo'}`}
      </button>
      <p className="text-muted" style={{ textAlign: 'center', fontSize: '0.6875rem', marginTop: '0.75rem' }}>Secure checkout powered by Stripe. Cancel anytime.</p>
    </div>
  );
}
