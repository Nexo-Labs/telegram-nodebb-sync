const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");

// --- Configuration --- 
// TODO: Replace with your Google Cloud Project ID
const GCP_PROJECT_ID = process.env.GCLOUD_PROJECT;
// TODO: Replace with the names of your secrets in Google Secret Manager
const TELEGRAM_BOT_TOKEN_SECRET_NAME = "projects/" + GCP_PROJECT_ID + "/secrets/TELEGRAM_BOT_TOKEN/versions/latest";
const NODEBB_API_TOKEN_SECRET_NAME = "projects/" + GCP_PROJECT_ID + "/secrets/NODEBB_API_TOKEN/versions/latest";
const NODEBB_API_USER_TOKEN_SECRET_NAME = "projects/" + GCP_PROJECT_ID + "/secrets/NODEBB_API_USER_TOKEN/versions/latest"; // Use this if using User Token
// TODO: Replace with your NodeBB Forum URL (e.g., https://yourforum.com)
const NODEBB_URL = ""; 
// TODO: Replace with the Category ID (cid) in NodeBB where posts should be created
const NODEBB_CATEGORY_ID = ""; 
// TODO: Replace with the User ID (uid) of the bot user in NodeBB if using a Master Token
const NODEBB_BOT_UID = ""; // Only needed if using Master Token
// TODO: Define the hashtags to trigger the sync (e.g., ["#nodebb", "#foro"])
const TARGET_HASHTAGS = [];
// TODO: (Optional) Set a secret token for webhook verification (must match the one set via setWebhook)
const TELEGRAM_SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN || null; // Or load from Secret Manager

// Initialize Firebase Admin SDK (if needed for Firestore, etc.)
// admin.initializeApp();

// Initialize Secret Manager Client
const secretManagerClient = new SecretManagerServiceClient();

// Function to get secrets from Secret Manager
async function getSecret(secretName) {
    try {
        const [version] = await secretManagerClient.accessSecretVersion({
            name: secretName,
        });
        const payload = version.payload.data.toString("utf8");
        functions.logger.log(`Successfully accessed secret: ${secretName}`);
        return payload;
    } catch (error) {
        functions.logger.error(`Error accessing secret ${secretName}:`, error);
        throw new Error(`Failed to access secret: ${secretName}`);
    }
}

// Main Firebase Function triggered by HTTP POST request (Telegram Webhook)
exports.telegramWebhookHandler = functions.https.onRequest(async (req, res) => {
    // --- 1. Request Verification --- 
    // Check if it's a POST request
    if (req.method !== "POST") {
        functions.logger.warn("Received non-POST request");
        res.status(405).send("Method Not Allowed");
        return;
    }

    // (Optional) Verify Telegram Secret Token
    if (TELEGRAM_SECRET_TOKEN) {
        const telegramTokenHeader = req.headers["x-telegram-bot-api-secret-token"];
        if (telegramTokenHeader !== TELEGRAM_SECRET_TOKEN) {
            functions.logger.error("Invalid Secret Token received");
            res.status(401).send("Unauthorized");
            return;
        }
        functions.logger.log("Secret Token verified.");
    }

    // --- 2. Process Telegram Update --- 
    const update = req.body;
    if (!update || !update.message) {
        functions.logger.log("Received update without a message field. Ignoring.", update);
        res.status(200).send("OK (No message)"); // Acknowledge receipt
        return;
    }

    const message = update.message;
    const messageText = message.text || "";
    const messageId = message.message_id;
    const chatId = message.chat.id;
    const messageEntities = message.entities || [];

    functions.logger.log(`Received message ${messageId} from chat ${chatId}: "${messageText.substring(0, 50)}..."`);

    // --- 3. Check for Target Hashtags --- 
    let containsTargetHashtag = false;
    for (const entity of messageEntities) {
        if (entity.type === "hashtag") {
            const hashtag = messageText.substring(entity.offset, entity.offset + entity.length).toLowerCase();
            if (TARGET_HASHTAGS.map(tag => tag.toLowerCase()).includes(hashtag)) {
                containsTargetHashtag = true;
                functions.logger.log(`Found target hashtag: ${hashtag}`);
                break;
            }
        }
    }

    if (!containsTargetHashtag) {
        functions.logger.log(`Message ${messageId} does not contain a target hashtag. Ignoring.`);
        res.status(200).send("OK (No target hashtag)");
        return;
    }

    // --- 4. TODO: Deduplication (Optional - using Firestore) --- 
    // Check if messageId has already been processed
    functions.logger.log(`Proceeding to process message ${messageId} for NodeBB.`);

    // --- 5. Fetch Secrets --- 
    let nodebbApiToken;
    try {
        // Choose one: User Token or Master Token
        nodebbApiToken = await getSecret(NODEBB_API_USER_TOKEN_SECRET_NAME); // Preferred
        // nodebbApiToken = await getSecret(NODEBB_API_TOKEN_SECRET_NAME); // If using Master Token
        // Optional: Fetch Telegram token if needed for replies/status updates
        // const telegramBotToken = await getSecret(TELEGRAM_BOT_TOKEN_SECRET_NAME); 
    } catch (error) {
        res.status(500).send("Error fetching secrets");
        return;
    }

    // --- 6. Prepare NodeBB Payload --- 
    // Basic title generation (can be improved)
    const title = `Telegram message from ${message.from.first_name || 'user'} (${messageId})`;
    const content = messageText; // TODO: Implement proper Markdown conversion

    const nodebbApiUrl = `${NODEBB_URL}/api/v3/topics`;
    const payload = {
        cid: NODEBB_CATEGORY_ID,
        title: title,
        content: content,
        // _uid: NODEBB_BOT_UID // Only include if using Master Token
    };

    const headers = {
        'Authorization': `Bearer ${nodebbApiToken}`,
        'Content-Type': 'application/json'
    };

    // --- 7. Call NodeBB API --- 
    try {
        functions.logger.log(`Posting to NodeBB API: ${nodebbApiUrl}`);
        const response = await axios.post(nodebbApiUrl, payload, { headers });
        functions.logger.info(`Successfully posted to NodeBB. Status: ${response.status}, Data:`, response.data);

        // --- 8. TODO: Store State (Optional - using Firestore) --- 
        // Mark messageId as processed, store NodeBB post ID (response.data?.payload?.postData?.pid)

        res.status(200).send("OK (Posted to NodeBB)");

    } catch (error) {
        functions.logger.error("Error calling NodeBB API:", error.response ? error.response.data : error.message);
        // Consider more specific error handling (e.g., rate limits 429)
        res.status(500).send("Error posting to NodeBB");
    }
});
