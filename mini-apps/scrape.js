const { chromium } = require('playwright');
const config = require('../redis');
const { Configuration, OpenAIApi } = require("openai");
const natural = require('natural');
const cleanTextUtils = require('clean-text-utils');

module.exports.run = async function (input) {
    console.log('[scrape] Requested!');

    const {
        openaiBotKey,
        openaiBotMaxTokens,
        openaiBotTemperature,
        openaiBotModel,
        openaiBotCommandScrapePrompt,
        openaiBotCommandScrapeFailed,
        openaiBotCommandScrapeRegex,
    } = await config.load();

    const regex = `(${openaiBotCommandScrapeRegex})(.*)`;
    console.log('[scrape]', regex)
    const pattern = new RegExp(regex, "gmi"); // The "i" flag makes it case-insensitive
    const resultRegex = pattern.exec(input.trim().toLowerCase())

    const url = resultRegex[2].trim();
    console.log('[scrape]', url);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { timeout: 60000 });

    // Normally, some pages puts a menu (nav element) that holds other piece of 
    // text that we don't want it from the scraper perspective.
    // Also some code elements could mess up the entire taging semantics.
    await page.evaluate(() => {
        const navElements = Array.from(document.querySelectorAll('nav'));
        const codeElements = Array.from(document.querySelectorAll('code'));
        navElements.forEach((navElement) => {
            navElement.remove();
        });
        codeElements.forEach((codeElement) => {
            codeElement.remove();
        });
    });

    let body = await page.innerText('body');
    body = cleanTextUtils.strip.emoji(body);
    body = cleanTextUtils.replace.diacritics(body);
    body = cleanTextUtils.replace.smartChars(body);
    body = body.replace(/^\s+|\s+$|\s+(?=\r?\n|\r)/gm, '').trim();
    body = body.replaceAll("\"", "\\\"");
    body = body.replaceAll("`", "\`");
    await browser.close();

    // let's tokenize it a little bit.
    const tokenizer = new natural.WordTokenizer({
        discardEmpty: false
    });

    const tokens = tokenizer.tokenize(body).slice(0, openaiBotMaxTokens);
    let content = ''
    for (const token of tokens) {
        content += `${token} `
    }

    const finalText = content.trim();
    let answer = openaiBotCommandScrapeFailed;
    try {
        const configuration = new Configuration({ apiKey: openaiBotKey });
        const openai = new OpenAIApi(configuration);
        answer = await openai.createChatCompletion({
            model: openaiBotModel,
            max_tokens: openaiBotMaxTokens,
            temperature: openaiBotTemperature,
            messages: [
                { role: "system", content: openaiBotCommandScrapePrompt },
                { role: "user", content: finalText }
            ]
        });
    }
    catch (e) {
        console.log(e);
    }
    console.log("[scrape]", answer.data.choices);
    const response = answer.data.choices[0].message.content;
    console.log('[scrape] Finished!');
    return response;
}
