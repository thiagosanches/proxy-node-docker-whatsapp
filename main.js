const config = require('./config.json');
const express = require('express');
const { chromium } = require('playwright');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({ apiKey: config.openaiKey });
const openai = new OpenAIApi(configuration);
const MAX_TOKENS = 256;

const app = express();
app.use(bodyParser.json())

let browser, page, jsonPhrases, motivationalMessage;

async function sendWhatsappMessage(name, body) {
    await page.type('div[title="Search input textbox"]', name);
    await page.waitForTimeout(1000);
    await page.locator('._13jwn').click();
    await page.waitForTimeout(1000);
    await page.type('div[title="Type a message"]', body);
    await page.waitForTimeout(1000);
    await page.locator('[aria-label="Send"]>>nth=0').click();
    await page.waitForTimeout(1000);
}

app.get('/login', async function (req, res) {
    browser = await chromium.launch({
        headless: false
    });
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto('https://web.whatsapp.com/');
    res.end('Browser started read the qr-code!');
});

app.get('/autoReplyUnreadMessages', async function (req, res) {
    const data = [];

    try {
        await page.locator('[aria-label="Unread"]>>nth=0', { timeout: 250 }).click();
        await page.waitForTimeout(250);

        const mainDiv = await page.evaluate(async () => document.getElementById("main").innerText);
        // The first thing is the contact name, I know that's ugly, but it's a pain inspect everything.
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

        // clear a little bit the content prior to forward to ChatGPT.
        const chatTextFlattened = elements.flat(Infinity).join(" ");

        // Use ChatGPT here!
        possibleAnswers = await openai.createCompletion({
            model: "text-davinci-003",
            max_tokens: MAX_TOKENS,
            temperature: 0.2,
            prompt: config.prompt.replaceAll("##TEXT##", chatTextFlattened)
        });

        console.log('[chatGPT response]', possibleAnswers.data.choices[0].text.replaceAll('\\n', '').trim());

        await page.type('div[title="Type a message"]', possibleAnswers.data.choices[0].text.replaceAll('\\n', '').trim());
        await page.waitForTimeout(1000);
        await page.locator('[aria-label="Send"]>>nth=0').click();
        await page.waitForTimeout(1000);

        await page.reload();
        await page.waitForTimeout(1000);

    } catch (e) {
        console.log(e)
    }

    res.json(data);
});

app.post('/sendMessage', async function (req, res) {
    const { name, body } = req.body;
    sendWhatsappMessage(name, body);
    res.end('Message has been sent!');
});

app.post('/sendMessages', async function (req, res) {
    for (let i = 0; i < req.body.length; i++) {
        await sendWhatsappMessage(req.body[i].name, req.body[i].body);
    }
    res.end('Message has been sent!');
});

app.post('/sendMotivationalMessage', async function (req, res) {
    const contacts = req.body.contacts;
    if (!jsonPhrases) {
        jsonPhrases = await fetch('https://raw.githubusercontent.com/moraislucas/MeMotive/master/phrases.json');
        motivationalMessage = JSON.parse(await jsonPhrases.text());
    }

    const randomNumber = Math.floor(Math.random() * motivationalMessage.length);
    const author = motivationalMessage[randomNumber].author;
    const message = motivationalMessage[randomNumber].quote;
    const formattedMessage = `_${message}_ (*${author}*)`;
    console.log(formattedMessage);

    for (let i = 0; i < contacts.length; i++) {
        await sendWhatsappMessage(contacts[i], formattedMessage);
    }

    res.end('Message has been sent!');
});

app.listen(3000);
