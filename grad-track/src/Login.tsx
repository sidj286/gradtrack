import React, { useState } from 'react';
import { supabase } from './lib/supabase';

interface LoginProps {
  onShowRegister: () => void;
}

const Login: React.FC<LoginProps> = ({ onShowRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, msg: string }>({ type: null, msg: '' });

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
    } else {
      setStatus({ type: 'success', msg: 'Login successful! Redirecting...' });
    }
  };

  const inputClass = 
    'w-full px-4 py-2.5 bg-[#fcfcfc] border border-[#e2e8f0] rounded-lg text-[14px] ' +
    'hover:border-[#cbd5e1] focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/5 ' +
    'outline-none transition-all duration-200 placeholder:text-slate-400 text-[#1e293b] shadow-sm';

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center font-sans py-10 px-4">
      
      {/* Centered Compact Card matching Register.tsx */}
      <div className="w-full max-w-[360px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/60 overflow-hidden">
        
        <div className="px-6 pt-7 pb-4 text-center">
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Welcome Back</h2>
          <p className="text-slate-500 text-[13px] mt-1">Sign in to your alumni account.</p>
        </div>

        <form onSubmit={handleLogin} className="px-6 pb-6 space-y-4">
          
          <div className="space-y-3">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="Email Address"
                required
              />
            </div>

            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Password"
                required
              />
              <div className="flex justify-end mt-2">
                <button type="button" className="text-[11px] text-[#800000] font-semibold hover:underline">
                  Forgot Password?
                </button>
              </div>
            </div>
          </div>

          {status.msg && (
            <div className={`p-3 rounded-xl text-[12px] text-center font-medium ${
              status.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
            }`}>
              {status.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#800000] hover:bg-[#6a0000] text-white text-[15px] font-bold rounded-xl transition-all shadow-[0_4px_12px_rgba(128,0,0,0.15)] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Log In'}
          </button>
        </form>

        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 text-center">
  <p className="text-slate-900 text-[13px]">
    New graduate?{' '}
    <button 
      onClick={onShowRegister} 
      className="text-[#800000] font-bold hover:underline underline-offset-2"
    >
      Click here
    </button>
  </p>
</div>
      </div>

      <footer className="mt-8 text-[11px] text-slate-400 font-medium text-center">
        © 2026 Cebu Roosevelt Memorial Colleges<br/>
        Alumni Relations Office
      </footer>
    </div>
  );
};

export default Login;