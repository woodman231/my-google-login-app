import { useState } from "react";
import { useGoogleOneTapLogin, useGoogleLogin, googleLogout } from "@react-oauth/google";
import type { TokenResponse, CredentialResponse } from "@react-oauth/google";

function App2() {
  const [token, setToken] = useState<TokenResponse | null>(null);
  const [credential, setCredential] = useState<CredentialResponse | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [folderName, setFolderName] = useState<string>("");
  const [creating, setCreating] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [folders, setFolders] = useState<any>(null);
  const [loadingFolders, setLoadingFolders] = useState<boolean>(false);
  const [sharedWithMeFolders, setSharedWithMeFolders] = useState<any>(null);
  const [loadingSharedWithMe, setLoadingSharedWithMe] = useState<boolean>(false);
  const [fileId, setFileId] = useState<string>("");
  const [fetchingFileInfo, setFetchingFileInfo] = useState<boolean>(false);
  const [fileInfo, setFileInfo] = useState<any>(null);
  const [appFolderInfo, setAppFolderInfo] = useState<any>(null);
  const [creatingAppFolder, setCreatingAppFolder] = useState<boolean>(false);

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
      // Fetch folders after login
      fetchAppFolders(response.access_token);
      fetchSharedWithMeFolders(response.access_token);
      setupAppDataFolder(response.access_token);
    },
    onError: () => {
      console.error("Google Login Failed");
      setErrors(prev => [...prev.filter(err => !err.includes("Google Drive")), "Google Drive Login Failed"]);
    },
    scope: "openid profile email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata",
    // scope: "openid profile email https://www.googleapis.com/auth/drive",
    flow: "implicit",
  });

  const onLogoutClick = () => {
    googleLogout();
    setToken(null);
    setCredential(null);
    setErrors([]);
    setFolderName("");
    setCreating(false);
    setResult(null);
    setFolders(null);
    setLoadingFolders(false);
    setSharedWithMeFolders(null);
    setLoadingSharedWithMe(false);
    setFileId("");
    setFetchingFileInfo(false);
    setFileInfo(null);
    setAppFolderInfo(null);
    setCreatingAppFolder(false);
    console.log("Logged out successfully");
  };

  const fetchAppFolders = async (accessToken: string) => {
    setLoadingFolders(true);
    try {
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,mimeType,createdTime,parents,owners,ownedByMe,shared,sharingUser,capabilities,driveId)&orderBy=createdTime desc&includeItemsFromAllDrives=true&supportsAllDrives=true",
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
      setFolders(data);
      setErrors(prev => prev.filter(err => !err.includes("Folders fetch")));
    } catch (error) {
      console.error('Error fetching folders:', error);
      setErrors(prev => [...prev.filter(err => !err.includes("Folders fetch")), `Folders fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setLoadingFolders(false);
    }
  };

  const fetchSharedWithMeFolders = async (accessToken: string) => {
    setLoadingSharedWithMe(true);
    try {
      const response = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and sharedWithMe=true and trashed=false&fields=files(id,name,mimeType,createdTime,parents,owners,ownedByMe,shared,sharingUser,capabilities,driveId)&orderBy=createdTime desc&includeItemsFromAllDrives=true&supportsAllDrives=true",
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
      setSharedWithMeFolders(data);
      setErrors(prev => prev.filter(err => !err.includes("Shared with me fetch")));
    } catch (error) {
      console.error('Error fetching shared with me folders:', error);
      setErrors(prev => [...prev.filter(err => !err.includes("Shared with me fetch")), `Shared with me fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setLoadingSharedWithMe(false);
    }
  };

  const setupAppDataFolder = async (accessToken: string) => {
    setCreatingAppFolder(true);
    try {
      // First, try to find if an app-specific folder already exists
      const searchResponse = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=name='MyApp Private Sharing Hub' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,mimeType,createdTime)&spaces=drive",
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
      
      let folderInfo;
      
      if (searchData.files && searchData.files.length > 0) {
        // Folder already exists
        folderInfo = searchData.files[0];
        console.log("Found existing app folder:", folderInfo);
      } else {
        // Create new app folder
        const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'MyApp Private Sharing Hub',
            mimeType: 'application/vnd.google-apps.folder',
            description: 'This folder is used by MyApp for private sharing between users. Only items placed here will be accessible to the app.'
          })
        });

        if (!createResponse.ok) {
          throw new Error(`HTTP error! status: ${createResponse.status}`);
        }

        folderInfo = await createResponse.json();
        console.log("Created new app folder:", folderInfo);
      }

      setAppFolderInfo(folderInfo);
      setErrors(prev => prev.filter(err => !err.includes("App folder")));
    } catch (error) {
      console.error('Error setting up app folder:', error);
      setErrors(prev => [...prev.filter(err => !err.includes("App folder")), `App folder setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setCreatingAppFolder(false);
    }
  };

  const fetchFileById = async () => {
    if (!token || !fileId.trim()) {
      setErrors(prev => [...prev, "Please provide a file ID"]);
      return;
    }

    setFetchingFileInfo(true);
    setFileInfo(null);
    setErrors(prev => prev.filter(err => !err.includes("File fetch")));

    try {
      console.log(`Attempting to fetch file info for ID: ${fileId}`);
      
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId.trim()}?fields=id,name,mimeType,createdTime,modifiedTime,parents,owners,ownedByMe,shared,sharingUser,capabilities,driveId,size,webViewLink,permissions&supportsAllDrives=true`,
        {
          headers: {
            'Authorization': `Bearer ${token.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`File fetch failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log("File info result:", data);
      setFileInfo(data);
      setErrors(prev => prev.filter(err => !err.includes("File fetch")));
    } catch (error) {
      console.error('Error fetching file by ID:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrors(prev => [...prev, `File fetch failed: ${errorMessage}`]);
      setFileInfo(null);
    } finally {
      setFetchingFileInfo(false);
    }
  };

  const createFolder = async () => {
    if (!token || !folderName.trim()) {
      setErrors(prev => [...prev, "Please provide a folder name"]);
      return;
    }

    setCreating(true);
    setResult(null);
    setErrors(prev => prev.filter(err => !err.includes("folder creation")));

    try {
      console.log(`Attempting to create folder "${folderName}"`);
      
      // Create folder in user's Drive root
      const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
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

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Folder creation failed: ${createResponse.status} ${createResponse.statusText} - ${errorText}`);
      }

      const createData = await createResponse.json();
      console.log("Folder creation result:", createData);
      
      setResult({
        success: true,
        message: `Successfully created folder "${folderName}"`,
        data: createData
      });

      // Refresh the folders list
      fetchAppFolders(token.access_token);
      fetchSharedWithMeFolders(token.access_token);

    } catch (error) {
      console.error('Error creating folder:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setErrors(prev => [...prev, `Folder creation failed: ${errorMessage}`]);
      setResult({
        success: false,
        message: errorMessage,
        data: null
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
          Google Drive Experiment - drive.file scope
        </h1>
        
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="text-lg font-semibold mb-2 text-blue-800">Experiment Goal</h2>
          <p className="text-blue-700 text-sm">
            Test creating folders with the `drive.file` scope and display accessible folders. 
            This will show what folders the app can see including both owned and shared folders.
            We're also testing a "Private Sharing Hub" approach for controlled sharing between users.
          </p>
        </div>

        {/* Login Controls */}
        <div className="flex flex-col items-center mb-6">
          {!token ? (
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg mb-4 transition-colors font-medium"
              onClick={() => connectWithDriveLogin()}
            >
              Connect with Google Drive (drive.file scope)
            </button>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 w-full">
              <div className="flex items-center justify-between">
                <span className="text-green-800 font-medium">✓ Connected to Google Drive</span>
                <button
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                  onClick={onLogoutClick}
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Experiment Form */}
        {token && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Create Folder</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="folderName" className="block text-sm font-medium text-gray-700 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  id="folderName"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="Enter the name for the new folder"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <button
                onClick={createFolder}
                disabled={creating || !folderName.trim()}
                className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Creating..." : "Create Folder"}
              </button>
            </div>
          </div>
        )}

        {/* Folders and Drives Display */}
        {token && (
          <div className="space-y-6 mb-6">
            {/* Accessible Folders */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3 text-gray-700">Accessible Folders</h2>
              {loadingFolders ? (
                <div className="flex items-center justify-center p-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : folders?.files && folders.files.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {folders.files.map((folder: any) => {
                    const isOwnedByMe = folder.ownedByMe !== false;
                    const driveType = folder.driveId ? 'Shared Drive' : 'Personal Drive';
                    
                    return (
                      <div key={folder.id} className="bg-white p-3 rounded border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-800">{folder.name}</div>
                          <div className="flex items-center space-x-2">
                            {isOwnedByMe ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Owned
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                                </svg>
                                Shared
                              </span>
                            )}
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              {driveType}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-1">
                          ID: {folder.id}
                        </div>
                        <div className="text-xs text-gray-500 mb-1">
                          Created: {new Date(folder.createdTime).toLocaleString()}
                        </div>
                        {folder.owners && folder.owners.length > 0 && (
                          <div className="text-xs text-gray-500 mb-1">
                            Owner: {folder.owners[0].displayName || folder.owners[0].emailAddress}
                          </div>
                        )}
                        {folder.sharingUser && (
                          <div className="text-xs text-gray-500 mb-1">
                            Shared by: {folder.sharingUser.displayName || folder.sharingUser.emailAddress}
                          </div>
                        )}
                        {folder.capabilities && (
                          <div className="text-xs text-gray-500">
                            Permissions: {Object.keys(folder.capabilities).filter(cap => folder.capabilities[cap]).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 italic">No folders accessible to this app</p>
              )}
            </div>

            {/* Shared With Me Folders */}
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <h2 className="text-lg font-semibold mb-3 text-yellow-800">Shared With Me Folders</h2>
              <p className="text-sm text-yellow-700 mb-3">
                These are folders explicitly shared with you that may not appear in the main accessible folders list due to drive.file scope limitations.
              </p>
              {loadingSharedWithMe ? (
                <div className="flex items-center justify-center p-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-600"></div>
                </div>
              ) : sharedWithMeFolders?.files && sharedWithMeFolders.files.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sharedWithMeFolders.files.map((folder: any) => {
                    const driveType = folder.driveId ? 'Shared Drive' : 'Personal Drive';
                    
                    return (
                      <div key={folder.id} className="bg-white p-3 rounded border border-yellow-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-gray-800">{folder.name}</div>
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                              </svg>
                              Shared With Me
                            </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              {driveType}
                            </span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-1">
                          ID: {folder.id}
                        </div>
                        <div className="text-xs text-gray-500 mb-1">
                          Created: {new Date(folder.createdTime).toLocaleString()}
                        </div>
                        {folder.owners && folder.owners.length > 0 && (
                          <div className="text-xs text-gray-500 mb-1">
                            Owner: {folder.owners[0].displayName || folder.owners[0].emailAddress}
                          </div>
                        )}
                        {folder.sharingUser && (
                          <div className="text-xs text-gray-500 mb-1">
                            Shared by: {folder.sharingUser.displayName || folder.sharingUser.emailAddress}
                          </div>
                        )}
                        {folder.capabilities && (
                          <div className="text-xs text-gray-500">
                            Permissions: {Object.keys(folder.capabilities).filter(cap => folder.capabilities[cap]).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 italic">No folders shared with you are visible to this app</p>
              )}
            </div>

            {/* App-Specific Sharing Hub */}
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h2 className="text-lg font-semibold mb-3 text-green-800">Private Sharing Hub</h2>
              <p className="text-sm text-green-700 mb-4">
                This is a potential solution for private user sharing. Each user gets a dedicated "MyApp Private Sharing Hub" folder. 
                Users can place shortcuts/copies of folders they want to share with other users in this hub.
              </p>
              
              {creatingAppFolder ? (
                <div className="flex items-center justify-center p-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                  <span className="ml-2 text-green-700">Setting up sharing hub...</span>
                </div>
              ) : appFolderInfo ? (
                <div className="bg-white p-3 rounded border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-2">Your Sharing Hub</h3>
                  <div className="space-y-2">
                    <div className="font-medium text-gray-800">{appFolderInfo.name}</div>
                    <div className="text-sm text-gray-600">
                      ID: {appFolderInfo.id}
                    </div>
                    <div className="text-xs text-gray-500">
                      Created: {new Date(appFolderInfo.createdTime).toLocaleString()}
                    </div>
                    <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                      <strong>How it works:</strong><br/>
                      1. Each user gets their own "MyApp Private Sharing Hub" folder<br/>
                      2. To share a folder, copy or move it into this hub<br/>
                      3. Share the hub folder with other users<br/>
                      4. Your app can only access items within these hub folders<br/>
                      5. Users maintain control over what gets shared
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 italic">Setting up your private sharing hub...</p>
              )}
            </div>

            {/* File ID Lookup */}
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <h2 className="text-lg font-semibold mb-3 text-purple-800">Test File Access by ID</h2>
              <p className="text-sm text-purple-700 mb-4">
                Test if you can access a file/folder by its ID even if it doesn't appear in the lists above. 
                This can help determine if shared items are accessible via direct ID lookup.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="fileId" className="block text-sm font-medium text-gray-700 mb-1">
                    File/Folder ID
                  </label>
                  <input
                    type="text"
                    id="fileId"
                    value={fileId}
                    onChange={(e) => setFileId(e.target.value)}
                    placeholder="Enter the Google Drive file or folder ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    You can find the ID in the URL when viewing a file/folder in Google Drive
                  </p>
                </div>
                
                <button
                  onClick={fetchFileById}
                  disabled={fetchingFileInfo || !fileId.trim()}
                  className="w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {fetchingFileInfo ? "Fetching..." : "Get File Info"}
                </button>
              </div>

              {/* File Info Results */}
              {fileInfo && (
                <div className="mt-4 bg-white p-3 rounded border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-2">File Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-800">{fileInfo.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {fileInfo.mimeType === 'application/vnd.google-apps.folder' ? 'Folder' : 'File'}
                        </span>
                        {fileInfo.ownedByMe !== false ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Owned
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Shared
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      ID: {fileInfo.id}
                    </div>
                    <div className="text-xs text-gray-500">
                      Created: {new Date(fileInfo.createdTime).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      Modified: {new Date(fileInfo.modifiedTime).toLocaleString()}
                    </div>
                    {fileInfo.owners && fileInfo.owners.length > 0 && (
                      <div className="text-xs text-gray-500">
                        Owner: {fileInfo.owners[0].displayName || fileInfo.owners[0].emailAddress}
                      </div>
                    )}
                    {fileInfo.sharingUser && (
                      <div className="text-xs text-gray-500">
                        Shared by: {fileInfo.sharingUser.displayName || fileInfo.sharingUser.emailAddress}
                      </div>
                    )}
                    {fileInfo.webViewLink && (
                      <div className="text-xs">
                        <a href={fileInfo.webViewLink} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:text-purple-800 underline">
                          View in Google Drive
                        </a>
                      </div>
                    )}
                    {fileInfo.capabilities && (
                      <div className="text-xs text-gray-500">
                        Permissions: {Object.keys(fileInfo.capabilities).filter(cap => fileInfo.capabilities[cap]).join(', ')}
                      </div>
                    )}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-800">View full response</summary>
                      <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-auto max-h-32">
                        {JSON.stringify(fileInfo, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className={`mb-6 p-4 border rounded-lg ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <h2 className={`text-lg font-semibold mb-2 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.success ? "Success!" : "Failed"}
            </h2>
            <p className={`text-sm mb-2 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {result.message}
            </p>
            {result.data && (
              <pre className="bg-white border rounded p-3 text-sm overflow-auto max-h-64 text-gray-800">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-2 text-red-700">Errors</h2>
            <ul className="space-y-1">
              {errors.map((error, index) => (
                <li key={index} className="text-sm text-red-600">
                  • {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Status */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-4">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${credential ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <div className={`w-2 h-2 rounded-full ${credential ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-sm font-medium">One Tap Login</span>
            </div>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${token ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <div className={`w-2 h-2 rounded-full ${token ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className="text-sm font-medium">Drive Access (file scope)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App2;