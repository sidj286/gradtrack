// Login.tsx - COPY THIS ENTIRE FILE
import React, { useState } from 'react';
import { supabase } from './lib/supabase';

interface LoginProps {
  onShowRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onShowRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, msg: string }>({ type: null, msg: '' });
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error' | null, msg: string }>({ type: null, msg: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: null, msg: '' });

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setStatus({ type: 'error', msg: error.message });
    }
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      setResetStatus({ type: 'error', msg: 'Please enter your email address' });
      return;
    }

    setResetLoading(true);
    setResetStatus({ type: null, msg: '' });

    const redirectTo = `${window.location.origin}/reset-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: redirectTo,
    });

    if (error) {
      setResetStatus({ type: 'error', msg: error.message });
    } else {
      setResetStatus({ 
        type: 'success', 
        msg: 'Password reset email sent! Check your inbox.' 
      });
      setTimeout(() => {
        setShowResetModal(false);
        setResetEmail('');
        setResetStatus({ type: null, msg: '' });
      }, 3000);
    }
    setResetLoading(false);
  };

  // Test alert to verify component is updating
  console.log("Login component rendered - Forgot password should be visible");

  return (
    <>
      <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827', margin: 0 }}>GT</h1>
            <p style={{ fontSize: '18px', color: '#4b5563', margin: '4px 0' }}>GradTrack</p>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>Alumni Relations & Career Tracking Platform</p>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
            <button style={{ flex: 1, padding: '8px', backgroundColor: '#800000', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
              Sign In
            </button>
            <button 
              onClick={onShowRegister}
              style={{ flex: 1, padding: '8px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
            >
              Register
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    style={{ fontSize: '12px', color: '#800000', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                  placeholder="Enter your password"
                  required
                />
              </div>

              {status.msg && (
                <div style={{ padding: '12px', borderRadius: '8px', fontSize: '14px', textAlign: 'center', backgroundColor: status.type === 'error' ? '#fef2f2' : '#f0fdf4', color: status.type === 'error' ? '#dc2626' : '#16a34a' }}>
                  {status.msg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ width: '100%', padding: '8px', backgroundColor: '#800000', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '14px', color: '#4b5563', margin: 0 }}>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={onShowRegister}
                  style={{ color: '#800000', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500', textDecoration: 'underline' }}
                >
                  Register here
                </button>
              </p>
            </div>
          </form>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: '10px', color: '#6b7280', marginTop: '32px' }}>
            Secure alumni portal for Cebu Roosevelt Memorial Colleges graduates
          </p>
        </div>
      </div>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', maxWidth: '400px', width: '90%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Reset Password</h3>
              <button onClick={() => setShowResetModal(false)} style={{ fontSize: '24px', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ marginBottom: '16px', color: '#4b5563' }}>Enter your email address and we'll send you a link to reset your password.</p>
            
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '16px' }}
              placeholder="your@email.com"
            />
            
            {resetStatus.msg && (
              <div style={{ padding: '12px', borderRadius: '8px', fontSize: '14px', textAlign: 'center', marginBottom: '16px', backgroundColor: resetStatus.type === 'error' ? '#fef2f2' : '#f0fdf4', color: resetStatus.type === 'error' ? '#dc2626' : '#16a34a' }}>
                {resetStatus.msg}
              </div>
            )}
            
            <button
              onClick={handleForgotPassword}
              disabled={resetLoading}
              style={{ width: '100%', padding: '8px', backgroundColor: '#800000', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: resetLoading ? 0.5 : 1 }}
            >
              {resetLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Login;