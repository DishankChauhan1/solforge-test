'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Image from 'next/image';
import Link from 'next/link';
import { updateUserProfile } from '@/lib/firebase';
import { UserRole } from '@/types/user';
import { toast } from 'react-hot-toast';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const wallet = useWallet();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    bio: user?.bio || '',
    website: user?.website || '',
    twitter: user?.twitter || '',
    discord: user?.discord || '',
    githubUsername: user?.githubUsername || '',
    role: user?.role || 'contributor' as UserRole,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      setFormData({
        bio: user.bio || '',
        website: user.website || '',
        twitter: user.twitter || '',
        discord: user.discord || '',
        githubUsername: user.githubUsername || '',
        role: user.role || 'contributor' as UserRole,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError(null);

    try {
      await updateUserProfile(user.uid, formData);
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error('Error updating profile:', err);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // Function to verify GitHub username
  const verifyGitHubUsername = async () => {
    if (!formData.githubUsername) {
      toast.error('Please enter a GitHub username');
      return;
    }

    try {
      // Show loading toast
      toast.loading('Verifying GitHub username...', { id: 'github-verification' });

      // Make a request to the GitHub API to check if the username exists
      const response = await fetch(`https://api.github.com/users/${formData.githubUsername}`);

      // Dismiss loading toast
      toast.dismiss('github-verification');

      if (response.ok) {
        const userData = await response.json();
        
        // Update the form with data from GitHub
        setFormData(prev => ({
          ...prev,
          githubUsername: userData.login,
        }));

        // Show success message
        toast.success('GitHub username verified!');
        
        // Save the verified username to user profile
        if (user) {
          await updateUserProfile(user.uid, {
            ...formData,
            githubUsername: userData.login,
          });
        }
      } else {
        toast.error('GitHub username not found. Please check and try again.');
      }
    } catch (error) {
      toast.dismiss('github-verification');
      toast.error('Error verifying GitHub username');
      console.error('Error verifying GitHub username:', error);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-4 py-5 sm:px-6 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Image
                  src={user.photoURL || '/default-avatar.png'}
                  alt={user.displayName}
                  width={64}
                  height={64}
                  className="rounded-full"
                />
                <div className="ml-4">
                  <h1 className="text-xl font-semibold text-gray-900">{user.displayName}</h1>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-3 py-1 text-sm text-purple-600 hover:text-purple-700"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
          </div>

          {/* Profile Content */}
          <div className="px-4 py-5 sm:p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
                {error}
              </div>
            )}

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                  >
                    <option value="contributor">Contributor</option>
                    <option value="creator">Creator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Website</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                    placeholder="https://your-website.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">GitHub Username</label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                      type="text"
                      value={formData.githubUsername}
                      onChange={(e) => setFormData({ ...formData, githubUsername: e.target.value })}
                      className="flex-1 block w-full rounded-l-md border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                      placeholder="github-username"
                    />
                    <button
                      type="button"
                      onClick={verifyGitHubUsername}
                      className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 text-sm"
                    >
                      Verify
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Linking your GitHub account is required to claim bounties for PRs you've created.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Twitter</label>
                    <input
                      type="text"
                      value={formData.twitter}
                      onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Discord</label>
                    <input
                      type="text"
                      value={formData.discord}
                      onChange={(e) => setFormData({ ...formData, discord: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500"
                      placeholder="username#0000"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Profile</h3>
                  <dl className="mt-4 space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Role</dt>
                      <dd className="mt-1 text-sm text-gray-900 capitalize">{user.role}</dd>
                    </div>
                    {user.bio && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Bio</dt>
                        <dd className="mt-1 text-sm text-gray-900">{user.bio}</dd>
                      </div>
                    )}
                    {user.website && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Website</dt>
                        <dd className="mt-1 text-sm text-purple-600 hover:text-purple-700">
                          <a href={user.website} target="_blank" rel="noopener noreferrer">
                            {user.website}
                          </a>
                        </dd>
                      </div>
                    )}
                    {user.githubUsername && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">GitHub</dt>
                        <dd className="mt-1 text-sm text-purple-600 hover:text-purple-700">
                          <a href={`https://github.com/${user.githubUsername}`} target="_blank" rel="noopener noreferrer">
                            {user.githubUsername}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900">Social Links</h3>
                  <dl className="mt-4 space-y-4">
                    {user.twitter && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Twitter</dt>
                        <dd className="mt-1 text-sm text-purple-600 hover:text-purple-700">
                          <a href={`https://twitter.com/${user.twitter}`} target="_blank" rel="noopener noreferrer">
                            @{user.twitter}
                          </a>
                        </dd>
                      </div>
                    )}
                    {user.discord && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Discord</dt>
                        <dd className="mt-1 text-sm text-gray-900">{user.discord}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900">Wallet</h3>
                  <div className="mt-4">
                    {wallet.connected ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{wallet.publicKey?.toString()}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Connected
                        </span>
                      </div>
                    ) : (
                      <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900">Stats</h3>
                  <dl className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <dt className="text-sm font-medium text-gray-500">Bounties Created</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        {user.totalBountiesCreated || 0}
                      </dd>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <dt className="text-sm font-medium text-gray-500">Bounties Claimed</dt>
                      <dd className="mt-1 text-2xl font-semibold text-gray-900">
                        {user.totalBountiesClaimed || 0}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 