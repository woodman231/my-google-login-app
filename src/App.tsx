import { useState } from "react";
import { useGoogleOneTapLogin, useGoogleLogin, googleLogout } from "@react-oauth/google";
import type { TokenResponse, CredentialResponse } from "@react-oauth/google";

function App() {
  /**
   * In this app we will use the one tap login for initial login, then have a connect to g drive button
   * that will use the google login to get the token and then use that token to connect
   * to the google drive api.
   */

  const [token, setToken] = useState<TokenResponse | null>(null);
  const [credential, setCredential] = useState<CredentialResponse | null>(null);
  
  useGoogleOneTapLogin({
    onSuccess: (response) => {
      console.log("One Tap Login Success:", response);
      setCredential(response);
    },
    onError: () => {
      console.error("One Tap Login Failed");
    },
  });

  const connectWithDriveLogin = useGoogleLogin({
    onSuccess: (response) => {
      console.log("Google Login Success:", response);
      setToken(response);
    },
    onError: () => {
      console.error("Google Login Failed");
    },
    scope: "openid profile email https://www.googleapis.com/auth/drive.file",
    flow: "implicit",
  });

  const onLogoutClick = () => {
    googleLogout();
    setToken(null);
    setCredential(null);
    console.log("Logged out successfully");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Google Login App</h1>
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
        onClick={() => connectWithDriveLogin()}
      >
        Connect with Google Drive
      </button>
      {token && (
        <div className="mb-4">
          <p>Token: {token.access_token}</p>
          <button
            className="bg-red-500 text-white px-4 py-2 rounded mt-2"
            onClick={onLogoutClick}
          >
            Logout
          </button>
        </div>
      )}
      {credential && (
        <div className="mb-4">
          <p>Credential: {credential.credential}</p>
        </div>
      )}
    </div>
  )

}

export default App;