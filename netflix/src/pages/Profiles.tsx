import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, Profile } from '../utils/authStore';
import { AVATAR_OPTIONS, DEFAULT_AVATAR } from '../utils/avatarUtils';
import { PlusCircleIcon, CheckBadgeIcon, UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

const Profiles: React.FC = () => {
  const { user, profiles, activeProfile, fetchProfiles, setActiveProfile, createProfile, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const [showAddModal, setShowAddModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[1] || DEFAULT_AVATAR);
  const [isKids, setIsKids] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleSelectProfile = (profile: Profile) => {
    setActiveProfile(profile);
    navigate('/');
  };

  const handleAddProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!profileName.trim()) {
      setAddError('Please enter a name for the profile');
      return;
    }

    const created = await createProfile(profileName.trim(), selectedAvatar, isKids);
    if (created) {
      setActiveProfile(created);
      setShowAddModal(false);
      setProfileName('');
      navigate('/');
    } else {
      setAddError('Failed to create profile. Maximum 5 profiles allowed.');
    }
  };

  // If no profiles loaded yet, fallback to single profile from user
  const displayedProfiles = profiles.length > 0 
    ? profiles 
    : user 
    ? [{ id: user.id, name: user.name || 'Member', avatar: user.avatar || DEFAULT_AVATAR, userId: user.id }] 
    : [];

  return (
    <div className="min-h-screen w-full bg-[#141414] flex flex-col items-center justify-center px-4 py-12 animate-fade-in">
      <div className="text-center max-w-4xl w-full">
        <h1 className="text-3xl md:text-5xl font-medium text-white mb-3 tracking-wide">
          Who's listening?
        </h1>
        <p className="text-white/50 text-sm mb-10">
          Select your family profile to personalize your music and recommendations.
        </p>

        {/* Profile Grid */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 mb-12">
          {displayedProfiles.map((prof) => {
            const isActive = activeProfile?.id === prof.id || (!activeProfile && prof.id === displayedProfiles[0]?.id);
            return (
              <div
                key={prof.id}
                onClick={() => handleSelectProfile(prof)}
                className="group flex flex-col items-center gap-3 cursor-pointer relative"
              >
                <div
                  className={`w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden border-2 transition-all duration-200 group-hover:scale-105 shadow-2xl relative bg-[#222] ${
                    isActive
                      ? 'border-[#1DB954] ring-4 ring-[#1DB954]/40'
                      : 'border-transparent group-hover:border-white'
                  }`}
                >
                  <img
                    src={prof.avatar || DEFAULT_AVATAR}
                    alt={prof.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                    }}
                  />
                  {isActive && (
                    <div className="absolute top-2 right-2 bg-[#1DB954] rounded-full p-0.5 text-black">
                      <CheckBadgeIcon className="w-5 h-5 text-black" />
                    </div>
                  )}
                  {prof.isKids && (
                    <div className="absolute bottom-2 left-2 bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">
                      KIDS
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-white/80 group-hover:text-white text-base md:text-lg font-bold transition-colors">
                    {prof.name}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Add Profile Tile (Max 5) */}
          {displayedProfiles.length < 5 && (
            <div
              onClick={() => setShowAddModal(true)}
              className="group flex flex-col items-center gap-3 cursor-pointer"
            >
              <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl flex items-center justify-center border-2 border-dashed border-white/20 group-hover:border-[#1DB954] group-hover:bg-[#1DB954]/10 transition-all duration-200 group-hover:scale-105">
                <PlusCircleIcon className="w-12 h-12 md:w-16 md:h-16 text-white/40 group-hover:text-[#1DB954] transition-colors" />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-white/40 group-hover:text-white text-base md:text-lg font-medium transition-colors">
                  Add Profile
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Manage Profiles Button */}
        <div>
          <Link
            to="/manage-profiles"
            className="inline-block px-8 py-2.5 border border-white/40 text-white/70 hover:text-white hover:border-white text-sm md:text-base font-bold tracking-widest uppercase rounded-lg transition-all duration-200 hover:bg-white/5"
          >
            Manage Profiles
          </Link>
        </div>
      </div>

      {/* Add Profile Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center px-4">
          <div className="bg-[#141414] border border-white/10 rounded-2xl max-w-md w-full p-8 shadow-2xl relative animate-scale-up">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white p-1 rounded-full"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-[#1DB954]/10 rounded-xl text-[#1DB954]">
                <UserPlusIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Add Profile</h2>
                <p className="text-xs text-white/50">Add a profile for another person watching Spotiflex</p>
              </div>
            </div>

            {addError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddProfileSubmit} className="space-y-5">
              {/* Profile Name */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">Profile Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya, Kids, Dad"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-[#1f1f1f] border border-white/10 focus:border-[#1DB954] text-white px-4 py-3 rounded-xl text-sm outline-none transition"
                />
              </div>

              {/* Choose Icon */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">Choose Icon</label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_OPTIONS.slice(0, 12).map((av, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedAvatar(av)}
                      className={`cursor-pointer rounded-lg overflow-hidden border-2 aspect-square transition-all ${
                        selectedAvatar === av ? 'border-[#1DB954] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={av} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Kids Profile Toggle */}
              <div className="flex items-center gap-3 bg-white/[0.03] p-3 rounded-xl border border-white/5">
                <input
                  type="checkbox"
                  id="kids-toggle"
                  checked={isKids}
                  onChange={(e) => setIsKids(e.target.checked)}
                  className="w-4 h-4 accent-[#1DB954] cursor-pointer"
                />
                <label htmlFor="kids-toggle" className="text-xs text-white/80 cursor-pointer">
                  Kid's Profile? (Only kid-friendly music and content)
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-sm rounded-xl transition flex items-center justify-center cursor-pointer shadow-lg shadow-[#1DB954]/20"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Create Profile'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profiles;
