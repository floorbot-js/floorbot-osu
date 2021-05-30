const OsuUtils = require('../../../lib/osu-utils');
const OsuTools = require('../../../lib/osu-tools');
const OsuApi = require('../../../lib/osu-api');
const { Util } = require('discord.js');
const DHMS = require('dhms.js');
const Osu = require('../osu');

module.exports = class extends Osu {

    constructor(client) {
        super(client, {
            name: 'recent',
            json: require('./recent.json')
        });
    }

    async execute(interaction) {
        await interaction.defer();

        const { webhook, options } = interaction;
        const username = options[0].value;

        return Promise.all([
            OsuApi.getUser({ u: username }),
            OsuApi.getUserRecent({ u: username, limit: 50 }),
            OsuApi.getUserBest({ u: username, limit: 100 })
        ]).then(userRes => {
            if (!userRes[0].length) return webhook.send(this.getUser404Embed(interaction, username));
            if (!userRes[1].length) return webhook.send(this.getEmbedTemplate(interaction, { description: `User \`${userRes[0].username}\` does not have a recent play!` }))

            const user = userRes[0][0];
            const recents = userRes[1];
            const recent = recents[0];
            const topPlays = userRes[2];

            const topIndex = topPlays.findIndex(play => play.date === recent.date);
            const ppWeight = topIndex > -1 ? (topPlays[topIndex].pp * Math.pow(0.95, topIndex)) : 0;

            return Promise.all([
                OsuApi.getBeatmaps({ b: recent.beatmap_id, mods: OsuUtils.decodeMods(recent.enabled_mods, true) }),
                OsuApi.getScores({ b: recent.beatmap_id, limit: 100 })
            ]).then(beatmapRes => {
                const beatmaps = beatmapRes[0];
                const leaderboard = beatmapRes[1];
                const leaderboardIndex = leaderboard.findIndex(play => play.date === recent.date);

                return OsuUtils.downloadBeatmap(beatmaps[0].beatmap_id).then(path => {
                    const acc = OsuUtils.getAcc(recent).toFixed(2);
                    const options = OsuUtils.decodeMods(recent.enabled_mods).map(mod => [OsuTools.MOD, mod.toLowerCase()]).flat();

                    return Promise.all([
                        OsuTools.simulate(path, options.concat([OsuTools.GOODS, recent.count100, OsuTools.MEHS, recent.count50, OsuTools.COMBO, recent.maxcombo, OsuTools.MISSES, recent.countmiss])),
                        OsuTools.simulate(path, parseInt(recent.countmiss) ? options.concat([OsuTools.GOODS, recent.count100, OsuTools.MEHS, recent.count50]) : options),
                        OsuUtils.difficulty(beatmaps[0], options)
                    ]).then(toolsRes => {
                        const [simulated, diffGoal, beatmap] = toolsRes;
                        let attempt = 0;
                        for (let r of recents) {
                            if (r.beatmap_id !== recent.beatmap_id) break;
                            attempt++;
                        }
                        const embed = this.getEmbedTemplate(interaction)
                            .setAuthor(`${user.username} - ${Util.formatCommas(Number(user.pp_raw).toFixed(2))}pp (#${Util.formatCommas(user.pp_rank)} ${user.country}#${Util.formatCommas(user.pp_country_rank)})`, `https://a.ppy.sh/${user.user_id}?${Math.floor(Math.random() * 1000)}`, `https://osu.ppy.sh/users/${user.user_id}`)
                            .setImage(`https://assets.ppy.sh/beatmaps/${beatmap.beatmapset_id}/covers/cover.jpg`)
                            .setTitle(`${beatmap.artist} - ${beatmap.title}`)
                            .setURL(`https://osu.ppy.sh/beatmapsets/${beatmap.beatmapset_id}#osu/${beatmap.beatmap_id}`)
                            .setFooter(`Beatmap set by ${beatmap.creator} | ${parseInt(beatmap.approved) > 0 ? 'Ranked' : 'Submitted'} on ${Util.formatDate(parseInt(beatmap.approved) > 0 ? `${beatmap.approved_date} UTC-0000` : `${beatmap.submit_date} UTC-0000`, true)}`, `https://a.ppy.sh/${beatmap.creator_id}?${Math.floor(Math.random() * 1000)}`)
                            .addField(`Try #${attempt}${leaderboardIndex > -1 ? ` | #${leaderboardIndex + 1} Global` : ''}${topIndex > -1 ? ` | **#${topIndex + 1} Top play (${ppWeight}pp)**` : ''}`,
                                `${OsuUtils.getRankEmoji(recent.rank)} **${simulated.pp.toFixed(2)}pp +${simulated.mods.join('')}** (${parseInt(recent.countmiss) ? 'FC ' : 'SS '} ${diffGoal.pp.toFixed(2)}pp)\n` +
                                `**${acc}%** | **${simulated.combo}x** (${simulated.max_combo}x)\n` +
                                `{ ${recent.count300} / ${recent.count100} / ${recent.count50} / ${recent.countmiss} }`,
                                false,
                            )
                            .addField(`${OsuUtils.getDiffEmoji(beatmap.difficultyrating)} [${beatmap.version}]`,
                                `SR:**${beatmap.difficultyrating}**★ BPM:**${beatmap.bpm}**\n` +
                                `CS:**${beatmap.diff_size}** AR:**${beatmap.diff_approach}** OD:**${beatmap.diff_overall}** HP:**${beatmap.diff_drain}**\n` +
                                `Length:**${DHMS.print(beatmap.total_length*1000)}** (${DHMS.print(beatmap.hit_length*1000)})`,
                                false,
                            )
                            .addField(`Set ${DHMS.print(OsuUtils.getTimeSince(recent.date), false, true)} ago`,
                                `${leaderboardIndex > -1 && parseInt(leaderboard[leaderboardIndex].replay_available) ? `[Replay](https://osu.ppy.sh/scores/osu/${leaderboard[leaderboardIndex].score_id}/download) | ` :
                                    (topIndex > -1 && parseInt(topPlays[topIndex].replay_available) ? `[Replay](https://osu.ppy.sh/scores/osu/${topPlays[topIndex].score_id}/download) | ` : '')}` +
                                `[Map](https://osu.ppy.sh/beatmapsets/${beatmap.beatmapset_id}/download)` +
                                `([no vid](https://osu.ppy.sh/beatmapsets/${beatmap.beatmapset_id}/download?noVideo=1)) | ` +
                                `[Bloodcat](http://bloodcat.com/osu/s/${beatmap.beatmapset_id})`,
                                false,
                            );
                        return interaction.webhook.send(embed);
                    });
                });
            });
        });
    }
}
