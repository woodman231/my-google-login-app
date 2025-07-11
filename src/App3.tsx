import { useState } from "react";
import { useGoogleOneTapLogin, useGoogleLogin, googleLogout } from "@react-oauth/google";
import type { TokenResponse, CredentialResponse } from "@react-oauth/google";

function App() {

    const [token, setToken] = useState<TokenResponse | null>(null);
    const [credential, setCredential] = useState<CredentialResponse | null>(null);
    const [errors, setErrors] = useState<string[]>([]);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
    const [newFileName, setNewFileName] = useState<string>("");
    const [creatingNewFile, setCreatingNewFile] = useState<boolean>(false);
    const [createNewFileResult, setCreateNewFileResult] = useState<any>(null);
    const [files, setFiles] = useState<any>(null);
    const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
    const [fileId, setFileId] = useState<string>("");
    const [fetchingFileInfo, setFetchingFileInfo] = useState<boolean>(false);
    const [fileInfo, setFileInfo] = useState<any>(null);
    const [shareWithEmail, setShareWithEmail] = useState<string>("");

    const connectWithDriveLogin = useGoogleLogin({
        onSuccess: (response) => {
            console.log("Google Login Success:", response);
            setToken(response);
            setErrors(prev => prev.filter(err => !err.includes("Google Drive")));
            // Fetch files after login
            fetchUserProfile(response.access_token);
            fetchAppFiles(response.access_token);
        },
        onError: () => {
            console.error("Google Login Failed");
            setErrors(prev => [...prev.filter(err => !err.includes("Google Drive")), "Google Drive Login Failed"]);
        },
        scope: "openid profile email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.install",
        // scope: "openid profile email https://www.googleapis.com/auth/drive",
        flow: "implicit",
    });

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

    const fetchAppFiles = async (accessToken: string) => {
        setLoadingFiles(true);
        try {
            const response = await fetch(
                "https://www.googleapis.com/drive/v3/files?q=mimeType='application/swtestapp1' and trashed=false&fields=files(id,name,mimeType,createdTime,parents,owners,ownedByMe,shared,sharingUser,capabilities,driveId)&orderBy=createdTime desc&includeItemsFromAllDrives=true&supportsAllDrives=true&sharedWithMe=true",
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
            console.error('Error fetching files:', error);
            setErrors(prev => [...prev.filter(err => !err.includes("Files fetch")), `Files fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
        } finally {
            setLoadingFiles(false);
        }
    };

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

    const createFile = async () => {
        if (!token || !newFileName.trim()) {
            setErrors(prev => [...prev, "Please provide a file name"]);
            return;
        }

        setCreatingNewFile(true);
        setCreateNewFileResult(null);
        setErrors(prev => prev.filter(err => !err.includes("file creation")));

        try {
            console.log(`Attempting to create file "${newFileName}"`);

            // Create file in user's Drive root with custom mime type
            const fileName = newFileName.trim().endsWith('.swtestapp1') 
                ? newFileName.trim() 
                : `${newFileName.trim()}.swtestapp1`;

            const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: fileName,
                    mimeType: 'application/swtestapp1'
                })
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                throw new Error(`File creation failed: ${createResponse.status} ${createResponse.statusText} - ${errorText}`);
            }

            const createData = await createResponse.json();
            console.log("File creation result:", createData);

            setCreateNewFileResult({
                success: true,
                message: `Successfully created file "${fileName}"`,
                data: createData
            });

            // Refresh the files list
            fetchAppFiles(token.access_token);

        } catch (error) {
            console.error('Error creating file:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setErrors(prev => [...prev, `File creation failed: ${errorMessage}`]);
            setCreateNewFileResult({
                success: false,
                message: errorMessage,
                data: null
            });
        } finally {
            setCreatingNewFile(false);
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
                `https://www.googleapis.com/drive/v3/files/${fileId.trim()}?fields=id,name,mimeType,createdTime,modifiedTime,parents,owners,ownedByMe,shared,sharingUser,capabilities,driveId,size,webViewLink,permissions&includeItemsFromAllDrives=true&supportsAllDrives=true&sharedWithMe=true`,
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

    const shareFile = async () => {
        // We will use the fileId state to determine which file to share
        // We will also use the shareWithEmail state to determine who to share it with
        if (!token || !fileId.trim() || !shareWithEmail.trim()) {
            setErrors(prev => [...prev, "Please provide a file ID and an email to share with"]);
            return;
        }

        try {
            console.log(`Attempting to share file with ID: ${fileId} with email: ${shareWithEmail}`);

            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files/${fileId.trim()}/permissions`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token.access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: 'user',
                        role: 'writer',
                        emailAddress: shareWithEmail.trim(),
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Sharing failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            console.log("Share result:", data);
            setErrors(prev => prev.filter(err => !err.includes("Share")));
        } catch (error) {
            console.error('Error sharing file:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setErrors(prev => [...prev, `Share failed: ${errorMessage}`]);
        }
    }

    const onLogoutClick = () => {
        googleLogout();
        setToken(null);
        setCredential(null);
        setFiles(null);
        setErrors([]);
        setLoadingFiles(false);
        setUserProfile(null);
        setLoadingProfile(false);
        setNewFileName("");
        setCreatingNewFile(false);
        setCreateNewFileResult(null);
        setFileId("");
        setFetchingFileInfo(false);
        setFileInfo(null);
        setShareWithEmail("");
    };

    return (
        <div>
            <h1 className="text-2xl font-bold">Google OAuth App</h1>
            <p>Connect with Google Drive to manage your folders.</p>
            <div className="flex flex-col gap-2">
                <button className="bg-blue-500 text-white p-2 rounded" onClick={() => connectWithDriveLogin()}>Connect with Google Drive</button>
                <button className="bg-red-500 text-white p-2 rounded" onClick={() => onLogoutClick()}>Logout</button>
            </div>
            <h2 className="text-xl font-bold">Profile</h2>
            {loadingProfile ? (
                <p>Loading profile...</p>
            ) : userProfile ? (
                <div className="p-2 border rounded">
                    <p><strong>Name:</strong> {userProfile.name}</p>
                    <p><strong>Email:</strong> {userProfile.email}</p>
                    <img src={userProfile.picture} alt="Profile" className="w-24 h-24 rounded-full" />
                </div>
            ) : (
                <p>No profile data available.</p>
            )}
            <h2 className="text-xl font-bold">Create a new file</h2>
            <div className="flex flex-col gap-2">
                <input
                    type="text"
                    placeholder="File Name (without extension)"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="border p-2 rounded"
                />
                <button
                    className="bg-green-500 text-white p-2 rounded"
                    onClick={createFile}
                    disabled={creatingNewFile || !token}
                >
                    {creatingNewFile ? "Creating..." : "Create File"}
                </button>
                {createNewFileResult && (
                    <div className={`p-2 rounded ${createNewFileResult.success ? 'bg-green-100' : 'bg-red-100'}`}>
                        <p>{createNewFileResult.message}</p>
                        {createNewFileResult.data && (
                            <pre>{JSON.stringify(createNewFileResult.data, null, 2)}</pre>
                        )}
                    </div>
                )}
            </div>
            <h2 className="text-xl font-bold">Files (.swtestapp1)</h2>
            {loadingFiles ? (
                <p>Loading files...</p>
            ) : (
                <ul className="list-disc pl-5">
                    {files && files.files && files.files.length > 0 ? (
                        files.files.map((file: any) => (
                            <li key={file.id}>
                                <strong>{file.name}</strong> (ID: {file.id}) - Created: {new Date(file.createdTime).toLocaleString()}
                            </li>
                        ))
                    ) : (
                        <li>No .swtestapp1 files found.</li>
                    )}
                </ul>
            )}
            <h2 className="text-xl font-bold">Fetch Folder Info By File Id</h2>
            <div className="flex flex-col gap-2">
                <input
                    type="text"
                    placeholder="File ID"
                    value={fileId}
                    onChange={(e) => setFileId(e.target.value)}
                    className="border p-2 rounded"
                />
                <button
                    className="bg-blue-500 text-white p-2 rounded"
                    onClick={fetchFileById}
                    disabled={fetchingFileInfo || !token}
                >
                    {fetchingFileInfo ? "Fetching..." : "Fetch File Info"}
                </button>
                {fileInfo && (
                    <div className="p-2 border rounded">
                        <h3 className="font-bold">File Info:</h3>
                        <pre>{JSON.stringify(fileInfo, null, 2)}</pre>
                        <h2 className="text-xl font-bold">Share File</h2>
                        <input
                            type="text"
                            placeholder="Email to share with"
                            value={shareWithEmail}
                            onChange={(e) => setShareWithEmail(e.target.value)}
                            className="border p-2 rounded"
                        />
                        <button
                            className="bg-yellow-500 text-white p-2 rounded"
                            onClick={shareFile}
                            disabled={!token || !fileId.trim() || !shareWithEmail.trim()}
                        >
                            Share File
                        </button>
                    </div>
                )}
            </div>
            <h2 className="text-xl font-bold">App State</h2>
            <pre>
                {JSON.stringify({
                    errors,
                    token,
                    credential,
                    userProfile,
                    loadingProfile,
                    files,
                    loadingFiles,
                }, null, 2)}
            </pre>
        </div>
    )
}

export default App;