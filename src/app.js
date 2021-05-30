require('dotenv').config();

const mariadb = require('mariadb');
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10,
    supportBigInt: true
});

function testDB(client) {
    return pool.query().then(res => client.emit('log', `[SETUP] Connected to database <${process.env.DB_NAME}>`))
        .catch(error => client.emit('log', `[SETUP] Failed to connect to database <${process.env.DB_NAME}>`, error))
}

const { Client, Intents } = require('discord.js-commands')(require('discord.js'));
const osu = require('./index')(pool);
const client = new Client({
    token: process.env.DISCORD_TOKEN,
    publicKey: process.env.DISCORD_PUBLIC_KEY,
    intents: Intents.ALL,
    commands: osu.commands
});

client.on('log', (string, object) => { console.log(string) })
client.on('error', (error) => { console.log(error) })
client.on('ready', () => client.emit('log', `[SETUP] Logged in as <${client.user.tag}>`));
// client.once('ready', () => {
//     const command = client.commands.recent;
//     client.application.commands.create(command.json).then(res => {
//         client.emit('log', 'Posted command successfully', res);
//     }).catch(error => {
//         client.emit('error', 'Failed to posted command', error);
//     })
// });
(async () => {
    await testDB(client);
    await osu.setup(client);
    await client.login();
})();
