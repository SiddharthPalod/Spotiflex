import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, Profile } from '../utils/authStore';
import { AVATAR_OPTIONS, DEFAULT_AVATAR } from '../utils/avatarUtils';
import { PencilSquareIcon, CheckIcon, TrashIcon, ArrowLeftIcon } from '@heroicons/react/24/solid';

const ManageProfiles: React.FC = () => {
  const { user, profiles, fetchProfiles, updateProfileItem, deleteProfileItem, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState(DEFAULT_AVATAR);
  const [editIsKids, setEditIsKids] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const startEditing = (prof: Profile) => {
    setEditingProfile(prof);
    setEditName(prof.name);
    setEditAvatar(prof.avatar || DEFAULT_AVATAR);
    setEditIsKids(Boolean(prof.isKids));
    setCustomUrl('');
    setUploadError(null);
    setIsSaved(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setUploadError('Image size should be under 4MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 256;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            setEditAvatar(compressedBase64);
          } else {
            setEditAvatar(result);
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = () => {
    if (customUrl.trim()) {
      setEditAvatar(customUrl.trim());
      setCustomUrl('');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    const success = await updateProfileItem(editingProfile.id, editName.trim(), editAvatar, editIsKids);
    if (success) {
      setIsSaved(true);
      setTimeout(() => {
        setEditingProfile(null);
        setIsSaved(false);
      }, 500);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this profile?')) {
      const success = await deleteProfileItem(id);
      if (success && editingProfile?.id === id) {
        setEditingProfile(null);
      }
    }
  };

  const displayedProfiles = profiles.length > 0
    ? profiles
    : user
    ? [{ id: user.id, name: user.name || 'Member', avatar: user.avatar || DEFAULT_AVATAR, userId: user.id }]
    : [];

  return (
    <div className="min-h-screen w-full bg-[#141414] text-white flex flex-col items-center justify-center px-4 py-12 animate-fade-in">
      <div className="max-w-3xl w-full space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-semibold text-white mb-2 tracking-wide">
            Manage Profiles
          </h1>
          <p className="text-white/50 text-sm">
            {editingProfile
              ? `Editing profile: ${editingProfile.name}`
              : `Select a profile to edit for ${user?.email || 'your account'}`}
          </p>
        </div>

        {/* View 1: Profile Grid with Edit Badges */}
        {!editingProfile ? (
          <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              {displayedProfiles.map((prof) => (
                <div
                  key={prof.id}
                  onClick={() => startEditing(prof)}
                  className="group flex flex-col items-center gap-3 cursor-pointer relative"
                >
                  <div className="w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden border-2 border-transparent group-hover:border-white transition-all duration-200 group-hover:scale-105 shadow-2xl relative bg-[#222]">
                    <img
                      src={prof.avatar || DEFAULT_AVATAR}
                      alt={prof.name}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                      <div className="p-2 bg-black/70 rounded-full border border-white/30 text-white">
                        <PencilSquareIcon className="w-6 h-6" />
                      </div>
                    </div>
                  </div>

                  <span className="text-white/70 group-hover:text-white text-base md:text-lg font-bold transition-colors">
                    {prof.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Done Button */}
            <div className="text-center pt-6">
              <button
                type="button"
                onClick={() => navigate('/profiles')}
                className="px-8 py-2.5 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-[#1DB954] hover:text-white transition duration-200 cursor-pointer shadow-lg"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* View 2: Edit Single Profile Form */
          <form
            onSubmit={handleSaveEdit}
            className="bg-[#1a1a1a] p-6 md:p-8 rounded-2xl border border-white/10 shadow-2xl space-y-6"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="text-white/60 hover:text-white text-xs flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                <span>Back to Profiles</span>
              </button>
              <h2 className="text-lg font-bold text-white">Edit Profile</h2>
              <div className="w-10" />
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Avatar Preview */}
              <div className="flex flex-col items-center gap-3 shrink-0 mx-auto md:mx-0">
                <div className="relative group w-32 h-32 md:w-36 md:h-36 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl bg-black/40">
                  <img
                    src={editAvatar}
                    alt="Selected Avatar"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
                    }}
                  />
                  <label
                    htmlFor="avatar-edit-file-input"
                    className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-2 text-center"
                  >
                    <PencilSquareIcon className="w-8 h-8 text-white mb-1" />
                    <span className="text-[11px] font-semibold text-white/90">Change Photo</span>
                  </label>
                </div>
                <span className="text-[11px] text-white/50">Avatar Preview</span>
              </div>

              {/* Form Inputs */}
              <div className="flex-1 w-full space-y-5">
                <div>
                  <label className="block text-xs uppercase font-bold text-white/50 tracking-wider mb-2">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#252525] border border-white/10 focus:border-[#1DB954] text-white px-4 py-3 rounded-xl text-sm outline-none transition"
                  />
                </div>

                {/* Preset Avatars */}
                <div>
                  <label className="block text-xs uppercase font-bold text-white/50 tracking-wider mb-2.5">
                    Select Icon
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {AVATAR_OPTIONS.slice(0, 12).map((av, idx) => (
                      <div
                        key={idx}
                        onClick={() => setEditAvatar(av)}
                        className={`cursor-pointer rounded-lg overflow-hidden border-2 aspect-square transition-all ${
                          editAvatar === av ? 'border-[#1DB954] scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={av} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Upload or Custom URL */}
                <div className="p-3.5 bg-white/[0.03] border border-white/10 rounded-xl space-y-2.5">
                  <label className="block text-xs font-semibold text-white/60">
                    Custom Photo or URL
                  </label>
                  {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <label
                      htmlFor="avatar-edit-file-input"
                      className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold cursor-pointer transition text-center flex items-center justify-center"
                    >
                      📁 Upload PC Photo
                    </label>
                    <input
                      id="avatar-edit-file-input"
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="flex-1 flex gap-2">
                      <input
                        type="url"
                        placeholder="Or paste image URL..."
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        className="flex-1 bg-[#252525] border border-white/10 focus:border-[#1DB954] text-white px-3 py-2 rounded-xl text-xs outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCustomUrl}
                        disabled={!customUrl.trim()}
                        className="px-3 py-2 bg-[#1DB954] disabled:opacity-30 disabled:pointer-events-none hover:bg-[#1ed760] text-black font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>

                {/* Kids Toggle */}
                <div className="flex items-center gap-3 bg-white/[0.03] p-3 rounded-xl border border-white/5">
                  <input
                    type="checkbox"
                    id="edit-kids-toggle"
                    checked={editIsKids}
                    onChange={(e) => setEditIsKids(e.target.checked)}
                    className="w-4 h-4 accent-[#1DB954] cursor-pointer"
                  />
                  <label htmlFor="edit-kids-toggle" className="text-xs text-white/80 cursor-pointer">
                    Kid's Profile (Restricts to kid-friendly recommendations)
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-5 border-t border-white/10">
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-white text-black font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[#1DB954] hover:text-white transition duration-200 flex items-center gap-2 cursor-pointer shadow-md"
                >
                  {isSaved ? (
                    <>
                      <CheckIcon className="w-4 h-4 text-black" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    'Save'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-5 py-2.5 border border-white/30 text-white/70 hover:text-white hover:border-white font-semibold text-xs uppercase tracking-wider rounded-xl transition duration-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {/* Delete Profile (Only if > 1 profile) */}
              {displayedProfiles.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteProfile(editingProfile.id)}
                  className="px-4 py-2 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span>Delete Profile</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ManageProfiles;
