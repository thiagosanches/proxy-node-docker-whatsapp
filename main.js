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
let blocked = false;
let totalPhotosTakenByDay = 0;
let browser, page;
let chatMessagesHistory = {};

const userDataPathToStoreWhatsappSession = "/tmp/whatsapp_userdata";
const app = express();
app.use(bodyParser.json());

/* MY MINI-APPS */
const scrape = require('./mini-apps/scrape');

cron.schedule('30 * * * * *', async () => {
    if (page && !blocked) {
        logger.info("It's time to check for unread messages!");
        await autoReplyUnreadMessages();
    }
});

cron.schedule('*/5 * * * *', async () => {
    logger.info("It's time to refresh the redis config again!");
    config = await redis.load(logger);
});

cron.schedule('0 0 0 * * *', async () => {
    logger.info("It's time to set to 0 the photos taken by day!");
    totalPhotosTakenByDay = 0;
});

cron.schedule('55 59 * * * *', async () => {
    if (!blocked) {
        logger.info("It's time to refresh the chat history!");
        chatMessagesHistory = {}
    }
});

async function autoReplyUnreadMessages() {
    const data = [];

    try {
        blocked = true;
        await page.locator('[aria-label="Unread"]>>nth=0', { timeout: 250 }).click();
        await page.waitForTimeout(250);
        const mainDiv = await page.evaluate(async () => document.getElementById("main").innerText);

        // The first thing is the contact name,
        // I know that's ugly, but it's a pain inspect everything.
        const groupName = mainDiv.split('\n')[0].trim();
        const elements = await page.evaluate(async () => {
            // Eliminate any div that displays the small URL preview,
            // as it can sometimes lead to comprehension issues for GPT.
            const linksPreview = document.querySelectorAll(".M6sU5");
            if (linksPreview) {
                linksPreview.forEach(element => {
                    element.parentNode.removeChild(element);
                })
            }

            // And let's eliminate any span that displays the time,
            // as it can sometimes lead to comprehension issues for GPT.
            const spanTime = document.querySelectorAll(".l7jjieqr.fewfhwl7");
            if (spanTime) {
                spanTime.forEach(element => {
                    element.parentNode.removeChild(element);
                })
            }

            // that message that says 'X UNREAD MESSAGE'
            const nodeListUnreadMessages = document.querySelectorAll('[aria-live="polite"]');
            let nodeListUnreadMessagesArray = Array.from(nodeListUnreadMessages);
            let peopleAndMessages = [];

            // This code iterates through sibling nodes of the div element with the [aria-live="polite"] attribute.
            // It aims to identify the sender of each message and extract the content of the message.
            // While this method employs a brute-force approach, it is necessary due to the lack of a public API for this purpose.
            nodeListUnreadMessagesArray.forEach(element => {
                let parentNodeUnreadMessage = element.parentNode;
                if (parentNodeUnreadMessage) {
                    while (parentNodeUnreadMessage &&
                        parentNodeUnreadMessage.nextElementSibling) {
                        parentNodeUnreadMessage = parentNodeUnreadMessage.nextElementSibling;
                        const personNode = parentNodeUnreadMessage.children[0].children[0].children[1].querySelectorAll('[data-pre-plain-text]');
                        if (personNode.length == 0) continue;
                        const personName = personNode[0].attributes['data-pre-plain-text'].nodeValue.split("]")[1].trim().replaceAll(":", "");
                        const messageFromPerson = parentNodeUnreadMessage.innerText.split('\n')
                        const existingPerson = peopleAndMessages.find(a => a.name === personName);
                        if (!existingPerson) {
                            peopleAndMessages.push({
                                name: personName,
                                message: [messageFromPerson]
                            })
                        }
                        else {
                            existingPerson.message.push(messageFromPerson)
                        }
                    }
                }
            });

            return peopleAndMessages;
        });

        data.push({
            groupName: groupName,
            messages: elements
        });

        logger.info('[chat received] %o', data);
        if (!chatMessagesHistory[groupName]) { chatMessagesHistory[groupName] = []; }

        // Prepare just the messages that have mention to the bot user.
        // TODO: make it better the properties names below, it's confusing.
        for (const message of data[0].messages) {
            for (const bla of message.message) {
                const person = message.name
                const chat = bla[bla.length - 1];
                if (chat.indexOf('@' + config.openaiBotName) >= 0) {
                    let filteredPerson = chatMessagesHistory[groupName].find(a => a.name === person);
                    if (!filteredPerson) {
                        logger.info("first message from person: %o", person);
                        filteredPerson = {
                            name: person,
                            messages: [
                                { role: "system", content: config.openaiBotChatPrompt }
                            ]
                        }
                        chatMessagesHistory[groupName].push(filteredPerson);
                    }
                    filteredPerson.name = person;
                    filteredPerson.messages.push({
                        role: "user", content: `${person} ${config.openaiBotSaidKeyword}: "${chat}"`
                    })
                }
            }
        }

        for (const personMessages of chatMessagesHistory[groupName]) {
            const currentPersonMessages = personMessages.messages;
            // clear a little bit the content prior to forward to ChatGPT.
            logger.info("[chatMessagesHistory] %o", currentPersonMessages);
            logger.info("[openaiBotName] %o", config.openaiBotName);
            logger.info("[openaiBotTurnedOn] %o", config.openaiBotTurnedOn);

            // only answer if you have been mentioned and the bot is turned on.
            if (currentPersonMessages.length > 1 &&
                config.openaiBotTurnedOn) {

                logger.info("🤖 Bot mentioned and turned on!");
                const configuration = new Configuration({ apiKey: config.openaiBotKey });
                const openai = new OpenAIApi(configuration);

                const possibleAnswers = await openai.createChatCompletion({
                    model: config.openaiBotModel,
                    max_tokens: config.openaiBotMaxTokens,
                    temperature: config.openaiBotTemperature,
                    messages: currentPersonMessages
                });

                let answer = possibleAnswers.data.choices[0].message.content.replaceAll('\\n', '').trim();
                currentPersonMessages.push({ role: "assistant", content: answer });
                logger.info('[chatGPT response] %o', answer);

                // if for some reason the message contains that magic command 'photo:true' (openaiBotCommandPhoto),
                // it will try to generate an image with DALLE, in order to send it, but only if it's still on the limit.
                if (answer.trim().toLowerCase().includes(config.openaiBotCommandPhoto)) {
                    if (totalPhotosTakenByDay <= config.openaiBotTotalPhotosLimit) {
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
        }
    } catch (e) {
        logger.error(e);
    }
    finally {
        blocked = false;
        await page.reload();
        await page.waitForTimeout(1000);
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
