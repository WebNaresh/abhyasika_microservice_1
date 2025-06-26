// Simple WhatsApp Web.js test to isolate the issue
const { Client, LocalAuth } = require('whatsapp-web.js');

console.log('🚀 Starting simple WhatsApp Web.js test...');

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: 'test-session',
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--disable-gpu',
            '--disable-web-security',
        ],
        timeout: 180000, // 3 minutes
    },
});

client.on('loading_screen', (percent, message) => {
    console.log(`📱 Loading: ${percent}% - ${message}`);
});

client.on('change_state', (state) => {
    console.log(`📱 State: ${state}`);
});

client.on('qr', (qr) => {
    console.log('📱 QR Code generated successfully!');
    console.log('QR Length:', qr.length);
    process.exit(0);
});

client.on('ready', () => {
    console.log('✅ Client is ready!');
    process.exit(0);
});

client.on('auth_failure', (msg) => {
    console.error('❌ Auth failure:', msg);
    process.exit(1);
});

client.on('disconnected', (reason) => {
    console.error('❌ Disconnected:', reason);
    process.exit(1);
});

// Timeout after 3 minutes
setTimeout(() => {
    console.error('❌ Test timeout after 3 minutes');
    process.exit(1);
}, 180000);

console.log('🔄 Initializing client...');
client.initialize().catch(error => {
    console.error('❌ Initialization error:', error);
    process.exit(1);
});
