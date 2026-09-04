// src/DigitalIDModal.tsx
import { useState } from 'react';
import { getFormattedAlumniID } from './lib/idUtils';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  course: string | null;
  department?: string | null;
  batch_year: number | null;
  gender: string | null;
  avatar_url?: string | null;
  student_id?: string | null;
}

interface DigitalIDModalProps {
  profile: Profile;
  onClose: () => void;
}

export default function DigitalIDModal({ profile, onClose }: DigitalIDModalProps) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Universal verification URL to scan & view alumnus digital ID
  const verifyUrl = `${window.location.origin}/?verify_id=${profile.id}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(verifyUrl)}`;

  // Determine Header Title based on Gender
  const genderLower = (profile.gender || '').toLowerCase().trim();
  let alumnusHeader = 'CEBU ROOSEVELT MEMORIAL COLLEGES ALUMNUS / ALUMNA';
  if (genderLower === 'male') {
    alumnusHeader = 'CEBU ROOSEVELT MEMORIAL COLLEGES ALUMNUS';
  } else if (genderLower === 'female') {
    alumnusHeader = 'CEBU ROOSEVELT MEMORIAL COLLEGES ALUMNA';
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  const avatarSrc = profile?.avatar_url && !imgError
    ? profile.avatar_url
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'Alumni')}&background=800000&color=ffffff&rounded=false&size=300`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xl overflow-y-auto print:bg-white print:p-0 print:block">
      {/* Embedded print CSS for standard Philippine Physical Student ID Card (53.98mm x 85.6mm) */}
      <style>{`
        @media print {
          @page {
            size: 53.98mm 85.6mm;
            margin: 0;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:hidden { display: none !important; }
          #digital-id-card {
            width: 53.98mm !important;
            height: 85.6mm !important;
            max-width: 53.98mm !important;
            max-height: 85.6mm !important;
            border-radius: 3.18mm !important;
            box-shadow: none !important;
            border: 1px solid #999 !important;
            margin: 0 auto !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-[320px] mx-auto bg-transparent my-auto">
        
        {/* Top Control Bar with Close Button */}
        <div className="flex justify-end mb-2 px-1 print:hidden">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/35 text-white flex items-center justify-center font-bold text-base backdrop-blur-md transition shadow-lg border border-white/30 active:scale-95"
            title="Close ID"
          >
            ✕
          </button>
        </div>

        {/* Philippine Standard Physical Student ID Card Container (CR80: 53.98mm x 85.6mm / 320px x 507px) */}
        <div 
          id="digital-id-card" 
          className="bg-white/85 backdrop-blur-2xl rounded-[1.75rem] overflow-hidden border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.35)] relative transition-all duration-300 font-sans antialiased w-full max-w-[320px] mx-auto"
        >
          {/* Lanyard Punch Slot Graphic */}
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
                ✓ VERIFIED DIGITAL ID
              </span>
            </div>
          </div>

          {/* Inner Body Card */}
          <div className="px-3.5 pt-0 pb-4 text-center bg-gradient-to-b from-white/90 via-white/80 to-white/90 backdrop-blur-xl">
            
            {/* Fitted Square ID Photo Frame */}
            <div className="flex justify-center -mt-7 mb-2 relative z-10">
              <div className="p-1 rounded-xl bg-white/40 backdrop-blur-md border border-white/80 shadow-lg">
                <img
                  src={avatarSrc}
                  alt={profile?.full_name || 'Alumni ID Photo'}
                  onError={() => setImgError(true)}
                  className="w-26 h-30 xs:w-28 xs:h-32 rounded-lg object-cover bg-white border-2 border-[#800000]/40 shadow-md"
                />
              </div>
            </div>

            {/* Alumni Name */}
            <h3 className="text-sm xs:text-base sm:text-lg font-bold text-gray-900 uppercase tracking-tight leading-tight">
              {profile?.full_name || 'Alumni Member'}
            </h3>

            {/* Program / Course */}
            <p className="text-[11px] xs:text-xs font-semibold text-[#800000] mt-0.5 max-w-xs mx-auto leading-tight">
              {profile?.course || 'Degree Program Not Specified'}
            </p>

            {/* Department Badge */}
            {profile?.department && (
              <div className="mt-0.5">
                <span className="text-[8.5px] font-semibold tracking-wide px-2 py-0.5 bg-amber-50 text-amber-900 rounded-full uppercase border border-amber-200/80 inline-block shadow-sm">
                  {profile.department}
                </span>
              </div>
            )}

            {/* Glassmorphic Inset Information Grid */}
            <div className="mt-2.5 p-2 bg-white/60 backdrop-blur-md rounded-xl text-left text-xs grid grid-cols-2 gap-1 border border-white/80 shadow-sm">
              <div>
                <span className="text-[8.5px] font-semibold text-gray-500 uppercase tracking-wider block">Batch Graduated</span>
                <span className="font-bold text-gray-900 text-[10.5px]">
                  {profile?.batch_year ? `Class of ${profile.batch_year}` : 'N/A'}
                </span>
              </div>

              <div>
                <span className="text-[8.5px] font-semibold text-gray-500 uppercase tracking-wider block">Gender</span>
                <span className="font-bold text-gray-900 capitalize text-[10.5px]">
                  {profile?.gender || 'N/A'}
                </span>
              </div>

              <div className="col-span-2 pt-1 border-t border-gray-200/60 flex justify-between items-center">
                <span className="text-[8.5px] font-semibold text-gray-500 uppercase tracking-wider">Alumni ID</span>
                <span className="font-mono font-bold text-[10.5px] text-[#800000] tracking-wide">
                  {getFormattedAlumniID(profile)}
                </span>
              </div>
            </div>

            {/* Universal QR Code Section */}
            <div className="mt-2.5 pt-2 border-t border-dashed border-gray-300/80 flex flex-col items-center">
              <div className="p-1.5 bg-white/90 backdrop-blur-md rounded-lg border-2 border-gray-900 shadow-md">
                <img
                  src={qrCodeUrl}
                  alt="Universal Alumni QR Code"
                  className="w-22 h-22 xs:w-24 xs:h-24 object-contain"
                />
              </div>
              <p className="text-[8.5px] font-semibold text-gray-500 uppercase tracking-wider mt-1.5 flex items-center gap-1">
                <span>📱</span> SCAN TO VERIFY ALUMNI STATUS
              </p>
            </div>
          </div>

          {/* Frosted Glass Footer Bar */}
          <div className="bg-[#800000]/95 text-amber-200 py-2 px-2.5 text-center text-[8.5px] font-semibold uppercase tracking-wider border-t border-white/10 backdrop-blur-md">
            Cebu Roosevelt Memorial Colleges • Bogo City, Cebu
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-3 flex flex-col sm:flex-row gap-2 print:hidden">
          <button
            onClick={handleCopyLink}
            className="flex-1 py-2.5 px-3 bg-white/80 hover:bg-white text-gray-900 font-extrabold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 border border-white/80 shadow-lg backdrop-blur-md active:scale-95"
          >
            <span>{copied ? '✓' : '🔗'}</span>
            <span>{copied ? 'Link Copied!' : 'Copy Verification Link'}</span>
          </button>
          
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 bg-gradient-to-r from-[#800000] to-[#600000] hover:from-[#700000] hover:to-[#500000] text-white font-extrabold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 shadow-lg border border-amber-300/30 active:scale-95"
          >
            <span>🖨️</span>
            <span>Print / Save Digital ID</span>
          </button>
        </div>
      </div>
    </div>
  );
}
