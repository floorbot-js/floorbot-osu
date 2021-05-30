const { Command, Util } = require('discord.js');

module.exports = class extends Command {

    constructor(client, options) {
        super(client, Object.assign({
            group: 'osu'
        }, options));
    }

    getEmbedTemplate(interaction, data) {
        return super.getEmbedTemplate(interaction, Object.assign({
            footer: {
                text: 'Powered by god and anime',
                icon_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Osu%21Logo_%282015%29.png/600px-Osu%21Logo_%282015%29.png'
            }
        }, data));
    }

    getUser404Embed(interaction, username) {
        return this.getEmbedTemplate(interaction, {
            description: `Could not find user \`${username}\`!`
        })
    }
}
