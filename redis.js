const redis = require('redis');
module.exports.load = async function (logger) {
    logger.info('📁 Loading configuration from redis.');
    const client = redis.createClient({ url: process.env.REDIS_URL });
    await client.connect();

    const configuration = {
        openaiBotKey: await client.get('whatsapp/openai-bot-key'),
        openaiBotChatPrompt: await client.get('whatsapp/openai-bot-chat-prompt'),
        openaiBotDallePrompt: await client.get('whatsapp/openai-bot-dalle-prompt'),
        openaiBotTemperature: parseFloat(await client.get('whatsapp/openai-bot-temperature')),
        openaiBotActivities: JSON.parse(await client.get('whatsapp/openai-bot-activities')),
        openaiBotTurnedOn: JSON.parse(await client.get('whatsapp/openai-bot-turned-on')),
        openaiBotTotalPhotosLimit: parseInt(await client.get('whatsapp/openai-bot-total-photos-limit')),
        openaiBotMaxTokens: parseInt(await client.get('whatsapp/openai-bot-max-tokens')),
        openaiBotModel: await client.get('whatsapp/openai-bot-model'),
        openaiBotName: await client.get('whatsapp/openai-bot-name'),
        openaiBotCommandPhoto: await client.get('whatsapp/openai-bot-command-photo'),
        openaiBotCommandPhotoFailed: await client.get('whatsapp/openai-bot-command-photo-failed'),
        openaiBotCommandPhotoRegex: await client.get('whatsapp/openai-bot-command-photo-regex'),
        openaiBotCommandScrape: await client.get('whatsapp/openai-bot-command-scrape'),
        openaiBotCommandScrapePrompt: await client.get('whatsapp/openai-bot-command-scrape-prompt'),
        openaiBotCommandScrapeFailed: await client.get('whatsapp/openai-bot-command-scrape-failed'),
        openaiBotCommandScrapeRegex: await client.get('whatsapp/openai-bot-command-scrape-regex'),
    }

    logger.info('📁 [DONE] Loading configuration from redis.');
    await client.disconnect();
    return configuration;
};
