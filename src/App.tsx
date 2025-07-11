import { useState } from "react";
import { useGoogleOneTapLogin, useGoogleLogin, googleLogout } from "@react-oauth/google";
import type { TokenResponse, CredentialResponse } from "@react-oauth/google";
import useDrivePicker from 'react-google-drive-picker';

function App() {
  /**
   * In this app we will use the one tap login for initial login, then have a connect to g drive button
   * that will use the google login to get the token and then use that token to connect
   * to the google drive api.
   */

  const [token, setToken] = useState<TokenResponse | null>(null);
  const [credential, setCredential] = useState<CredentialResponse | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [files, setFiles] = useState<any>(null);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const [appFolderId, setAppFolderId] = useState<string | null>(null);
  const [loadingAppFolder, setLoadingAppFolder] = useState<boolean>(false);
  const [creatingProject, setCreatingProject] = useState<boolean>(false);
  const [creatingNewFolder, setCreatingNewFolder] = useState<boolean>(false);
  
  // Initialize the Google Drive Picker
  const [openPicker] = useDrivePicker();
  
  useGoogleOneTapLogin({
    onSuccess: (response) => {
      console.log("One Tap Login Success:", response);
      setCredential(response);
      setErrors(prev => prev.filter(err => !err.includes("One Tap")));
    },
    onError: () => {
      console.error("One Tap Login Failed");
      setErrors(prev => [...prev.filter(err => !err.includes("One Tap")), "One Tap Login Failed"]);
    },
  });

  const connectWithDriveLogin = useGoogleLogin({
    onSuccess: (response) => {
      console.log("Google Login Success:", response);
      setToken(response);
      setErrors(prev => prev.filter(err => !err.includes("Google Drive")));
      // Fetch user profile and setup app folder
      fetchUserProfile(response.access_token);
      setupAppFolder(response.access_token);
    },
    onError: () => {
      console.error("Google Login Failed");
      setErrors(prev => [...prev.filter(err => !err.includes("Google Drive")), "Google Drive Login Failed"]);
    },
    scope: "openid profile email https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata",
    flow: "implicit",
  });

  const onLogoutClick = () => {
    googleLogout();
    setToken(null);
    setCredential(null);
    setErrors([]);
    setFiles(null);
    setLoadingFiles(false);
    setUserProfile(null);
    setLoadingProfile(false);
    setAppFolderId(null);
    setLoadingAppFolder(false);
    setCreatingProject(false);
    setCreatingNewFolder(false);
    console.log("Logged out successfully");
  }

  const fetchUserProfile = async (accessToken: string) => {
    setLoadingProfile(true);
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setUserProfile(data);
      setErrors(prev => prev.filter(err => !err.includes("Profile fetch")));
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setErrors(prev => [...prev.filter(err => !err.includes("Profile fetch")), `Profile fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setLoadingProfile(false);
    }
  };

  const setupAppFolder = async (accessToken: string) => {
    setLoadingAppFolder(true);
    try {
      // First, search for existing "My Apps Projects" folder
      const searchResponse = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=name='My Apps Projects' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)",
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!searchResponse.ok) {
        throw new Error(`HTTP error! status: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      
      let folderId: string;
      
      if (searchData.files && searchData.files.length > 0) {
        // Folder already exists
        folderId = searchData.files[0].id;
        console.log("Found existing My Apps Projects folder:", folderId);
      } else {
        // Create new folder
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'My Apps Projects',
            mimeType: 'application/vnd.google-apps.folder'
          })
        });

        if (!createResponse.ok) {
          throw new Error(`HTTP error! status: ${createResponse.status}`);
        }

        const createData = await createResponse.json();
        folderId = createData.id;
        console.log("Created new My Apps Projects folder:", folderId);
      }

      setAppFolderId(folderId);
      setErrors(prev => prev.filter(err => !err.includes("App folder")));
      
      // Now fetch project folders
      fetchProjectFolders(accessToken, folderId);
    } catch (error) {
      console.error('Error setting up app folder:', error);
      setErrors(prev => [...prev.filter(err => !err.includes("App folder")), `App folder setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setLoadingAppFolder(false);
    }
  };

  const fetchProjectFolders = async (accessToken: string, parentFolderId: string) => {
    setLoadingFiles(true);
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${parentFolderId}' in parents and trashed=false&fields=files(id,name,mimeType,createdTime,shortcutDetails)&orderBy=createdTime desc`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setFiles(data);
      setErrors(prev => prev.filter(err => !err.includes("Files fetch")));
    } catch (error) {
      console.error('Error fetching project folders:', error);
      setErrors(prev => [...prev.filter(err => !err.includes("Files fetch")), `Project folders fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const createProject = async () => {
    if (!token || !appFolderId) return;

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const developerKey = import.meta.env.VITE_GOOGLE_API_KEY;
    
    console.log('Environment check:', {
      clientId,
      developerKey,
      hasToken: !!token,
      allEnv: import.meta.env
    });

    if (!clientId || !developerKey) {
      setErrors(prev => [...prev, 'Missing Google API configuration. Please check your .env file.']);
      return;
    }

    const handleOpenPicker = () => {
      setCreatingProject(true);
      
      try {
        openPicker({
          clientId: clientId,
          developerKey: developerKey,
          viewId: 'DOCS', // Changed from 'FOLDERS' to 'DOCS' for better folder selection
          token: token.access_token,
          showUploadView: true, // Enable upload view for folder creation
          showUploadFolders: true, // Enable folder creation
          supportDrives: true, // Enable shared drives support
          setIncludeFolders: true, // Include folders in the view
          setSelectFolderEnabled: true, // Enable folder selection
          multiselect: false,
          callbackFunction: (data) => {
            console.log('Picker callback:', data);
            setCreatingProject(false);
            
            if (data.action === 'cancel') {
              console.log('User cancelled the picker');
              return;
            }
            
            if (data.action === 'picked' && data.docs && data.docs.length > 0) {
              const selectedFolder = data.docs[0];
              console.log('Selected folder:', selectedFolder);
              
              // Extract what information we can from the folder object
              console.log('Full folder object:', JSON.stringify(selectedFolder, null, 2));
              
              // Use any available properties that might indicate drive context
              const hasSharedInfo = (selectedFolder as any).driveId || (selectedFolder as any).teamDriveId;
              const isOwnedByMe = (selectedFolder as any).ownedByMe !== false;
              
              // Determine drive type for display
              let driveType = 'Personal Drive';
              if (hasSharedInfo) {
                driveType = 'Shared Drive';
              } else if (!isOwnedByMe && (selectedFolder as any).ownedByMe !== undefined) {
                driveType = 'Shared Folder';
              }
              
              console.log(`Detected Drive Type: ${driveType}`);
              
              // Create a symbolic link or reference to this folder in our app folder
              createProjectReference(selectedFolder, driveType);
            }
          },
        });
      } catch (error) {
        console.error('Error opening picker:', error);
        setCreatingProject(false);
        setErrors(prev => [...prev, `Picker error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      }
    };

    handleOpenPicker();
  };

  const createNewFolder = async () => {
    if (!token) return;

    const folderName = prompt("Enter new folder name:");
    if (!folderName || folderName.trim() === '') return;

    setCreatingNewFolder(true);
    try {
      // Create new folder in the user's Drive root
      const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName.trim(),
          mimeType: 'application/vnd.google-apps.folder'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newFolder = await response.json();
      console.log("Created new folder:", newFolder);
      
      // Automatically add the new folder as a project reference
      if (appFolderId) {
        createProjectReference(newFolder, 'Personal Drive');
      }
      
      setErrors(prev => prev.filter(err => !err.includes("Folder creation")));
    } catch (error) {
      console.error('Error creating new folder:', error);
      setErrors(prev => [...prev.filter(err => !err.includes("Folder creation")), `Folder creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setCreatingNewFolder(false);
    }
  };

  const createProjectReference = async (selectedFolder: any, driveType = 'Personal Drive') => {
    if (!token || !appFolderId) return;

    try {
      // Create a shortcut/reference to the selected folder in our "My Apps Projects" folder
      const displayName = `${selectedFolder.name} (${driveType})`;
      const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: displayName,
          mimeType: 'application/vnd.google-apps.shortcut',
          parents: [appFolderId],
          shortcutDetails: {
            targetId: selectedFolder.id
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Created project reference:", data);
      setErrors(prev => prev.filter(err => !err.includes("Project creation")));
      
      // Refresh the project folders list
      fetchProjectFolders(token.access_token, appFolderId);
    } catch (error) {
      console.error('Error creating project reference:', error);
      setErrors(prev => [...prev.filter(err => !err.includes("Project creation")), `Project reference creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  const isLoggedIn = token || credential;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Google Login App</h1>
        
        {/* Login Controls / Profile */}
        <div className="flex flex-col items-center mb-6">
          {!token ? (
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg mb-4 transition-colors font-medium"
              onClick={() => connectWithDriveLogin()}
            >
              Connect with Google Drive
            </button>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center space-x-4">
              {loadingProfile ? (
                <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse"></div>
              ) : userProfile?.picture ? (
                <img 
                  src={userProfile.picture} 
                  alt="Profile"
                  className="w-12 h-12 rounded-full border-2 border-blue-300"
                />
              ) : (
                <div className="w-12 h-12 bg-blue-300 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    {userProfile?.name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              <div className="flex-1">
                {loadingProfile ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse w-32"></div>
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-48"></div>
                  </div>
                ) : (
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {userProfile?.name || 'Unknown User'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {userProfile?.email || 'No email available'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div className="flex space-x-3">
            {token && appFolderId && (
              <>
                <button
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={createProject}
                  disabled={creatingProject}
                >
                  {creatingProject ? 'Selecting...' : 'Select Existing Folder'}
                </button>
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={createNewFolder}
                  disabled={creatingNewFolder}
                >
                  {creatingNewFolder ? 'Creating...' : 'Create New Folder'}
                </button>
              </>
            )}
            
            {isLoggedIn && (
              <button
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                onClick={onLogoutClick}
              >
                Logout
              </button>
            )}
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Token Response */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-3 text-gray-700">Google Drive Token</h2>
            {token ? (
              <pre className="bg-green-50 border border-green-200 rounded p-3 text-sm overflow-auto max-h-64 text-green-800">
                {JSON.stringify(token, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500 italic">No Google Drive token available</p>
            )}
          </div>

          {/* Credential Response */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-3 text-gray-700">One Tap Credential</h2>
            {credential ? (
              <pre className="bg-blue-50 border border-blue-200 rounded p-3 text-sm overflow-auto max-h-64 text-blue-800">
                {JSON.stringify(credential, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500 italic">No one-tap credential available</p>
            )}
          </div>

          {/* User Profile Response */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-3 text-gray-700">User Profile</h2>
            {loadingProfile ? (
              <div className="flex items-center justify-center p-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                <span className="ml-2 text-gray-600">Loading profile...</span>
              </div>
            ) : userProfile ? (
              <pre className="bg-orange-50 border border-orange-200 rounded p-3 text-sm overflow-auto max-h-64 text-orange-800">
                {JSON.stringify(userProfile, null, 2)}
              </pre>
            ) : (
              <p className="text-gray-500 italic">No user profile available</p>
            )}
          </div>

          {/* Files Response */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold text-gray-700">Project Folders</h2>
              {loadingAppFolder && (
                <div className="flex items-center text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                  Setting up...
                </div>
              )}
            </div>
            {loadingFiles ? (
              <div className="flex items-center justify-center p-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-600">Loading projects...</span>
              </div>
            ) : files?.files && files.files.length > 0 ? (
              <div className="space-y-2">
                {files.files.map((file: any) => {
                  const isShortcut = file.mimeType === 'application/vnd.google-apps.shortcut';
                  const targetId = isShortcut ? file.shortcutDetails?.targetId : file.id;
                  const displayName = file.name;
                  
                  return (
                    <div key={file.id} className="bg-white border border-gray-200 rounded p-2 flex items-center space-x-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
                        <span className="text-white text-xs">{isShortcut ? '🔗' : '📁'}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{displayName}</p>
                        <p className="text-xs text-gray-500">
                          {isShortcut ? 'Project Reference • ' : 'Folder • '}
                          Created: {new Date(file.createdTime).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <a
                          href={`https://drive.google.com/drive/folders/${targetId || file.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-700 text-sm px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          title="Open in Google Drive"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : appFolderId ? (
              <p className="text-gray-500 italic">No projects yet. Create your first project!</p>
            ) : (
              <p className="text-gray-500 italic">Setting up your projects folder...</p>
            )}
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-3 text-red-700">Errors</h2>
            <ul className="space-y-2">
              {errors.map((error, index) => (
                <li key={index} className="text-red-600 bg-red-100 rounded px-3 py-2">
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Status Summary */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center space-x-4">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${credential ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <div className={`w-2 h-2 rounded-full ${credential ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-sm font-medium">One Tap Login</span>
            </div>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${token ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <div className={`w-2 h-2 rounded-full ${token ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-sm font-medium">Google Drive Access</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

}

export default App;