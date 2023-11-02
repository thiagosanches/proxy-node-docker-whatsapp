const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const redis = require('./redis');
const { chromium } = require('playwright');
const { Configuration, OpenAIApi } = require("openai");
const { createLogger, format, transports } = require('winston');

const timezoned = () => { return new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }); };
const consoleFormat = format.combine(
    format.label({ label: "proxy-node-docker-whatsapp" }),
    format.colorize(),
    format.timestamp({ format: timezoned }),
    format.align(),
    format.splat(),
    format.printf((info) => {
        if (typeof info.message === 'object') {
            info.message = JSON.stringify(info.message, null, 3)
        }
        return `${info.timestamp} - ${info.level} [${info.label}]: ${info.message}`
    })
)

const logger = createLogger({ format: consoleFormat, transports: [new transports.Console()] });

let config = {};
let blockedByCommand = false;
let totalPhotosTakenByDay = 0;
let browser, page;

const userDataPathToStoreWhatsappSession = "/tmp/whatsapp_userdata";
const app = express();
app.use(bodyParser.json());

/* MY MINI-APPS */
const scrape = require('./mini-apps/scrape');

cron.schedule('30 * * * * *', async () => {
    if (page && !blockedByCommand) {
        logger.info("It's time to check for unread messages!");
        await autoReplyUnreadMessages();
    }
});

cron.schedule('*/5 * * * *', async () => {
    logger.info("It's time to refresh the redis config again!");
    config = await redis.load();
});

cron.schedule('0 0 0 * * *', async () => {
    logger.info("It's time to set to 0 the photos taken by day!");
    totalPhotosTakenByDay = 0;
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

            // Let's eliminate any div that displays the small URL preview,
            // as it can sometimes lead to comprehension issues for GPT.
            const linksPreview = document.querySelectorAll(".M6sU5");
            if (linksPreview) {
                linksPreview.forEach(element => {
                    element.parentNode.removeChild(element);
                })
            }

            // Let's eliminate any span that displays the time,
            // as it can sometimes lead to comprehension issues for GPT.
            const spanTime = document.querySelectorAll(".l7jjieqr.fewfhwl7");
            if (spanTime) {
                spanTime.forEach(element => {
                    element.parentNode.removeChild(element);
                })
            }

            const elementArray = Array.from(nodeList);
            const messages = [];
            return elementArray.map(element => {
                let parentNodeUnreadMessage = element.parentNode;
                if (parentNodeUnreadMessage) {
                    while (parentNodeUnreadMessage &&
                        parentNodeUnreadMessage.nextElementSibling) {
                        messages.push(parentNodeUnreadMessage.nextElementSibling.innerText.split('\n'));
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

        logger.info('[chat received] %o', data);

        // clear a little bit the content prior to forward to ChatGPT.
        const chatTextFlattened = elements.flat(Infinity).join(": ");
        logger.info("[chatTextFlattened] %o", chatTextFlattened);
        logger.info("[openaiBotName] %o", config.openaiBotName);
        logger.info("[openaiBotTurnedOn] %o", config.openaiBotTurnedOn);

        // only answer if you have been mentioned and the bot is turned on.
        if (chatTextFlattened.indexOf('@' + config.openaiBotName) > 0 &&
            config.openaiBotTurnedOn) {

            logger.info("🤖 Bot mentioned and turned on!");
            const configuration = new Configuration({ apiKey: config.openaiBotKey });
            const openai = new OpenAIApi(configuration);

            const possibleAnswers = await openai.createChatCompletion({
                model: config.openaiBotModel,
                max_tokens: config.openaiBotMaxTokens,
                temperature: config.openaiBotTemperature,
                messages: [
                    { role: "system", content: config.openaiBotChatPrompt },
                    { role: "user", content: chatTextFlattened }
                ]
            });

            let answer = possibleAnswers.data.choices[0].message.content.replaceAll('\\n', '').trim();
            logger.info('[chatGPT response] %o', answer);

            // if for some reason the message contains that magic command 'photo:true' (openaiBotCommandPhoto),
            // it will try to generate an image with DALLE, in order to send it, but only if it's still on the limit.
            if (answer.trim().toLowerCase().includes(config.openaiBotCommandPhoto)) {
                if (totalPhotosTakenByDay <= config.openaiBotTotalPhotosLimit) {
                    blockedByCommand = true;

                    const activities = config.openaiBotActivities;
                    const photoFinalPrompt = config.openaiBotDallePrompt.replaceAll("##TEXT##",
                        activities[Math.floor(Math.random() * activities.length)]);

                    const photoResponse = await openai.createImage({
                        prompt: photoFinalPrompt,
                        n: 1,
                        size: "256x256",
                    });

                    const photoUrl = photoResponse.data.data[0].url;
                    const page2 = await browser.newPage();
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

            // TODO: make it better to organize it.
            if (answer.trim().toLowerCase().includes(config.openaiBotCommandScrape)) {
                blockedByCommand = true;
                answer = await scrape.run(logger, answer);
            }

            // Sometimes GPT respond back with only the command defined as a 'placeholder' for photos like: 'photo:true',
            // and I don't want it to answer with that value! 
            // I noticed that even with a normal phrase, it puts back the 'photo:true', so we need to sanitize it.            
            if (answer.trim().toLowerCase() !== config.openaiBotCommandPhoto) {
                const pattern = new RegExp(config.openaiBotCommandPhotoRegex, "gmi"); // The "i" flag makes it case-insensitive
                const filteredAnswer = answer.replace(pattern, '');

                await page.type('div[title="Type a message"]', filteredAnswer);
                await page.waitForTimeout(1000);
                await page.locator('[aria-label="Send"]>>nth=0').click();
                await page.waitForTimeout(1000);
            }
        }
        await page.reload();
        await page.waitForTimeout(1000);
    } catch (e) {
        logger.error(e);
    }
    finally {
        blockedByCommand = false;
    }

    return data;
};

app.get('/login', async function (req, res) {
    config = await redis.load(logger);

    browser = await chromium.launchPersistentContext(userDataPathToStoreWhatsappSession,
        { headless: false, permissions: ["clipboard-read", "clipboard-write"] });

    page = await browser.newPage();
    await page.goto('https://web.whatsapp.com/');
    res.end('Browser started read the qr-code, if necessary!');
});

app.listen(3000);
