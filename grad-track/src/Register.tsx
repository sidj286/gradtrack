// Register.tsx - COMPLETE WITH BLUE STYLING (ERRORS FIXED)
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
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleVerifyStudent = async () => {
    if (!formData.studentId) {
      setError('📚 Please enter your Student ID');
      return;
    }

    setVerificationStatus('verifying');
    setError('');

    try {
      // Check against graduates_master
      const { data: graduate, error: verifyError } = await supabase
        .from('graduates_master')
        .select('*')
        .eq('student_id', formData.studentId.trim())
        .eq('verified', true)
        .single();

      if (verifyError || !graduate) {
        setVerificationStatus('error');
        setError('❌ Student ID not found in verified graduates list. Please contact your school administrator.');
        return;
      }

      setVerifiedGraduate(graduate);
      
      // Auto-fill form from master list
      setFormData(prev => ({
        ...prev,
        fullName: graduate.full_name,
        batchYear: graduate.batch_year?.toString() || '',
        course: graduate.course || '',
      
      }));
      
      setVerificationStatus('verified');
    } catch (err) {
      console.error('Verification error:', err);
      setVerificationStatus('error');
      setError('⚠️ An error occurred during verification. Please try again.');
    }
  };

  // Improved check for existing user
  const checkIfUserExists = async (studentId: string, email: string) => {
    try {
      console.log('Checking for existing user with Student ID:', studentId);
      
      // Check by student_id in alumni_profiles
      const { data: existingProfile } = await supabase
        .from('alumni_profiles')
        .select('user_id, full_name, student_id')
        .eq('student_id', studentId)
        .maybeSingle();

      if (existingProfile) {
        console.log('Found existing profile with this student ID');
        return { 
          exists: true, 
          reason: 'student_id', 
          message: `❌ Student ID "${studentId}" is already registered.\n\nPlease sign in to your existing account.`,
          suggestion: 'Go to Sign In'
        };
      }

      // Check by email in users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('email', email)
        .maybeSingle();

      if (existingUser) {
        console.log('Found existing user with this email');
        return { 
          exists: true, 
          reason: 'email', 
          message: `❌ Email "${email}" is already registered.\n\nAccount holder: ${existingUser.full_name || 'Unknown'}\n\nPlease sign in to your account.`,
          suggestion: 'Go to Sign In'
        };
      }

      return { exists: false };
    } catch (err) {
      console.error('Error checking user:', err);
      return { exists: false };
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setError('');

    if (!agreedToTerms) {
      setError('📋 Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    if (verificationStatus !== 'verified') {
      setError('🔍 Please verify your student ID first');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('🔐 Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('🔒 Password must be at least 6 characters');
      return;
    }

    if (!formData.email) {
      setError('📧 Email address is required');
      return;
    }

    setLoading(true);
    setLoadingStep('Checking existing account...');

    try {
      // STEP 1: Check if user already exists
      const existingCheck = await checkIfUserExists(formData.studentId, formData.email);
      
      if (existingCheck.exists) {
        setError(existingCheck.message || 'User already exists');
        setLoading(false);
        setLoadingStep('');
        
        // Scroll to error message
        document.getElementById('error-message')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      // STEP 1.5: Capture official student details from the master list
// This ensures 'masterData' is available for Step 5 later on.
const { data: masterData } = await supabase
  .from('graduates_master')
  .select('department')
  .eq('student_id', formData.studentId)
  .single();

      // STEP 2: Double-check with a more precise query
      setLoadingStep('Verifying account details...');
      const { data: duplicateCheck } = await supabase
        .from('users')
        .select('email')
        .eq('email', formData.email)
        .maybeSingle();

      if (duplicateCheck) {
        setError(`⚠️ Email "${formData.email}" is already taken.\n\nPlease use a different email or sign in to your existing account.`);
        setLoading(false);
        setLoadingStep('');
        return;
      }

      // STEP 3: Create auth user
      setLoadingStep('Creating secure account...');
      console.log('Creating auth user...');
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            student_id: formData.studentId,
            batch_year: parseInt(formData.batchYear),
            course: formData.course,
          }
        }
      });

      if (signUpError) {
        console.error('Signup error:', signUpError);
        
        // Better error messages for common scenarios
        if (signUpError.message.includes('already registered')) {
          setError(`📧 Email "${formData.email}" is already registered.\n\nPlease sign in instead or use "Forgot Password" if you can't access your account.`);
        } else if (signUpError.message.includes('weak password')) {
          setError('🔒 Password is too weak. Please use a stronger password with at least 6 characters.');
        } else if (signUpError.message.includes('invalid email')) {
          setError('📧 Invalid email format. Please enter a valid email address.');
        } else {
          setError(`❌ Registration failed: ${signUpError.message}`);
        }
        setLoading(false);
        setLoadingStep('');
        return;
      }

      if (authData.user) {
        console.log('Auth user created:', authData.user.id);

        // STEP 4: Create users table entry
// STEP 4: Create/Sync users table entry
const { error: userInsertError } = await supabase
  .from('users')
  .upsert({ // Changed from .insert to .upsert
    id: authData.user.id,
    email: formData.email,
    role: 'Alumni',
    full_name: authData.user.user_metadata?.full_name || '',
    admin: false 
    
  }, { onConflict: 'id' }); // This tells the code: "If user exists, it's okay, keep going."

if (userInsertError) {
  console.error('Error creating users entry:', userInsertError);
  setError('Registration failed at user initialization.');
  setLoading(false);
  return;
}
     // STEP 5: Create alumni profile
// Now that student_id exists in your DB, this will work!
setLoadingStep('Finalizing registration...');
const { error: profileError } = await supabase
  .from('alumni_profiles')
  .insert({
    user_id: authData.user.id,
    student_id: formData.studentId, // Move student_id here
    full_name: formData.fullName,   // Move full_name here
    course: formData.course,
    batch_year: parseInt(formData.batchYear),
    department: masterData?.department || 'N/A',
    gender: (masterData as any)?.gender || '', 
    employment_status: 'Unemployed',
    profile_completion: 50,
    career_alignment_status: 'Pending'
  });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          
          // Specific error handling for profile creation
          if (profileError.code === '23505') {
            setError('⚠️ This student ID is already registered. Please contact support if you believe this is an error.');
          } else {
            setError('Account created but profile setup failed. Our team has been notified. Please try logging in.');
          }
          setLoading(false);
          setLoadingStep('');
          return;
        }

        console.log('Registration complete!');
        
        // Show success message
        const successMessage = `✓ Registration Successful!\n\nWelcome, ${formData.fullName}!\n\nA confirmation email has been sent to:\n${formData.email}\n\nPlease check your inbox and click the confirmation link to activate your GradTrack account.`;
        alert(successMessage);
        
        // Redirect to login
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      
      // Handle network errors
      if (err.message === 'Failed to fetch') {
        setError('🌐 Network error. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

  // Terms Modal Component
  const TermsModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">Terms of Service</h3>
          <button onClick={() => setShowTermsModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
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
          <button onClick={() => setShowTermsModal(false)} className="w-full py-2 bg-[#800000] text-white rounded-xl font-semibold hover:bg-[#6a0000] transition">Close</button>
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
          <button onClick={() => setShowPrivacyModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4 text-gray-600">
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Information We Collect</h4>
            <p className="text-sm">We collect personal information including your name, student ID, email, program, batch year, employment status, and career information provided by you.</p>
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
          <button onClick={() => setShowPrivacyModal(false)} className="w-full py-2 bg-[#800000] text-white rounded-xl font-semibold hover:bg-[#6a0000] transition">Close</button>
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
          <div className="flex flex-col sm:flex-row gap-2">
  <input
    type="text"
    value={formData.studentId}
    onChange={(e) => {
      setFormData({ ...formData, studentId: e.target.value });
      setVerificationStatus('idle');
      setError('');
    }}
    placeholder="Enter your Student ID"
    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:border-[#800000] focus:ring-2 focus:ring-[#800000]/20 outline-none transition-all"
    disabled={verificationStatus === 'verified'}
  />
  <button
    type="button"
    onClick={handleVerifyStudent}
    disabled={verificationStatus === 'verifying' || verificationStatus === 'verified'}
    className="px-6 py-2 bg-[#800000] text-white rounded-xl font-semibold hover:bg-[#6a0000] transition-all disabled:opacity-50 sm:whitespace-nowrap"
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
                Program: {verifiedGraduate.course} • Batch: {verifiedGraduate.batch_year}
              </p>
            </div>
          )}
          
          {verificationStatus === 'error' && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm whitespace-pre-line">{error}</p>
            </div>
          )}
        </div>

        {/* Full Name - Read-only */}
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

        {/* Course - Read-only */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Program <span className="text-red-500">*</span>
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

        {/* Batch Year - Read-only */}
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

        {/* Email */}
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
        
        </div>

        {/* Password */}
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

        {/* Confirm Password */}
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

        {/* Error Display with Blue Styling (matching verify ID section) */}
        {error && (
          <div 
            id="error-message"
            className="rounded-xl p-4 bg-blue-50 border border-blue-200"
          >
            <div className="flex items-start gap-3">
              <div className="text-xl flex-shrink-0">
                {error.includes('already registered') || error.includes('already taken') ? '⚠️' : '❌'}
              </div>
              <div className="flex-1">
                <p className="text-sm whitespace-pre-line text-blue-800">
                  {error}
                </p>
                
                {/* Action buttons for existing users */}
                {(error.includes('already registered') || error.includes('already taken')) && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => onSuccess?.()}
                        className="px-3 py-1.5 bg-[#800000] text-white rounded-md font-medium hover:bg-[#6a0000] transition text-xs"
                      >
                        Sign In →
                      </button>
                    </div>
                    
                    <p className="text-xs text-gray-500 text-center pt-2">
                      Forgot your password? Use the "Forgot Password" link on the sign in page.
                    </p>
                  </div>
                )}
                
                {/* Retry button for other errors */}
                {!error.includes('already registered') && !error.includes('already taken') && (
                  <button
                    type="button"
                    onClick={() => setError('')}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button with loading step */}
        <button
          type="submit"
          disabled={loading || verificationStatus !== 'verified' || !agreedToTerms}
          className="w-full py-3 bg-gradient-to-r from-[#800000] to-[#a10000] text-white font-bold rounded-xl hover:from-[#6a0000] hover:to-[#8a0000] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? loadingStep : 'Register Now'}
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