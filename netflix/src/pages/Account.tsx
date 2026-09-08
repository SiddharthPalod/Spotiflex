import { Link } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import { DEFAULT_AVATAR } from '../utils/avatarUtils';
import { ShieldCheckIcon, CreditCardIcon, ArrowRightOnRectangleIcon, UserGroupIcon, KeyIcon } from '@heroicons/react/24/outline';

const Account = () => {
  const { user, profiles, activeProfile } = useAuthStore();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-16 px-4 md:px-12 font-sans animate-fade-in">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">Account</h1>
            <p className="text-white/50 text-sm mt-1">Manage your membership, security, and profiles</p>
          </div>
          <Link
            to="/profiles"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
          >
            <UserGroupIcon className="w-4 h-4" />
            <span>Switch Profile</span>
          </Link>
        </div>

        {/* Section 1: Membership & Security */}
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">
                Membership & Security
              </h2>
              <Link
                to="/signout"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-red-500/20 text-xs font-bold text-red-400 hover:text-red-300 rounded-xl border border-red-500/20 transition"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span>Sign Out</span>
              </Link>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10">
                <div>
                  <span className="block text-base font-bold text-white">{user?.email || 'N/A'}</span>
                  <span className="text-xs text-[#1DB954] flex items-center gap-1 mt-1 font-medium">
                    <ShieldCheckIcon className="w-4 h-4" />
                    Encrypted with AES-256-GCM & Blind Indexed
                  </span>
                </div>
                <Link to="/manage-profiles" className="text-xs text-[#1DB954] hover:underline mt-2 sm:mt-0 font-semibold">
                  Manage profiles
                </Link>
              </div>

              <div className="flex items-center justify-between pb-4 border-b border-white/10 text-xs">
                <div className="flex items-center gap-2 text-white/80">
                  <KeyIcon className="w-4 h-4 text-white/40" />
                  <span>Password: ********</span>
                </div>
                <span className="text-white/40 text-[11px] font-mono bg-white/5 px-2 py-1 rounded">
                  Bcrypt Hashed (10 rounds)
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2 text-white/80">
                  <CreditCardIcon className="w-4 h-4 text-[#1DB954]" />
                  <span className="font-semibold">Spotiflex Premium / Lossless Plan</span>
                </div>
                <span className="px-2.5 py-0.5 bg-[#1DB954]/10 text-[#1DB954] font-bold rounded-full border border-[#1DB954]/30">
                  ACTIVE
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Plan & Audio Details */}
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">
              Plan Details
            </h2>
            <div className="md:col-span-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className="font-bold text-white">Lossless High-Fidelity Audio</span>
                <span className="text-[10px] px-2 py-0.5 bg-[#1DB954]/20 text-[#1DB954] font-black rounded border border-[#1DB954]/40">
                  24-BIT
                </span>
              </div>
              <span className="text-xs text-white/40">Hybrid AI / FAISS Recommendations</span>
            </div>
          </div>
        </div>

        {/* Section 3: Profile & Family Sub-Profiles */}
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 md:p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2">
                Profiles ({profiles.length || 1})
              </h2>
              <p className="text-xs text-white/40">
                Family members on this account
              </p>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-xl border border-white/10">
                <div className="flex items-center gap-3">
                  <img
                    src={activeProfile?.avatar || user?.avatar || DEFAULT_AVATAR}
                    alt={activeProfile?.name || 'User'}
                    className="w-12 h-12 rounded-lg object-cover ring-2 ring-[#1DB954]/50"
                  />
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{activeProfile?.name || user?.name || 'Spotiflex Member'}</span>
                      <span className="text-[10px] bg-[#1DB954]/20 text-[#1DB954] px-2 py-0.5 rounded-full font-bold">
                        ACTIVE
                      </span>
                    </h3>
                    <p className="text-xs text-white/50">{user?.email}</p>
                  </div>
                </div>
                <Link
                  to="/manage-profiles"
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-bold rounded-lg transition"
                >
                  Manage
                </Link>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs">
                <Link to="/profiles" className="text-[#1DB954] hover:underline font-semibold flex items-center gap-1.5">
                  <UserGroupIcon className="w-4 h-4" />
                  <span>Switch active profile / Add family member</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
