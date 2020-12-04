<template lang="pug">
div
	.message-line(v-for="msg in messages" :key="msg.tags.id")
		.user(
			:style="{ color: msg.tags.color || 'white' }"
		) {{ msg.tags['display-name'] || msg.tags.username }}
		div :
		.message
			div(
				class="message-part"
				v-for="part in msg.parts"
				:data-part="part.type"
				:style="{ backgroundImage: part.url }"
				:title="part.isEmote ? part.name : ''"
			)
				span(v-if="!part.isEmote") {{ part.content }}
</template>

<script lang="ts">
import Vue from 'vue';
import io from 'socket.io-client';

export default Vue.extend({
	mounted() {
		const socket = io({ transports: [ 'websocket' ] });
		// socket.set('transports', [ 'websocket' ]);
		socket.on('message', e => this.onMessage(e));
		this.getHistory();
	},
	data() {
		return {
			messages: []
		};
	},
	methods: {
		async getHistory() {
			const res = await fetch('/api/history');
			const data = await res.json();
			data.history.forEach(this.onMessage);
		},
		/**
		 * 
		 * @param {{ tags: import('tmi.js').ChatUserstate }} param0 
		 */
		onMessage({ channel, tags, message, self }) {
			const parts = [
				{ type: 'text', content: message } 
			];
			if(tags.emotes) {
				const messageText = Array.from(message);
				const { emotes } = tags;
				const emoteList = [];
				for(const [ id, indicies ] of Object.entries(emotes)) {
					for(const item of indicies) {
						const spl = item.split('-');
						const start = +spl[0];
						const end = +spl[1] + 1;
						const name = messageText.slice(start, end).join('');
						emoteList.push({
							type: 'emote', vendor: 'twitch',
							isEmote: true,
							id, name, start, end,
							url: `url('https://static-cdn.jtvnw.net/emoticons/v1/${id}/2.0')`
						});
					}
				}
				emoteList.sort((a, b) => a.start - b.start);
				parts.splice(0);
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
			this.messages.push({ tags, parts });
			if(this.messages.length > 100) {
				this.messages.shift();
			}
		}
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

	& > div {
		display: inline;
		font-size: 16px;
	}
}
.message {
	flex-grow: 1;
}
.message-part {
	display: inline;

	&[data-part="emote"] {
		display: inline-block;
		width: 28px;
		height: 28px;
		background-repeat: no-repeat;
		background-size: contain;
		vertical-align: middle;
	}
}
</style>