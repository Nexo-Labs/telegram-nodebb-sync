# Telegram to NodeBB Sync Bot

Firebase Cloud Function to automatically post tagged messages from a Telegram group to a NodeBB forum.

## Setup

1.  **Prerequisites:**
    *   Node.js (v18 recommended)
    *   Firebase CLI (`npm install -g firebase-tools`)
    *   Google Cloud SDK (`gcloud`)
    *   A Firebase Project
    *   A Telegram Bot Token
    *   A NodeBB instance with API access configured (User Token recommended)

2.  **Configuration (`functions/index.js`):**
    *   Update `GCP_PROJECT_ID` (or ensure it's set in the environment).
    *   Update `TELEGRAM_BOT_TOKEN_SECRET_NAME`, `NODEBB_API_USER_TOKEN_SECRET_NAME` (or `NODEBB_API_TOKEN_SECRET_NAME`) to match the names you'll use in Google Secret Manager.
    *   Update `NODEBB_URL` with your forum's base URL.
    *   Update `NODEBB_CATEGORY_ID` with the target category ID.
    *   Update `TARGET_HASHTAGS` with the hashtags you want to track.
    *   (Optional) Update `NODEBB_BOT_UID` if using a Master Token.
    *   (Optional) Set `TELEGRAM_SECRET_TOKEN` environment variable or store it in Secret Manager if using webhook verification.

3.  **Store Secrets:**
    *   Enable the Secret Manager API in your Google Cloud project.
    *   Store your Telegram Bot Token and NodeBB API Token in Secret Manager using the names defined above (e.g., `TELEGRAM_BOT_TOKEN`, `NODEBB_API_USER_TOKEN`).
    *   Ensure the Cloud Functions service account has the 'Secret Manager Secret Accessor' IAM role.

4.  **Install Dependencies:**
    ```bash
    cd functions
    npm install
    cd ..
    ```

5.  **Deploy Function:**
    *   Log in to Firebase: `firebase login`
    *   Set your Firebase project: `firebase use YOUR_PROJECT_ID`
    *   Deploy: `firebase deploy --only functions`
    *   After deployment, Firebase CLI will output the **Function URL**. This is your webhook URL.

6.  **Set Telegram Webhook:**
    *   Use a tool like `curl` or Postman, or a simple script, to call the Telegram API's `setWebhook` method:
      ```
      https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=<YOUR_FUNCTION_URL>&secret_token=<YOUR_SECRET_TOKEN_IF_USED>
      ```
      Replace `<YOUR_TELEGRAM_BOT_TOKEN>`, `<YOUR_FUNCTION_URL>`, and optionally `<YOUR_SECRET_TOKEN_IF_USED>`.

7.  **Test:**
    *   Send a message with one of the `TARGET_HASHTAGS` to the Telegram group where your bot is a member (with appropriate permissions).
    *   Check your NodeBB forum and the Cloud Function logs in the Google Cloud Console.
