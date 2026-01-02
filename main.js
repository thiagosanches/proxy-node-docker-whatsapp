const express = require('express');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { chromium } = require('playwright');
const { createLogger, format, transports } = require('winston');
const GOOD_MORNING_CRON = process.env.GOOD_MORNING_CRON || '0 8 * * *';
const GOOD_EVENING_CRON = process.env.GOOD_EVENING_CRON || '0 18 * * *';

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
let browser, page;

const userDataPathToStoreWhatsappSession = "/tmp/whatsapp_userdata";
const app = express();
app.use(bodyParser.json());

const goodMorningMessages = [
    'file:///home/guest/app/images/bom-dia-domingo.jpeg',
    'file:///home/guest/app/images/bom-dia-segunda-feira.jpeg',
    'file:///home/guest/app/images/bom-dia-terca-feira.jpeg',
    'file:///home/guest/app/images/bom-dia-quarta-feira.jpeg',
    'file:///home/guest/app/images/bom-dia-quinta-feira.jpeg',
    'file:///home/guest/app/images/bom-dia-sexta-feira.jpeg',
    'file:///home/guest/app/images/bom-dia-sabado.jpeg',

]

const goodEveningMessages = [
    'file:///home/guest/app/images/boa-noite-domingo.jpeg',
    'file:///home/guest/app/images/boa-noite-segunda-feira.jpeg',
    'file:///home/guest/app/images/boa-noite-terca-feira.jpeg',
    'file:///home/guest/app/images/boa-noite-quarta-feira.jpeg',
    'file:///home/guest/app/images/boa-noite-quinta-feira.jpeg',
    'file:///home/guest/app/images/boa-noite-sexta-feira.jpeg',
    'file:///home/guest/app/images/boa-noite-sabado.jpeg',
]

cron.schedule(GOOD_MORNING_CRON, async () => {
    if (page) {
        logger.info("[good-morning] It's time to auto-reply!");
        await autoReply(goodMorningMessages[new Date().getDay()]);
    }
});

cron.schedule(GOOD_EVENING_CRON, async () => {
    if (page) {
        logger.info("[good-evening] It's time to auto-reply!");
        await autoReply(goodEveningMessages[new Date().getDay()]);
    }
});

async function autoReply(message) {
    try {
        const sidePanel = await page.$('#side');
        if (sidePanel) {
            await sidePanel.hover();
            for (let i = 0; i < 50; i++) {
                await page.mouse.wheel(0, 50); // Scroll down
                await page.waitForTimeout(300); // Wait between scrolls
            }
        }

        const elements = await page.evaluate(async () => {
            const results = document.querySelectorAll("span[dir=\"auto\"]");
            const list = [];
            results.forEach(element => {
                if (element.getAttribute("title") !== null)
                    list.push({ title: element.getAttribute("title") });
            });

            return list;
        });

        logger.info(`Total contacts found: ${elements.length}`);
        logger.info(`Found contacts: ${elements.map(e => e.title).join(', ')}`);

        const image = await browser.newPage();
        await image.goto(message);
        await image.keyboard.press("Control+C");
        await page.bringToFront();

        for (const element of elements) {
            logger.info(`Clicking on contact: '${element.title}'`);

            const contact = await page.$(`span[title="${element.title}"]`);
            contact.click()
            await page.waitForTimeout(2000);

            await page.keyboard.press("Control+V");
            await page.waitForTimeout(5000);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(5000);
            break;
        }
        logger.info("Auto-reply process completed.");
        await image.close();
    } catch (e) {
        logger.error(e);
    }
};

app.get('/login', async function (req, res) {
    browser = await chromium.launchPersistentContext(userDataPathToStoreWhatsappSession,
        { headless: false, permissions: ["clipboard-read", "clipboard-write"] });

    page = await browser.newPage();
    await page.goto('https://web.whatsapp.com/');
    res.end('Browser started read the qr-code, if necessary!');
});

app.listen(3002);
