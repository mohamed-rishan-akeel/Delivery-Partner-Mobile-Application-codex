const os = require('os');
const fs = require('fs');
const path = require('path');

// 1. Paths
const configPath = path.join(__dirname, '../config.js');
const examplePath = path.join(__dirname, '../config.js.example');

// 2. Auto-create config.js if it doesn't exist
if (!fs.existsSync(configPath)) {
    if (fs.existsSync(examplePath)) {
        console.log('📝 config.js missing, creating from template...');
        fs.copyFileSync(examplePath, configPath);
    } else {
        console.error('❌ Error: Neither config.js nor config.js.example found.');
        process.exit(1);
    }
}

// 3. Find the local IPv4 address
const interfaces = os.networkInterfaces();
let ip = 'localhost';

for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
        const family = typeof net.family === 'string' ? net.family : 'IPv' + net.family;
        if (family === 'IPv4' && !net.internal) {
            ip = net.address;
            break;
        }
    }
    if (ip !== 'localhost') break;
}

// 4. Update the API_BASE_URL line in config.js
try {
    let content = fs.readFileSync(configPath, 'utf8');
    
    // This regex looks for the API_BASE_URL line and replaces the IP part
    const updatedContent = content.replace(
        /export const API_BASE_URL = 'http:\/\/.*:3000\/api';/,
        `export const API_BASE_URL = 'http://${ip}:3000/api';`
    );
    
    fs.writeFileSync(configPath, updatedContent);
    console.log(`\x1b[32m✅ Auto-configured API_BASE_URL: http://${ip}:3000/api\x1b[0m`);
} catch (error) {
    console.error('\x1b[31m❌ Failed to update IP in config.js:\x1b[0m', error.message);
}
