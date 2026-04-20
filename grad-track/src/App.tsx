// App.tsx - With Gmail Image Logo on Both Buttons
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import AlumniDashboard from './AlumniDashboard';
import AdminDashboard from './AdminDashboard';
import Register from './Register';
import ResetPassword from './ResetPassword';
import type { Session } from '@supabase/supabase-js';

// Eye Icons
const EyeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeSlashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  // Email link states
  const [useEmailLink, setUseEmailLink] = useState(false);
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [emailLinkAddress, setEmailLinkAddress] = useState('');

  useEffect(() => {
    // Check for password recovery hash
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setIsResettingPassword(true);
      setLoading(false);
      return;
    }
    
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        const userEmail = session.user.email;
        if (userEmail === 'caayoncj@gmail.com') {
          setIsAdmin(true);
        } else {
          const { data } = await supabase
            .from('users')
            .select('admin')
            .eq('id', session.user.id)
            .maybeSingle();
          
          setIsAdmin(data?.admin === true);
        }
      }
    } catch (err) {
      console.error("Error:", err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  // Regular password login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setError('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      await checkUser();
    }
    setLoginLoading(false);
  };

  // Email link login
  const handleEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: window.location.origin,
      }
    });

    if (error) {
      setError(error.message);
      setLoginLoading(false);
    } else {
      setEmailLinkSent(true);
      setEmailLinkAddress(email);
      setLoginLoading(false);
    }
  };

  // Forgot password
  const handleForgotPassword = async () => {
    if (!resetEmail) {
      setResetMessage({ type: 'error', text: 'Please enter your email address' });
      return;
    }

    setResetLoading(true);
    setResetMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    });

    if (error) {
      setResetMessage({ type: 'error', text: error.message });
    } else {
      setResetMessage({ 
        type: 'success', 
        text: 'Password reset link sent to your Gmail inbox!' 
      });
      setTimeout(() => {
        setShowResetModal(false);
        setResetEmail('');
        setResetMessage(null);
      }, 3000);
    }
    setResetLoading(false);
  };

  const handleResetComplete = () => {
    setIsResettingPassword(false);
    window.location.hash = '';
    window.location.reload();
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

  // Reset email link state when switching back
  const switchToPasswordLogin = () => {
    setUseEmailLink(false);
    setEmailLinkSent(false);
    setEmailLinkAddress('');
    setError('');
  };

  const switchToEmailLink = () => {
    setUseEmailLink(true);
    setEmailLinkSent(false);
    setError('');
  };

  // Show reset password page
  if (isResettingPassword) {
    return <ResetPassword onComplete={handleResetComplete} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#800000]/20 border-t-[#800000] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white p-4">
          <div className="max-w-md w-full">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-[#800000] to-[#a10000] rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg">
                GT
              </div>
              <h1 className="text-3xl font-bold text-gray-900">GradTrack</h1>
              <p className="text-gray-600 mt-2">Alumni Relations & Career Tracking Platform</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="flex gap-4 mb-6 border-b border-gray-200">
                <button
                  onClick={() => {
                    setShowLogin(true);
                    setError('');
                    switchToPasswordLogin();
                  }}
                  className={`pb-3 px-4 font-semibold transition ${
                    showLogin ? 'text-[#800000] border-b-2 border-[#800000]' : 'text-gray-500'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setShowLogin(false);
                    setError('');
                    switchToPasswordLogin();
                  }}
                  className={`pb-3 px-4 font-semibold transition ${
                    !showLogin ? 'text-[#800000] border-b-2 border-[#800000]' : 'text-gray-500'
                  }`}
                >
                  Register
                </button>
              </div>

              {showLogin ? (
                <>
                  {!useEmailLink ? (
                    // PASSWORD LOGIN FORM
                    <>
                      <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none"
                            placeholder="your@gmail.com"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none"
                              placeholder="Enter your password"
                              required
                            />
                            <button
                              type="button"
                              onClick={togglePasswordVisibility}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#800000]"
                            >
                              {showPassword ? <EyeIcon /> : <EyeSlashIcon />}
                            </button>
                          </div>
                          <div className="flex justify-end mt-3">
                            <button
                              type="button"
                              onClick={() => setShowResetModal(true)}
                              className="text-xs text-[#800000] font-medium hover:underline"
                            >
                              Forgot password?
                            </button>
                          </div>
                        </div>
                        
                        {error && (
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <p className="text-red-600 text-sm">{error}</p>
                          </div>
                        )}
                        
                        <button
                          type="submit"
                          disabled={loginLoading}
                          className="w-full py-3 bg-gradient-to-r from-[#800000] to-[#a10000] text-white font-bold rounded-xl hover:from-[#6a0000] hover:to-[#8a0000] transition-all disabled:opacity-50"
                        >
                          {loginLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                      </form>
                      
                      <div className="mt-4 relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-400">or</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={switchToEmailLink}
                        className="w-full mt-4 py-2.5 border-2 border-[#800000] text-[#800000] font-semibold rounded-xl hover:bg-[#800000]/5 transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        <img 
                          src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png" 
                          alt="Gmail" 
                          className="w-5 h-5"
                        />
                        Continue with email
                      </button>
                      
                      <p className="text-center text-sm text-gray-600 mt-6">
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => setShowLogin(false)}
                          className="text-[#800000] font-semibold hover:underline"
                        >
                          Create account
                        </button>
                      </p>
                    </>
                  ) : emailLinkSent ? (
                    // EMAIL LINK SENT MESSAGE
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <img 
                          src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png" 
                          alt="Gmail" 
                          className="w-8 h-8"
                        />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Check your Gmail</h3>
                      <p className="text-gray-600">
                        We sent a secure sign-in link to:<br/>
                        <strong className="text-[#800000]">{emailLinkAddress}</strong>
                      </p>
                      <div className="bg-blue-50 rounded-lg p-3 text-sm text-gray-600">
                        <p> Open your Gmail inbox and click the link to sign in instantly.</p>
                        <p className="text-xs text-gray-500 mt-1">For security, the link expires in 24 hours.</p>
                      </div>
                      <button
                        onClick={switchToPasswordLogin}
                        className="text-[#800000] text-sm hover:underline mt-2"
                      >
                        ← Back to password sign in
                      </button>
                    </div>
                  ) : (
                    // EMAIL LINK FORM
                    <form onSubmit={handleEmailLink} className="space-y-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
                        <p className="text-sm text-blue-800">
                           Enter your email address and we'll send a secure sign-in link to your Gmail.
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none"
                          placeholder="your@gmail.com"
                          required
                          autoFocus
                        />
                      </div>
                      
                      {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                          <p className="text-red-600 text-sm">{error}</p>
                        </div>
                      )}
                      
                      <button
                        type="submit"
                        disabled={loginLoading}
                        className="w-full py-3 bg-gradient-to-r from-[#800000] to-[#a10000] text-white font-bold rounded-xl hover:from-[#6a0000] hover:to-[#8a0000] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <img 
                          src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png" 
                          alt="Gmail" 
                          className="w-5 h-5"
                        />
                        {loginLoading ? 'Sending...' : 'Send secure link'}
                      </button>
                      
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={switchToPasswordLogin}
                          className="text-sm text-[#800000] hover:underline"
                        >
                          ← Sign in with password
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <Register onSuccess={() => setShowLogin(true)} />
              )}
            </div>
          </div>
        </div>

        {/* Forgot Password Modal */}
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
              <div className="p-6 border-b border-gray-100">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Reset Password</h3>
                    <p className="text-sm text-gray-500 mt-1">Enter your email to receive a reset link</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowResetModal(false);
                      setResetEmail('');
                      setResetMessage(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none"
                    placeholder="your@gmail.com"
                    autoFocus
                  />
                </div>
                
                {resetMessage && (
                  <div className={`p-3 rounded-xl text-sm text-center font-medium ${
                    resetMessage.type === 'error' 
                      ? 'bg-red-50 text-red-600' 
                      : 'bg-green-50 text-green-600'
                  }`}>
                    {resetMessage.text}
                  </div>
                )}
                
                <button
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="w-full py-2.5 bg-[#800000] hover:bg-[#6a0000] text-white font-semibold rounded-xl transition disabled:opacity-50"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return isAdmin ? <AdminDashboard session={session} /> : <AlumniDashboard session={session} />;
}

export default App;