const express = require('express');
const { chromium } = require('playwright');
const bodyParser = require('body-parser')
const fetch = require('node-fetch');

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
    await page.locator('button[data-testid="compose-btn-send"]').click();
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
