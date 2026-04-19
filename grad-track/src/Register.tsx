// Register.tsx - FIXED VERSION with Professional Eye Icons
import React, { useState } from 'react';
import { supabase } from './lib/supabase';

// Professional Eye Icon Components
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

interface RegisterProps {
  onSuccess?: () => void;
}

export default function Register({ onSuccess }: RegisterProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    studentId: '',
    fullName: '',
    batchYear: '',
    course: '',
  });
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'verifying' | 'verified' | 'error'>('idle');
  const [verifiedGraduate, setVerifiedGraduate] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleVerifyStudent = async () => {
    if (!formData.studentId) {
      setError('Please enter your Student ID');
      return;
    }

    setVerificationStatus('verifying');
    setError('');

    try {
      // Check ONLY against graduates_master (the official list)
      const { data: graduate, error: verifyError } = await supabase
        .from('graduates_master')
        .select('*')
        .eq('student_id', formData.studentId.trim())
        .eq('verified', true)
        .single();

      if (verifyError || !graduate) {
        setVerificationStatus('error');
        setError('Student ID not found in verified graduates list. Please contact your school administrator.');
        return;
      }

      setVerifiedGraduate(graduate);
      
      // Auto-fill form from master list
      setFormData(prev => ({
        ...prev,
        fullName: graduate.full_name,
        batchYear: graduate.batch_year?.toString() || '',
        course: graduate.course || '',
        email: graduate.email || prev.email,
      }));
      
      setVerificationStatus('verified');
    } catch (err) {
      console.error('Verification error:', err);
      setVerificationStatus('error');
      setError('An error occurred during verification');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    if (verificationStatus !== 'verified') {
      setError('Please verify your student ID first');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!formData.email) {
      setError('Email address is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // NO email existence check - let Supabase Auth handle duplicates
      // Just attempt to create the auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            student_id: formData.studentId,
            batch_year: parseInt(formData.batchYear),
            course: formData.course,
            agreed_to_terms: true,
            agreed_at: new Date().toISOString(),
          }
        }
      });

      if (signUpError) {
        // Only show error if it's not an email conflict
        if (signUpError.message.includes('already registered')) {
          setError('This email is already associated with an existing account. Please use a different email or sign in.');
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      if (authData.user) {
        // Wait for the trigger to create the users table entry
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create alumni profile
        const { error: profileError } = await supabase
          .from('alumni_profiles')
          .insert({
            user_id: authData.user.id,
            full_name: formData.fullName,
            course: formData.course,
            batch_year: parseInt(formData.batchYear),
            employment_status: 'Unemployed',
            profile_completion: 50,
            career_alignment_status: 'Pending',
          });

        if (profileError) {
          console.error('Profile error:', profileError);
        }

        alert('Registration successful! Please check your email to confirm your account.');
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  // Toggle password visibility - CORRECTED LOGIC
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // Terms Modal Component
  const TermsModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">Terms of Service</h3>
          <button
            onClick={() => setShowTermsModal(false)}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4 text-gray-600">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h4>
            <p className="text-sm">By registering for GradTrack, you agree to comply with these Terms of Service. If you disagree with any part, please do not use our service.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">2. Eligibility</h4>
            <p className="text-sm">You must be a verified graduate of Cebu Roosevelt Memorial Colleges to use this platform. False information will result in account termination.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">3. Account Responsibility</h4>
            <p className="text-sm">You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">4. Data Accuracy</h4>
            <p className="text-sm">You agree to provide accurate, current, and complete information. Misrepresentation may lead to account suspension.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">5. Acceptable Use</h4>
            <p className="text-sm">You agree not to misuse the platform, including but not limited to: harassment, spamming, or attempting to access unauthorized data.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">6. Privacy</h4>
            <p className="text-sm">Your privacy is important. Please review our Privacy Policy to understand how we collect and use your information.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">7. Termination</h4>
            <p className="text-sm">We reserve the right to terminate or suspend accounts that violate these terms or for any other reason at our discretion.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">8. Changes to Terms</h4>
            <p className="text-sm">We may modify these terms at any time. Continued use of the platform constitutes acceptance of updated terms.</p>
          </div>
        </div>
        <div className="p-6 border-t border-gray-100">
          <button
            onClick={() => setShowTermsModal(false)}
            className="w-full py-2 bg-[#800000] text-white rounded-xl font-semibold hover:bg-[#6a0000] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  // Privacy Modal Component
  const PrivacyModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">Privacy Policy</h3>
          <button
            onClick={() => setShowPrivacyModal(false)}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4 text-gray-600">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Information We Collect</h4>
            <p className="text-sm">We collect personal information including your name, student ID, email, course, batch year, employment status, and career information provided by you.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">How We Use Your Information</h4>
            <p className="text-sm">Your information is used to verify your graduate status, track career outcomes, provide alumni services, and generate institutional reports.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Data Sharing</h4>
            <p className="text-sm">We do not sell your personal information. Aggregated, anonymized data may be shared for institutional reporting and research purposes.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Data Security</h4>
            <p className="text-sm">We implement industry-standard security measures to protect your data from unauthorized access or disclosure.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Your Rights</h4>
            <p className="text-sm">You have the right to access, correct, or delete your personal information. Contact the admin for assistance.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Data Retention</h4>
            <p className="text-sm">We retain your data as long as your account is active or as needed to provide services. You may request deletion at any time.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Cookies and Tracking</h4>
            <p className="text-sm">We use cookies to enhance your experience and analyze platform usage. You can control cookie preferences in your browser.</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Contact Us</h4>
            <p className="text-sm">For privacy concerns, contact the Alumni Relations Office at Cebu Roosevelt Memorial Colleges.</p>
          </div>
        </div>
        <div className="p-6 border-t border-gray-100">
          <button
            onClick={() => setShowPrivacyModal(false)}
            className="w-full py-2 bg-[#800000] text-white rounded-xl font-semibold hover:bg-[#6a0000] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <form onSubmit={handleRegister} className="space-y-4">
        {/* Student ID Verification */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Student ID <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.studentId}
              onChange={(e) => {
                setFormData({ ...formData, studentId: e.target.value });
                setVerificationStatus('idle');
              }}
              placeholder="Enter your Student ID"
              className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all"
              disabled={verificationStatus === 'verified'}
            />
            <button
              type="button"
              onClick={handleVerifyStudent}
              disabled={verificationStatus === 'verifying' || verificationStatus === 'verified'}
              className="px-6 py-2 bg-[#800000] text-white rounded-xl font-semibold hover:bg-[#6a0000] transition-all disabled:opacity-50"
            >
              {verificationStatus === 'verifying' ? 'Verifying...' : 'Verify'}
            </button>
          </div>
          
          {verificationStatus === 'verified' && verifiedGraduate && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 text-sm font-medium flex items-center gap-2">
                <span>✓</span> Verified Graduate: {verifiedGraduate.full_name}
              </p>
              <p className="text-green-600 text-xs mt-1">
                Course: {verifiedGraduate.course} • Batch: {verifiedGraduate.batch_year}
              </p>
            </div>
          )}
          
          {verificationStatus === 'error' && (
            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Full Name - Read-only from master list */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.fullName}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
            readOnly
            required
          />
          <p className="text-xs text-gray-400 mt-1">Auto-filled from master list</p>
        </div>

        {/* Course - Read-only from master list */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Course <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.course}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
            readOnly
            required
          />
          <p className="text-xs text-gray-400 mt-1">Auto-filled from master list</p>
        </div>

        {/* Batch Year - Read-only from master list */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Batch Year <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.batchYear}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"
            readOnly
            required
          />
          <p className="text-xs text-gray-400 mt-1">Auto-filled from master list</p>
        </div>

        {/* Email - Can be edited if not in master list */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="your.email@example.com"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all"
            required
          />
          {verifiedGraduate?.email && (
            <p className="text-xs text-green-600 mt-1">✓ Email from master list: {verifiedGraduate.email}</p>
          )}
        </div>

        {/* Password with professional eye icon - CORRECTED LOGIC */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Create a password (min. 6 characters)"
              className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all"
              required
            />
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#800000] transition-colors focus:outline-none"
              tabIndex={-1}
            >
              {showPassword ? <EyeIcon /> : <EyeSlashIcon />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Password must be at least 6 characters</p>
        </div>

        {/* Confirm Password with professional eye icon - CORRECTED LOGIC */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Confirm Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Confirm your password"
              className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all"
              required
            />
            <button
              type="button"
              onClick={toggleConfirmPasswordVisibility}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#800000] transition-colors focus:outline-none"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeIcon /> : <EyeSlashIcon />}
            </button>
          </div>
          {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
            <p className="text-xs text-red-500 mt-1">⚠ Passwords do not match</p>
          )}
          {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
            <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
          )}
        </div>

        {/* Terms and Policy Checkbox */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 w-4 h-4 text-[#800000] border-gray-300 rounded focus:ring-[#800000]"
            />
            <label htmlFor="terms" className="text-sm text-gray-700">
              I agree to the{' '}
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="text-[#800000] font-semibold hover:underline"
              >
                Terms of Service
              </button>
              {' '}and{' '}
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="text-[#800000] font-semibold hover:underline"
              >
                Privacy Policy
              </button>
            </label>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-xs text-gray-500">
              By registering, you confirm that the information provided is accurate and you consent to the collection and processing of your data for alumni tracking purposes.
            </p>
          </div>
        </div>

        {error && (
          <div className={`rounded-xl p-4 ${
            error.includes('already registered') 
              ? 'bg-amber-50 border border-amber-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start gap-3">
              <div className="text-xl">
                {error.includes('already registered') ? '⚠️' : '❌'}
              </div>
              <div className="flex-1">
                <p className={`text-sm whitespace-pre-line ${
                  error.includes('already registered') ? 'text-amber-800' : 'text-red-800'
                }`}>
                  {error}
                </p>
                {error.includes('already registered') && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSuccess) onSuccess();
                      }}
                      className="inline-flex items-center gap-2 text-sm text-[#800000] font-semibold hover:underline"
                    >
                      <span>→</span> Go to Sign In page
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                      Already have an account? Use your email and password to sign in.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || verificationStatus !== 'verified' || !agreedToTerms}
          className="w-full py-3 bg-gradient-to-r from-[#800000] to-[#a10000] text-white font-bold rounded-xl hover:from-[#6a0000] hover:to-[#8a0000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Account...' : 'Register Now'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          By registering, you confirm that you are a verified graduate of Cebu Roosevelt Memorial Colleges.
        </p>
      </form>

      {/* Modals */}
      {showTermsModal && <TermsModal />}
      {showPrivacyModal && <PrivacyModal />}
    </>
  );
}