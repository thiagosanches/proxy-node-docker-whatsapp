const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const redis = require('./redis');
const { chromium } = require('playwright');
const { Configuration, OpenAIApi } = require("openai");

let config = {};
let blockedBySendingPicture = false;
let totalPhotosTakenByDay = 0;
let browser, page;

const userDataPath = process.env.USERDATA_PATH;
const app = express();
app.use(bodyParser.json());

cron.schedule('30 * * * * *', async () => {
    if (page && !blockedBySendingPicture) {
        console.log("[node-cron]", "It's time to check for unread messages!")
        await autoReplyUnreadMessages();
    }
});

cron.schedule('*/5 * * * *', async () => {
    console.log("[node-cron]", "It's time to refresh the redis config again!")
    config = await redis.load();
});

async function autoReplyUnreadMessages() {
    const data = [];

    try {
        await page.locator('[aria-label="Unread"]>>nth=0', { timeout: 250 }).click();
        await page.waitForTimeout(250);
        const mainDiv = await page.evaluate(async () => document.getElementById("main").innerText);

        // The first thing is the contact name, 
        // I know that's ugly, but it's a pain inspect everything.
        const contactName = mainDiv.split('\n')[0].trim();
        const elements = await page.evaluate(async () => {
            const nodeList = document.querySelectorAll('[aria-live="polite"]'); // that message that says 'X UNREAD MESSAGE'
            const elementArray = Array.from(nodeList);
            const messages = [];
            return elementArray.map(element => {
                let parentNodeUnreadMessage = element.parentNode;
                if (parentNodeUnreadMessage) {
                    while (parentNodeUnreadMessage &&
                        parentNodeUnreadMessage.nextElementSibling) {
                        messages.push(parentNodeUnreadMessage.nextElementSibling.innerText);
                        parentNodeUnreadMessage = parentNodeUnreadMessage.nextElementSibling;
                    }
                }
                return messages
            });
        });

        data.push({
            contactName: contactName,
            messages: elements.flat(Infinity)
        });

        console.log('[chat received]', data);

        // clear a little bit the content prior to forward to ChatGPT.
        const chatTextFlattened = elements.flat(Infinity).join(" ");

        console.log("[chatTextFlattened]", chatTextFlattened);
        console.log("[openaiBotName]", config.openaiBotName);
        console.log("[openaiBotTurnedOn]", config.openaiBotTurnedOn);

        // only answer if you have been mentioned and the bot is turned on.
        if (chatTextFlattened.indexOf('@' + config.openaiBotName) > 0 &&
            config.openaiBotTurnedOn) {

            console.log("🤖 Bot mentioned and turned on!");
            const configuration = new Configuration({ apiKey: config.openaiBotKey });
            const openai = new OpenAIApi(configuration);

            possibleAnswers = await openai.createCompletion({
                model: config.openaiBotModel,
                max_tokens: config.openaiBotMaxTokens,
                temperature: config.openaiBotTemperature,
                prompt: config.openaiBotChatPrompt.replaceAll("##TEXT##", chatTextFlattened)
            });

            const answer = possibleAnswers.data.choices[0].text.replaceAll('\\n', '').trim();
            console.log('[chatGPT response]', answer);

            // if for some reason the message contains that magic command 'photo:true' (openaiBotCommandPhoto),
            // it will try to generate an image with DALLE, in order to send it, but only if it's still on the limit.
            if (answer.trim().toLowerCase().includes(config.openaiBotCommandPhoto)) {
                if (totalPhotosTakenByDay <= config.openaiBotTotalPhotosLimit) {
                    blockedBySendingPicture = true;

                    const activities = config.openaiBotActivities;
                    const photoFinalPrompt = config.openaiBotDallePrompt.replaceAll("##TEXT##",
                        activities[Math.floor(Math.random() * activities.length)]);

                    const photoResponse = await openai.createImage({
                        prompt: photoFinalPrompt,
                        n: 1,
                        size: "256x256",
                    });

                    const photoUrl = photoResponse.data.data[0].url;
                    const context2 = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
                    const page2 = await context2.newPage();
                    await page2.goto(photoUrl);
                    await page2.keyboard.press("Control+C");
                    await page.bringToFront();
                    await page.keyboard.press("Control+V");

                    await page.waitForTimeout(1000);
                    await page.locator('[aria-label="Send"]>>nth=0').click();
                    await page.waitForTimeout(5000);
                    await page2.close();
                    totalPhotosTakenByDay++;
                }
                else {
                    answer = config.openaiBotCommandPhotoFailed;
                }
            }

            // Sometimes GPT respond back with only the command defined as a 'placeholder' for photos like: 'photo:true',
            // and I don't want it to answer with that value!
            if (answer.trim().toLowerCase() !== config.openaiBotCommandPhoto) {
                await page.type('div[title="Type a message"]', answer);
                await page.waitForTimeout(1000);
                await page.locator('[aria-label="Send"]>>nth=0').click();
                await page.waitForTimeout(1000);
            }
        }

        blockedBySendingPicture = false;
        await page.reload();
        await page.waitForTimeout(1000);

    } catch (e) {
        console.log(e)
    }

    return data;
};

app.get('/login', async function (req, res) {
    config = await redis.load();

    browser = await chromium.launchPersistentContext(userDataPath, { headless: false });
    page = await browser.newPage();
    await page.goto('https://web.whatsapp.com/');

    res.end('Browser started read the qr-code!');
});

app.listen(3000);
