# Google Drive Picker Setup Instructions

To use the Google Drive Picker functionality, you need to set up a Google API Key:

## Steps:

1. **Go to Google Cloud Console**: https://console.cloud.google.com/

2. **Select the correct project** (the same one where your OAuth client was created)

3. **Enable Required APIs**:
   - Go to "APIs & Services" > "Library"
   - Search for and enable:
     - **Google Drive API**
     - **Google Picker API**
   - Make sure both show as "ENABLED"

4. **Create an API Key**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key

5. **Configure API Key Restrictions** (Important!):
   - Click on your newly created API key to edit it
   - **Application restrictions**:
     - Select "HTTP referrers (web sites)"
     - Add these referrers:
       - `http://localhost:5173/*` (for development)
       - `https://localhost:5173/*` (for development)
       - Your production domain if applicable
   - **API restrictions**:
     - Select "Restrict key"
     - Choose only:
       - Google Drive API
       - Google Picker API

6. **Update Environment Variables**:
   - Open the `.env` file in your project root
   - Replace the API key (NO quotes needed):
     ```
     VITE_GOOGLE_API_KEY=YOUR_ACTUAL_API_KEY_HERE
     ```

7. **Restart your development server** after updating the `.env` file

## Troubleshooting:

### "API developer key is invalid" Error:

1. **Check API Key Format**: Remove any quotes from the .env file
2. **Wait for propagation**: API key changes can take up to 5 minutes to propagate
3. **Verify APIs are enabled**: Both Google Drive API and Google Picker API must be enabled
4. **Check referrer restrictions**: Make sure `http://localhost:5173/*` is in your allowed referrers
5. **Try a fresh API key**: Delete the old one and create a new one
6. **Check browser console**: Look for more detailed error messages

### "Access blocked" Error:
- Make sure your OAuth consent screen is configured
- Add your Google account as a test user if the app is in testing mode

### Still not working?
Try these steps:
1. Create a completely unrestricted API key (temporarily)
2. Test if the picker works
3. If it works, gradually add restrictions back

## Current Configuration:
- ✅ Google OAuth Client ID is already configured  
- ⚠️ Google API Key needs to be properly configured with correct restrictions

Once configured, users will be able to:
- Click "Select Project Folder" 
- Browse their Google Drive using the native Google picker
- Select any existing folder to use as a project workspace
- See the selected folder appear in their project list with a link icon (🔗)
