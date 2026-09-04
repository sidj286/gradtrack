// src/DigitalIDViewer.tsx
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { getFormattedAlumniID } from './lib/idUtils';

interface AlumniProfile {
  id: string;
  full_name: string | null;
  course: string | null;
  department: string | null;
  batch_year: number | null;
  gender: string | null;
  avatar_url?: string | null;
  employment_status?: string | null;
  job_title?: string | null;
  company?: string | null;
  career_alignment_status?: string | null;
  student_id?: string | null;
}

interface DigitalIDViewerProps {
  verifyId: string;
  onBackToApp?: () => void;
}

export default function DigitalIDViewer({ verifyId, onBackToApp }: DigitalIDViewerProps) {
  const [profile, setProfile] = useState<AlumniProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const fetchPublicProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchErr } = await supabase
          .from('alumni_profiles')
          .select('*')
          .eq('id', verifyId)
          .maybeSingle();

        if (fetchErr) {
          console.error('Error fetching verified profile:', fetchErr);
          setError('Unable to load verification record.');
          return;
        }

        if (!data) {
          setError('Alumni verification record not found or invalid QR code.');
          return;
        }

        let avatarUrl = null;
        if (data.avatar_url) {
          const { data: publicUrlData } = supabase.storage
            .from('profile-pictures')
            .getPublicUrl(data.avatar_url);
          avatarUrl = publicUrlData.publicUrl;
        }

        setProfile({ ...data, avatar_url: avatarUrl });
      } catch (err) {
        console.error('Unexpected verification error:', err);
        setError('An error occurred while verifying alumni record.');
      } finally {
        setLoading(false);
      }
    };

    if (verifyId) {
      fetchPublicProfile();
    }
  }, [verifyId]);

  const genderLower = (profile?.gender || '').toLowerCase().trim();
  let alumnusHeader = 'CEBU ROOSEVELT MEMORIAL COLLEGES ALUMNUS / ALUMNA';
  if (genderLower === 'male') {
    alumnusHeader = 'CEBU ROOSEVELT MEMORIAL COLLEGES ALUMNUS';
  } else if (genderLower === 'female') {
    alumnusHeader = 'CEBU ROOSEVELT MEMORIAL COLLEGES ALUMNA';
  }

  const verifyUrl = `${window.location.origin}/?verify_id=${verifyId}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(verifyUrl)}`;

  const avatarSrc = profile?.avatar_url && !imgError
    ? profile.avatar_url
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'Alumni')}&background=800000&color=ffffff&rounded=false&size=300`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-[#400000] to-gray-950 flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto">
      
      {/* Top Navigation Control Bar */}
      <div className="w-full max-w-[340px] xs:max-w-[375px] sm:max-w-[420px] flex items-center justify-between mb-4">
        {onBackToApp ? (
          <button
            onClick={onBackToApp}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold text-xs backdrop-blur-md transition shadow-lg border border-white/20 active:scale-95"
          >
            <span>←</span>
            <span>Back to Portal</span>
          </button>
        ) : (
          <a
            href="/"
            className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold text-xs backdrop-blur-md transition shadow-lg border border-white/20 active:scale-95"
          >
            <span>←</span>
            <span>Home</span>
          </a>
        )}

        <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase px-3 py-1 bg-black/40 rounded-full border border-amber-400/30 backdrop-blur-md">
          OFFICIAL CRMC VERIFICATION
        </span>
      </div>

      {loading ? (
        <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/10 text-white text-center max-w-sm w-full">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold text-sm">Verifying QR Code Credentials...</p>
        </div>
      ) : error ? (
        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border border-red-200 text-center max-w-sm w-full">
          <div className="text-4xl mb-2">⚠️</div>
          <h3 className="text-lg font-bold text-red-600 mb-1">Verification Failed</h3>
          <p className="text-xs text-gray-600 mb-4">{error}</p>
          <a
            href="/"
            className="inline-block py-2.5 px-6 bg-[#800000] hover:bg-[#600000] text-white text-xs font-bold rounded-xl transition shadow"
          >
            Return to GradTrack Home
          </a>
        </div>
      ) : profile ? (
        <div className="w-full max-w-[320px] mx-auto space-y-3">
          
          {/* Glassmorphic Verification Status Banner */}
          <div className="bg-gradient-to-r from-emerald-600/90 to-teal-700/90 text-white p-2.5 rounded-2xl shadow-xl flex items-center justify-between gap-2 border border-emerald-300/40 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <div className="text-left">
                <p className="text-[10.5px] font-bold uppercase tracking-wider">OFFICIALLY VERIFIED RECORD</p>
                <p className="text-[8.5px] text-emerald-100 font-medium">
                  Verified on {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider bg-white/20 rounded-full border border-white/30 backdrop-blur-sm">
              AUTHENTIC
            </span>
          </div>

          {/* Philippine Standard Physical Student ID Card Container (CR80: 53.98mm x 85.6mm / 320px x 507px) */}
          <div className="bg-white/85 backdrop-blur-2xl rounded-[1.75rem] overflow-hidden border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative transition-all duration-300 font-sans antialiased w-full max-w-[320px] mx-auto">
            
            {/* Lanyard Graphic */}
            <div className="bg-[#800000] pt-2.5 pb-1 text-center relative print:hidden">
              <div className="w-11 h-2 bg-black/50 rounded-full mx-auto border border-white/20 shadow-inner" />
            </div>

            {/* Header Banner */}
            <div className="bg-gradient-to-b from-[#800000]/95 via-[#700000]/90 to-[#600000]/85 text-white px-3 py-3 text-center relative backdrop-blur-md border-b border-white/10">
              {/* CRMC Institution Logo */}
              <div className="flex justify-center mb-1">
                <img 
                  src="/images/institution_logo/crmc_logo.png" 
                  alt="CRMC Institution Logo" 
                  className="w-16 h-16 object-contain drop-shadow-md"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/pwa-192x192.png';
                  }}
                />
              </div>

              <p className="text-[10px] font-bold tracking-wider text-amber-300 uppercase leading-tight">
                CEBU ROOSEVELT MEMORIAL COLLEGES
              </p>

              <h2 className="text-[11px] font-bold uppercase text-white mt-0.5 tracking-wide leading-tight">
                {alumnusHeader}
              </h2>

              <div className="mt-1 inline-block">
                <span className="px-2.5 py-0.5 text-[8.5px] font-semibold tracking-wider uppercase bg-[#D4AF37] text-[#400000] rounded-full shadow-sm border border-amber-200/40 backdrop-blur-sm">
                  VERIFIED DIGITAL ID
                </span>
              </div>
            </div>

            {/* Card Body */}
            <div className="px-3.5 pt-0 pb-4 text-center bg-gradient-to-b from-white/90 via-white/80 to-white/90 backdrop-blur-xl">
              
              {/* Fitted Square ID Photo Frame */}
              <div className="flex justify-center -mt-7 mb-2 relative z-10">
                <div className="p-1 rounded-xl bg-white/40 backdrop-blur-md border border-white/80 shadow-lg">
                  <img
                    src={avatarSrc}
                    alt={profile.full_name || 'Alumni ID Photo'}
                    onError={() => setImgError(true)}
                    className="w-26 h-30 xs:w-28 xs:h-32 rounded-lg object-cover bg-white border-2 border-[#800000]/40 shadow-md"
                  />
                </div>
              </div>

              {/* Name */}
              <h3 className="text-sm xs:text-base sm:text-lg font-bold text-gray-900 uppercase tracking-tight leading-tight">
                {profile.full_name || 'Alumni Member'}
              </h3>

              {/* Program */}
              <p className="text-[11px] xs:text-xs font-semibold text-[#800000] mt-0.5 max-w-xs mx-auto leading-tight">
                {profile.course || 'Degree Program Not Specified'}
              </p>

              {/* Department */}
              {profile.department && (
                <div className="mt-0.5">
                  <span className="text-[8.5px] font-semibold tracking-wide px-2 py-0.5 bg-amber-50 text-amber-900 rounded-full uppercase border border-amber-200/80 inline-block shadow-sm">
                    {profile.department}
                  </span>
                </div>
              )}

              {/* Glassmorphic Information Grid */}
              <div className="mt-2.5 p-2 bg-white/60 backdrop-blur-md rounded-xl text-left text-xs grid grid-cols-2 gap-1 border border-white/80 shadow-sm">
                <div>
                  <span className="text-[8.5px] font-semibold text-gray-500 uppercase tracking-wider block">Graduated</span>
                  <span className="font-bold text-gray-900 text-[10.5px]">
                    {profile.batch_year ? `Class of ${profile.batch_year}` : 'N/A'}
                  </span>
                </div>

                <div>
                  <span className="text-[8.5px] font-semibold text-gray-500 uppercase tracking-wider block">Gender</span>
                  <span className="font-bold text-gray-900 capitalize text-[10.5px]">
                    {profile.gender || 'N/A'}
                  </span>
                </div>

                <div className="col-span-2 pt-1 border-t border-gray-200/60 flex justify-between items-center">
                  <span className="text-[8.5px] font-semibold text-gray-500 uppercase tracking-wider">Alumni ID</span>
                  <span className="font-mono font-bold text-[10.5px] text-[#800000] tracking-wide">
                    {getFormattedAlumniID(profile)}
                  </span>
                </div>
              </div>

              {/* Career Info (if available) */}
              {profile.job_title && (
                <div className="mt-2 p-2 bg-emerald-50/80 backdrop-blur-md rounded-xl text-left text-xs border border-emerald-200/80 shadow-sm">
                  <span className="text-[8.5px] font-semibold text-emerald-700 uppercase tracking-wider block mb-0.5">Career & Current Role</span>
                  <p className="font-bold text-gray-900 text-[11px]">{profile.job_title}</p>
                  {profile.company && <p className="text-[9.5px] text-gray-600 font-medium">{profile.company}</p>}
                </div>
              )}

              {/* Universal QR Code */}
              <div className="mt-2.5 pt-2 border-t border-dashed border-gray-300/80 flex flex-col items-center">
                <div className="p-1.5 bg-white/90 backdrop-blur-md rounded-lg border-2 border-gray-900 shadow-md">
                  <img
                    src={qrCodeUrl}
                    alt="Universal Alumni QR Code"
                    className="w-22 h-22 xs:w-24 xs:h-24 object-contain"
                  />
                </div>
                <p className="text-[8.5px] font-semibold text-gray-500 uppercase tracking-wider mt-1.5">
                  OFFICIAL CRMC ALUMNI CREDENTIAL
                </p>
              </div>
            </div>

            {/* Frosted Glass Footer Bar */}
            <div className="bg-[#800000]/95 text-amber-200 py-2 px-2.5 text-center text-[8.5px] font-semibold uppercase tracking-wider border-t border-white/10 backdrop-blur-md">
              Cebu Roosevelt Memorial Colleges • Bogo City, Cebu
            </div>
          </div>

          {/* Action to Return */}
          <div className="text-center pt-2 pb-4">
            {onBackToApp ? (
              <button
                onClick={onBackToApp}
                className="py-3 px-6 bg-white/20 hover:bg-white/30 text-white font-extrabold text-xs rounded-2xl backdrop-blur-md transition shadow-lg border border-white/20 active:scale-95"
              >
                ← Return to GradTrack Portal
              </button>
            ) : (
              <a
                href="/"
                className="inline-block py-3 px-6 bg-white/20 hover:bg-white/30 text-white font-extrabold text-xs rounded-2xl backdrop-blur-md transition shadow-lg border border-white/20 active:scale-95"
              >
                ← Go to GradTrack Portal Home
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
