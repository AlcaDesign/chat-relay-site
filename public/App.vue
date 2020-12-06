<template lang="pug">
div
	.message-line(
		v-for="msg in messages"
		:key="msg.tags.id"
		:style="{ '--user-color': msg.tags.color }"
		:data-type="msg.tags['message-type']"
	)
		.user-meta
			.badges
				.badge(
					v-for="badge in msg.badges"
					:key="badge.type"
					:style="{ backgroundImage: badge.url }"
				)
			.user {{ msg.tags['display-name'] || msg.tags.username }}
		//- .message-colon
		.message
			.message-part(
				v-for="part in msg.parts"
				:data-part="part.type"
				:style="{ backgroundImage: part.url }"
				:title="part.isEmote ? part.name : ''"
			)
				span(v-if="!part.isEmote") {{ part.content }}
</template>

<script lang="ts">
import Vue from 'vue';
// import io from 'socket.io-client';

export default Vue.extend({
	async mounted() {
		console.log('Load badges');
		await Promise.all([
			this.getBadges(),
			this.getBadges('7676884')
		]);
		console.log('Loaded badges');
		console.log('Loading BTTV/FFZ emotes');
		await Promise.all([
			this.getBTTVEmotes(),
			this.getBTTVEmotes('7676884'),
			this.getFFZEmotes(),
			this.getFFZEmotes('alca')
		]);
		console.log('Loaded', this.bttvEmotes.length, 'BTTV emotes');
		console.log('Loaded', this.ffzEmotes.length, 'FFZ emotes');
		this.getHistory();
		this.connectSocket();
	},
	data() {
		return {
			socket: null,
			badges: { global: {} },
			messages: [],
			bttvEmotes: [],
			ffzEmotes: []
		};
	},
	methods: {
		connectSocket() {
			if(this.socket) {
				if(this.socket.readyState !== WebSocket.OPEN) {
					try {
						this.socket.close();
					} catch {}
				}
			}
			const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
			this.socket = new WebSocket(`${protocol}://${location.hostname}`);
			this.socket.addEventListener('message', ({ data }) => {
				try {
					const json = JSON.parse(data);
					const cb = { message: this.onMessage }[json.type];
					if(cb) cb(json.content);
				} catch(err) {
					console.error('Could not parse', err);
					console.log(data);
				}
			});
			this.socket.addEventListener('close', () => {
				this.connectSocket();
			});
		},
		async getHistory() {
			const res = await fetch('/api/history');
			const data = await res.json();
			data.history.forEach(this.onMessage);
		},
		parseThirdPartyEmotes(thirdPartyEmotes, emoteList, message) {
			for(const { code, id, url, provider } of thirdPartyEmotes) {
				if(!message.includes(code)) {
					continue;
				}
				for(
					let start = message.indexOf(code);
					start > -1;
					start = message.indexOf(code, start + 1)
				) {
					const end = start + code.length;
					emoteList.push({
						type: 'emote', provider,
						isEmote: true,
						name: code, start, end,
						url: `url(${url})`
					});
				}
			}
		},
		/**
		 * @param {{ tags: import('tmi.js').ChatUserstate }} param0
		 */
		onMessage({ channel, tags, message, self }) {
			const parts = [
				{ type: 'text', content: message }
			];
			const messageText = Array.from(message);
			let emoteList = [];
			if(tags.emotes) {
				const { emotes } = tags;
				for(const [ id, indicies ] of Object.entries(emotes)) {
					for(const item of indicies) {
						const spl = item.split('-');
						const start = +spl[0];
						const end = +spl[1] + 1;
						const name = messageText.slice(start, end).join('');
						emoteList.push({
							type: 'emote', provider: 'twitch',
							isEmote: true,
							name, start, end,
							url: `url('https://static-cdn.jtvnw.net/emoticons/v1/${id}/2.0')`
						});
					}
				}
			}
			this.parseThirdPartyEmotes(this.bttvEmotes, emoteList, message);
			this.parseThirdPartyEmotes(this.ffzEmotes, emoteList, message);
			if(emoteList.length) {
				emoteList.sort((a, b) => a.start - b.start);
				parts.splice(0);
				const seen = [];
				emoteList = emoteList.filter(({ start, end }) => {
					if(seen.length && !seen.every(n => start > n.end)) {
						return false;
					}
					seen.push({ start, end });
					return true;
				});
				if(emoteList[0].start !== 0) {
					parts.push({
						type: 'text',
						content: messageText.slice(0, emoteList[0].start).join('')
					});
				}
				for(let i = 0; i < emoteList.length; i++) {
					const emote = emoteList[i];
					parts.push(emote);
					const nextEmote = emoteList[i + 1] || {};
					const endContent = messageText.slice(emote.end, nextEmote.start);
					if(endContent.length) {
						parts.push({
							type: 'text',
							content: endContent.join('')
						});
					}
				}
			}
			const username = tags.username;
			const displayName = tags['display-name'];
			tags.name = displayName;
			if(displayName.toLowerCase() !== username) {
				tags.name = `${displayName} (${username})`;
			}
			const badges = [];
			if(tags.badges) {
				const badgeGroup = {
					...this.badges.global,
					...(this.badges[tags['room-id']] || {})
				};
				const badgeEntries = Object.entries(tags.badges);
				for(const [ type, version ] of badgeEntries) {
					const group = badgeGroup[type];
					if(group && version in group.versions) {
						const url = `url(${group.versions[version].image_url_2x}`;
						badges.push({ url, type });
					}
				}
			}
			this.messages.push({ tags, badges, parts });
			if(this.messages.length > 100) {
				this.messages.shift();
			}
		},
		/**
		 * @param {string} channel Twitch channel ID
		 */
		async getBadges(channel) {
			const endpoint = channel ? `channels/${channel}/display` : 'global/display';
			const url = `https://badges.twitch.tv/v1/badges/${endpoint}`;
			const res = await fetch(url);
			const data = await res.json();
			const key = channel ? channel : 'global';
			this.badges[key] = data.badge_sets;
		},
		/**
		 * @param {string} channel Twitch channel login
		 */
		async getFFZEmotes(channel) {
			const endpoint = channel ? `room/${channel}` : 'set/global';
			const url = `https://api.frankerfacez.com/v1/${endpoint}`;
			const res = await fetch(url);
			const data = await res.json();
			const emoteData = Object.values(data.sets).reduce((p, n) => [ ...p, ...n.emoticons ], []);
			emoteData.forEach(n => {
				const emote = {
					url: n.urls[2] || n.urls[1],
					code: n.name,
					provider: 'ffz'
				};
				this.ffzEmotes.push(emote);
			});
		},
		/**
		 * @param {string} channel Twitch channel ID
		 */
		async getBTTVEmotes(channel) {
			const endpoint = channel ? `users/twitch/${channel}` : 'emotes/global';
			const url = `https://api.betterttv.net/3/cached/${endpoint}`;
			const res = await fetch(url);
			const data = await res.json();
			const emoteData = !channel ? data : [ ...data.channelEmotes, ...data.sharedEmotes ];
			emoteData.forEach(n => {
				const emote = {
					url: `https://cdn.betterttv.net/emote/${n.id}/2x`,
					code: n.code,
					provider: 'bttv'
				};
				this.bttvEmotes.push(emote);
			});
		},
	}
});
</script>

<style lang="scss">
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
body {
	background: hsl(0, 0%, 8%);
	color: hsl(0, 0%, 100%);
	font-family: 'Roboto', sans-serif;
}
.message-line {
	font-size: 0;
	--user-color: white;

	& > div {
		font-size: 16px;
		vertical-align: middle;
	}
	&[data-type="action"] {
		.message {
			color: var(--user-color);
		}
		.message-colon {

			&:before {
				content: '';
			}
		}
	}
}
.user-meta {
	display: inline-flex;
	align-items: center;
	margin-right: 0.4em;

	.user {
		color: var(--user-color);
	}
}
.badges .badge,
.message-part[data-part="emote"] {
	display: inline-block;
	background-repeat: no-repeat;
	background-size: contain;
	background-position: center;
}
.badges {
	vertical-align: middle;

	.badge {
		width: 18px;
		height: 18px;
		margin-right: 2px;

		&:last-child {
			margin-right: 4px;
		}
	}
}
.message-colon {
	display: inline;

	&:before {
		content: ': ';
		margin-right: 0.5rem;
	}
}
.message {
	display: inline;
}
.message-part {
	display: inline;

	&[data-part="emote"] {
		width: 28px;
		height: 28px;
		vertical-align: middle;
	}
}
</style>